# Miko TypeScript Fork Implementation Plan

Miko is a TypeScript/Bun fork of OpenCode. The runtime is centered on `packages/opencode` as the CLI/TUI/server shell, shared provider/config state lives in `packages/core`, native LLM protocols live in `packages/llm`, and app/visual surfaces live in `packages/app` and `packages/ui`. 

> [!IMPORTANT]
> The previous Go-oriented implementation plan is completely obsolete for this repository. Additionally, the desktop Electron module (`packages/desktop`) has been fully removed from the workspace to maintain a lightweight, terminal-centric architecture.
