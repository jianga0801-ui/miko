# Miko

**[简体中文](README.zh.md) | English**

Miko is a terminal-first AI coding agent specially optimized for the Xiaomi Mimo model, built for developers who want a fast local
workflow, a polished TUI, strong model support, and real extensibility without a
heavy desktop stack.

Miko is maintained at [jianga0801-ui/miko](https://github.com/jianga0801-ui/miko)
and is based on the OpenCode codebase from
[sst/opencode](https://github.com/sst/opencode). It keeps the parts that make
OpenCode powerful - TUI, MCP, providers, tools, sessions, and plugins - and
pushes the fork toward a cleaner local-first Miko distribution with bundled
skills, cross-platform release binaries, and Windows ergonomics.

## Why Miko

- **Specially Optimized for Xiaomi Mimo**: First-class deep optimizations for the Xiaomi Mimo large model, maximizing cache hits, fully utilizing multimodal inputs (audio, video, image), and guaranteeing premium code generation quality.
- **Open the archive and run it**: release binaries are self-contained for the
  core CLI/TUI runtime. End users do not install Bun, Node.js, or `node_modules`.
- **Terminal-native workflow**: Miko starts in the project directory, reads the
  repository, edits files, runs commands, and keeps the loop inside the terminal.
- **Model-aware runtime**: model limits, modalities, tool support, reasoning,
  variants, and provider options are normalized before requests are sent.
- **Cache-hit optimized agent loop**: prompt caching is on by default where the
  provider supports inline cache hints, reducing repeated tool/system context
  cost in long tool-use turns.
- **Built-in skills and slash commands**: project workflows such as review,
  planning, design polish, document generation, translation, changelog, and
  cleanup are available without extra setup.
- **Extensible by design**: MCP prompts, local command templates, plugins,
  provider hooks, workspace adapters, keymaps, and TUI slash commands are all
  first-class extension points.

## Xiaomi Mimo Model Deep Optimization 🚀

Miko is meticulously tailored and optimized for the **Xiaomi Mimo** large model, delivering unmatched performance and a state-of-the-art coding experience:

- **Cache-Hit Optimization**: Advanced prompt-caching strategies designed specifically for Mimo's context window. It dramatically reduces token overhead and latency during long, tool-heavy development loops by keeping system prompts, tool definitions, and repo context cached.
- **Full Multimodal Understanding**: Fully unleashes Mimo's multimodal capabilities, seamlessly processing and understanding rich inputs including images, audio, and video for visual coding, UI review, and multimodal debugging.
- **Elite Reply Quality**: Finetuned formatting prompts, system context structures, and response generation rules tailored to Mimo to ensure highly accurate, clean, structured, and production-grade code output.
- **Built-in Tavily Search**: Deeply integrated Tavily search capabilities (requires a Tavily API Key) to empower the agent to fetch up-to-date documentation, API specs, and web resources for highly precise answers.

## Install

Linux and macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/jianga0801-ui/miko/main/install | bash
miko --version
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/jianga0801-ui/miko/main/install.ps1 | iex
miko --version
```

Manual downloads are available from
[GitHub Releases](https://github.com/jianga0801-ui/miko/releases). Each release
ships Linux, macOS, Windows, glibc/musl, x64/arm64, baseline builds, and
`checksums.txt`.

See [docs/install.md](./docs/install.md) for version-pinned and manual installs.

## What Is Built In

### Agents

Miko ships with specialized agents instead of one generic prompt. The specialized built-in agents and workspaces in Miko are inspired by and refer to [opencode-workspace](https://github.com/kdcokenny/opencode-workspace):

| Agent | Role |
| --- | --- |
| `miko` | Read-only orchestrator that routes work to focused subagents. |
| `coder` | Implementation specialist for source edits, builds, tests, and fixes. |
| `explore` | Read-only codebase explorer for tracing files and logic. |
| `researcher` | External research agent for docs, APIs, package data, and web sources. |
| `reviewer` | Code and plan reviewer with severity and confidence thresholds. |
| `scribe` | Documentation, changelog, release note, PR, and user-facing prose writer. |
| `.miko/agent/triage` | GitHub issue triage agent for ownership routing. |
| `.miko/agent/duplicate-pr` | GitHub PR duplicate detector. |

### Skills

Built-in skills can be loaded by agents and are also exposed as command-style
workflows when appropriate:

| Skill | Purpose | Source |
| --- | --- | --- |
| `code-philosophy` | Internal logic and data-flow standards. | Miko builtin, this repository. |
| `frontend-philosophy` | UI and visual quality standards. | Miko builtin, this repository. |
| `code-review` | Four-layer review process: correctness, security, performance, maintainability. | Miko builtin, this repository. |
| `plan-protocol` | Implementation-plan format, citations, and progress tracking. | Miko builtin, this repository. |
| `plan-review` | Quality checks for implementation plans. | Miko builtin, this repository. |
| `impeccable` | Production-grade frontend design, critique, polish, adaptation, animation, and live variant workflows. | [pbakaus/impeccable](https://github.com/pbakaus/impeccable). |
| `kami` | Professional document, landing page, one-pager, resume, report, PDF, and slide typesetting. | [tw93/kami](https://github.com/tw93/kami). |
| `effect` | Effect v4 / effect-smol coding guidance for this repo. | Local project skill; API reference source is [Effect-TS/effect-smol](https://github.com/Effect-TS/effect-smol). |


### Slash Commands

Miko features an elegant and highly customizable slash command system. Commands can come from built-ins,
project configuration files, MCP server prompts, or custom skills.

Built-in commands:

| Command | What it does |
| --- | --- |
| `/init` | Guided `AGENTS.md` setup for a repository. |
| `/review` | Delegates code review to the reviewer agent. |

Project commands in `.miko/command`:

| Command | What it does |
| --- | --- |
| `/ai-deps` | Reports safe AI SDK dependency upgrades. |
| `/changelog` | Builds `UPCOMING_CHANGELOG.md` from structured release input. |
| `/commit` | Creates and pushes a conventional commit from current diffs. |
| `/goal` | Runs a high-thoroughness goal execution protocol. |
| `/issues` | Searches GitHub issues for related reports. |
| `/learn` | Extracts durable repo learnings into scoped `AGENTS.md` files. |
| `/plan` | Researches and saves a cited implementation plan. |
| `/rmslop` | Removes AI-generated code/documentation slop from a branch. |
| `/spellcheck` | Checks changed Markdown for spelling and grammar. |
| `/translate` | Translates changed English docs and UI copy while preserving code terms. |
| `/yolo` | Direct execution mode with verification and no planning detour. |

All active MCP prompts and custom skills are automatically registered as slash commands (`/`), providing a unified and autocompletable TUI shortcut experience.

## Model and Provider Runtime

Miko combines two model layers:

- `models.dev` catalog data for provider/model metadata, refreshed with a local
  disk cache and an in-process cache.
- Runtime provider adapters that normalize authentication, endpoint selection,
  request options, streaming events, and model capabilities.

Miko is specifically designed for the **Xiaomi Mimo** model family as its primary, fully optimized provider. It also retains a generic **OpenAI-compatible** provider adapter to support custom self-hosted endpoints, local LLM runtimes, and standard OpenAI integrations.

Miko tracks capabilities instead of treating every model as plain text:

- context, input, and output limits
- text, image, audio, video, and PDF input/output modalities (perfectly supporting Mimo's multi-modal features)
- tool-call support
- reasoning support and reasoning variants (specially optimized for Mimo's reasoning-content continuation)
- temperature support
- provider-specific endpoint type
- cost, cache read/write cost, and status metadata

Provider-specific optimizations include:

- First-class Mimo provider optimizations, integrating token usage tracking, reasoning part separation, and high-performance streaming.
- OpenAI-compatible profiles for deep integration with standard services and local mock servers.

## Cache-Hit and Context Optimizations

Miko optimizes repeated agent turns at several layers:

- **Prompt cache auto-placement**: for providers that respect inline cache
  markers, Miko places cache breakpoints at the last tool definition, last
  system part, and latest user message. This targets the stable prefix used
  repeatedly during a single tool-heavy turn.
- **Manual cache hints preserved**: explicit `cache` markers on tools, system
  parts, or messages are not overwritten.
- **Provider-aware behavior**: inline markers are applied to Mimo and other compatible paths, while providers with implicit caching or
  out-of-band cache systems are left alone.
- **Usage accounting**: usage events keep non-cached input tokens, cache-read
  tokens, cache-write tokens, reasoning tokens, visible output tokens, and raw
  provider metadata separately.
- **Model catalog cache**: `models.dev` metadata is cached on disk, guarded by a
  cross-process file lock, and refreshed in the background.
- **Local search fallback**: release builds no longer depend on downloading
  `ripgrep` at runtime; if a system `rg` is unavailable, Miko falls back to the
  built-in file search path.

## Extensibility

Miko can be extended without patching core code, fully compatible with all original OpenCode extensions:

- **MCP**: MCP prompts become slash commands; MCP tools become available through
  the agent runtime.
- **Commands**: add Markdown files under `command/` or `.miko/command/`.
- **Skills**: add `SKILL.md` directories under the configured skills paths.
- **Plugins**: register tools, provider hooks, model hooks, keymap layers,
  TUI routes, slash commands, workspace adapters, and context injectors.
- **Providers**: use bundled AI SDK providers or define OpenAI-compatible
  endpoints and provider-specific options.

## Source Development

End users should use the release installers above. Source development requires
Bun:

```bash
git clone https://github.com/jianga0801-ui/miko.git
cd miko
bun install
bun run dev
```

Run package checks from package directories. Do not run the root test script; it
intentionally exits.

```bash
cd packages/miko
bun typecheck
```

## Release

The release workflow builds self-contained archives and uploads checksums:

```bash
script/release 0.0.1
```

The same workflow also runs when a `v*` tag is pushed.

## Fork and Source Attribution

| Component | Repository |
| --- | --- |
| Current Miko repository | [jianga0801-ui/miko](https://github.com/jianga0801-ui/miko) |
| Primary upstream codebase | [sst/opencode](https://github.com/sst/opencode) |
| Historical package metadata still visible in some files | [anomalyco/miko](https://github.com/anomalyco/miko) |
| Model catalog | [models.dev](https://models.dev) |
| Built-in agent workspace references | [kdcokenny/opencode-workspace](https://github.com/kdcokenny/opencode-workspace) |
| Impeccable design skill | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) |
| Kami bundled skill | [tw93/kami](https://github.com/tw93/kami) |
| Effect reference used by local `effect` skill | [Effect-TS/effect-smol](https://github.com/Effect-TS/effect-smol) |

