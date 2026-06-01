import path from "path"
import nodeFs from "fs/promises"
import { serviceUse } from "@miko-ai/core/effect/service-use"
import { AppFileSystem } from "@miko-ai/core/filesystem"
import { Cause, Context, Effect, Fiber, Layer, Queue, Schema, Stream } from "effect"
import type { PlatformError } from "effect/PlatformError"
import { ChildProcess } from "effect/unstable/process"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"

import { CrossSpawnSpawner } from "@miko-ai/core/cross-spawn-spawner"
import { Global } from "@miko-ai/core/global"
import * as Log from "@miko-ai/core/util/log"
import { sanitizedProcessEnv } from "@miko-ai/core/util/miko-process"
import { which } from "@/util/which"
import { NonNegativeInt } from "@miko-ai/core/schema"
import { minimatch } from "minimatch"

const log = Log.create({ service: "ripgrep" })

const TimeStats = Schema.Struct({
  secs: NonNegativeInt,
  nanos: NonNegativeInt,
  human: Schema.String,
})

const Stats = Schema.Struct({
  elapsed: TimeStats,
  searches: NonNegativeInt,
  searches_with_match: NonNegativeInt,
  bytes_searched: NonNegativeInt,
  bytes_printed: NonNegativeInt,
  matched_lines: NonNegativeInt,
  matches: NonNegativeInt,
})

const PathText = Schema.Struct({
  text: Schema.String,
})

const Begin = Schema.Struct({
  type: Schema.Literal("begin"),
  data: Schema.Struct({
    path: PathText,
  }),
})

export const SearchMatch = Schema.Struct({
  path: PathText,
  lines: Schema.Struct({
    text: Schema.String,
  }),
  line_number: NonNegativeInt,
  absolute_offset: NonNegativeInt,
  submatches: Schema.Array(
    Schema.Struct({
      match: Schema.Struct({
        text: Schema.String,
      }),
      start: NonNegativeInt,
      end: NonNegativeInt,
    }),
  ),
})

export const Match = Schema.Struct({
  type: Schema.Literal("match"),
  data: SearchMatch,
})

const End = Schema.Struct({
  type: Schema.Literal("end"),
  data: Schema.Struct({
    path: PathText,
    binary_offset: Schema.NullOr(NonNegativeInt),
    stats: Stats,
  }),
})

const Summary = Schema.Struct({
  type: Schema.Literal("summary"),
  data: Schema.Struct({
    elapsed_total: TimeStats,
    stats: Stats,
  }),
})

const Result = Schema.Union([Begin, Match, End, Summary])
const decodeResult = Schema.decodeUnknownEffect(Schema.fromJsonString(Result))

export type Result = Schema.Schema.Type<typeof Result>
export type Match = Schema.Schema.Type<typeof Match>
export type Item = Match["data"]
export type Begin = Schema.Schema.Type<typeof Begin>
export type End = Schema.Schema.Type<typeof End>
export type Summary = Schema.Schema.Type<typeof Summary>
export type Row = Match["data"]

export interface SearchResult {
  items: Item[]
  partial: boolean
}

export interface FilesInput {
  cwd: string
  glob?: string[]
  hidden?: boolean
  follow?: boolean
  maxDepth?: number
  signal?: AbortSignal
}

export interface SearchInput {
  cwd: string
  pattern: string
  glob?: string[]
  limit?: number
  follow?: boolean
  file?: string[]
  signal?: AbortSignal
}

export interface TreeInput {
  cwd: string
  limit?: number
  signal?: AbortSignal
}

export interface Interface {
  readonly files: (input: FilesInput) => Stream.Stream<string, PlatformError | Error>
  readonly tree: (input: TreeInput) => Effect.Effect<string, PlatformError | Error>
  readonly search: (input: SearchInput) => Effect.Effect<SearchResult, PlatformError | Error>
}

export class Service extends Context.Service<Service, Interface>()("@miko/Ripgrep") {}

export const use = serviceUse(Service)

function env() {
  const env = sanitizedProcessEnv()
  delete env.RIPGREP_CONFIG_PATH
  return env
}

function aborted(signal?: AbortSignal) {
  const err = signal?.reason
  if (err instanceof Error) return err
  const out = new Error("Aborted")
  out.name = "AbortError"
  return out
}

function waitForAbort(signal?: AbortSignal) {
  if (!signal) return Effect.never
  if (signal.aborted) return Effect.fail(aborted(signal))
  return Effect.callback<never, Error>((resume) => {
    const onabort = () => resume(Effect.fail(aborted(signal)))
    signal.addEventListener("abort", onabort, { once: true })
    return Effect.sync(() => signal.removeEventListener("abort", onabort))
  })
}

function error(stderr: string, code: number) {
  const err = new Error(stderr.trim() || `ripgrep failed with code ${code}`)
  err.name = "RipgrepError"
  return err
}

function clean(file: string) {
  return path.normalize(file.replace(/^\.[\\/]/, ""))
}

function row(data: Row): Row {
  return {
    ...data,
    path: {
      ...data.path,
      text: clean(data.path.text),
    },
  }
}

