export type MimoKeyType = "sk" | "tp-cn" | "tp-sgp" | "tp-ams"

export interface MimoKeyOption {
  type: MimoKeyType
  label: string
  description: string
  keyPrefix: string
  endpoint: string
}

export const MIMO_KEY_OPTIONS: MimoKeyOption[] = [
  {
    type: "sk",
    label: "Standard (sk-)",
    description: "Global endpoint, standard API key",
    keyPrefix: "sk-",
    endpoint: "https://api.xiaomimimo.com/v1",
  },
  {
    type: "tp-cn",
    label: "China (tp-)",
    description: "China region endpoint",
    keyPrefix: "tp-",
    endpoint: "https://cn.api.xiaomimimo.com/v1",
  },
  {
    type: "tp-sgp",
    label: "Singapore (tp-)",
    description: "Singapore region endpoint",
    keyPrefix: "tp-",
    endpoint: "https://sgp.api.xiaomimimo.com/v1",
  },
  {
    type: "tp-ams",
    label: "Amsterdam (tp-)",
    description: "Amsterdam region endpoint",
    keyPrefix: "tp-",
    endpoint: "https://ams.api.xiaomimimo.com/v1",
  },
]

export function detectMimoKeyType(apiKey: string): MimoKeyType | undefined {
  if (apiKey.startsWith("sk-")) return "sk"
  if (apiKey.startsWith("tp-")) {
    return undefined
  }
  return undefined
}

export function validateMimoKey(apiKey: string, keyType: MimoKeyType): string | undefined {
  if (!apiKey || apiKey.trim().length === 0) return "API key is required"
  if (keyType === "sk" && !apiKey.startsWith("sk-")) return "Standard keys must start with 'sk-'"
  if (keyType.startsWith("tp-") && !apiKey.startsWith("tp-")) return "Region keys must start with 'tp-'"
  if (apiKey.length < 10) return "API key seems too short"
  return undefined
}

export function isMimoProviderEnabled(providers: { id: string; enabled?: unknown }[]): boolean {
  const mimo = providers.find((p) => p.id === "mimo")
  return !!mimo?.enabled
}
