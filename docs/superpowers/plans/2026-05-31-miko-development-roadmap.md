# Miko Development Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current TypeScript/Bun OpenCode fork into Miko: a WSL-first, terminal-centric MiMo coding agent with a stable MVP, clear branding, MiMo provider support, and later voice/multimodal polish.

**Architecture:** Keep the existing monorepo and runtime boundaries. Treat `packages/opencode` as the CLI/TUI/server shell, `packages/core` as shared config/provider/project state, `packages/llm` as the native LLM protocol layer, and `packages/app`/`packages/ui`/`packages/desktop` as visual surfaces. Do not rewrite the fork as Go; the current repository is a TypeScript/Bun codebase.

**Tech Stack:** Bun 1.3.14, TypeScript, Effect, AI SDK, `@opencode-ai/llm`, OpenTUI, Solid/Vite, Electron, Turbo, SQLite/Drizzle.

---

## Current Project Inventory

### Verified Facts

- Repository path: `/home/linuu/Code/miko` in WSL, exposed to Windows as `\\wsl.localhost\Ubuntu-26.04\home\linuu\Code\miko`.
- Git branch: `dev`, tracking `origin/dev`.
- Git remote currently points to `https://github.com/sst/opencode.git`, not `jianga0801-ui/miko`.
- WSL git status currently shows `AGENTS.md` modified and `docs/` untracked.
- Windows PowerShell over the UNC path can show noisy file-type changes for symlink-like assets. Prefer WSL git commands for this repo.
- `bun.lock` exists, but `bun` is not installed in the WSL environment and `node_modules` is missing.
- Root `package.json` intentionally blocks root tests with `test: echo 'do not run tests from root' && exit 1`.
- Existing `docs/implementation_plan.md` describes a Go-based `sst/opencode` fork. That does not match the current codebase.

### Package Map

| Area | Main Paths | Responsibility |
| --- | --- | --- |
| CLI/TUI/server runtime | `packages/opencode/src`, `packages/opencode/package.json` | Primary executable, commands, server, session loop, tools, project bootstrapping |
| Shared core | `packages/core/src`, `packages/core/package.json` | Provider config, model metadata, global paths, project/account/database abstractions |
| LLM protocol layer | `packages/llm/src`, `packages/llm/package.json` | Native provider protocols, request/event schemas, route executor |
| Web app shell | `packages/app/src`, `packages/app/package.json` | Solid/Vite app UI used by web and desktop surfaces |
| Shared UI | `packages/ui/src`, `packages/ui/package.json` | Reusable UI components, theme, icons, session diff rendering |
| Desktop | `packages/desktop`, `packages/desktop/package.json` | Electron packaging and native desktop app wrapper |
| SDK | `packages/sdk/js`, `packages/sdk/openapi.json` | Generated JS SDK and API contracts |
| Plugin API | `packages/plugin/src`, `packages/plugin/package.json` | Public plugin surface and TUI/tool plugin types |
| Installer/release | `install`, `script/*`, `github/*`, `sdks/vscode/*` | Distribution scripts, release helpers, extension publishing |

### Current LLM Integration Shape

- Default LLM execution still flows through AI SDK in `packages/opencode/src/session/llm.ts`.
- Adapter boundary is documented in `packages/opencode/src/session/llm/AGENTS.md`.
- AI SDK stream events are normalized in `packages/opencode/src/session/llm/ai-sdk.ts`.
- Native opt-in request lowering lives in `packages/opencode/src/session/llm/native-request.ts` and `packages/opencode/src/session/llm/native-runtime.ts`.
- OpenAI-compatible native support already exists in `packages/llm/src/providers/openai-compatible.ts` and `packages/llm/src/protocols/openai-compatible-chat.ts`.
- Reasoning continuation already has a useful seam in `packages/opencode/src/provider/transform.ts`: interleaved reasoning can be sent back through `providerOptions.openaiCompatible.reasoning_content`.

## Strategic Decisions

