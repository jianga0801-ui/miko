import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useTuiI18n } from "@tui/context/i18n"

export function DialogSubagent(props: { sessionID: string }) {
  const route = useRoute()
  const i18n = useTuiI18n()

  return (
    <DialogSelect
      title={i18n.t("subagentActions.title")}
      options={[
        {
          title: i18n.t("subagentActions.open.title"),
          value: "subagent.view",
          description: i18n.t("subagentActions.open.description"),
          onSelect: (dialog) => {
            route.navigate({
              type: "session",
              sessionID: props.sessionID,
            })
            dialog.clear()
          },
        },
      ]}
    />
  )
}
