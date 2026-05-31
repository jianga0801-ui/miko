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

**Miko** is a lightweight, high-performance, and visually stunning terminal-centric (TUI/CLI) AI programming assistant. Forked from OpenCode, Miko is designed to be your ultimate local AI coding companion with a focus on speed, aesthetics, and rich developer experience.

### Core Features

- **TUI & Aesthetic First**: Designed with modern developer aesthetics, harmonic color palettes, and micro-interactions for a premium CLI experience.
- **Voice & TTS Integration**: Deeply integrates text-to-speech (TTS) and voice recognition for seamless voice-guided assistance.
- **WSL Deep Integration**: Optimized cross-boundary execution between Windows hosts and WSL containers, ensuring secure and high-speed command execution.
- **Native Extensibility**: Built-in support for MCP (Model Context Protocol), custom plugins, and reusable skills.

### Getting Started

#### Installation

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

#### Running Subcomponents

Miko includes additional interface layers (web app and management console) which can be run using the following scripts:

```bash
# Run the Web App interface
bun run dev:web

# Run the Management Console
bun run dev:console
```

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