function parse(line: string) {
  return decodeResult(line).pipe(Effect.mapError((cause) => new Error("invalid ripgrep output", { cause })))
}

function fail(queue: Queue.Queue<string, PlatformError | Error | Cause.Done>, err: PlatformError | Error) {
  Queue.failCauseUnsafe(queue, Cause.fail(err))
}

function filesArgs(input: FilesInput) {
  const args = ["--no-config", "--files", "--glob=!.git/*"]
  if (input.follow) args.push("--follow")
  if (input.hidden !== false) args.push("--hidden")
  if (input.hidden === false) args.push("--glob=!.*")
  if (input.maxDepth !== undefined) args.push(`--max-depth=${input.maxDepth}`)
  if (input.glob) {
    for (const glob of input.glob) args.push(`--glob=${glob}`)
  }
  args.push(".")
  return args
}

function searchArgs(input: SearchInput) {
  const args = ["--no-config", "--json", "--hidden", "--glob=!.git/*", "--no-messages"]
  if (input.follow) args.push("--follow")
  if (input.glob) {
    for (const glob of input.glob) args.push(`--glob=${glob}`)
  }
  if (input.limit) args.push(`--max-count=${input.limit}`)
  args.push("--", input.pattern, ...(input.file ?? ["."]))
  return args
}

function raceAbort<A, E, R>(effect: Effect.Effect<A, E, R>, signal?: AbortSignal) {
  return signal ? effect.pipe(Effect.raceFirst(waitForAbort(signal))) : effect
}

function matchesGlobs(file: string, globs?: string[]) {
  if (!globs?.length) return true
  let included = false
  let hasInclude = false
  for (const glob of globs) {
    if (glob.startsWith("!")) {
      if (minimatch(file, glob.slice(1), { dot: true })) return false
      continue
    }
    hasInclude = true
    if (minimatch(file, glob, { dot: true })) included = true
  }
  return hasInclude ? included : true
}

function isHidden(file: string) {
  return file.split(/[\\/]/).some((part) => part.startsWith("."))
}

async function fallbackFiles(input: FilesInput) {
  const out: string[] = []
  const root = path.resolve(input.cwd)

  async function visit(dir: string, depth: number): Promise<void> {
    if (input.signal?.aborted) throw aborted(input.signal)
    if (input.maxDepth !== undefined && depth > input.maxDepth) return

    const entries = await nodeFs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === ".git") continue
      if (input.signal?.aborted) throw aborted(input.signal)

      const full = path.join(dir, entry.name)
      const rel = clean(path.relative(root, full))
      if (!rel) continue
      if (input.hidden === false && isHidden(rel)) continue

      const stat = input.follow && entry.isSymbolicLink() ? await nodeFs.stat(full).catch(() => undefined) : undefined
      const directory = stat?.isDirectory() ?? entry.isDirectory()
      if (directory) {
        await visit(full, depth + 1)
        continue
      }
      if (matchesGlobs(rel, input.glob)) out.push(rel)
    }
  }

  await visit(root, 1)
  return out.sort((a, b) => a.localeCompare(b))
}

async function fallbackSearch(input: SearchInput): Promise<SearchResult> {
  const files = input.file?.length
    ? input.file.map((file) => clean(file)).filter((file) => matchesGlobs(file, input.glob))
    : await fallbackFiles({ cwd: input.cwd, glob: input.glob, hidden: true, follow: input.follow, signal: input.signal })
  const regex = new RegExp(input.pattern, "g")
  const items: Item[] = []

  for (const file of files) {
    if (input.signal?.aborted) throw aborted(input.signal)
    const full = path.resolve(input.cwd, file)
    const text = await nodeFs.readFile(full, "utf8").catch(() => undefined)
    if (text === undefined) continue

    let offset = 0
    const lines = text.split(/(?<=\n)/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      regex.lastIndex = 0
      const submatches = Array.from(line.matchAll(regex)).map((match) => ({
        match: { text: match[0] },
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      }))
      if (submatches.length) {
        items.push({
          path: { text: file },
          lines: { text: line },
          line_number: i + 1,
          absolute_offset: offset,
          submatches,
        })
        if (input.limit && items.length >= input.limit) return { items, partial: true }
      }
      offset += line.length
    }
  }

  return { items, partial: false }
}