1. Build the TypeScript fork that is actually present. Do not use the Go file layout from `docs/implementation_plan.md`.
2. Start with user-visible Miko branding and MiMo as a first-class provider. Keep internal `@opencode-ai/*` workspace package names for the first MVP to avoid a large import churn.
3. Do not delete existing providers until MiMo MVP passes. First set Miko defaults and allow `enabled_providers`/`disabled_providers` to restrict behavior. Pruning providers is a later release-hardening phase.
4. Treat `reasoning_content` continuity as part of MiMo MVP, not an enhancement.
5. Keep MCP, plugins, skills, commands, permissions, project/worktree support, and file tools intact unless a failing test proves they block Miko.

## Success Criteria

- `miko --version`, `miko --help`, and the main TUI identify as Miko.
- A fresh WSL install can run `bun install`, package typechecks, and targeted tests.
- A `miko.json` or `.miko/` project config can select MiMo without requiring OpenCode branding.
- MiMo supports single-turn chat, multi-turn reasoning continuation, tool calling, and OpenAI-compatible streaming.
- README and docs match the TypeScript/Bun implementation.
- Release scripts and installer do not publish or install under the wrong owner or command name.

---

## Phase 0: Baseline And Workspace Truth

**Goal:** Make the repository runnable and remove planning ambiguity before feature work.

**Files:**
- Read: `package.json`
- Read: `packages/*/package.json`
- Read: `docs/implementation_plan.md`
- Read: `AGENTS.md`
- Potentially modify after confirmation: `.git/config`

- [x] **Step 1: Verify WSL tooling**

Run:

```bash
cd /home/linuu/Code/miko
bun --version
git status --short --branch
git remote -v
```

Expected current result:

```txt
bash: bun: command not found
## dev...origin/dev
origin https://github.com/sst/opencode.git
```

- [x] **Step 2: Install Bun in WSL**

Run only in WSL:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

Expected: `bun --version` prints `1.3.14` or a newer compatible version. If a newer version is installed, keep it unless a repository test fails specifically because of Bun version drift.

- [x] **Step 3: Install dependencies**

Run:

```bash
cd /home/linuu/Code/miko
bun install
test -d node_modules && echo "node_modules ready"
```

Expected: install succeeds and `node_modules ready` is printed.

- [x] **Step 4: Confirm remote target before changing it**

Current remote is upstream OpenCode. Before changing `.git/config`, confirm whether the target repo already exists.

Run:

```bash
cd /home/linuu/Code/miko
git remote -v
```

If the desired remote is `https://github.com/jianga0801-ui/miko.git`, run after user confirmation:

```bash
git remote set-url origin https://github.com/jianga0801-ui/miko.git
git remote -v
```

Expected: both fetch and push remotes point to `jianga0801-ui/miko.git`.

- [x] **Step 5: Establish verification baseline**

Run from package directories only:

```bash
cd /home/linuu/Code/miko/packages/core
bun typecheck
bun test test/config/provider.test.ts test/plugin/provider-openai-compatible.test.ts
```

```bash
cd /home/linuu/Code/miko/packages/llm
bun typecheck
bun test test/provider/openai-compatible-chat.test.ts test/route.test.ts
```

```bash
cd /home/linuu/Code/miko/packages/opencode
bun typecheck
bun test test/provider/transform.test.ts test/config/config.test.ts test/cli/error.test.ts
```

Expected: commands pass before feature work starts. If they fail, fix only the failing baseline issue before moving on.

Commit:

```bash
git add docs/superpowers/plans/2026-05-31-miko-development-roadmap.md
git commit -m "docs: add miko development roadmap"
```

---

## Phase 1: Replace Stale Project Plan With TypeScript Truth

**Goal:** Make project docs match the actual repository so future agents do not implement against a Go phantom.

**Files:**
- Modify: `docs/implementation_plan.md`
- Modify: `README.md`
- Modify: `README.zh.md`
- Modify: `AGENTS.md` only if current local edits need alignment

