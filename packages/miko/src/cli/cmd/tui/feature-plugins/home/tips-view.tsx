import type { TuiPluginApi } from "@miko-ai/plugin/tui"
import { createMemo, For, type Accessor } from "solid-js"
import { DEFAULT_THEMES, useTheme } from "@tui/context/theme"
import { useCommandShortcut } from "../../keymap"
import { resolveTuiLanguage, TuiLanguageKVKey, type TuiLanguage, type TuiLanguageConfig } from "../../i18n"

const themeCount = Object.keys(DEFAULT_THEMES).length

type TipPart = { text: string; highlight: boolean }
type TipShortcut = Accessor<string>
type Shortcuts = {
  agentCycle: TipShortcut
  permissionToggle: TipShortcut
  childFirst: TipShortcut
  childNext: TipShortcut
  childPrevious: TipShortcut
  commandList: TipShortcut
  editorOpen: TipShortcut
  helpShow: TipShortcut
  inputClear: TipShortcut
  inputNewline: TipShortcut
  inputPaste: TipShortcut
  inputUndo: TipShortcut
  leader: TipShortcut
  messagesCopy: TipShortcut
  messagesFirst: TipShortcut
  messagesLast: TipShortcut
  messagesPageDown: TipShortcut
  messagesPageUp: TipShortcut
  messagesToggleConceal: TipShortcut
  modelCycleRecent: TipShortcut
  modelList: TipShortcut
  sessionExport: TipShortcut
  sessionInterrupt: TipShortcut
  sessionList: TipShortcut
  sessionNew: TipShortcut
  sessionParent: TipShortcut
  sessionPinToggle: TipShortcut
  sessionQuickSwitch1: TipShortcut
  sessionQuickSwitch9: TipShortcut
  sessionSidebarToggle: TipShortcut
  sessionTimeline: TipShortcut
  statusView: TipShortcut
  terminalSuspend: TipShortcut
  themeList: TipShortcut
}
type Tip = string | ((shortcuts: Shortcuts) => string | undefined)

function parse(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g
  const found = Array.from(tip.matchAll(regex))
  const state = found.reduce(
    (acc, match) => {
      const start = match.index ?? 0
      if (start > acc.index) {
        acc.parts.push({ text: tip.slice(acc.index, start), highlight: false })
      }
      acc.parts.push({ text: match[1], highlight: true })
      acc.index = start + match[0].length
      return acc
    },
    { parts, index: 0 },
  )

  if (state.index < tip.length) {
    parts.push({ text: tip.slice(state.index), highlight: false })
  }

  return parts
}

const NO_MODELS_TIP = "Run {highlight}/connect{/highlight} to add an AI provider and start coding"
const NO_MODELS_TIP_ZH = "运行 {highlight}/connect{/highlight} 添加 AI Provider 即可开始编码"
const NO_MODELS_PARTS = parse(NO_MODELS_TIP)

function shortcutText(value: string) {
  return `{highlight}${value}{/highlight}`
}

function commandText(command: string, shortcut: string) {
  if (!shortcut) return shortcutText(command)
  return `${shortcutText(command)} or ${shortcutText(shortcut)}`
}

function commandTextZh(command: string, shortcut: string) {
  if (!shortcut) return shortcutText(command)
  return `${shortcutText(command)} 或 ${shortcutText(shortcut)}`
}

function press(shortcut: string, text: string) {
  if (!shortcut) return undefined
  return `Press ${shortcutText(shortcut)} ${text}`
}

function pressZh(shortcut: string, text: string) {
  if (!shortcut) return undefined
  return `按 ${shortcutText(shortcut)} ${text}`
}

function configShortcut(api: TuiPluginApi, command: string): TipShortcut {
  return () =>
    api.tuiConfig.keybinds
      .get(command)
      .map((binding) => api.keys.formatSequence(Array.from(api.keymap.parseKeySequence(binding.key))))
      .filter(Boolean)
      .join(", ")
}

