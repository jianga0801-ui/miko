import { createSignal } from "solid-js"
import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { DialogModel } from "./dialog-model"

export function DialogTavilySetup(props: { providerID: string }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()
  const [busy, setBusy] = createSignal(false)

  const proceed = () => dialog.replace(() => <DialogModel providerID={props.providerID} />)

  return (
    <DialogPrompt
      title="Setup Tavily Web Search (optional)"
      placeholder="tvly-..."
      busy={busy()}
      busyText="Saving..."
      description={() => (
        <box gap={1}>
          <text fg={theme.textMuted}>Enables web search for any model. Leave empty and submit to skip.</text>
          <text fg={theme.textMuted}>
            Get a key: <span style={{ fg: theme.text }}>https://app.tavily.com</span>
          </text>
        </box>
      )}
      onConfirm={async (value) => {
        const key = value.trim()
        if (!key) {
          proceed()
          return
        }
        if (!key.startsWith("tvly-")) {
          toast.show({ variant: "error", message: "Tavily keys start with 'tvly-'" })
          return
        }
        setBusy(true)
        try {
          await sdk.client.auth.set({ providerID: "tavily", auth: { type: "api", key } })
          await sdk.client.instance.dispose()
          await sync.bootstrap()
          toast.show({ variant: "info", message: "Tavily API key saved" })
        } finally {
          setBusy(false)
        }
        proceed()
      }}
    />
  )
}