- [ ] **Step 1: Rewrite `docs/implementation_plan.md` around the TypeScript monorepo**

Required content:

```md
# Miko TypeScript Fork Implementation Plan

Miko is a TypeScript/Bun fork of OpenCode. The runtime is centered on `packages/opencode`, shared provider/config state lives in `packages/core`, native LLM protocols live in `packages/llm`, and app surfaces live in `packages/app`, `packages/ui`, and `packages/desktop`.

The previous Go-oriented plan is obsolete for this repository.
```

Verification:

```bash
cd /home/linuu/Code/miko
rg -n "go.mod|cmd/root.go|internal/llm|Bubble Tea|Go 1.24" docs/implementation_plan.md
```

Expected: no matches.

- [ ] **Step 2: Update README first screen**

Change the README heading and first paragraph to Miko. Keep a short attribution sentence:

```md
# Miko

Miko is a WSL-first, terminal-centric AI coding agent forked from OpenCode and focused on Xiaomi MiMo model support.

This project is not affiliated with the OpenCode team.
```

Verification:

```bash
cd /home/linuu/Code/miko
rg -n "opencode.ai|anomalyco/opencode|sst/opencode|opencode-ai@latest" README.md README.zh.md
```

Expected: only attribution or migration notes remain.

- [ ] **Step 3: Run doc-sensitive checks**

Run:

```bash
cd /home/linuu/Code/miko
git diff -- docs/implementation_plan.md README.md README.zh.md AGENTS.md
```

Expected: every changed line is documentation truth, not implementation progress.

Commit:

```bash
git add docs/implementation_plan.md README.md README.zh.md AGENTS.md
git commit -m "docs: align miko plan with typescript fork"
```

---

## Phase 2: Minimal User-Visible Rebrand

**Goal:** Make the executable and user-facing strings say Miko while keeping internal workspace package names stable for MVP.

**Files:**
- Modify: `package.json`
- Modify: `packages/opencode/package.json`
- Modify: `packages/opencode/src/index.ts`
- Modify: `packages/opencode/src/cli/ui.ts`
- Modify: `packages/opencode/src/cli/logo.ts`
- Create: `packages/opencode/bin/miko`
- Keep initially: `packages/opencode/bin/opencode`
- Modify: `install`
- Test: `packages/opencode/test/cli/*.test.ts`

- [ ] **Step 1: Add primary `miko` bin without removing `opencode` yet**

In `packages/opencode/package.json`, set:

```json
"bin": {
  "miko": "./bin/miko",
  "opencode": "./bin/opencode"
}
```

Create `packages/opencode/bin/miko` with the same launcher behavior as `packages/opencode/bin/opencode`, changing only the file name and command label if the script contains one.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/cli/account.test.ts test/cli/error.test.ts
```

Expected: CLI tests still pass.

- [ ] **Step 2: Change yargs script name**

In `packages/opencode/src/index.ts`, change:

```ts
.scriptName("opencode")
```

to:

```ts
.scriptName("miko")
```

Also update `show()` so help output detection uses `miko `.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun --conditions=browser src/index.ts --help | head -40
```

Expected: help output starts with `miko`, not `opencode`.

- [ ] **Step 3: Update installer command and install directory**

In `install`, change:

```sh
APP=opencode
INSTALL_DIR=$HOME/.opencode/bin
```

to:

```sh
APP=miko
INSTALL_DIR=$HOME/.miko/bin
```

Update GitHub release URLs only after Phase 8 confirms the release repository.

Verification:

```bash
cd /home/linuu/Code/miko
bash -n install
rg -n "APP=opencode|\\.opencode/bin|which opencode|opencode --version" install
```

Expected: no active installer paths still use `opencode`; compatibility notes may remain only if explicitly documented.

- [ ] **Step 4: Rebrand visible CLI logo and messages**