export function Tips(props: { api: TuiPluginApi; connected?: boolean }) {
  const theme = useTheme().theme
  const tipOffset = Math.random()
  const language = (): TuiLanguage =>
    resolveTuiLanguage(props.api.kv.get(TuiLanguageKVKey, props.api.tuiConfig.language) as TuiLanguageConfig | undefined)
  const noModelsTip = () => (language() === "zh-CN" ? NO_MODELS_TIP_ZH : NO_MODELS_TIP)
  const shortcuts: Shortcuts = {
    agentCycle: useCommandShortcut("agent.cycle"),
    permissionToggle: useCommandShortcut("permission.toggle"),
    childFirst: configShortcut(props.api, "session.child.first"),
    childNext: configShortcut(props.api, "session.child.next"),
    childPrevious: configShortcut(props.api, "session.child.previous"),
    commandList: useCommandShortcut("command.palette.show"),
    editorOpen: useCommandShortcut("prompt.editor"),
    helpShow: useCommandShortcut("help.show"),
    inputClear: useCommandShortcut("prompt.clear"),
    inputNewline: useCommandShortcut("input.newline"),
    inputPaste: useCommandShortcut("prompt.paste"),
    inputUndo: useCommandShortcut("input.undo"),
    leader: configShortcut(props.api, "leader"),
    messagesCopy: configShortcut(props.api, "messages.copy"),
    messagesFirst: configShortcut(props.api, "session.first"),
    messagesLast: configShortcut(props.api, "session.last"),
    messagesPageDown: configShortcut(props.api, "session.page.down"),
    messagesPageUp: configShortcut(props.api, "session.page.up"),
    messagesToggleConceal: configShortcut(props.api, "session.toggle.conceal"),
    modelCycleRecent: useCommandShortcut("model.cycle_recent"),
    modelList: useCommandShortcut("model.list"),
    sessionExport: configShortcut(props.api, "session.export"),
    sessionInterrupt: configShortcut(props.api, "session.interrupt"),
    sessionList: useCommandShortcut("session.list"),
    sessionNew: useCommandShortcut("session.new"),
    sessionParent: configShortcut(props.api, "session.parent"),
    sessionPinToggle: configShortcut(props.api, "session.pin.toggle"),
    sessionQuickSwitch1: useCommandShortcut("session.quick_switch.1"),
    sessionQuickSwitch9: useCommandShortcut("session.quick_switch.9"),
    sessionSidebarToggle: configShortcut(props.api, "session.sidebar.toggle"),
    sessionTimeline: configShortcut(props.api, "session.timeline"),
    statusView: useCommandShortcut("miko.status"),
    terminalSuspend: useCommandShortcut("terminal.suspend"),
    themeList: useCommandShortcut("theme.switch"),
  }
  const tip = createMemo(() => {
    if (props.connected === false) return noModelsTip()
    const source = language() === "zh-CN" ? TIPS_ZH : TIPS
    const tips = source.flatMap((item) => {
      const value = typeof item === "string" ? item : item(shortcuts)
      return value ? [value] : []
    })
    return tips[Math.floor(tipOffset * tips.length)] ?? noModelsTip()
  }, NO_MODELS_TIP)
  // Solid can expose a memo's initial value while a pure computation is pending.
  const parts = createMemo(() => {
    const value = tip()
    if (typeof value === "string") return parse(value)
    return NO_MODELS_PARTS
  }, NO_MODELS_PARTS)

  return (
    <box flexDirection="row" maxWidth="100%">
      <text flexShrink={0} style={{ fg: theme.primary }}>
        ● {language() === "zh-CN" ? "提示" : "Tip"}{" "}
      </text>
      <text flexShrink={1} wrapMode="word">
        <For each={parts()}>
          {(part) => <span style={{ fg: part.highlight ? theme.primary : theme.textMuted }}>{part.text}</span>}
        </For>
      </text>
    </box>
  )
}

