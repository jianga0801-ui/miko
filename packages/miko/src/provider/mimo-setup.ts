export type MimoKeyType = "sk" | "tp-cn" | "tp-sgp" | "tp-ams"

export interface MimoKeyOption {
  type: MimoKeyType
  label: string
  description: string
  keyPrefix: string
  endpoint: string
  providerID: string
}

export const MIMO_KEY_OPTIONS: MimoKeyOption[] = [
  {
    type: "sk",
    label: "Standard (sk-)",
    description: "Global endpoint, standard API key",
    keyPrefix: "sk-",
    endpoint: "https://api.xiaomimimo.com/v1",
    providerID: "xiaomi",
  },
  {
    type: "tp-cn",
    label: "China (tp-)",
    description: "China region Token Plan endpoint",
    keyPrefix: "tp-",
    endpoint: "https://token-plan-cn.xiaomimimo.com/v1",
    providerID: "xiaomi-token-plan-cn",
  },
  {
    type: "tp-sgp",
    label: "Singapore (tp-)",
    description: "Singapore region Token Plan endpoint",
    keyPrefix: "tp-",
    endpoint: "https://token-plan-sgp.xiaomimimo.com/v1",
    providerID: "xiaomi-token-plan-sgp",
  },
  {
    type: "tp-ams",
    label: "Amsterdam (tp-)",
    description: "Amsterdam region Token Plan endpoint",
    keyPrefix: "tp-",
    endpoint: "https://token-plan-ams.xiaomimimo.com/v1",
    providerID: "xiaomi-token-plan-ams",
  },
]

export const MIMO_PROVIDER_IDS = [
  ...MIMO_KEY_OPTIONS.map((option) => option.providerID),
  "mimo",
]

export function isMimoProviderID(providerID: string): boolean {
  return MIMO_PROVIDER_IDS.includes(providerID)
}

export function filterMimoProviders<T>(providers: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(providers).filter(([providerID]) => isMimoProviderID(providerID)))
}

export function detectMimoKeyType(apiKey: string): MimoKeyType | undefined {
  const key = apiKey.trim()
  if (key.length < 10) return undefined
  if (key.startsWith("sk-")) return "sk"
  if (key.startsWith("tp-")) return "tp-cn"
  return undefined
}

export function validateMimoKey(apiKey: string, keyType: MimoKeyType): string | undefined {
  if (!apiKey || apiKey.trim().length === 0) return "API key is required"
  if (keyType === "sk" && !apiKey.startsWith("sk-")) return "Standard keys must start with 'sk-'"
  if (keyType.startsWith("tp-") && !apiKey.startsWith("tp-")) return "Region keys must start with 'tp-'"
  if (apiKey.length < 10) return "API key seems too short"
  return undefined
}

export function providerIDForMimoKeyType(keyType: MimoKeyType): string {
  return MIMO_KEY_OPTIONS.find((option) => option.type === keyType)?.providerID ?? "xiaomi-token-plan-cn"
}

export function isMimoProviderEnabled(providers: { id: string; enabled?: unknown }[]): boolean {
  return providers.some((provider) => isMimoProviderID(provider.id))
}