Update `packages/opencode/src/cli/ui.ts` and `packages/opencode/src/cli/logo.ts` so startup/help branding says `Miko`.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun typecheck
```

Expected: typecheck passes.

Commit:

```bash
git add package.json packages/opencode/package.json packages/opencode/bin/miko packages/opencode/src/index.ts packages/opencode/src/cli/ui.ts packages/opencode/src/cli/logo.ts install
git commit -m "feat(cli): add miko command branding"
```

---

## Phase 3: Miko Config Namespace

**Goal:** Support `miko.json`, `.miko/`, and `MIKO_*` environment variables without breaking existing users during migration.

**Files:**
- Modify: `packages/core/src/global.ts`
- Modify: `packages/core/src/flag/flag.ts`
- Modify: `packages/opencode/src/config/paths.ts`
- Modify: `packages/opencode/src/config/config.ts`
- Test: `packages/core/test/global.test.ts`
- Test: `packages/opencode/test/config/config.test.ts`

- [ ] **Step 1: Add Miko app paths**

In `packages/core/src/global.ts`, change the app constant:

```ts
const app = "miko"
```

Then add compatibility only where needed through explicit legacy lookup in config paths, not by keeping the global app as `opencode`.

Verification:

```bash
cd /home/linuu/Code/miko/packages/core
bun test test/global.test.ts
```

Expected: path expectations are updated to `miko`.

- [ ] **Step 2: Add `MIKO_*` flags while keeping legacy `OPENCODE_*` fallback**

In `packages/core/src/flag/flag.ts`, for each renamed user-facing variable, read Miko first and OpenCode second. Example:

```ts
const env = (primary: string, legacy: string) => process.env[primary] ?? process.env[legacy]
```

Use it for config, server, database, and client flags. Do not rename internal object property names in the same change; keep the diff small.

Verification:

```bash
cd /home/linuu/Code/miko/packages/core
bun typecheck
```

Expected: typecheck passes.

- [ ] **Step 3: Support `.miko` and `miko.json` project config**

In `packages/opencode/src/config/paths.ts`, search both current and legacy names:

```ts
targets: [`${name}.jsonc`, `${name}.json`]
```

Callers should pass `miko` as the primary config name after the CLI rename. Directory lookup should prefer `.miko` before `.opencode`.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/config/config.test.ts
```

Expected: tests cover `miko.json`, `.miko`, and legacy `.opencode` fallback.

Commit:

```bash
git add packages/core/src/global.ts packages/core/src/flag/flag.ts packages/opencode/src/config/paths.ts packages/opencode/src/config/config.ts packages/core/test/global.test.ts packages/opencode/test/config/config.test.ts
git commit -m "feat(config): add miko config namespace"
```

---

## Phase 4: MiMo Provider MVP

**Goal:** Add a first-class MiMo provider using the existing OpenAI-compatible path, including region routing and reasoning continuation.

**Files:**
- Create: `packages/core/src/plugin/provider/mimo.ts`
- Modify: `packages/core/src/plugin/provider.ts`
- Modify: `packages/core/src/provider.ts`
- Modify: `packages/opencode/src/provider/provider.ts`
- Modify: `packages/opencode/src/provider/transform.ts`
- Test: `packages/core/test/plugin/provider-mimo.test.ts`
- Test: `packages/opencode/test/provider/transform.test.ts`
- Test: `packages/llm/test/provider/openai-compatible-chat.test.ts`

- [ ] **Step 1: Register provider ID**

In `packages/core/src/provider.ts`, add:

```ts
mimo: schema.make("mimo"),
```

Verification:

```bash
cd /home/linuu/Code/miko/packages/core
bun typecheck
```

Expected: typecheck passes.

- [ ] **Step 2: Add MiMo provider plugin**

Create `packages/core/src/plugin/provider/mimo.ts` as a small wrapper around OpenAI-compatible behavior. The provider must:

