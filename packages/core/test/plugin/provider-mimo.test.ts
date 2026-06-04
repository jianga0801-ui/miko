import { describe, expect, mock, test } from "bun:test"
import { Effect } from "effect"
import { Catalog } from "@miko-ai/core/catalog"
import { PluginV2 } from "@miko-ai/core/plugin"
import { MimoPlugin, resolveMimoEndpoint } from "@miko-ai/core/plugin/provider/mimo"
import { ProviderV2 } from "@miko-ai/core/provider"
import { ModelV2 } from "@miko-ai/core/model"
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

describe("resolveMimoEndpoint", () => {
  test("routes sk- keys to the global endpoint regardless of region", () => {
    expect(resolveMimoEndpoint("sk-key")).toBe("https://api.xiaomimimo.com/v1")
    expect(resolveMimoEndpoint("sk-key", "sgp")).toBe("https://api.xiaomimimo.com/v1")
  })

  test("routes tp- keys to token-plan hosts by region, defaulting to cn", () => {
    expect(resolveMimoEndpoint("tp-key", "sgp")).toBe("https://token-plan-sgp.xiaomimimo.com/v1")
    expect(resolveMimoEndpoint("tp-key", "ams")).toBe("https://token-plan-ams.xiaomimimo.com/v1")
    expect(resolveMimoEndpoint("tp-key", "cn")).toBe("https://token-plan-cn.xiaomimimo.com/v1")
    expect(resolveMimoEndpoint("tp-key")).toBe("https://token-plan-cn.xiaomimimo.com/v1")
  })
})

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
        expect((mimoProv.endpoint as any).url).toBe("https://token-plan-sgp.xiaomimimo.com/v1")
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
        expect((mimoProv.endpoint as any).url).toBe("https://token-plan-cn.xiaomimimo.com/v1")
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
      // Pro: text-only agentic LLM, 1M context / 128K output, no key in this
      // test so the pay-as-you-go ($) pricing applies with a 256K context tier.
      expect(proModel.capabilities.tools).toBe(true)
      expect(proModel.capabilities.input).toEqual(["text"])
      expect(proModel.capabilities.output).toEqual(["text", "reasoning"])
      expect(proModel.limit.context).toBe(1_048_576)
      expect(proModel.limit.output).toBe(131_072)
      expect(proModel.enabled).toBe(true)
      expect(proModel.cost).toHaveLength(1)
      expect(proModel.cost[0]).toEqual({ input: 0.435, output: 0.87, cache: { read: 0.0036, write: 0 } })

      // mimo-v2.5 is the omni model; image is the attachable modality (audio/
      // video go through the mimo_analyze_media tool, not message attachments).
      const omniModel = yield* catalog.model.get(ProviderV2.ID.mimo, ModelV2.ID.make("mimo-v2.5"))
      expect(omniModel.capabilities.input).toEqual(["text", "image"])
      expect(omniModel.limit.context).toBe(1_048_576)
      expect(omniModel.cost[0]).toEqual({ input: 0.14, output: 0.28, cache: { read: 0.0028, write: 0 } })
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
