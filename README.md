<p align="center">
  <picture>
    <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
    <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Miko logo" width="200">
  </picture>
</p>
<h1 align="center">Miko</h1>
<p align="center">A lightning-fast, beautiful, and voice-enabled TUI AI Coding Agent.</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

**Miko** is a lightweight, high-performance, and visually stunning terminal-centric (TUI/CLI) AI programming assistant. Forked from Miko, Miko is designed to be your ultimate local AI coding companion with a focus on speed, aesthetics, and rich developer experience.

### Core Features

- **TUI & Aesthetic First**: Designed with modern developer aesthetics, harmonic color palettes, and micro-interactions for a premium CLI experience.
- **Voice & TTS Integration**: Deeply integrates text-to-speech (TTS) and voice recognition for seamless voice-guided assistance.
- **WSL Deep Integration**: Optimized cross-boundary execution between Windows hosts and WSL containers, ensuring secure and high-speed command execution.
- **Native Extensibility**: Built-in support for MCP (Model Context Protocol), custom plugins, and reusable skills.

### Getting Started

#### Portable Install

For normal use, download the release archive for your platform from
[GitHub Releases](https://github.com/jianga0801-ui/miko/releases), extract it,
and run the included `miko` binary.

The release binary is self-contained for the core CLI/TUI runtime. It does not
require Bun, Node.js, or `node_modules` on the user's machine.

#### Source Development

To run Miko locally from source:

```bash
# Clone the repository
git clone https://github.com/jianga0801-ui/miko.git
cd miko

# Install dependencies using Bun
bun install

# Run the development TUI CLI
bun run dev
```

### WSL Integration Guidance

Miko is optimized for Windows Subsystem for Linux (WSL). When using Miko in a WSL environment, keep the following guidelines in mind:

- **Run inside WSL**: Run Miko commands and tests directly inside the WSL terminal (e.g., Ubuntu shell) where Node and Bun are installed, rather than using Windows CMD/PowerShell over UNC paths (`\\wsl.localhost\...`).
- **Path Casing and UNC Paths**: Avoid running git status or file operations from Windows PowerShell against the WSL UNC path, as case-insensitivity on Windows can cause git or tests to behave unexpectedly.
- **Windows Host as Editor**: We recommend using VS Code or other Windows IDEs as the frontend/editor surface, while keeping all execution, terminal commands, and AI agent runs inside the native WSL container.

### Agents

Miko includes two built-in agents you can switch between with the `Tab` key in the TUI:

- **build** - Default, full-access agent for development work.
- **plan** - Read-only agent for analysis and code exploration.
  - Denies file edits by default.
  - Asks permission before running bash commands.
  - Ideal for exploring unfamiliar codebases or planning changes.

Also included is a **general** subagent for complex searches and multistep tasks. This is used internally and can be invoked using `@general` in messages.

### Documentation & Contribution

- Read our design system and development constraints in [AGENTS.md](./AGENTS.md).
- To contribute, please check our [CONTRIBUTING.md](./CONTRIBUTING.md).

---

**Miko is fully open-source and dedicated to every developer who loves crafting in the terminal.**