- Use provider id `mimo`.
- Read `MIMO_API_KEY`.
- Read optional `MIMO_REGION`.
- Route `sk-` keys to `https://api.xiaomimimo.com/v1`.
- Route `tp-` keys with `cn`, `sgp`, or `ams` to the matching token-plan endpoint.
- Expose MiMo model entries with `reasoning: true`, `tool_call: true`, and `interleaved: { field: "reasoning_content" }`.

Test first in `packages/core/test/plugin/provider-mimo.test.ts` with cases for `sk-`, `tp-` + `cn`, missing key, and model metadata.

Verification:

```bash
cd /home/linuu/Code/miko/packages/core
bun test test/plugin/provider-mimo.test.ts
```

Expected: all MiMo provider plugin tests pass.

- [ ] **Step 3: Register plugin in provider list**

In `packages/core/src/plugin/provider.ts`, import and add `MimoPlugin` before `DynamicProviderPlugin`.

Verification:

```bash
cd /home/linuu/Code/miko/packages/core
bun test test/plugin/provider-mimo.test.ts test/plugin/provider-openai-compatible.test.ts
```

Expected: MiMo and OpenAI-compatible tests pass.

- [ ] **Step 4: Preserve `reasoning_content` across turns**

Extend `packages/opencode/test/provider/transform.test.ts` with a MiMo-style assistant message containing a reasoning part and a text part. Expected transformed message:

```ts
{
  role: "assistant",
  content: [{ type: "text", text: "visible answer" }],
  providerOptions: {
    openaiCompatible: {
      reasoning_content: "hidden chain state"
    }
  }
}
```

If the existing interleaved transform already passes this test, do not change implementation.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/provider/transform.test.ts
```

Expected: MiMo reasoning continuity test passes.

- [ ] **Step 5: Verify OpenAI-compatible protocol behavior**

Run:

```bash
cd /home/linuu/Code/miko/packages/llm
bun test test/provider/openai-compatible-chat.test.ts
```

Expected: existing OpenAI-compatible chat behavior remains green.

Commit:

```bash
git add packages/core/src/plugin/provider/mimo.ts packages/core/src/plugin/provider.ts packages/core/src/provider.ts packages/opencode/src/provider/provider.ts packages/opencode/src/provider/transform.ts packages/core/test/plugin/provider-mimo.test.ts packages/opencode/test/provider/transform.test.ts
git commit -m "feat(core): add mimo provider"
```

---

## Phase 5: MiMo Default Experience

**Goal:** Make Miko usable out of the box with MiMo while preserving advanced config escape hatches.

**Files:**
- Modify: `packages/opencode/src/config/config.ts`
- Modify: `packages/app/src/components/dialog-select-provider.tsx`
- Modify: `packages/app/src/components/dialog-select-model.tsx`
- Modify: `packages/app/src/i18n/en.ts`
- Modify: `packages/app/src/i18n/zh.ts`
- Test: `packages/opencode/test/config/config.test.ts`
- Test: `packages/app/src/components/dialog-select-provider.tsx` related tests if present

- [ ] **Step 1: Add documented config example**

Add this example to the implementation docs and README:

```json
{
  "model": "mimo/mimo-v2.5-pro",
  "provider": {
    "mimo": {
      "options": {
        "apiKey": "{env:MIMO_API_KEY}",
        "region": "{env:MIMO_REGION}"
      }
    }
  }
}
```

Verification:

```bash
cd /home/linuu/Code/miko
rg -n "mimo/mimo-v2.5-pro|MIMO_API_KEY|MIMO_REGION" README.md docs/implementation_plan.md
```

Expected: all three strings are documented.

- [ ] **Step 2: Put MiMo first in provider/model selection**

Update provider selection UI so MiMo appears before generic OpenAI-compatible providers when available.

Verification:

```bash
cd /home/linuu/Code/miko/packages/app
bun test:unit
```

Expected: unit tests pass.

- [ ] **Step 3: Keep explicit user provider restrictions working**

Add config tests that prove `enabled_providers: ["mimo"]` hides other providers and `disabled_providers: ["mimo"]` hides MiMo.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/config/config.test.ts
```

Expected: provider restriction tests pass.

