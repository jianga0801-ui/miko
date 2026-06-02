# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Miko is a terminal-first AI coding agent (TUI + headless server + CLI), forked from
[sst/opencode](https://github.com/sst/opencode) and optimized for the Xiaomi Mimo model
family. It is a Bun + Turbo monorepo of TypeScript packages written largely in
[Effect](https://effect.website). End users run a self-contained release binary; this repo
is the source. See [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for the
product/contribution overview.

## Commands

Requires **Bun 1.3+** (`packageManager` is pinned to bun@1.3.14). Run `bun install` once at the root.

| Task | Command | Notes |
| --- | --- | --- |
| Run the app (dev) | `bun dev` (from root) | Local equivalent of the `miko` binary. `bun dev <dir>` runs against another directory; `bun dev .` runs in this repo. `bun dev serve`, `bun dev web`, `bun dev --help` mirror the prod subcommands. |
| Lint | `bun run lint` (root) | oxlint, config in [.oxlintrc.json](.oxlintrc.json). |
| Typecheck (all) | `bun run typecheck` (root) | `turbo typecheck`; per-package uses `tsgo --noEmit`. |
| Typecheck (one package) | `bun typecheck` from that package dir | |
| Tests | `bun test` **from `packages/miko`** (or another package), `--timeout 30000` | **Do not run `bun test` / `bun run test` from the repo root — it intentionally exits with an error.** |
| Single test | `bun test <file>` or `bun test -t "<name>"` from the package dir | |
| Build release binary | `bun run build` from `packages/miko` (or `./packages/miko/script/build.ts --single`) | Produces self-contained archives; output under `packages/miko/dist/`. |
| Regenerate SDK | `./script/generate.ts` | Required after changing the HTTP API or SDK (e.g. `packages/miko/src/server/server.ts`). |

Inspecting the TUI non-interactively: don't run `bun dev` as a blocking foreground command.
Start it under tmux instead — `tmux new-session -d -s miko-dev 'bun dev'`, read with
`tmux capture-pane -pt miko-dev`, stop with `tmux kill-session -t miko-dev`. Debugger setup
(breakpoints in server vs TUI worker thread) is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Package map

Workspaces are `packages/*` plus `packages/sdk/js`. The ones you'll touch most:

- **`packages/miko`** — the main package: CLI entry, TUI, HTTP server, session/agent runtime,
  tools, providers, MCP, LSP, plugins. This is where most feature work happens.
- **`packages/llm`** (`@miko-ai/llm`) — Effect Schema-first LLM core. Provider-native request
  building, streaming, and tool loops via a four-axis Route abstraction (Protocol / Endpoint /
  Auth / Framing). Kept independent of session concerns. See [packages/llm/AGENTS.md](packages/llm/AGENTS.md).
- **`packages/core`** (`@miko-ai/core`) — shared business logic: config, auth, provider/model
  catalog (`models.dev`), git, sessions, snapshots, plugins. Drizzle schema lives in
  `packages/core/src/**/*.sql.ts`; migrations are applied by core.
- **`packages/ui`** (`@miko-ai/ui`) — shared SolidJS components + Storybook.
- **`packages/plugin`** (`@miko-ai/plugin`), **`packages/sdk/js`** (`@miko-ai/sdk`),
  **`packages/script`** (`@miko-ai/script`) — plugin API, generated client SDK, build/release scripts.
- Other: `app`, `web`, `console`, `enterprise`, `docs`, `function`, `containers`, `http-recorder`,
  `identity`, `llm`, `extensions`, and the `effect-*-sqlite` adapters.

## Architecture (the big picture)

**Entry → CLI.** `packages/miko/src/index.ts` is the executable. It wires a yargs CLI; each
subcommand lives in `src/cli/cmd/*` (`run`, `serve`, `tui`, `agent`, `models`, `mcp`, `pr`,
`github`, `db`, …). On first run it performs a one-time SQLite JSON→DB migration.

**TUI.** `packages/miko/src/cli/cmd/tui/` is a SolidJS app rendered with
[opentui](https://github.com/sst/opentui) (`@opentui/*`). `bun dev` runs the server in a worker
thread and the TUI in the main process; `bun dev attach <url>` connects a TUI to a running server.

**Server.** `packages/miko/src/server/` exposes a Hono HTTP API (default port 4096) consumed by
the TUI, web UI, and SDK. Changing routes here means regenerating the SDK.

**Session/agent loop.** `packages/miko/src/session/` owns the orchestration:
`session/llm.ts` decides whether a request uses the AI SDK path or the native `@miko-ai/llm`
route runtime (`session/llm/{ai-sdk,native-request,native-runtime}.ts`). Tools live in
`packages/miko/src/tool/` (`read`, `edit`, `write`, `grep`, `glob`, `shell`, `task`, `skill`,
`webfetch`, Mimo's `mimo_analyze_media`, etc.) — each tool typically pairs a `.ts` implementation
with a `.txt` prompt/description file, registered in `tool/registry.ts`.

**Providers.** Two layers: `models.dev` catalog metadata (`packages/core`) plus runtime route
adapters in `packages/llm`. Miko is built primarily around **Xiaomi Mimo** — see
`packages/miko/src/provider/mimo-setup.ts` (region/key-type endpoints) and `provider/provider.ts` —
and retains a generic OpenAI-compatible adapter. Prompt-cache breakpoints are auto-placed for
compatible providers; see the README "Cache-Hit and Context Optimizations" section.

**Built-in agents, skills, commands.** Bundled prompts/workflows ship under
`packages/miko/builtin/` (`agent/`, `command/`, `skills/`). The repo's own project-level
agents/commands/skills live under `.miko/` (`agent/`, `command/`, `skills/`, `glossary/`).
MCP prompts and custom skills are auto-registered as `/` slash commands at runtime.

## Effect & module conventions

This codebase uses Effect v4 (beta) heavily. Before writing or migrating Effect code, read the
package guides — they are authoritative and detailed:

- [packages/miko/AGENTS.md](packages/miko/AGENTS.md) — module shape, runtime vs `InstanceState`,
  schemas/errors, preferred Effect services, callback boundaries.
- [packages/llm/AGENTS.md](packages/llm/AGENTS.md) — Route/Protocol architecture, provider facades,
  recorded (cassette) tests.

Highlights that catch people out:

- **No `export namespace Foo {}` for module organization.** Use flat top-level exports with a
  self-reexport at the bottom: `export * as Foo from "./foo"`. Consumers import the namespace
  projection (`import { Foo } from "@/foo/foo"`). No barrel `index.ts` in multi-sibling dirs.
- Use `makeRuntime` (`src/effect/run-service.ts`) for services; `InstanceState`
  (`src/effect/instance-state.ts`) for per-directory/per-project state needing cleanup.
- `Schema.Class` for multi-field data, `Schema.brand` for single values,
  `Schema.TaggedErrorClass` for typed errors. In `Effect.gen`, prefer `yield* new MyError(...)`.
- `Effect.fork`/`forkDaemon` don't exist in this beta — use `Effect.forkIn(scope)` / `forkScoped`.
- Prefer Effect platform services (`FileSystem`, `HttpClient`, `Path`, `Clock`, `DateTime`,
  `ChildProcessSpawner`) over raw `fs`/`fetch`/process wrappers.

## Code style (from CONTRIBUTING.md)

Prettier: no semicolons, `printWidth: 120`. Conventional-commit PR titles with optional package
scope (`fix(miko): …`). General preferences: avoid `else`; prefer `.catch(...)` over `try/catch`;
avoid unnecessary destructuring; immutable patterns over `let`; precise types, avoid `any`;
concise single-word identifiers; use Bun helpers (`Bun.file()`) where they fit.
