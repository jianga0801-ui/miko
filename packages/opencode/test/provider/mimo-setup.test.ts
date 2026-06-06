import { describe, expect, test } from "bun:test"
import {
  detectMimoKeyType,
  filterMimoProviders,
  isMimoProviderEnabled,
  providerIDForMimoKeyType,
} from "../../src/provider/mimo-setup"
import { fromModelsDevProvider } from "../../src/provider/provider"

describe("mimo setup", () => {
  test("detects complete MiMo key types from pasted keys", () => {
    expect(detectMimoKeyType("sk-1234567890")).toBe("sk")
    expect(detectMimoKeyType("tp-c1k8czc1kucd9ck37bwiyllpahxwfqlw")).toBe("tp-cn")
  })

  test("does not detect short prefixes as complete keys", () => {
    expect(detectMimoKeyType("sk-")).toBeUndefined()
    expect(detectMimoKeyType("tp-")).toBeUndefined()
  })

  test("maps MiMo key types to the actual Xiaomi providers", () => {
    expect(providerIDForMimoKeyType("sk")).toBe("xiaomi")
    expect(providerIDForMimoKeyType("tp-cn")).toBe("xiaomi-token-plan-cn")
  })

  test("treats Xiaomi providers as MiMo setup completion", () => {
    expect(isMimoProviderEnabled([{ id: "xiaomi-token-plan-cn" }])).toBe(true)
    expect(isMimoProviderEnabled([{ id: "openai" }])).toBe(false)
  })

  test("filters provider catalogs to MiMo providers only", () => {
    expect(
      Object.keys(
        filterMimoProviders({
          openai: {},
          "xiaomi-token-plan-cn": {},
          anthropic: {},
          xiaomi: {},
        }),
      ),
    ).toEqual(["xiaomi-token-plan-cn", "xiaomi"])
  })

  test("keeps catalog MiMo model capabilities unchanged", () => {
    const provider = fromModelsDevProvider({
      id: "xiaomi-token-plan-cn",
      name: "Xiaomi",
      env: [],
      npm: "@ai-sdk/openai-compatible",
      api: "https://token-plan-cn.xiaomimimo.com/v1",
      models: {
        "mimo-v2.5-pro": {
          id: "mimo-v2.5-pro",
          name: "MiMo-V2.5-Pro",
          attachment: false,
          reasoning: true,
          release_date: "2026-01-01",
          temperature: true,
          tool_call: true,
          modalities: { input: ["text"], output: ["text"] },
          limit: { context: 128000, input: 128000, output: 4096 },
          cost: { input: 0, output: 0 },
        },
        "mimo-v2.5": {
          id: "mimo-v2.5",
          name: "MiMo-V2.5",
          attachment: true,
          reasoning: true,
          release_date: "2026-01-01",
          temperature: true,
          tool_call: true,
          modalities: { input: ["text", "image", "audio", "video"], output: ["text"] },
          limit: { context: 128000, input: 128000, output: 4096 },
          cost: { input: 0, output: 0 },
        },
        "mimo-v2-pro": {
          id: "mimo-v2-pro",
          name: "MiMo-V2-Pro",
          attachment: false,
          reasoning: true,
          release_date: "2026-01-01",
          temperature: true,
          tool_call: true,
          modalities: { input: ["text"], output: ["text"] },
          limit: { context: 128000, input: 128000, output: 4096 },
          cost: { input: 0, output: 0 },
        },
        "mimo-v2-omni": {
          id: "mimo-v2-omni",
          name: "MiMo-V2-Omni",
          attachment: true,
          reasoning: true,
          release_date: "2026-01-01",
          temperature: true,
          tool_call: true,
          modalities: { input: ["text", "image", "audio", "video"], output: ["text"] },
          limit: { context: 128000, input: 128000, output: 4096 },
          cost: { input: 0, output: 0 },
        },
      },
    } as Parameters<typeof fromModelsDevProvider>[0])

    expect(provider.models["mimo-v2.5-pro"]?.capabilities.attachment).toBe(false)
    expect(provider.models["mimo-v2.5-pro"]?.capabilities.input.image).toBe(false)
    expect(provider.models["mimo-v2.5"]?.capabilities.input.image).toBe(true)
    expect(provider.models["mimo-v2.5"]?.capabilities.input.audio).toBe(true)
    expect(provider.models["mimo-v2.5"]?.capabilities.input.video).toBe(true)
    expect(provider.models["mimo-v2-pro"]).toBeUndefined()
    expect(provider.models["mimo-v2-omni"]).toBeUndefined()
  })
})