const TIPS: Tip[] = [
  "Type {highlight}@{/highlight} followed by a filename to fuzzy search and attach files",
  "Start a message with {highlight}!{/highlight} to run shell commands directly (e.g., {highlight}!ls -la{/highlight})",
  (shortcuts) => press(shortcuts.permissionToggle(), "to toggle Auto-Approve permission mode (on/off)"),
  "Use {highlight}/undo{/highlight} to revert the last message and file changes",
  "Use {highlight}/redo{/highlight} to restore previously undone messages and file changes",
  "Run {highlight}/share{/highlight} to create a public link to your conversation at miko.dev",
  "Drag and drop images or PDFs into the terminal to add them as context",
  (shortcuts) => press(shortcuts.inputPaste(), "to paste images from your clipboard into the prompt"),
  (shortcuts) => `Use ${commandText("/editor", shortcuts.editorOpen())} to compose messages in your external editor`,
  "Run {highlight}/init{/highlight} to auto-generate project rules based on your codebase",
  (shortcuts) => `Use ${commandText("/models", shortcuts.modelList())} to see and switch between available AI models`,
  (shortcuts) => `Use ${commandText("/themes", shortcuts.themeList())} to switch between ${themeCount} built-in themes`,
  (shortcuts) => `Use ${commandText("/new", shortcuts.sessionNew())} to start a fresh conversation session`,
  (shortcuts) => `Use ${commandText("/sessions", shortcuts.sessionList())} to list, pin, and continue sessions`,
  (shortcuts) => press(shortcuts.sessionPinToggle(), "in the session list to pin a session so it stays at the top"),
  (shortcuts) =>
    shortcuts.sessionQuickSwitch1() && shortcuts.sessionQuickSwitch9()
      ? `Pinned sessions are assigned quick slots; use ${shortcutText(shortcuts.sessionQuickSwitch1())} through ${shortcutText(shortcuts.sessionQuickSwitch9())} to switch`
      : undefined,
  "Run {highlight}/compact{/highlight} to summarize long sessions near context limits",
  (shortcuts) => `Use ${commandText("/export", shortcuts.sessionExport())} to save the conversation as Markdown`,
  (shortcuts) => press(shortcuts.messagesCopy(), "to copy the assistant's last message to clipboard"),
  (shortcuts) => press(shortcuts.commandList(), "to see all available actions and commands"),
  "Run {highlight}/connect{/highlight} to add API keys for 75+ supported LLM providers",
  (shortcuts) => `The leader key is ${shortcutText(shortcuts.leader())}; combine with other keys for quick actions`,
  (shortcuts) => press(shortcuts.modelCycleRecent(), "to quickly switch between recently used models"),
  (shortcuts) => press(shortcuts.sessionSidebarToggle(), "in a session to show or hide the sidebar panel"),
  (shortcuts) =>
    shortcuts.messagesPageUp() && shortcuts.messagesPageDown()
      ? `Use ${shortcutText(shortcuts.messagesPageUp())}/${shortcutText(shortcuts.messagesPageDown())} to navigate through conversation history`
      : undefined,
  (shortcuts) => press(shortcuts.messagesFirst(), "to jump to the beginning of the conversation"),
  (shortcuts) => press(shortcuts.messagesLast(), "to jump to the most recent message"),
  (shortcuts) => press(shortcuts.inputNewline(), "to add newlines in your prompt"),
  (shortcuts) => press(shortcuts.inputClear(), "when typing to clear the input field"),
  (shortcuts) => press(shortcuts.sessionInterrupt(), "to stop the AI mid-response"),
  "Run {highlight}/plan [task]{/highlight} to generate an implementation plan before making changes",
  "Use {highlight}@agent-name{/highlight} in prompts to invoke specialized subagents",
  (shortcuts) => {
    const items = [
      shortcuts.sessionParent(),
      shortcuts.childFirst(),
      shortcuts.childPrevious(),
      shortcuts.childNext(),
    ].filter(Boolean)
    if (!items.length) return undefined
    return `Use ${items.map(shortcutText).join(" / ")} to move between parent and child sessions`
  },
  "Create {highlight}miko.json{/highlight} for server settings and {highlight}tui.json{/highlight} for TUI settings",
  "Place TUI settings in {highlight}~/.config/miko/tui.json{/highlight} for global config",
  "Add {highlight}$schema{/highlight} to your config for autocomplete in your editor",
  "Configure {highlight}model{/highlight} in config to set your default model",
  "Override any keybind in {highlight}tui.json{/highlight} via the {highlight}keybinds{/highlight} section",
  "Set any keybind to {highlight}none{/highlight} to disable it completely",
  "Configure local or remote MCP servers in the {highlight}mcp{/highlight} config section",
  "Add {highlight}.md{/highlight} files to {highlight}.miko/command/{/highlight} to define reusable custom prompts",
  "Use {highlight}$ARGUMENTS{/highlight}, {highlight}$1{/highlight}, {highlight}$2{/highlight} in custom commands for dynamic input",
  "Use backticks in commands to inject shell output (e.g., {highlight}`git status`{/highlight})",
  "Add {highlight}.md{/highlight} files to {highlight}.miko/agent/{/highlight} for specialized AI personas",
  "Configure per-agent permissions for {highlight}edit{/highlight}, {highlight}bash{/highlight}, and {highlight}webfetch{/highlight} tools",
  'Use patterns like {highlight}"git *": "allow"{/highlight} for granular bash permissions',
  'Set {highlight}"rm -rf *": "deny"{/highlight} to block destructive commands',
  'Configure {highlight}"git push": "ask"{/highlight} to require approval before pushing',
  'Set {highlight}"formatter": true{/highlight} in config to enable built-in formatters like prettier, gofmt, and ruff',
  'Set {highlight}"formatter": false{/highlight} in config to disable formatters enabled by another config layer',
  "Define custom formatter commands with file extensions in config",
  'Set {highlight}"lsp": true{/highlight} in config to enable built-in LSP servers for code analysis',
  "Create {highlight}.ts{/highlight} files in {highlight}.miko/tool/{/highlight} to define new LLM tools",
  "Tool definitions can invoke scripts written in Python, Go, etc",
  "Add {highlight}.ts{/highlight} files to {highlight}.miko/plugins/{/highlight} for event hooks",
  "Use plugins to send OS notifications when sessions complete",
  "Create a plugin to prevent Miko from reading sensitive files",
  "Use {highlight}miko run{/highlight} for non-interactive scripting",
  "Use {highlight}miko --continue{/highlight} to resume the last session",
  "Use {highlight}miko run -f file.ts{/highlight} to attach files via CLI",
  "Use {highlight}--format json{/highlight} for machine-readable output in scripts",
  "Run {highlight}miko serve{/highlight} for headless API access to Miko",
  "Use {highlight}miko run --attach{/highlight} to connect to a running server",
  "Run {highlight}miko upgrade{/highlight} to update to the latest version",
  "Run {highlight}miko auth list{/highlight} to see all configured providers",
  "Run {highlight}miko agent create{/highlight} for guided agent creation",
  "Use {highlight}/miko{/highlight} in GitHub issues/PRs to trigger AI actions",
  "Run {highlight}miko github install{/highlight} to set up the GitHub workflow",
  "Comment {highlight}/miko fix this{/highlight} on issues to auto-create PRs",
  "Comment {highlight}/oc{/highlight} on PR code lines for targeted code reviews",
  'Use {highlight}"theme": "system"{/highlight} to match your terminal\'s colors',
  "Create JSON theme files in {highlight}.miko/themes/{/highlight} directory",
  "Themes support dark/light variants for both modes",
  "Use numeric xterm color codes 0-255 in custom theme JSON",
  "Use {highlight}{env:VAR_NAME}{/highlight} syntax to reference environment variables in config",
  "Use {highlight}{file:path}{/highlight} to include file contents in config values",
  "Use {highlight}instructions{/highlight} in config to load additional rules files",
  "Set agent {highlight}temperature{/highlight} from 0.0 (focused) to 1.0 (creative)",
  "Configure {highlight}steps{/highlight} to limit agentic iterations per request",
  'Set {highlight}"tools": {"bash": false}{/highlight} to disable specific tools',
  'Set {highlight}"mcp_*": false{/highlight} to disable all tools from an MCP server',
  "Override global tool settings per agent configuration",
  'Set {highlight}"share": "auto"{/highlight} to automatically share all sessions',
  'Set {highlight}"share": "disabled"{/highlight} to prevent any session sharing',
  "Run {highlight}/unshare{/highlight} to remove a session from public access",
  "Permission {highlight}doom_loop{/highlight} prevents infinite tool call loops",
  "Permission {highlight}external_directory{/highlight} protects files outside project",
  "Run {highlight}miko debug config{/highlight} to troubleshoot configuration",
  "Use {highlight}--print-logs{/highlight} flag to see detailed logs in stderr",
  (shortcuts) => `Use ${commandText("/timeline", shortcuts.sessionTimeline())} to jump to specific messages`,
  (shortcuts) => press(shortcuts.messagesToggleConceal(), "to toggle code block visibility in messages"),
  (shortcuts) => `Use ${commandText("/status", shortcuts.statusView())} to see system status info`,
  "Enable {highlight}scroll_acceleration{/highlight} in {highlight}tui.json{/highlight} for smooth macOS-style scrolling",
  (shortcuts) =>
    shortcuts.commandList()
      ? `Toggle username display in chat via the command palette (${shortcutText(shortcuts.commandList())})`
      : "Toggle username display in chat via the command palette",
  "Run {highlight}docker run -it --rm ghcr.io/jianga0801-ui/miko{/highlight} for containerized use",
  "Use {highlight}/connect{/highlight} with Miko Zen for curated, tested models",
  "Commit your project's {highlight}AGENTS.md{/highlight} file to Git for team sharing",
  "Use {highlight}/review{/highlight} to review uncommitted changes, branches, or PRs",
  (shortcuts) => `Use ${commandText("/help", shortcuts.helpShow())} to show the help dialog`,
  "Use {highlight}/rename{/highlight} to rename the current session",
  ...(process.platform === "win32"
    ? ([(shortcuts) => press(shortcuts.inputUndo(), "to undo changes in your prompt")] satisfies Tip[])
    : ([
        (shortcuts) => press(shortcuts.terminalSuspend(), "to suspend the terminal and return to your shell"),
      ] satisfies Tip[])),
]