export const layer: Layer.Layer<Service, never, AppFileSystem.Service | ChildProcessSpawner> =
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const fs = yield* AppFileSystem.Service
      const spawner = yield* ChildProcessSpawner

      const filepath = yield* Effect.cached(
        Effect.gen(function* () {
          const system = yield* Effect.sync(() => which(process.platform === "win32" ? "rg.exe" : "rg"))
          if (system && (yield* fs.isFile(system).pipe(Effect.orDie))) return system

          const target = path.join(Global.Path.bin, `rg${process.platform === "win32" ? ".exe" : ""}`)
          if (yield* fs.isFile(target).pipe(Effect.orDie)) return target

          log.info("ripgrep not found; using built-in file search fallback")
          return undefined
        }),
      )

      const check = Effect.fnUntraced(function* (cwd: string) {
        if (yield* fs.isDir(cwd).pipe(Effect.orDie)) return
        return yield* Effect.fail(
          Object.assign(new Error(`No such file or directory: '${cwd}'`), {
            code: "ENOENT",
            errno: -2,
            path: cwd,
          }),
        )
      })

      const command = Effect.fnUntraced(function* (cwd: string, args: string[]) {
        const binary = yield* filepath
        if (!binary) return
        return ChildProcess.make(binary, args, {
          cwd,
          env: env(),
          extendEnv: true,
          stdin: "ignore",
        })
      })

      const files: Interface["files"] = (input) =>
        Stream.callback<string, PlatformError | Error>((queue) =>
          Effect.gen(function* () {
            yield* Effect.forkScoped(
              Effect.gen(function* () {
                yield* check(input.cwd)
                const cmd = yield* command(input.cwd, filesArgs(input))
                if (!cmd) {
                  for (const file of yield* Effect.promise(() => fallbackFiles(input))) {
                    Queue.offerUnsafe(queue, file)
                  }
                  Queue.endUnsafe(queue)
                  return
                }
                const handle = yield* spawner.spawn(cmd)
                const stderr = yield* Stream.mkString(Stream.decodeText(handle.stderr)).pipe(Effect.forkScoped)
                const stdout = yield* Stream.decodeText(handle.stdout).pipe(
                  Stream.splitLines,
                  Stream.filter((line) => line.length > 0),
                  Stream.runForEach((line) => Effect.sync(() => Queue.offerUnsafe(queue, clean(line)))),
                  Effect.forkScoped,
                )
                const code = yield* raceAbort(handle.exitCode, input.signal)
                yield* Fiber.join(stdout)
                if (code === 0 || code === 1) {
                  Queue.endUnsafe(queue)
                  return
                }
                fail(queue, error(yield* Fiber.join(stderr), code))
              }).pipe(
                Effect.catch((err) =>
                  Effect.sync(() => {
                    fail(queue, err)
                  }),
                ),
              ),
            )
          }),
        )

      const search: Interface["search"] = Effect.fn("Ripgrep.search")(function* (input: SearchInput) {
        yield* check(input.cwd)

        const program = Effect.scoped(
          Effect.gen(function* () {
            const cmd = yield* command(input.cwd, searchArgs(input))
            if (!cmd) return yield* Effect.promise(() => fallbackSearch(input))
            const handle = yield* spawner.spawn(cmd)

            const [items, stderr, code] = yield* Effect.all(
              [
                Stream.decodeText(handle.stdout).pipe(
                  Stream.splitLines,
                  Stream.filter((line) => line.length > 0),
                  Stream.mapEffect(parse),
                  Stream.filter((item): item is Match => item.type === "match"),
                  Stream.map((item) => row(item.data)),
                  Stream.runCollect,
                  Effect.map((chunk) => [...chunk]),
                ),
                Stream.mkString(Stream.decodeText(handle.stderr)),
                handle.exitCode,
              ],
              { concurrency: "unbounded" },
            )

            if (code !== 0 && code !== 1 && code !== 2) {
              return yield* Effect.fail(error(stderr, code))
            }

            return {
              items: code === 1 ? [] : items,
              partial: code === 2,
            }
          }),
        )

        return yield* raceAbort(program, input.signal)
      })

      const tree: Interface["tree"] = Effect.fn("Ripgrep.tree")(function* (input: TreeInput) {
        log.info("tree", input)
        const list = Array.from(yield* files({ cwd: input.cwd, signal: input.signal }).pipe(Stream.runCollect))

        interface Node {
          name: string
          children: Map<string, Node>
        }

        function child(node: Node, name: string) {
          const item = node.children.get(name)
          if (item) return item
          const next = { name, children: new Map() }
          node.children.set(name, next)
          return next
        }

        function count(node: Node): number {
          return Array.from(node.children.values()).reduce((sum, child) => sum + 1 + count(child), 0)
        }

        const root: Node = { name: "", children: new Map() }
        for (const file of list) {
          if (file.includes(".miko")) continue
          const parts = file.split(path.sep)
          if (parts.length < 2) continue
          let node = root
          for (const part of parts.slice(0, -1)) {
            node = child(node, part)
          }
        }

        const total = count(root)
        const limit = input.limit ?? total
        const lines: string[] = []
        const queue: Array<{ node: Node; path: string }> = Array.from(root.children.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((node) => ({ node, path: node.name }))

        let used = 0
        for (let i = 0; i < queue.length && used < limit; i++) {
          const item = queue[i]
          lines.push(item.path)
          used++
          queue.push(
            ...Array.from(item.node.children.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((node) => ({ node, path: `${item.path}/${node.name}` })),
          )
        }

        if (total > used) lines.push(`[${total - used} truncated]`)
        return lines.join("\n")
      })

      return Service.of({ files, tree, search })
    }),
  )

export const defaultLayer = layer.pipe(
  Layer.provide(AppFileSystem.defaultLayer),
  Layer.provide(CrossSpawnSpawner.defaultLayer),
)

export * as Ripgrep from "./ripgrep"
