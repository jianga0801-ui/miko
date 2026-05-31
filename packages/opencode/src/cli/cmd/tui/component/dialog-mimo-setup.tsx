import { createSignal, Show } from "solid-js"
import { useDialog } from "../ui/dialog"
import { DialogSelect } from "../ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { DialogModel } from "./dialog-model"
import { MIMO_KEY_OPTIONS, validateMimoKey, type MimoKeyType } from "@/provider/mimo-setup"

export function DialogMimoSetup() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()
  const [step, setStep] = createSignal<"select" | "input">("select")
  const [selectedType, setSelectedType] = createSignal<MimoKeyType | null>(null)

  const keyTypeOptions = MIMO_KEY_OPTIONS.map((opt) => ({
    title: opt.label,
    value: opt.type,
    description: opt.description,
  }))

  if (step() === "select") {
    return (
      <DialogSelect
        title="Setup MiMo API Key"
        options={keyTypeOptions}
        footerHints={[
          { title: "Get a key", label: "https://mimo.xiaomi.com", side: "left" },
        ]}
        onSelect={(option) => {
          setSelectedType(option.value as MimoKeyType)
          setStep("input")
        }}
      />
    )
  }

  const keyType = selectedType()!
  const option = MIMO_KEY_OPTIONS.find((o) => o.type === keyType)!

  return (
    <DialogPrompt
      title={`Enter ${option.label} API Key`}
      placeholder={option.keyPrefix + "..."}
      description={() => (
        <box gap={1}>
          <text fg={theme.textMuted}>{option.description}</text>
          <text fg={theme.textMuted}>
            Endpoint: <span style={{ fg: theme.text }}>{option.endpoint}</span>
          </text>
          <Show when={keyType === "sk"}>
            <text fg={theme.textMuted}>
              Keys starting with <span style={{ fg: theme.text }}>sk-</span> use the global endpoint
            </text>
          </Show>
          <Show when={keyType.startsWith("tp-")}>
            <text fg={theme.textMuted}>
              Keys starting with <span style={{ fg: theme.text }}>tp-</span> use region-specific endpoints
            </text>
          </Show>
        </box>
      )}
      onConfirm={async (value) => {
        const error = validateMimoKey(value, keyType)
        if (error) {
          toast.show({ variant: "error", message: error })
          return
        }
        const metadata: Record<string, string> = {}
        if (keyType !== "sk") {
          const region = keyType.replace("tp-", "")
          metadata.region = region
        }
        await sdk.client.auth.set({
          providerID: "mimo",
          auth: {
            type: "api",
            key: value,
            metadata,
          },
        })
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        toast.show({ variant: "info", message: "MiMo API key saved" })
        dialog.replace(() => <DialogModel providerID="mimo" />)
      }}
    />
  )
}

export function isMimoSetupNeeded(providers: { id: string }[]): boolean {
  return !providers.some((p) => p.id === "mimo")
}
