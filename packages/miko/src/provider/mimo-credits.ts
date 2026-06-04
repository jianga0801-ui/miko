/**
 * MiMo Token Plan "Credits" estimation.
 *
 * Token Plan (`tp-`) keys are flat-rate subscriptions billed in **Credits**, not
 * money — so miko's USD cost is 0 for them. This module estimates how many plan
 * Credits a session consumed, using MiMo's published per-token Credit rates and
 * the nighttime discount, so the sidebar can show a meaningful figure for tp-
 * users instead of "$0.00".
 *
 * Rates and discount verified against
 * platform.xiaomimimo.com/docs/zh-CN/price/tokenplan/subscription (2026-06-02):
 *   - per-token Credits: cached input / uncached input / output
 *   - cache write is free (0 Credits); TTS models are free
 *   - nighttime discount: Beijing 00:00–08:00 (== UTC 16:00–24:00) → 0.8x
 *
 * Estimate only — the platform's account-side ledger is authoritative.
 */

export interface MimoCreditRate {
  /** Credits per cached ("命中缓存") input token. */
  cache: number
  /** Credits per uncached ("未命中缓存") input token. */
  input: number
  /** Credits per output token (reasoning tokens billed as output). */
  output: number
}

/** Per-token Credit rates by model id. Models not listed (e.g. TTS) are free. */
export const MIMO_CREDIT_RATES: Record<string, MimoCreditRate> = {
  "mimo-v2.5-pro": { cache: 2.5, input: 300, output: 600 },
  "mimo-v2-pro": { cache: 2.5, input: 300, output: 600 },
  "mimo-v2.5": { cache: 2, input: 100, output: 200 },
  "mimo-v2-omni": { cache: 2, input: 100, output: 200 },
}

/** Token Plan provider ids look like `xiaomi-token-plan-{cn,sgp,ams}`. */
export function isTokenPlanProviderID(providerID: string): boolean {
  return providerID.includes("token-plan")
}

/**
 * Nighttime Credit-consumption coefficient. The discount window is Beijing
 * 00:00–08:00, i.e. UTC 16:00–24:00, where consumption is multiplied by 0.8.
 */
export function mimoNighttimeCoefficient(atMs: number): number {
  const utcHour = new Date(atMs).getUTCHours()
  return utcHour >= 16 ? 0.8 : 1
}

export interface MimoCreditTokens {
  /** Non-cached input tokens (miko's adjusted input). */
  input: number
  /** Output tokens (excluding reasoning). */
  output: number
  /** Reasoning tokens (billed at the output rate). */
  reasoning: number
  cache: {
    /** Cached ("命中缓存") input tokens. */
    read: number
    /** Cache write tokens — free, 0 Credits. */
    write: number
  }
}

/**
 * Estimate the Credits consumed by a single assistant turn. Returns 0 for models
 * with no Credit rate (e.g. TTS, which is free, or unknown ids).
 */
export function computeMimoCredits(input: {
  modelID: string
  tokens: MimoCreditTokens
  atMs: number
}): number {
  const rate = MIMO_CREDIT_RATES[input.modelID]
  if (!rate) return 0

  const base =
    input.tokens.cache.read * rate.cache +
    input.tokens.input * rate.input +
    (input.tokens.output + input.tokens.reasoning) * rate.output

  return base * mimoNighttimeCoefficient(input.atMs)
}
