import { describe, expect, test } from "bun:test"
import { createTuiI18n, formatMcpConnectionError, translateCommandText } from "@/cli/cmd/tui/i18n"

describe("tui i18n", () => {
  test("translates input editor which-key labels shown in zh-CN", () => {
    expect(translateCommandText("New line", "zh-CN")).toBe("换行")
    expect(translateCommandText("Submit", "zh-CN")).toBe("提交")
    expect(translateCommandText("Visual line end", "zh-CN")).toBe("可视行尾")
    expect(translateCommandText("Visual line start", "zh-CN")).toBe("可视行首")
    expect(translateCommandText("Select to buffer end", "zh-CN")).toBe("选择到输入缓冲区末尾")
    expect(translateCommandText("Select to buffer start", "zh-CN")).toBe("选择到输入缓冲区开头")
    expect(translateCommandText("Select to visual line end", "zh-CN")).toBe("选择到可视行尾")
    expect(translateCommandText("Select to visual line start", "zh-CN")).toBe("选择到可视行首")
    expect(translateCommandText("leader", "zh-CN")).toBe("前导键")
  })

  test("translates MCP sidebar connection failures", () => {
    const i18n = createTuiI18n("zh-CN")

    expect(i18n.t("sidebar.mcp.failed", { reason: i18n.t("sidebar.mcp.error.sse405") })).toBe(
      "连接失败：服务端拒绝 SSE 连接（405）",
    )
    expect(formatMcpConnectionError("SSE error: Non-200 status code (405)", i18n)).toBe(
      "连接失败：服务端拒绝 SSE 连接（405）",
    )
  })

  test("translates message and subagent action dialogs", () => {
    const i18n = createTuiI18n("zh-CN")

    expect(i18n.t("session.shareConfirm.title")).toBe("分享会话")
    expect(i18n.t("session.shareConfirm.message")).toBe("确定要分享此会话吗？")
    expect(i18n.t("session.rename.title")).toBe("重命名会话")
    expect(i18n.t("session.timeline.title")).toBe("跳转到消息")
    expect(i18n.t("session.fork.full")).toBe("完整会话")
    expect(i18n.t("session.compaction")).toBe("会话压缩")
    expect(i18n.t("session.copy.success")).toBe("会话记录已复制到剪贴板")
    expect(i18n.t("session.export.success", { filename: "session.md" })).toBe("会话已导出到 session.md")
    expect(i18n.t("export.title")).toBe("导出选项")
    expect(i18n.t("export.includeThinking")).toBe("包含思考过程")
    expect(i18n.t("session.exit.session")).toBe("会话")
    expect(i18n.t("session.exit.continue")).toBe("继续")
    expect(i18n.t("system.heapSnapshotWritten", { files: "tui.heapsnapshot" })).toBe("堆快照已写入 tui.heapsnapshot")
    expect(i18n.t("diff.source.workingTree")).toBe("工作树")
    expect(i18n.t("diff.empty")).toBe("没有差异")
    expect(i18n.t("debug.title")).toBe("调试信息")
    expect(i18n.t("console.title")).toBe("控制台")
    expect(i18n.t("console.focused", { title: i18n.t("console.title") })).toBe("控制台（已聚焦）")
    expect(translateCommandText("Next export option", "zh-CN")).toBe("下一个导出选项")
    expect(translateCommandText("Toggle export option", "zh-CN")).toBe("切换导出选项")
    expect(translateCommandText("Toggle generic tool output", "zh-CN")).toBe("展开/收起通用工具输出")
    expect(i18n.t("session.messageCopy.success")).toBe("消息已复制到剪贴板")
    expect(translateCommandText("Compact session", "zh-CN")).toBe("压缩会话")
    expect(translateCommandText("Rename session", "zh-CN")).toBe("重命名会话")
    expect(translateCommandText("Fork session", "zh-CN")).toBe("复刻会话")
    expect(translateCommandText("Jump to message", "zh-CN")).toBe("跳转到消息")
    expect(translateCommandText("Copy session transcript", "zh-CN")).toBe("复制会话记录")
    expect(i18n.t("messageActions.title")).toBe("消息操作")
    expect(i18n.t("messageActions.revert.description")).toBe("撤销消息和文件改动")
    expect(i18n.t("messageActions.copy.description")).toBe("将消息文本复制到剪贴板")
    expect(i18n.t("messageActions.fork.description")).toBe("创建一个新会话")
    expect(i18n.t("subagentActions.title")).toBe("子智能体操作")
    expect(i18n.t("subagentActions.open.description")).toBe("子智能体会话")
  })
})
