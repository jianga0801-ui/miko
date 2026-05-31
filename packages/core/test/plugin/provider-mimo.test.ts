import { describe, expect, mock } from "bun:test"
import { Effect } from "effect"
import { Catalog } from "@opencode-ai/core/catalog"
import { PluginV2 } from "@opencode-ai/core/plugin"
import { MimoPlugin } from "@opencode-ai/core/plugin/provider/mimo"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { it, model, withEnv } from "./provider-helper"

const mimoOptions: Record<string, any>[] = []

void mock.module("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (options: Record<string, any>) => {
    mimoOptions.push({ ...options })
    return {
      languageModel: (modelID: string) => ({
        modelID,
        provider: `${options.name ?? "mimo"}.chat`,
        specificationVersion: "v3",
      }),
    }
  },
}))

describe("MimoPlugin", () => {
  it.effect("registers mimo provider name and env keys on catalog transform", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(MimoPlugin)
      const transform = yield* catalog.transform()
      yield* transform((catalog) => {
        // Just trigger catalog transform
      })
      const mimoProv = yield* catalog.provider.get(ProviderV2.ID.mimo)
      expect(mimoProv.name).toBe("Xiaomi MiMo")
      expect(mimoProv.env).toEqual(["MIMO_API_KEY", "MIMO_REGION"])
    }),
  )

  it.effect("routes sk- keys to default api.xiaomimimo.com endpoint", () =>
    withEnv({ MIMO_API_KEY: "sk-test-key", MIMO_REGION: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MimoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {})
        
        const mimoProv = yield* catalog.provider.get(ProviderV2.ID.mimo)
        expect((mimoProv.endpoint as any).url).toBe("https://api.xiaomimimo.com/v1")
        expect(mimoProv.options.aisdk.provider.apiKey).toBe("sk-test-key")
        expect(mimoProv.options.headers["Authorization"]).toBe("Bearer sk-test-key")
        expect(mimoProv.enabled).toBeDefined()
      }),
    ),
  )

  it.effect("routes tp- keys with different regions appropriately", () =>
    withEnv({ MIMO_API_KEY: "tp-test-key", MIMO_REGION: "sgp" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MimoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {})
        
        const mimoProv = yield* catalog.provider.get(ProviderV2.ID.mimo)
        expect((mimoProv.endpoint as any).url).toBe("https://sgp.api.xiaomimimo.com/v1")
      }),
    ),
  )

  it.effect("routes tp- keys default to cn when region is not sgp/ams", () =>
    withEnv({ MIMO_API_KEY: "tp-test-key", MIMO_REGION: "cn" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(MimoPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {})
        
        const mimoProv = yield* catalog.provider.get(ProviderV2.ID.mimo)
        expect((mimoProv.endpoint as any).url).toBe("https://cn.api.xiaomimimo.com/v1")
      }),
    ),
  )

  it.effect("registers models on catalog transform", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(MimoPlugin)
      const transform = yield* catalog.transform()
      yield* transform((catalog) => {})
      
      const proModel = yield* catalog.model.get(ProviderV2.ID.mimo, ModelV2.ID.make("mimo-v2.5-pro"))
      expect(proModel.name).toBe("Xiaomi MiMo Pro")
      expect(proModel.family).toBe(ModelV2.Family.make("mimo"))
      expect(proModel.capabilities.tools).toBe(true)
      expect(proModel.enabled).toBe(true)
    }),
  )

  it.effect("creates a Mimo SDK only for @ai-sdk/mimo package", () =>
    Effect.gen(function* () {
      mimoOptions.length = 0
      const plugin = yield* PluginV2.Service
      yield* plugin.add(MimoPlugin)
      
      const ignored = yield* plugin.trigger(
        "aisdk.sdk",
        { model: model("mimo", "mimo-v2.5-pro"), package: "@ai-sdk/openai-compatible", options: { name: "mimo" } },
        {},
      )
      expect(ignored.sdk).toBeUndefined()

      const result = yield* plugin.trigger(
        "aisdk.sdk",
        { model: model("mimo", "mimo-v2.5-pro"), package: "@ai-sdk/mimo", options: { name: "mimo" } },
        {},
      )
      expect(result.sdk).toBeDefined()
      expect(result.options.includeUsage).toBe(true)
    }),
  )
})
