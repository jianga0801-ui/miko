#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")
const appDir = path.join(import.meta.dirname, "../../app")

process.chdir(dir)

const generated = await import("./generate.ts")

import { Script } from "@miko-ai/script"
import pkg from "../package.json"

const singleFlag = process.argv.includes("--single")
const baselineFlag = process.argv.includes("--baseline")
const skipInstall = process.argv.includes("--skip-install")
const sourcemapsFlag = process.argv.includes("--sourcemaps")
const plugin = createSolidTransformPlugin()
const skipEmbedWebUi = process.argv.includes("--skip-embed-web-ui") || !fs.existsSync(path.join(appDir, "package.json"))
const archiveFlag = Script.release || process.argv.includes("--archive")

const resetDir = (target: string) => {
  const resolved = path.resolve(target)
  if (!resolved.startsWith(`${dir}${path.sep}`)) {
    throw new Error(`Refusing to reset path outside package: ${resolved}`)
  }
  if (!fs.existsSync(resolved)) return
  const trash = path.join(dir, `dist-trash-${path.basename(resolved)}-${Date.now()}`)
  fs.renameSync(resolved, trash)
}

const createEmbeddedWebUIBundle = async () => {
  console.log(`Building Web UI to embed in the binary`)
  const dist = path.join(appDir, "dist")
  await $`MIKO_CHANNEL=${Script.channel} bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".map"))
    .sort()
  const imports = files.map((file, i) => {
    const spec = path.relative(dir, path.join(dist, file)).replaceAll("\\", "/")
    return `import file_${i} from ${JSON.stringify(spec.startsWith(".") ? spec : `./${spec}`)} with { type: "file" };`
  })
  const entries = files.map((file, i) => `  ${JSON.stringify(file)}: file_${i},`)
  return [
    `// Import all files as file_$i with type: "file"`,
    ...imports,
    `// Export with original mappings`,
    `export default {`,
    ...entries,
    `}`,
  ].join("\n")
}

const embeddedFileMap = skipEmbedWebUi ? null : await createEmbeddedWebUIBundle()

const allTargets: {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false,
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
    avx2: false,
  },
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "darwin",
    arch: "x64",
    avx2: false,
  },
  {
    os: "win32",
    arch: "arm64",
  },
  {
    os: "win32",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
    avx2: false,
  },
]

const osArg = process.argv.find((arg) => arg.startsWith("--os="))?.split("=")[1]
const archArg = process.argv.find((arg) => arg.startsWith("--arch="))?.split("=")[1]

const targets = osArg
  ? allTargets.filter((item) => item.os === osArg && (!archArg || item.arch === archArg) && item.avx2 !== false && item.abi === undefined)
  : singleFlag
  ? allTargets.filter((item) => {
      if (item.os !== process.platform || item.arch !== process.arch) {
        return false
      }

      // When building for the current platform, prefer a single native binary by default.
      // Baseline binaries require additional Bun artifacts and can be flaky to download.
      if (item.avx2 === false) {
        return baselineFlag
      }

      // also skip abi-specific builds for the same reason
      if (item.abi !== undefined) {
        return false
      }

      return true
    })
  : allTargets

resetDir(path.join(dir, "dist"))