Commit:

```bash
git add README.md docs/implementation_plan.md packages/opencode/src/config/config.ts packages/app/src/components/dialog-select-provider.tsx packages/app/src/components/dialog-select-model.tsx packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/opencode/test/config/config.test.ts
git commit -m "feat(app): make mimo the default provider path"
```

---

## Phase 6: WSL-First Runtime Hardening

**Goal:** Make Windows host plus WSL usage predictable and explicit.

**Files:**
- Modify: `packages/opencode/src/file/ripgrep.ts`
- Modify: `packages/opencode/src/shell/shell.ts`
- Modify: `packages/opencode/src/pty/pty.bun.ts`
- Modify: `packages/opencode/src/util/filesystem.ts`
- Modify: `README.zh.md`
- Test: `packages/opencode/test/file/ripgrep.test.ts`
- Test: `packages/opencode/test/pty/pty-shell.test.ts`
- Test: `packages/opencode/test/filesystem/filesystem.test.ts`

- [ ] **Step 1: Document supported launch modes**

README must describe:

- Running Miko inside WSL as the primary path.
- Avoiding PowerShell operations over UNC paths for git status and tests.
- Using Windows only as a host/editor surface.

Verification:

```bash
cd /home/linuu/Code/miko
rg -n "WSL|UNC|PowerShell|/home/linuu/Code/miko" README.zh.md README.md
```

Expected: WSL guidance is present.

- [ ] **Step 2: Add path behavior tests before changing runtime code**

Add tests for WSL paths and Windows UNC paths in the specific modules that normalize paths or spawn shells.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/file/ripgrep.test.ts test/pty/pty-shell.test.ts test/filesystem/filesystem.test.ts
```

Expected: new tests fail only if current code mishandles the path case being fixed.

- [ ] **Step 3: Implement minimal runtime fixes**

Only change code required by failing tests. Avoid broad shell abstraction rewrites.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/file/ripgrep.test.ts test/pty/pty-shell.test.ts test/filesystem/filesystem.test.ts
bun typecheck
```

Expected: path tests and typecheck pass.

Commit:

```bash
git add README.md README.zh.md packages/opencode/src/file/ripgrep.ts packages/opencode/src/shell/shell.ts packages/opencode/src/pty/pty.bun.ts packages/opencode/src/util/filesystem.ts packages/opencode/test/file/ripgrep.test.ts packages/opencode/test/pty/pty-shell.test.ts packages/opencode/test/filesystem/filesystem.test.ts
git commit -m "fix(opencode): harden wsl path handling"
```

---

## Phase 7: Voice And Multimodal After MVP

**Goal:** Add TTS and media understanding after text/tool MiMo is stable.

**Files:**
- Create: `packages/opencode/src/tool/speak.ts`
- Create: `packages/opencode/src/tool/speak.txt`
- Modify: `packages/opencode/src/tool/registry.ts`
- Modify: `packages/opencode/src/util/media.ts`
- Modify: `packages/llm/src/schema/messages.ts`
- Modify: `packages/llm/src/protocols/openai-compatible-chat.ts`
- Modify: `packages/app/src/components/prompt-input.tsx`
- Modify: `packages/ui/src/components/*` only for reusable audio/media UI
- Test: `packages/opencode/test/tool/*.test.ts`
- Test: `packages/llm/test/provider/openai-compatible-chat.test.ts`
- Test: `packages/app/src/utils/runtime-adapters.test.ts`

- [ ] **Step 1: Add media request tests**

Add protocol tests that send image/audio/video message parts through OpenAI-compatible chat without dropping metadata.

Verification:

```bash
cd /home/linuu/Code/miko/packages/llm
bun test test/provider/openai-compatible-chat.test.ts
```

Expected: test fails before protocol support if media is currently dropped.

- [ ] **Step 2: Add `speak` tool with file output first**

