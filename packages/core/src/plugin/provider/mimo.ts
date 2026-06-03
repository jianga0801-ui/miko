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

          const customKey = provider.options.aisdk.provider.apiKey as string | undefined
          const customRegion = provider.options.aisdk.provider.region as string | undefined
          const apiKey = customKey || process.env.MIMO_API_KEY || ""
          const region = customRegion || process.env.MIMO_REGION || "cn"
          resolvedApiKey = apiKey

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

        // Cost is USD per 1M tokens (miko computes tokens * price / 1_000_000).
        // `tp-` (Token Plan) keys are flat-rate across every region (cn/sgp/ams),
        // so per-token cost is 0. `sk-` (pay-as-you-go) keys use MiMo's published
        // *overseas* ($) pricing, which is tiered by context length (<=256K vs
        // 256K-1M, the higher tier ~2x) and cache state; cache read is ~0.2x
        // input and cache write is currently free. Domestic accounts are billed
        // in CNY at ~7x these numbers — the ratio is preserved, so the USD figure
        // stays a faithful relative estimate. Verified against
        // platform.xiaomimimo.com/docs/zh-CN/pricing (2026-04-30).
        const isTokenPlan = resolvedApiKey.startsWith("tp-")
        const TIER_HIGH = 262_144 // 256K — where the higher price tier begins

        // V2.5-series catalog only, matching the official platform docs:
        //  - mimo-v2.5-pro: text LLM, 1M context / 128K output
        //  - mimo-v2.5:     OMNI model, 1M context / 128K output
        // Modalities reflect what is *attachable* on the OpenAI-compatible chat
        // path: only mimo-v2.5 takes image input (standard image_url, which the
        // AI SDK emits natively). Audio/video are NOT declared here — the AI SDK
        // openai-compatible provider throws on video and reshapes audio, so MiMo
        // audio/video understanding is exposed via the mimo_analyze_media tool
        // instead, not as message attachments. Both models are tiered by context
        // length (<=256K vs 256K-1M).
        const mimoModels = [
          {
            id: "mimo-v2.5-pro",
            name: "Xiaomi MiMo Pro",
            input: ["text"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 1.0, cache: 0.2, output: 3.0 },
            priceHigh: { input: 2.0, cache: 0.4, output: 6.0 } as { input: number; cache: number; output: number } | undefined,
          },
          {
            id: "mimo-v2.5",
            name: "Xiaomi MiMo (Omni)",
            input: ["text", "image"] as const,
            context: 1_048_576,
            output: 131_072,
            price: { input: 0.4, cache: 0.08, output: 2.0 },
            priceHigh: { input: 0.8, cache: 0.16, output: 4.0 } as { input: number; cache: number; output: number } | undefined,
          },
        ]

        for (const m of mimoModels) {
          evt.model.update(ProviderV2.ID.mimo, ModelV2.ID.make(m.id), (model) => {
            model.name = m.name
            model.family = ModelV2.Family.make("mimo")
            model.capabilities = {
              tools: true,
              input: [...m.input],
              output: ["text", "reasoning"],
            }
            model.limit = {
              context: m.context,
              output: m.output,
            }
            if (isTokenPlan) {
              model.cost = [{ input: 0, output: 0, cache: { read: 0, write: 0 } }]
            } else {
              const base = {
                input: m.price.input,
                output: m.price.output,
                cache: { read: m.price.cache, write: 0 },
              }
              model.cost = m.priceHigh
                ? [
                    base,
                    {
                      tier: { type: "context" as const, size: TIER_HIGH },
                      input: m.priceHigh.input,
                      output: m.priceHigh.output,
                      cache: { read: m.priceHigh.cache, write: 0 },
                    },
                  ]
                : [base]
            }
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
