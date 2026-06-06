import { TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import * as Clipboard from "@tui/util/clipboard"
import { createSignal } from "solid-js"
import { InstallationVersion } from "@miko-ai/core/installation/version"
import { getScrollAcceleration } from "../util/scroll"
import { resolveTuiLanguage } from "../i18n"

export function ErrorComponent(props: {
  error: Error
  reset: () => void
  exit: () => Promise<void>
  mode?: "dark" | "light"
}) {
  const term = useTerminalDimensions()

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      void props.exit()
    }
  })
  const [copied, setCopied] = createSignal(false)

  const issueURL = new URL("https://github.com/jianga0801-ui/miko/issues/new?template=bug-report.yml")

  // Choose safe fallback colors per mode since theme context may not be available
  const isLight = props.mode === "light"
  const colors = {
    bg: isLight ? "#ffffff" : "#0a0a0a",
    text: isLight ? "#1a1a1a" : "#eeeeee",
    muted: isLight ? "#8a8a8a" : "#808080",
    primary: isLight ? "#3b7dd8" : "#fab283",
  }

  if (props.error.message) {
    issueURL.searchParams.set("title", `opentui: fatal: ${props.error.message}`)
  }

  if (props.error.stack) {
    issueURL.searchParams.set(
      "description",
      "```\n" + props.error.stack.substring(0, 6000 - issueURL.toString().length) + "...\n```",
    )
  }

  issueURL.searchParams.set("miko-version", InstallationVersion)

  const copyIssueURL = () => {
    void Clipboard.copy(issueURL.toString()).then(() => {
      setCopied(true)
    })
  }

  const isZh = resolveTuiLanguage(undefined) === "zh-CN"
  const textPleaseReport = isZh ? "请报告此问题。" : "Please report an issue."
  const textCopyUrl = isZh ? "复制 Issue 链接（已预填异常信息）" : "Copy issue URL (exception info pre-filled)"
  const textSuccessfullyCopied = isZh ? "复制成功" : "Successfully copied"
  const textFatalError = isZh ? "发生致命错误！" : "A fatal error occurred!"
  const textResetTui = isZh ? "重置 TUI" : "Reset TUI"
  const textExit = isZh ? "退出" : "Exit"

  return (
    <box flexDirection="column" gap={1} backgroundColor={colors.bg}>
      <box flexDirection="row" gap={1} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={colors.text}>
          {textPleaseReport}
        </text>
        <box onMouseUp={copyIssueURL} backgroundColor={colors.primary} padding={1}>
          <text attributes={TextAttributes.BOLD} fg={colors.bg}>
            {textCopyUrl}
          </text>
        </box>
        {copied() && <text fg={colors.muted}>{textSuccessfullyCopied}</text>}
      </box>
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={colors.text}>{textFatalError}</text>
        <box onMouseUp={props.reset} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>{textResetTui}</text>
        </box>
        <box onMouseUp={() => void props.exit()} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>{textExit}</text>
        </box>
      </box>
      <scrollbox height={Math.floor(term().height * 0.7)} scrollAcceleration={getScrollAcceleration()}>
        <text fg={colors.muted}>{props.error.stack}</text>
      </scrollbox>
      <text fg={colors.text}>{props.error.message}</text>
    </box>
  )
}
