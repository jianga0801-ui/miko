# Miko - Agent & Project Plan Guide

欢迎来到 Miko！本仓库是 Fork 自 Miko 的轻量级、超强 Agent 编程助手客户端，托管于用户 `jianga0801-ui`。
本文件（`AGENTS.md`）旨在说明项目开发计划、架构愿景，并为所有在此仓库中工作的 AI Agent 制定严格的操作约束与代码风格指南。

---

## 1. 项目计划与愿景 (Project Plan & Vision)

Miko 旨在打造一个极速、极简、且具备极高视觉美感与极佳人机交互体验的 Terminal-centric (TUI/CLI) AI 编程助手。

### 核心特性 (Core Features)
- **多端原生支持**：保留并强化原生 MCP、Plugins、Skills 等生态扩展支持。
- **TTS & 语音交互**：深度集成文本转语音（TTS）与语音输入/识别，实现无缝的人机语音协助。
- **WSL 深度融合**：优化 Windows 宿主机与 WSL 开发环境的跨端协作，确保 Agent 在宿主机与 WSL 容器间安全、高效地执行命令。
- **美学至上 (TUI/UI)**：虽然是命令行/终端客户端，但设计上必须遵循高品质美学标准，使用和谐色调与微动画，拒绝平庸。
- **完全开源**：计划开源，作为每个开发者的终极本地 AI 编程伴侣。

---

## 2. Agent 严苛开发约束 (Agent Constraints)

作为在 Miko 项目中参与开发的 AI Agent，你**必须**严格遵守以下规范。任何违反以下规范的代码或指令将被直接拒绝。

### 2.1 安全操作规范 (Security Standards)

- **禁止递归强制删除**：
  - **绝对禁止**在 Windows PowerShell 中执行 `Remove-Item -Recurse -Force`，在 CMD 中执行 `del /S /Q`，或在 Linux/Bash 中使用 `rm -rf` 等破坏性命令。
  - **文件移入回收站**：如果需要删除文件，优先将其移入回收站而非永久删除。
    - PowerShell: 可以通过调用 `Shell.Application` 或者使用 Python `send2trash` 模块。
  - **删除前确认**：删除前必须先用 `Get-ChildItem` (PowerShell) / `dir` (CMD) / `ls` (Bash) 确认目标确实存在。批量删除前，必须列出范围并经过用户显式确认。
- **破坏性操作二次确认**：在执行任何可能导致数据丢失或覆盖的操作前，必须清晰地解释意图，并等待用户确认。
- **配置文件备份**：在修改任何关键配置文件前，必须先创建备份：
  - PowerShell: `Copy-Item file file.bak.$((Get-Date -Format "yyyyMMddHHmmss"))`
  - Linux/Bash: `cp file file.bak.$(date +%s)`
- **文本替换安全**：使用文本替换工具前必须仔细验证修改内容，防止意外覆盖。

### 2.2 Karpathy-Inspired Coding Guidelines (极简高效开发原则)

1. **Think Before Coding（谋定而后动）**：
   - 不盲目假设，不隐瞒困惑。主动向用户呈现设计权衡（Trade-offs）。
   - 如果存在多种方案或理解，列出它们供用户选择，绝不自作主张。
   - 如果能用更简单的方法解决，务必提出并推动。
2. **Simplicity First（至简至美）**：
   - 编写解决问题所需的最少代码，绝不编写投机性或超前的代码。
   - 不为仅使用一次的代码做抽象或封装。
   - 不增加未被明确要求的配置项和“灵活性”。
   - 如果你能用 50 行代码解决，绝不写 200 行。写完后问自己：“资深工程师会觉得这太复杂了吗？”
3. **Surgical Changes（外科手术式修改）**：
   - 仅修改与任务直接相关的代码，不要试图“顺手”重构相邻的不相关代码。
   - 严格匹配现有代码风格，哪怕你觉得它不够完美。
   - 当你的修改导致某些变量、导入或函数失效时，务必将其彻底清理，不留下垃圾。