const binaries: Record<string, string> = {}
if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`
  await $`bun install --os="*" --cpu="*" @ffmpeg-installer/ffmpeg@${pkg.dependencies["@ffmpeg-installer/ffmpeg"]}`
}
for (const item of targets) {
  const name = [
    pkg.name,
    // changing to win32 flags npm for some reason
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  console.log(`building ${name}`)
  await $`mkdir -p dist/${name}/bin`

  const localPath = path.resolve(dir, "node_modules/@opentui/core/parser.worker.js")
  const rootPath = path.resolve(dir, "../../node_modules/@opentui/core/parser.worker.js")
  const parserWorker = fs.realpathSync(fs.existsSync(localPath) ? localPath : rootPath)
  const workerPath = "./src/cli/cmd/tui/worker.ts"

  // Use platform-specific bunfs root path based on target OS
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [plugin],
    external: ["node-gyp"],
    format: "esm",
    minify: true,
    sourcemap: sourcemapsFlag ? "linked" : "none",
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace(pkg.name, "bun") as any,
      outfile: `dist/${name}/bin/miko`,
      execArgv: [`--user-agent=miko/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    files: embeddedFileMap ? { "miko-web-ui.gen.ts": embeddedFileMap } : {},
    entrypoints: ["./src/index.ts", parserWorker, workerPath, ...(embeddedFileMap ? ["miko-web-ui.gen.ts"] : [])],
    define: {
      MIKO_VERSION: `'${Script.version}'`,
      MIKO_MODELS_DEV: generated.modelsData,
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      MIKO_WORKER_PATH: workerPath,
      MIKO_CHANNEL: `'${Script.channel}'`,
      MIKO_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
    },
  })

  await $`cp -r builtin dist/${name}/bin/builtin`

  // Ship SnoreToast for native Windows toast notifications and for WSL: Linux
  // binaries running under WSL launch this Windows .exe via binfmt interop.
  // macOS uses `alerter` (resolved from PATH) instead, so it needs nothing here.
  if (item.os === "win32" || item.os === "linux") {
    const snoreCandidates = [
      path.join(dir, "node_modules/node-notifier/vendor/snoreToast/snoretoast-x64.exe"),
      path.join(dir, "../../node_modules/node-notifier/vendor/snoreToast/snoretoast-x64.exe"),
    ]
    const snoreSource = snoreCandidates.find((candidate) => fs.existsSync(candidate))
    if (!snoreSource) throw new Error("Missing node-notifier SnoreToast binary for notify packaging")
    const snoreDest = `dist/${name}/bin/snoretoast-x64.exe`
    await Bun.write(snoreDest, Bun.file(snoreSource))
    // Exec bit lets WSL interop launch the Windows .exe from the Linux binary.
    fs.chmodSync(snoreDest, 0o755)
  }

  // Ship a managed ffmpeg next to the binary so voice input works out of the box
  // on every platform (previously Windows-x64 only). The ffmpeg binary is the same
  // regardless of the miko binary's avx2/musl/baseline variant. @ffmpeg-installer
  // has no win32-arm64 build, so that single target falls back to a system ffmpeg.
  {
    const ffmpegExt = item.os === "win32" ? ".exe" : ""
    const ffmpegPkg = `${item.os}-${item.arch}`
    const ffmpegRoot = path.join(dir, "../../node_modules/.bun")
    const ffmpegBinary = (
      await Array.fromAsync(
        new Bun.Glob(
          `@ffmpeg-installer+${ffmpegPkg}@*/node_modules/@ffmpeg-installer/${ffmpegPkg}/ffmpeg${ffmpegExt}`,
        ).scan({ cwd: ffmpegRoot, onlyFiles: true }),
      )
    )
      .sort()
      .at(-1)
    if (ffmpegBinary) {
      const ffmpegDest = `dist/${name}/bin/ffmpeg${ffmpegExt}`
      await Bun.write(ffmpegDest, Bun.file(path.join(ffmpegRoot, ffmpegBinary)))
      // Exec bit for macOS/Linux managed ffmpeg.
      if (item.os !== "win32") fs.chmodSync(ffmpegDest, 0o755)
    } else if (item.os === "win32" && item.arch === "arm64") {
      console.warn(`No @ffmpeg-installer build for ${ffmpegPkg}; voice input will use a system ffmpeg on this target.`)
    } else {
      throw new Error(`Missing @ffmpeg-installer/${ffmpegPkg} binary for ${name}`)
    }
  }

  // Smoke test: only run if binary is for current platform
  if (item.os === process.platform && item.arch === process.arch && !item.abi) {
    const binaryPath = `dist/${name}/bin/miko`
    console.log(`Running smoke test: ${binaryPath} --version`)
    try {
      const versionOutput = await $`${binaryPath} --version`.text()
      console.log(`Smoke test passed: ${versionOutput.trim()}`)
    } catch (e) {
      console.error(`Smoke test failed for ${name}:`, e)
      process.exit(1)
    }
  }

  resetDir(path.join(dir, "dist", name, "bin", "tui"))
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: Script.version,
        preferUnplugged: true,
        os: [item.os],
        cpu: [item.arch],
      },
      null,
      2,
    ),
  )
  binaries[name] = Script.version
}

if (archiveFlag) {
  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}/bin`)
    } else {
      await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}/bin`)
    }
  }
  if (Script.release) {
    await $`gh release upload v${Script.version} ./dist/*.zip ./dist/*.tar.gz --clobber --repo ${process.env.GH_REPO}`
  }
}

export { binaries }
