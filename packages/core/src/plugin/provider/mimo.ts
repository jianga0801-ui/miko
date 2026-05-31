import { Effect } from "effect"
import { ModelV2 } from "../../model"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"
import { makeMimoFetch, resolveMimoWebSearchConfig } from "./mimo-media"

/**
 * Resolve the MiMo OpenAI-compatible base URL from an API key + region.
 *
 * `sk-` keys always hit the global endpoint; `tp-` (token-plan) keys are
 * region-routed. This is the single source of truth for MiMo endpoint routing
 * so chat, TTS, and any other MiMo-backed feature stay aligned to the same
 * key + region the user configured.
 */
export function resolveMimoEndpoint(apiKey: string, region?: string): string {
  if (apiKey.startsWith("tp-")) {
    if (region === "sgp") return "https://sgp.api.xiaomimimo.com/v1"
    if (region === "ams") return "https://ams.api.xiaomimimo.com/v1"
    return "https://cn.api.xiaomimimo.com/v1"
  }
  return "https://api.xiaomimimo.com/v1"
}

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
          
          const url = resolveMimoEndpoint(apiKey, region)

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
        // Rewrite audio/video sentinel parts into MiMo content blocks and inject
        // the built-in web_search tool (when enabled) on the way out, so both
        // ride the same key + endpoint as chat.
        const opts = evt.options as Record<string, any>
        opts.fetch = makeMimoFetch(opts.fetch ?? globalThis.fetch, { webSearch: resolveMimoWebSearchConfig() })
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        evt.sdk = mod.createOpenAICompatible(evt.options as any)
      }),
    }
  }),
})