4. **Goal-Driven Execution（目标驱动与验证）**：
   - 将每个任务转化为可量化验证的成功标准。
   - 实施闭环验证逻辑：先写测试（或提供清晰的验证脚本），确保它在修改前失败，在修改后成功。
   - 多步骤任务需先陈述简要计划：`[步骤] -> verify: [检查项]`。

---

## 3. 代码风格与规范 (Style Guide)

### 3.1 仓库与分支
- 重新生成 JavaScript SDK：运行 `./packages/sdk/js/script/build.ts`
- 默认分支为 `dev`。
- 本地 `main` 引用可能不存在；比对差异时请使用 `dev` 或 `origin/dev`。

### 3.2 Commits 与 PR 标题
遵循常规提交风格：`type(scope): summary`
- 有效类型：`feat`, `fix`, `docs`, `chore`, `refactor`, `test`。
- 常用 Scope（可选）：`core`, `miko`, `tui`, `app`, `sdk`, `plugin`。
- 示例：`fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`

### 3.3 编程规范 (TS/JS)
- **单一函数原则**：保持代码集中在一个函数中，除非它具有高度的通用性或复用性。不要过早提取单次使用的辅助函数。
- **避免 Try/Catch**：尽可能减少不必要的 try/catch，依靠更清晰的逻辑或框架级的错误处理。
- **禁用 `any`**：严禁使用 `any` 类型。
- **使用 Bun API**：在可能的情况下，优先使用 Bun 的原生 API（例如 `Bun.file()`）。
- **类型推导**：尽量依赖 TS 的自动类型推导，除非必须导出或必须明确声明，否则避免多余的 explicit annotations 或 interfaces。
- **函数式数组处理**：优先使用 `flatMap`、`filter`、`map` 等函数式数组操作，而不是传统的 `for` 循环。在 `filter` 中使用类型守卫（Type Guard）以确保下游的类型推导。
- **模块导出**：在 `src/config` 中，如果添加了新配置模块，遵循原有的自导出模式（例如在文件顶部使用 `export * as ConfigAgent from "./agent"`）。
- **减少临时变量**：如果一个值仅被使用一次，应直接将其内联，以减少总变量数量。
  ```ts
  // 推荐 (Good)
  const journal = await Bun.file(path.join(dir, "journal.json")).json()

  // 避免 (Bad)
  const journalPath = path.join(dir, "journal.json")
  const journal = await Bun.file(journalPath).json()
  ```

### 3.4 模块导入 (Imports)
- **禁止使用别名导入**：不要使用 `import { foo as bar }` 或 `import { resolve as pathResolve }`。
- **禁止使用星号导入**：不要使用 `import * as Foo` 或 `import type * as Foo`。
- **命名空间导入**：如果需要命名空间样式的值，引入该模块自身导出的命名空间名称（例如 `import { Project } from "@miko-ai/core/project"`，然后通过 `Project.ID` 引用）。

### 3.5 变量与控制流
- 优先使用 `const`。使用三元运算符或早期返回来代替变量的重新赋值（reassignment）。
- 绝不使用 `else`。优先使用早期返回（Early Return）。
  ```ts
  // 推荐 (Good)
  function foo() {
    if (condition) return 1
    return 2
  }

  // 避免 (Bad)
  function foo() {
    if (condition) return 1
    else return 2
  }
  ```

### 3.6 数据库 Schema 定义 (Drizzle)
字段名采用 `snake_case`，避免在定义列时显式重新指定 string 类型的列名：
```ts
// 推荐 (Good)
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// 避免 (Bad)
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

---

## 4. 测试与类型检查 (Testing & Type Check)

- **严禁 Mock**：在编写测试时，尽可能避免使用 mock。
- **避免逻辑复制**：测试应当测试实际的输入与输出，不要将业务逻辑复制到测试代码中。
- **测试路径规范**：不能从仓库根目录直接运行测试（有 `do-not-run-tests-from-root` 的保护限制）。必须进入对应的包目录（如 `packages/miko`）下运行。
- **类型检查**：必须进入对应的包目录下运行 `bun typecheck`，严禁直接运行 `tsc`。
