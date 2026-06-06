import { Effect } from "effect"
import { ModelV2 } from "../../model"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"
import { makeMimoFetch, resolveMimoWebSearchConfig } from "./mimo-media"

/**
 * Resolve the MiMo OpenAI-compatible base URL from an API key + region.
 *
 * `sk-` (balance / pay-as-you-go) keys hit the global endpoint; `tp-`
 * (Token Plan) keys are region-routed to the dedicated token-plan hosts.
 * These hostnames are verified against the live platform — the `tp-` host is
 * `token-plan-<region>.xiaomimimo.com`, NOT `<region>.api.xiaomimimo.com`
 * (those subdomains do not exist). This is the single source of truth for MiMo
 * endpoint routing so chat, TTS, and any other MiMo-backed feature stay aligned
 * to the same key + region the user configured.
 */
export function resolveMimoEndpoint(apiKey: string, region?: string): string {
  if (apiKey.startsWith("tp-")) {
    if (region === "sgp") return "https://token-plan-sgp.xiaomimimo.com/v1"
    if (region === "ams") return "https://token-plan-ams.xiaomimimo.com/v1"
    return "https://token-plan-cn.xiaomimimo.com/v1"
  }
  return "https://api.xiaomimimo.com/v1"
}

export const MimoPlugin = PluginV2.define({
  id: PluginV2.ID.make("mimo"),
  effect: Effect.gen(function* () {
    return {
      "catalog.transform": Effect.fn(function* (evt) {
        // Resolve the active key once so the provider endpoint and the per-model
        // cost (token-plan vs pay-as-you-go) stay consistent.
        let resolvedApiKey = process.env.MIMO_API_KEY || ""
        evt.provider.update(ProviderV2.ID.mimo, (provider) => {
          provider.name = "Xiaomi MiMo"
          provider.env = ["MIMO_API_KEY", "MIMO_REGION"]

          const settings = provider.api.type === "aisdk" ? (provider.api.settings ?? {}) : {}
          const customKey = settings["apiKey"] as string | undefined
          const customRegion = settings["region"] as string | undefined
          const apiKey = customKey || process.env.MIMO_API_KEY || ""
          const region = customRegion || process.env.MIMO_REGION || "cn"
          resolvedApiKey = apiKey

          const hasKey = Boolean(apiKey)
          if (hasKey && !provider.enabled) {
            provider.enabled = { via: "env", name: "MIMO_API_KEY" }
          }

          const url = resolveMimoEndpoint(apiKey, region)

          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/mimo",
            url,
            settings: {
              ...settings,
              ...(apiKey ? { apiKey } : {}),
            },
          }

          if (apiKey) {
            provider.request.headers["Authorization"] = `Bearer ${apiKey}`
          }
        })

        // Cost is USD per 1M tokens (miko computes tokens * price / 1_000_000).
        // `tp-` (Token Plan) keys are flat-rate across every region (cn/sgp/ams),
        // so per-token cost is 0. `sk-` (pay-as-you-go) keys use MiMo's published
        // *overseas* ($) pricing — a single flat rate per model (the earlier
        // <=256K / 256K-1M context tiers were removed in the 2026-05-27
        // repricing); cached input is far cheaper than uncached and cache write
        // is free. Domestic accounts are billed in CNY at a different per-model
        // ratio, so the USD figure is a relative estimate. Verified against
        // platform.xiaomimimo.com/docs/zh-CN/price/pay-as-you-go (2026-06-02).
        const isTokenPlan = resolvedApiKey.startsWith("tp-")

        // V2.5-series catalog only, matching the official platform docs:
        //  - mimo-v2.5-pro: text LLM, 1M context / 128K output
        //  - mimo-v2.5:     OMNI model, 1M context / 128K output
        // Modalities reflect what is *attachable* on the OpenAI-compatible chat
        // path: mimo-v2.5 takes image/audio/video input. Images are standard
        // image_url; audio/video are carried as sentinel text parts through the
        // AI SDK and rewritten to MiMo's official blocks by mimo-media fetch.
        const mimoModels = [
          {
            id: "mimo-v2.5-pro",
            name: "Xiaomi MiMo Pro",
            input: ["text"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0.435, cache: 0.0036, output: 0.87 },
          },
          {
            id: "mimo-v2.5",
            name: "Xiaomi MiMo (Omni)",
            input: ["text", "image", "audio", "video"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0.14, cache: 0.0028, output: 0.28 },
          },
          {
            id: "mimo-v2.5-asr",
            name: "Xiaomi MiMo ASR",
            input: ["audio"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0, cache: 0, output: 0 },
            capabilities: { tools: false, output: ["text"] as const },
          },
          {
            id: "mimo-v2.5-tts",
            name: "Xiaomi MiMo TTS",
            input: ["text"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0, cache: 0, output: 0 },
            capabilities: { tools: false, output: ["audio"] as const },
          },
          {
            id: "mimo-v2.5-tts-voiceclone",
            name: "Xiaomi MiMo TTS VoiceClone",
            input: ["text"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0, cache: 0, output: 0 },
            capabilities: { tools: false, output: ["audio"] as const },
          },
          {
            id: "mimo-v2.5-tts-voicedesign",
            name: "Xiaomi MiMo TTS VoiceDesign",
            input: ["text"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0, cache: 0, output: 0 },
            capabilities: { tools: false, output: ["audio"] as const },
          },
        ]

        for (const m of mimoModels) {
          evt.model.update(ProviderV2.ID.mimo, ModelV2.ID.make(m.id), (model) => {
            model.name = m.name
            model.family = ModelV2.Family.make("mimo")
            model.capabilities = {
              tools: ("capabilities" in m && m.capabilities && "tools" in m.capabilities) ? m.capabilities.tools : true,
              input: [...m.input],
              output: ("capabilities" in m && m.capabilities && "output" in m.capabilities) ? [...m.capabilities.output] : ["text", "reasoning"],
            }
            model.limit = {
              context: m.context,
              output: m.output,
            }
            model.cost = [
              isTokenPlan
                ? { input: 0, output: 0, cache: { read: 0, write: 0 } }
                : {
                    input: m.price.input,
                    output: m.price.output,
                    cache: { read: m.price.cache, write: 0 },
                  },
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
