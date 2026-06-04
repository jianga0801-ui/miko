import { createMemo } from "solid-js"
import { useLocal } from "@tui/context/local"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useTuiI18n } from "../context/i18n"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()
  const i18n = useTuiI18n()

  const options = createMemo(() =>
    local.agent.list().map((item) => {
      return {
        value: item.name,
        title: item.name,
        description: item.native ? i18n.t("agent.native") : item.description,
      }
    }),
  )

  return (
    <DialogSelect
      title={i18n.t("agent.select")}
      current={local.agent.current()?.name}
      options={options()}
      onSelect={(option) => {
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
  )
}
