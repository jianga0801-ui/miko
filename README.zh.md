<p align="center">
  <picture>
    <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
    <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Miko logo" width="200">
  </picture>
</p>
<h1 align="center">Miko</h1>
<p align="center">一款极速、美观且支持语音交互的终端 (TUI) AI 编程助手。</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

**Miko** 是一个轻量级、超强性能且具备极高视觉美感与极佳人机交互体验的 Terminal-centric (TUI/CLI) AI 编程助手。本仓库 Fork 自 Miko，致力于打造成每个开发者最得心应手的本地 AI 编程伴侣。

### 核心特性

- **美学至上 (TUI/UI)**：基于现代开发者审美设计，使用和谐色调与微动画，拒绝平庸，提供极致的终端视觉体验。
- **TTS & 语音交互**：深度集成文本转语音（TTS）与语音输入/识别，实现无缝的人机语音协作。
- **WSL 深度融合**：优化 Windows 宿主机与 WSL 开发环境的跨端协作，确保 Agent 在宿主机与 WSL 容器间安全、高效地执行命令。
- **生态扩展支持**：保留并强化原生 MCP（Model Context Protocol）、Plugins（插件体系）与 Skills（技能库）支持。

### 快速开始

#### 本地安装与运行

要从源码运行 Miko：

```bash
# 克隆仓库
git clone https://github.com/jianga0801-ui/miko.git
cd miko

# 使用 Bun 安装依赖
bun install

# 启动本地开发版 TUI 终端
bun run dev
```

#### 启动其他组件

Miko 还包含网页端和控制台，可运行对应的脚本启动：

```bash
# 启动网页端界面
bun run dev:web

# 启动管理控制台
bun run dev:console
```

### WSL 深度融合指南

Miko 针对 Windows Subsystem for Linux (WSL) 进行了深度优化。在 WSL 环境中使用 Miko 时，请遵循以下指南：

- **在 WSL 内部运行**：建议直接在 WSL 终端（如 Ubuntu shell）内部运行 Miko 命令和测试（此处已安装 Node 和 Bun），而不是在 Windows 宿主机上通过 UNC 路径（如 `\\wsl.localhost\...`）使用 CMD/PowerShell 运行。
- **路径大小写与 UNC 路径**：避免在 Windows PowerShell 中针对 WSL UNC 路径执行 git status 或文件命令，因为 Windows 的大小写不敏感特性可能会导致 git 或测试表现异常。
- **以 Windows 为编辑器，以 WSL 为运行环境**：推荐使用 VS Code 等 Windows 宿主机 IDE 作为前端/编辑器，同时将所有命令执行、终端任务和 AI Agent 运行都保留在原生的 WSL 容器内。

### 内置 Agents

Miko 内置两种 Agent，可在终端中通过 `Tab` 键快速切换：

- **build** - 默认模式，具备完整读写权限，适合核心开发工作。
- **plan** - 只读模式，适合未知代码库分析与探索。
  - 默认拒绝修改文件。
  - 运行命令前会询问。
  - 便于安全地规划改动。

另外还包含一个 **general** 子 Agent，用于复杂搜索和多步任务，可在消息中输入 `@general` 显式调用。

### 文档与贡献指南

- 关于开发设计约束与代码风格规范，请阅读 [AGENTS.md](./AGENTS.md)。
- 如有兴趣贡献代码，请阅读 [贡献指南](./CONTRIBUTING.md)。

---

**Miko 完全开源，献给所有热爱在命令行中创造的开发者。**
