import { createSignal } from "solid-js"
import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { DialogTavilySetup } from "./dialog-tavily-setup"
import { detectMimoKeyType, isMimoProviderEnabled, providerIDForMimoKeyType, validateMimoKey } from "@/provider/mimo-setup"

export function DialogMimoSetup() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()
  const [busy, setBusy] = createSignal(false)

  return (
    <DialogPrompt
      title="Enter MiMo API Key"
      placeholder="sk-... or tp-..."
      busy={busy()}
      busyText="Saving..."
      description={() => (
        <box gap={1}>
          <text fg={theme.textMuted}>
            Standard keys start with <span style={{ fg: theme.text }}>sk-</span>; Token Plan keys start with{" "}
            <span style={{ fg: theme.text }}>tp-</span>
          </text>
          <text fg={theme.textMuted}>
            Token Plan keys default to the China endpoint. Get a key:{" "}
            <span style={{ fg: theme.text }}>https://mimo.xiaomi.com</span>
          </text>
        </box>
      )}
      onConfirm={async (value) => {
        const key = value.trim()
        const keyType = detectMimoKeyType(key)
        if (!keyType) {
          toast.show({ variant: "error", message: "MiMo API keys must start with 'sk-' or 'tp-'" })
          return
        }
        const error = validateMimoKey(key, keyType)
        if (error) {
          toast.show({ variant: "error", message: error })
          return
        }
        const metadata: Record<string, string> = {}
        if (keyType !== "sk") {
          const region = keyType.replace("tp-", "")
          metadata.region = region
        }
        const providerID = providerIDForMimoKeyType(keyType)
        setBusy(true)
        try {
          const auth = { type: "api" as const, key, metadata }
          await sdk.client.auth.set({ providerID: "mimo", auth })
          await sdk.client.auth.set({ providerID, auth })
          await sdk.client.instance.dispose()
          await sync.bootstrap()
          toast.show({ variant: "info", message: "MiMo API key saved" })
        } finally {
          setBusy(false)
        }
        dialog.replace(() => <DialogTavilySetup providerID={providerID} />)
      }}
    />
  )
}

export function isMimoSetupNeeded(providers: { id: string }[]): boolean {
  return !isMimoProviderEnabled(providers)
}