const TIPS_ZH: Tip[] = [
  "输入 {highlight}@{/highlight} 加文件名即可模糊搜索并附加文件",
  "以 {highlight}!{/highlight} 开头的消息可直接运行 Shell 命令（例如 {highlight}!ls -la{/highlight}）",
  (shortcuts) => pressZh(shortcuts.permissionToggle(), "切换自动批准权限模式（开/关）"),
  "使用 {highlight}/undo{/highlight} 撤销上一条消息和文件改动",
  "使用 {highlight}/redo{/highlight} 恢复此前撤销的消息和文件改动",
  "运行 {highlight}/share{/highlight} 在 miko.dev 上为你的对话创建公开链接",
  "将图片或 PDF 拖放到终端即可作为上下文添加",
  (shortcuts) => pressZh(shortcuts.inputPaste(), "将剪贴板中的图片粘贴到输入框"),
  (shortcuts) => `使用 ${commandTextZh("/editor", shortcuts.editorOpen())} 在外部编辑器中撰写消息`,
  "运行 {highlight}/init{/highlight} 根据你的代码库自动生成项目规则",
  (shortcuts) => `使用 ${commandTextZh("/models", shortcuts.modelList())} 查看并切换可用的 AI 模型`,
  (shortcuts) => `使用 ${commandTextZh("/themes", shortcuts.themeList())} 在 ${themeCount} 个内置主题间切换`,
  (shortcuts) => `使用 ${commandTextZh("/new", shortcuts.sessionNew())} 开启一个全新的对话会话`,
  (shortcuts) => `使用 ${commandTextZh("/sessions", shortcuts.sessionList())} 列出、置顶并继续会话`,
  (shortcuts) => pressZh(shortcuts.sessionPinToggle(), "在会话列表中置顶会话，使其保持在顶部"),
  (shortcuts) =>
    shortcuts.sessionQuickSwitch1() && shortcuts.sessionQuickSwitch9()
      ? `已置顶的会话会分配快捷位；使用 ${shortcutText(shortcuts.sessionQuickSwitch1())} 到 ${shortcutText(shortcuts.sessionQuickSwitch9())} 切换`
      : undefined,
  "运行 {highlight}/compact{/highlight} 在接近上下文上限时压缩冗长的会话",
  (shortcuts) => `使用 ${commandTextZh("/export", shortcuts.sessionExport())} 将对话保存为 Markdown`,
  (shortcuts) => pressZh(shortcuts.messagesCopy(), "将助手的最后一条消息复制到剪贴板"),
  (shortcuts) => pressZh(shortcuts.commandList(), "查看所有可用的操作和选项"),
  "运行 {highlight}/connect{/highlight} 为 75+ 个受支持的 LLM Provider 添加 API key",
  (shortcuts) => `Leader 键是 ${shortcutText(shortcuts.leader())}；与其他键组合可快速操作`,
  (shortcuts) => pressZh(shortcuts.modelCycleRecent(), "在最近使用的模型间快速切换"),
  (shortcuts) => pressZh(shortcuts.sessionSidebarToggle(), "在会话中显示或隐藏侧边栏面板"),
  (shortcuts) =>
    shortcuts.messagesPageUp() && shortcuts.messagesPageDown()
      ? `使用 ${shortcutText(shortcuts.messagesPageUp())}/${shortcutText(shortcuts.messagesPageDown())} 浏览对话历史`
      : undefined,
  (shortcuts) => pressZh(shortcuts.messagesFirst(), "跳转到对话开头"),
  (shortcuts) => pressZh(shortcuts.messagesLast(), "跳转到最新消息"),
  (shortcuts) => pressZh(shortcuts.inputNewline(), "在输入框中换行"),
  (shortcuts) => pressZh(shortcuts.inputClear(), "在输入时清空输入框"),
  (shortcuts) => pressZh(shortcuts.sessionInterrupt(), "在 AI 回复过程中将其中断"),
  "运行 {highlight}/plan [task]{/highlight} 在改动前生成实现计划",
  "在输入中使用 {highlight}@agent-name{/highlight} 调用专门的子 Agent",
  (shortcuts) => {
    const items = [
      shortcuts.sessionParent(),
      shortcuts.childFirst(),
      shortcuts.childPrevious(),
      shortcuts.childNext(),
    ].filter(Boolean)
    if (!items.length) return undefined
    return `使用 ${items.map(shortcutText).join(" / ")} 在父会话和子会话间切换`
  },
  "创建 {highlight}miko.json{/highlight} 配置服务端设置，{highlight}tui.json{/highlight} 配置 TUI 设置",
  "将 TUI 设置放在 {highlight}~/.config/miko/tui.json{/highlight} 作为全局配置",
  "在配置中加入 {highlight}$schema{/highlight} 以在编辑器中获得自动补全",
  "在配置中设置 {highlight}model{/highlight} 来指定默认模型",
  "在 {highlight}tui.json{/highlight} 的 {highlight}keybinds{/highlight} 部分可覆盖任意快捷键",
  "将任意快捷键设为 {highlight}none{/highlight} 即可完全禁用",
  "在 {highlight}mcp{/highlight} 配置部分配置本地或远程 MCP 服务器",
  "将 {highlight}.md{/highlight} 文件放入 {highlight}.miko/command/{/highlight} 来定义可复用的自定义提示",
  "在自定义命令中使用 {highlight}$ARGUMENTS{/highlight}、{highlight}$1{/highlight}、{highlight}$2{/highlight} 实现动态输入",
  "在命令中使用反引号注入 Shell 输出（例如 {highlight}`git status`{/highlight}）",
  "将 {highlight}.md{/highlight} 文件放入 {highlight}.miko/agent/{/highlight} 来定义专门的 AI 角色",
  "为每个 Agent 配置 {highlight}edit{/highlight}、{highlight}bash{/highlight} 和 {highlight}webfetch{/highlight} 工具的权限",
  '使用类似 {highlight}"git *": "allow"{/highlight} 的模式实现细粒度的 bash 权限',
  '设置 {highlight}"rm -rf *": "deny"{/highlight} 来阻止破坏性命令',
  '配置 {highlight}"git push": "ask"{/highlight} 在推送前要求确认',
  '在配置中设置 {highlight}"formatter": true{/highlight} 启用 prettier、gofmt、ruff 等内置格式化工具',
  '在配置中设置 {highlight}"formatter": false{/highlight} 禁用由其他配置层启用的格式化工具',
  "在配置中为指定文件扩展名定义自定义格式化命令",
  '在配置中设置 {highlight}"lsp": true{/highlight} 启用内置 LSP 服务器进行代码分析',
  "在 {highlight}.miko/tool/{/highlight} 中创建 {highlight}.ts{/highlight} 文件来定义新的 LLM 工具",
  "工具定义可以调用用 Python、Go 等编写的脚本",
  "将 {highlight}.ts{/highlight} 文件放入 {highlight}.miko/plugins/{/highlight} 来添加事件钩子",
  "使用插件在会话完成时发送系统通知",
  "创建插件以阻止 Miko 读取敏感文件",
  "使用 {highlight}miko run{/highlight} 进行非交互式脚本化",
  "使用 {highlight}miko --continue{/highlight} 恢复上一个会话",
  "使用 {highlight}miko run -f file.ts{/highlight} 通过 CLI 附加文件",
  "使用 {highlight}--format json{/highlight} 在脚本中获得机器可读的输出",
  "运行 {highlight}miko serve{/highlight} 以无界面 API 方式访问 Miko",
  "使用 {highlight}miko run --attach{/highlight} 连接到正在运行的服务器",
  "运行 {highlight}miko upgrade{/highlight} 更新到最新版本",
  "运行 {highlight}miko auth list{/highlight} 查看所有已配置的 Provider",
  "运行 {highlight}miko agent create{/highlight} 进行引导式 Agent 创建",
  "在 GitHub issue/PR 中使用 {highlight}/miko{/highlight} 触发 AI 操作",
  "运行 {highlight}miko github install{/highlight} 设置 GitHub 工作流",
  "在 issue 上评论 {highlight}/miko fix this{/highlight} 自动创建 PR",
  "在 PR 代码行上评论 {highlight}/oc{/highlight} 进行针对性的代码审查",
  '使用 {highlight}"theme": "system"{/highlight} 匹配你终端的配色',
  "在 {highlight}.miko/themes/{/highlight} 目录中创建 JSON 主题文件",
  "主题支持深色/浅色两种模式的变体",
  "在自定义主题 JSON 中使用 0-255 的 xterm 数字颜色码",
  "使用 {highlight}{env:VAR_NAME}{/highlight} 语法在配置中引用环境变量",
  "使用 {highlight}{file:path}{/highlight} 在配置值中包含文件内容",
  "在配置中使用 {highlight}instructions{/highlight} 加载额外的规则文件",
  "将 Agent 的 {highlight}temperature{/highlight} 从 0.0（专注）设到 1.0（有创意）",
  "配置 {highlight}steps{/highlight} 限制每次请求的 Agent 迭代次数",
  '设置 {highlight}"tools": {"bash": false}{/highlight} 禁用特定工具',
  '设置 {highlight}"mcp_*": false{/highlight} 禁用某个 MCP 服务器的所有工具',
  "可在每个 Agent 配置中覆盖全局工具设置",
  '设置 {highlight}"share": "auto"{/highlight} 自动分享所有会话',
  '设置 {highlight}"share": "disabled"{/highlight} 禁止任何会话分享',
  "运行 {highlight}/unshare{/highlight} 取消会话的公开访问",
  "{highlight}doom_loop{/highlight} 权限可防止无限的工具调用循环",
  "{highlight}external_directory{/highlight} 权限可保护项目外的文件",
  "运行 {highlight}miko debug config{/highlight} 排查配置问题",
  "使用 {highlight}--print-logs{/highlight} 标志在 stderr 中查看详细日志",
  (shortcuts) => `使用 ${commandTextZh("/timeline", shortcuts.sessionTimeline())} 跳转到指定消息`,
  (shortcuts) => pressZh(shortcuts.messagesToggleConceal(), "切换消息中代码块的可见性"),
  (shortcuts) => `使用 ${commandTextZh("/status", shortcuts.statusView())} 查看系统状态信息`,
  "在 {highlight}tui.json{/highlight} 中启用 {highlight}scroll_acceleration{/highlight} 获得 macOS 风格的顺滑滚动",
  (shortcuts) =>
    shortcuts.commandList()
      ? `通过选项面板切换聊天中的用户名显示（${shortcutText(shortcuts.commandList())}）`
      : "通过选项面板切换聊天中的用户名显示",
  "运行 {highlight}docker run -it --rm ghcr.io/jianga0801-ui/miko{/highlight} 以容器方式使用",
  "搭配 Miko Zen 使用 {highlight}/connect{/highlight} 获取精选且经过测试的模型",
  "将项目的 {highlight}AGENTS.md{/highlight} 文件提交到 Git 以便团队共享",
  "使用 {highlight}/review{/highlight} 审查未提交的改动、分支或 PR",
  (shortcuts) => `使用 ${commandTextZh("/help", shortcuts.helpShow())} 显示帮助对话框`,
  "使用 {highlight}/rename{/highlight} 重命名当前会话",
  ...(process.platform === "win32"
    ? ([(shortcuts) => pressZh(shortcuts.inputUndo(), "撤销输入框中的改动")] satisfies Tip[])
    : ([
        (shortcuts) => pressZh(shortcuts.terminalSuspend(), "挂起终端并返回到你的 Shell"),
      ] satisfies Tip[])),
]