Implement `speak` so it writes an audio file path and returns a structured result. Terminal autoplay can be added after file output passes tests.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/tool/speak.test.ts
```

Expected: generated file path and tool result shape are stable.

- [ ] **Step 3: Add terminal playback as optional behavior**

Use Linux playback commands only when present. If neither `paplay` nor `aplay` exists, return the saved file path without failing the conversation.

Verification:

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/tool/speak.test.ts
```

Expected: tests cover both playback-command-present and playback-command-missing cases without shelling out to real audio devices.

Commit:

```bash
git add packages/opencode/src/tool/speak.ts packages/opencode/src/tool/speak.txt packages/opencode/src/tool/registry.ts packages/opencode/src/util/media.ts packages/llm/src/schema/messages.ts packages/llm/src/protocols/openai-compatible-chat.ts packages/app/src/components/prompt-input.tsx packages/opencode/test/tool/speak.test.ts packages/llm/test/provider/openai-compatible-chat.test.ts packages/app/src/utils/runtime-adapters.test.ts
git commit -m "feat(opencode): add mimo voice and media support"
```

---

## Phase 8: Visual Polish For TUI And App

**Goal:** Make Miko feel intentionally designed without destabilizing workflows.

**Files:**
- Modify: `packages/opencode/src/cli/logo.ts`
- Modify: `packages/opencode/src/cli/ui.ts`
- Modify: `packages/app/src/index.css`
- Modify: `packages/app/src/components/titlebar.tsx`
- Modify: `packages/app/src/components/status-popover.tsx`
- Modify: `packages/ui/src/theme/*`
- Test: `packages/app/src/theme-preload.test.ts`
- Test: `packages/app/src/components/titlebar-history.test.ts`
- Test: `packages/app/src/components/titlebar-session-events.test.ts`

- [ ] **Step 1: Define restrained Miko theme tokens**

Use existing theme files. Avoid a one-hue purple/blue theme. Add tokens for accent, status, warning, surface, text, and muted text.

Verification:

```bash
cd /home/linuu/Code/miko/packages/ui
bun typecheck
```

Expected: theme exports compile.

- [ ] **Step 2: Update title/status surfaces**

Use concise UI text:

```txt
Miko
MiMo ready
WSL
```

Do not add in-app explanatory copy for keyboard shortcuts or feature descriptions.

Verification:

```bash
cd /home/linuu/Code/miko/packages/app
bun test:unit
bun build
```

Expected: unit tests and build pass.

Commit:

```bash
git add packages/opencode/src/cli/logo.ts packages/opencode/src/cli/ui.ts packages/app/src/index.css packages/app/src/components/titlebar.tsx packages/app/src/components/status-popover.tsx packages/ui/src/theme packages/app/src/theme-preload.test.ts packages/app/src/components/titlebar-history.test.ts packages/app/src/components/titlebar-session-events.test.ts
git commit -m "feat(ui): apply miko visual identity"
```

---

## Phase 9: Installer, Desktop, SDK, And Release Readiness

**Goal:** Ensure the project can be installed, packaged, and published under Miko without leaking OpenCode release targets.

**Files:**
- Modify: `install`
- Modify: `packages/desktop/package.json`
- Modify: `packages/desktop/electron-builder.config.ts`
- Modify: `packages/sdk/js/package.json`
- Modify: `packages/sdk/js/script/build.ts`
- Modify: `packages/sdk/openapi.json` only through generation
- Modify: `github/action.yml`
- Modify: `github/script/publish`
- Modify: `github/script/release`
- Modify: `script/publish.ts`
- Modify: `script/release`

- [ ] **Step 1: Confirm publication owner**

Run:

```bash
cd /home/linuu/Code/miko
git remote -v
gh auth status
```

Expected: authenticated GitHub user can push to `jianga0801-ui/miko`. If not, stop release work.

- [ ] **Step 2: Update desktop metadata**

Change desktop product name, author, homepage, artifact names, and update URLs to Miko targets.

Verification:

```bash
cd /home/linuu/Code/miko/packages/desktop
bun typecheck
bun build
```

