import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "./dialog"
import { useBindings, useCommandShortcut } from "../keymap"
import { useTuiI18n } from "../context/i18n"

export function DialogHelp() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const i18n = useTuiI18n()
  const commandShortcut = useCommandShortcut("command.palette.show")

  useBindings(() => ({
    bindings: [
      { key: "return", desc: i18n.t("dialog.closeHelp"), group: i18n.t("dialog.category"), cmd: () => dialog.clear() },
      { key: "escape", desc: i18n.t("dialog.closeHelp"), group: i18n.t("dialog.category"), cmd: () => dialog.clear() },
    ],
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {i18n.t("help.title")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc/enter
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={theme.textMuted}>
          {i18n.t("help.message", { shortcut: commandShortcut() })}
        </text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box paddingLeft={3} paddingRight={3} backgroundColor={theme.primary} onMouseUp={() => dialog.clear()}>
          <text fg={theme.selectedListItemText}>{i18n.t("common.ok")}</text>
        </box>
      </box>
    </box>
  )
}
