import { createMemo } from "solid-js"
import { DialogSelect, type DialogSelectRef } from "@tui/ui/dialog-select"
import { type DialogContext } from "@tui/ui/dialog"
import {
  COMMAND_PALETTE_COMMAND,
  formatKeyBindings,
  type OpenTuiKeymap,
  useKeymapSelector,
  useMikoKeymap,
} from "../keymap"
import { useTuiConfig } from "../context/tui-config"
import { useTuiI18n } from "../context/i18n"
import { useLocal } from "@tui/context/local"

type PaletteCommandEntry = ReturnType<OpenTuiKeymap["getCommandEntries"]>[number]

function isVisiblePaletteCommand(command: PaletteCommandEntry["command"]) {
  return command.hidden !== true && command.name !== COMMAND_PALETTE_COMMAND
}

function isSuggestedPaletteCommand(entry: PaletteCommandEntry) {
  const suggested = entry.command.suggested
  if (typeof suggested === "boolean") return suggested
  if (typeof suggested === "function") return suggested() === true
  return false
}

export function CommandPaletteDialog() {
  const config = useTuiConfig()
  const i18n = useTuiI18n()
  const keymap = useMikoKeymap()
  const local = useLocal()

  // The thinking-mode toggle reflects its current state: when thinking is on we
  // offer to turn it off, and vice versa. Only applies to on/off style variants.
  function commandTitle(entry: PaletteCommandEntry) {
    if (entry.command.name === "variant.cycle" && local.model.variant.list().includes("disabled")) {
      const on = local.model.variant.effective() !== "disabled"
      return i18n.t(on ? "commands.thinkingModeDisable" : "commands.thinkingModeEnable")
    }
    return (
      i18n.command(typeof entry.command.title === "string" ? entry.command.title : entry.command.name) ??
      entry.command.name
    )
  }
  const entries = useKeymapSelector((keymap: OpenTuiKeymap) => {
    const query = {
      namespace: "palette",
    }
    const reachable = keymap.getCommandEntries({
      ...query,
      visibility: "reachable",
      filter: isVisiblePaletteCommand,
    })
    const registeredBindings = keymap.getCommandBindings({
      visibility: "registered",
      commands: reachable.map((entry) => entry.command.name),
    })

    return reachable.map((entry) => ({
      ...entry,
      bindings: registeredBindings.get(entry.command.name) ?? entry.bindings,
    }))
  })
  const options = createMemo(() =>
    entries().map((entry) => ({
      title: commandTitle(entry),
      description: i18n.command(typeof entry.command.desc === "string" ? entry.command.desc : undefined),
      category: i18n.command(typeof entry.command.category === "string" ? entry.command.category : undefined),
      footer: formatKeyBindings(entry.bindings, config),
      value: entry.command.name,
      suggested: isSuggestedPaletteCommand(entry),
      onSelect: (dialog: DialogContext) => {
        dialog.clear()
        keymap.dispatchCommand(entry.command.name)
      },
    })),
  )

  let ref: DialogSelectRef<string>
  const list = () => {
    if (ref?.filter) return options()
    return [
      ...options()
        .filter((option) => option.suggested)
        .map((option) => ({
          ...option,
          value: `suggested:${option.value}`,
          category: i18n.t("commands.suggested"),
        })),
      ...options(),
    ]
  }

  return <DialogSelect ref={(value) => (ref = value)} title={i18n.t("commands.title")} options={list()} />
}
