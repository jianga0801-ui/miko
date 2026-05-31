import { Effect } from "effect"
import { ModelV2 } from "../../model"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const MimoPlugin = PluginV2.define({
  id: PluginV2.ID.make("mimo"),
  effect: Effect.gen(function* () {
    return {
      "catalog.transform": Effect.fn(function* (evt) {
        evt.provider.update(ProviderV2.ID.mimo, (provider) => {
          provider.name = "Xiaomi MiMo"
          provider.env = ["MIMO_API_KEY", "MIMO_REGION"]
          
          const customKey = provider.options.aisdk.provider.apiKey as string | undefined
          const customRegion = provider.options.aisdk.provider.region as string | undefined
          const apiKey = customKey || process.env.MIMO_API_KEY || ""
          const region = customRegion || process.env.MIMO_REGION || "cn"
          
          const hasKey = Boolean(apiKey)
          if (hasKey && !provider.enabled) {
            provider.enabled = { via: "env", name: "MIMO_API_KEY" }
          }
          
          let url = "https://api.xiaomimimo.com/v1"
          
          if (apiKey.startsWith("sk-")) {
            url = "https://api.xiaomimimo.com/v1"
          } else if (apiKey.startsWith("tp-")) {
            if (region === "sgp") {
              url = "https://sgp.api.xiaomimimo.com/v1"
            } else if (region === "ams") {
              url = "https://ams.api.xiaomimimo.com/v1"
            } else {
              url = "https://cn.api.xiaomimimo.com/v1"
            }
          }
          
          provider.endpoint = {
            type: "aisdk",
            package: "@ai-sdk/mimo",
            url,
          }
          
          if (apiKey) {
            provider.options.aisdk.provider.apiKey = apiKey
            provider.options.headers["Authorization"] = `Bearer ${apiKey}`
          }
        })

        const mimoModels = [
          { id: "mimo-v2.5-pro", name: "Xiaomi MiMo Pro" },
          { id: "mimo-v2.5-flash", name: "Xiaomi MiMo Flash" },
          { id: "mimo-v2.5-nano", name: "Xiaomi MiMo Nano" },
        ]

        for (const m of mimoModels) {
          evt.model.update(ProviderV2.ID.mimo, ModelV2.ID.make(m.id), (model) => {
            model.name = m.name
            model.family = ModelV2.Family.make("mimo")
            model.capabilities = {
              tools: true,
              input: ["text", "image"],
              output: ["text"],
            }
            model.limit = {
              context: 128000,
              output: 4096,
            }
            model.cost = [
              {
                input: 0.0015,
                output: 0.005,
                cache: {
                  read: 0,
                  write: 0,
                },
              }
            ]
            model.enabled = true
            model.status = "active"
          })
        }
      }),
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/mimo") return
        if (evt.options.includeUsage !== false) evt.options.includeUsage = true
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        evt.sdk = mod.createOpenAICompatible(evt.options as any)
      }),
    }
  }),
})