Expected: desktop build passes.

- [ ] **Step 3: Regenerate SDK only after API naming changes**

Run:

```bash
cd /home/linuu/Code/miko
./packages/sdk/js/script/build.ts
cd packages/sdk/js
bun typecheck
```

Expected: generated SDK compiles and git diff contains generated API changes only where expected.

- [ ] **Step 4: Run release grep**

Run:

```bash
cd /home/linuu/Code/miko
rg -n "anomalyco/opencode|sst/opencode|opencode.ai|opencode-desktop|opencode-ai|OPENCODE_INSTALL_DIR|\\.opencode/bin" install packages/desktop github script packages/sdk README.md README.zh.md
```

Expected: remaining matches are compatibility notes or internal package names intentionally deferred past MVP.

Commit:

```bash
git add install packages/desktop packages/sdk github script README.md README.zh.md
git commit -m "chore: prepare miko release metadata"
```

---

## Phase 10: Provider Pruning And Dependency Slimming

**Goal:** Reduce non-MiMo provider surface only after MiMo is working and release metadata is correct.

**Files:**
- Modify: `packages/core/src/plugin/provider.ts`
- Modify: `packages/opencode/src/provider/provider.ts`
- Modify: `packages/opencode/package.json`
- Modify: `packages/core/package.json`
- Modify: `package.json`
- Modify: `bun.lock`
- Test: provider tests under `packages/core/test/plugin`
- Test: provider tests under `packages/opencode/test/provider`

- [ ] **Step 1: Decide policy**

Choose one:

```txt
Policy A: keep all providers available, but Miko defaults to MiMo.
Policy B: ship only MiMo and OpenAI-compatible provider support.
```

Recommended for MVP: Policy A.

- [ ] **Step 2: If choosing Policy B, delete tests and dependencies in one focused branch**

Before deleting anything, list the scope:

```bash
cd /home/linuu/Code/miko
rg -n "@ai-sdk/anthropic|@ai-sdk/google|@ai-sdk/amazon-bedrock|@openrouter/ai-sdk-provider|ProviderPlugins" packages package.json
```

Then remove only the provider plugins, imports, dependencies, and tests for providers that are intentionally unsupported.

Verification:

```bash
cd /home/linuu/Code/miko/packages/core
bun test test/plugin/provider-mimo.test.ts test/plugin/provider-openai-compatible.test.ts
bun typecheck
```

```bash
cd /home/linuu/Code/miko/packages/opencode
bun test test/provider/provider.test.ts test/provider/transform.test.ts
bun typecheck
```

Expected: supported provider tests pass; removed provider tests are gone.

Commit:

```bash
git add packages/core/src/plugin/provider.ts packages/opencode/src/provider/provider.ts packages/opencode/package.json packages/core/package.json package.json bun.lock packages/core/test/plugin packages/opencode/test/provider
git commit -m "refactor(core): slim provider surface for miko"
```

---

## Final Verification Matrix

Run this before tagging an MVP:

```bash
cd /home/linuu/Code/miko/packages/core
bun typecheck
bun test
```

```bash
cd /home/linuu/Code/miko/packages/llm
bun typecheck
bun test
```

```bash
cd /home/linuu/Code/miko/packages/opencode
bun typecheck
bun test --timeout 30000
```

```bash
cd /home/linuu/Code/miko/packages/app
bun typecheck
bun test:unit
bun build
```

```bash
cd /home/linuu/Code/miko/packages/ui
bun typecheck
bun test
```

```bash
cd /home/linuu/Code/miko/packages/desktop
bun typecheck
bun build
```

Release grep:

```bash
cd /home/linuu/Code/miko
rg -n "anomalyco/opencode|sst/opencode|opencode.ai|opencode-desktop|OPENCODE_INSTALL_DIR|\\.opencode/bin" README.md README.zh.md docs install packages github script
```

Expected: every remaining match is either a documented compatibility note or an intentionally deferred internal package namespace.

