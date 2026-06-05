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

    expect(i18n.t("messageActions.title")).toBe("消息操作")
    expect(i18n.t("messageActions.revert.description")).toBe("撤销消息和文件改动")
    expect(i18n.t("messageActions.copy.description")).toBe("将消息文本复制到剪贴板")
    expect(i18n.t("messageActions.fork.description")).toBe("创建一个新会话")
    expect(i18n.t("subagentActions.title")).toBe("子智能体操作")
    expect(i18n.t("subagentActions.open.description")).toBe("子智能体会话")
  })
})
