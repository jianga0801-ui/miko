# Miko

**简体中文 | [English](README.md)**

Miko 是一个专为开发者打造、专为小米 Mimo 模型优化的终端优先 AI 编程助手：极致美观的终端交互体验、超快的启动速度、完整的模型能力适配、丰富多元的内置工作流，同时保持本地优先与极致的可扩展性。

当前仓库由 [jianga0801-ui/miko](https://github.com/jianga0801-ui/miko) 维护，基于 [sst/opencode](https://github.com/sst/opencode) 代码库开发。Miko 保留了 OpenCode 中成熟的 TUI、MCP、Provider、工具调用、会话和插件体系，并致力于为用户提供更纯净、开箱即用的本地发行版：自包含免依赖二进制文件、内置丰富 Skills、跨平台一键快速安装，以及更好的 Windows 宿主机使用体验。

## 核心优势

- **专为小米 Mimo 优化**：针对小米 Mimo (Xiaomi Mimo) 大模型进行深度全栈级定制，实现卓越的缓存命中率、全模态（音频/视频/图片）交互支持以及极高的代码生成质量。
- **免安装依赖**：Release 压缩包内置核心 CLI/TUI 运行时，普通用户不需要手动安装 Bun、Node.js 或 `node_modules`。
- **终端原生工作流**：在项目目录中直接启动，读取仓库、编辑文件、运行命令、查看结果，全流程闭环在终端内，高效无干扰。
- **模型能力感知**：在发送请求前，智能且统一地处理模型上下文限制、输入输出能力、工具调用、推理能力、变体和 provider 选项。
- **缓存命中优化**：对支持 inline cache hint 的 provider 默认启用 prompt cache 自动断点，大幅减少长链路工具链交互中的重复上下文成本。
- **内置丰富 Skills 与 `/` 命令**：代码审查、计划拟定、设计打磨、文档排版、智能翻译、changelog 自动生成、无用代码清理等高频工作流开箱即用。
- **扩展能力完整**：MCP prompt、本地命令模板、插件、provider hook、workspace adapter、keymap、TUI slash command 均是一等扩展点。

## 小米 Mimo 模型深度优化 🚀

Miko 专为**小米 Mimo (Xiaomi Mimo)** 大模型进行了深度的全栈级优化，带来卓越的开发速度、智能度与准确性：

- **极速缓存命中 (Cache-Hit)**：针对 Mimo 的上下文窗口深度定制了 Prompt Caching（提示词缓存）机制。在长链路的工具调用和复杂交互中，自动对系统 Prompt、工具定义和仓库上下文进行精准缓存，大幅降低 Token 消耗并缩减响应延迟。
- **全模态深度理解 (Multimodal)**：完美释放 Mimo 的多模态能力，无缝支持并理解图片、音频、视频等丰富媒介输入，无论是 UI 视觉审查、语音协助还是音视频多模态调试都能轻松应对。
- **超高回复质量 (Reply Quality)**：针对 Mimo 的生成特性，定制了高度优化的格式提示、系统上下文结构和响应生成规则，确保生成的代码高度准确、结构严谨、规范且符合生产级标准。
- **内置 Tavily 搜索**：深度集成 Tavily 搜索引擎（需配置 Tavily API Key），为 Mimo 提供即时、高质量的网页搜索与最新的文档 API 查询能力，彻底消除知识盲区。

## 安装

Linux / macOS：

```bash
curl -fsSL https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install | bash
miko --version
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/jianga0801-ui/miko/dev/install.ps1 | iex
miko --version
```

也可以从 [GitHub Releases](https://github.com/jianga0801-ui/miko/releases) 手动下载。每个版本都会发布 Linux、macOS、Windows、glibc/musl、x64/arm64、baseline 构建和 `checksums.txt`。

指定版本和手动安装方式见 [docs/install.md](./docs/install.md)。

## 内置能力

### Agents

Miko 内置多个专职 agent，而不是只靠一个泛用提示词。Miko 的内置 Agent 及工作区（Workspace）设计参考并借鉴了 [opencode-workspace](https://github.com/kdcokenny/opencode-workspace)：

| Agent | 作用 |
| --- | --- |
| `miko` | 只读编排器，负责把任务分派给专职 subagent。 |
| `coder` | 代码实现、构建、测试、修复执行者。 |
| `explore` | 只读代码库探索者，负责找文件、追踪逻辑和结构。 |
| `researcher` | 外部资料研究 agent，用于文档、API、包信息和网页资料。 |
| `reviewer` | 代码和计划审查 agent，带严重级别和置信度规则。 |
| `scribe` | 文档、changelog、release note、PR 描述和用户可见文案写作者。 |
| `.miko/agent/triage` | GitHub issue 分诊 agent。 |
| `.miko/agent/duplicate-pr` | GitHub PR 重复项检测 agent。 |

### Skills

内置 skills 可被 agent 加载，部分也会以命令式工作流出现：

| Skill | 作用 | 来源 |
| --- | --- | --- |
| `code-philosophy` | 内部逻辑和数据流编码标准。 | Miko 内置，本仓库。 |
| `frontend-philosophy` | UI 和视觉质量标准。 | Miko 内置，本仓库。 |
| `code-review` | 正确性、安全、性能、可维护性的四层审查方法。 | Miko 内置，本仓库。 |
| `plan-protocol` | 实施计划格式、引用和进度追踪规范。 | Miko 内置，本仓库。 |
| `plan-review` | 实施计划质量审查规则。 | Miko 内置，本仓库。 |
| `impeccable` | 前端设计、审查、打磨、响应式、动画和 live variant 工作流。 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable)。 |
| `kami` | 专业文档、落地页、一页纸、简历、报告、PDF 和幻灯片排版。 | [tw93/kami](https://github.com/tw93/kami)。 |
| `effect` | 本仓库 Effect v4 / effect-smol 编码指引。 | 本项目本地 skill；API 参考源是 [Effect-TS/effect-smol](https://github.com/Effect-TS/effect-smol)。 |

Kami 的图表/diagram 指南还标注了 [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) 作为 editorial inline-SVG diagram 方法的灵感来源。

### `/` 命令

Miko 的命令本质是 Markdown prompt template，可以来自内置命令、项目文件、MCP prompt 或 skill。

内置命令：

| 命令 | 作用 |
| --- | --- |
| `/init` | 引导创建或整理仓库的 `AGENTS.md`。 |
| `/review` | 把代码审查委派给 reviewer agent。 |

`.miko/command` 项目命令：

| 命令 | 作用 |
| --- | --- |
| `/ai-deps` | 分析 AI SDK 依赖的安全 minor/patch 升级。 |
| `/changelog` | 根据结构化 release 输入生成 `UPCOMING_CHANGELOG.md`。 |
| `/commit` | 基于当前 diff 创建并推送 conventional commit。 |
| `/goal` | 高彻底度目标执行协议，强调分解和验证。 |
| `/issues` | 在 GitHub issues 里搜索相似问题。 |
| `/learn` | 把会话里的稳定经验沉淀进合适层级的 `AGENTS.md`。 |
| `/plan` | 研究并保存带引用的实施计划。 |
| `/rmslop` | 清理分支里引入的 AI slop。 |
| `/spellcheck` | 检查变更 Markdown 的拼写和语法。 |
| `/translate` | 翻译英文文档和 UI 文案，同时保留代码术语。 |
| `/yolo` | 跳过规划，直接执行并验证。 |

MCP prompt 名称和 skill 名称也会自动加入命令列表，只要不与已有命令冲突。

## 模型和 Provider 运行时

Miko 的模型层由两部分组成：

- `models.dev` 模型目录，用于 provider/model 元数据，并带本地磁盘缓存和进程内缓存。
- 运行时 provider adapter，用来统一认证、endpoint 选择、request options、流式事件和模型能力。

Miko 专为 **小米 Mimo (Xiaomi Mimo)** 大模型家族设计，将其作为首要的、深度优化的第一方 Provider。同时，Miko 保留了通用的 **OpenAI-compatible (OpenAI 兼容)** 适配器，以支持自定义私有部署、本地大模型运行时以及标准 OpenAI 协议的扩展。

Miko 不把所有模型都当成普通文本模型，而是细粒度地跟踪和调优这些能力：

- context、input、output token 上限
- text、image、audio、video、PDF 输入输出模态（完美支持 Mimo 的全模态理解能力）
- tool-call 支持
- reasoning 支持和 reasoning variants（针对 Mimo 深度优化的推理思维链持续输出）
- temperature 支持
- provider-specific endpoint 类型
- cost、cache read/write cost、状态元数据

Provider 侧的优化包括：

- 小米 Mimo 官方通道的深度适配：对 token 消耗统计、推理过程分离、超低延迟流式响应等进行了原生集成。
- OpenAI 兼容配置文件的标准化：支持与主流 OpenAI 兼容协议的服务和本地测试服务无缝对接。

## 缓存命中和上下文优化

Miko 在多层做缓存和上下文优化：

- **Prompt cache 自动断点**：对支持 inline cache marker 的 provider，Miko 会在最后一个 tool definition、最后一个 system part、最新 user message 处放置 cache breakpoint，覆盖工具密集回合里的稳定前缀。
- **保留手动 cache hint**：工具、system part 或 message 上已有的显式 `cache` 标记不会被覆盖。
- **Provider 感知**：Mimo 及其他兼容路径会应用 inline marker；对隐式缓存或 out-of-band cache 的 provider 不做无意义标记。
- **Usage 细分**：usage event 单独保留 non-cached input tokens、cache-read tokens、cache-write tokens、reasoning tokens、visible output tokens 和原始 provider metadata。
- **模型目录缓存**：`models.dev` 元数据写入本地磁盘，使用跨进程文件锁，并在后台周期刷新。
- **本地搜索回退**：发布包不再依赖运行时下载 `ripgrep`；如果系统没有 `rg`，Miko 会走内置文件搜索回退。

## 扩展体系

不改核心代码也能扩展 Miko：

- **MCP**：MCP prompts 会变成 `/` 命令，MCP tools 会进入 agent runtime。
- **Commands**：在 `command/` 或 `.miko/command/` 下添加 Markdown 文件即可。
- **Skills**：在配置的 skills 路径下添加带 `SKILL.md` 的目录。
- **Plugins**：可注册工具、provider hook、model hook、keymap layer、TUI route、slash command、workspace adapter 和上下文注入器。
- **Providers**：可使用内置 AI SDK provider，也可定义 OpenAI-compatible endpoint 和 provider-specific options。

## 源码开发

普通用户应使用上面的一键安装。源码开发需要 Bun：

```bash
git clone https://github.com/jianga0801-ui/miko.git
cd miko
bun install
bun run dev
```

检查要进入具体 package。不要运行根目录 test 脚本，它会故意退出：

```bash
cd packages/miko
bun typecheck
```

## 发布

Release workflow 会构建自包含压缩包并上传 checksum：

```bash
script/release 0.0.1
```

推送 `v*` tag 也会触发同一个 workflow。

## Fork 和来源标注

| 组件 | 仓库 |
| --- | --- |
| 当前 Miko 仓库 | [jianga0801-ui/miko](https://github.com/jianga0801-ui/miko) |
| 主要上游代码库 | [sst/opencode](https://github.com/sst/opencode) |
| 部分历史包元数据仍可见的 fork 链路 | [anomalyco/miko](https://github.com/anomalyco/miko) |
| 模型目录 | [models.dev](https://models.dev) |
| 内置 Agent 工作区参考来源 | [kdcokenny/opencode-workspace](https://github.com/kdcokenny/opencode-workspace) |
| Impeccable 视觉设计 skill | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) |
| Kami 内置 skill | [tw93/kami](https://github.com/tw93/kami) |
| `effect` skill 使用的 Effect API 参考源 | [Effect-TS/effect-smol](https://github.com/Effect-TS/effect-smol) |
| Kami diagram 灵感来源 | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) |

这些来源明确写在 README 中，方便用户区分哪些是 Miko 本地所做的深度优化与改造，哪些来自 OpenCode 上游，哪些是随项目打包的第三方 Skill、内置工作区参考或外部参考源。
