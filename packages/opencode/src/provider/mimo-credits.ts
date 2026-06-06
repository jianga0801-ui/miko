/**
 * MiMo Token Plan "Credits" estimation.
 *
 * Token Plan (`tp-`) keys are flat-rate subscriptions billed in **Credits**, not
 * money, so miko's USD cost is 0 for them. This module estimates how many plan
 * Credits a session consumed using MiMo's published V2.5 conversion ratios and
 * nighttime discount.
 *
 * Rates and discount verified against
 * platform.xiaomimimo.com/docs/en-US/tokenplan/subscription (2026-06-05):
 *   - MiMo-V2.5: 1x Credit consumption
 *   - MiMo-V2.5-Pro: 2x Credit consumption
 *   - TTS series models are free for a limited time
 *   - nighttime discount: Beijing 00:00-08:00 (== UTC 16:00-24:00) -> 0.8x
 *
 * Estimate only — the platform's account-side ledger is authoritative.
 */

export interface MimoCreditRate {
  /** Credits per uncached input token. */
  input: number
  /** Credits per output token. */
  output: number
  /** Credits per cached input token. */
  cacheRead: number
}

/** Credit rates (per token) by model id. Models not listed (e.g. TTS) are free. */
export const MIMO_CREDIT_RATES: Record<string, MimoCreditRate> = {
  "mimo-v2.5-pro": { input: 300, output: 600, cacheRead: 2.5 },
  "mimo-v2.5": { input: 100, output: 200, cacheRead: 2 },
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
  /** Non-cached input tokens. */
  input: number
  /** Output tokens, excluding reasoning. */
  output: number
  /** Reasoning tokens. */
  reasoning: number
  cache: {
    /** Cached input tokens. */
    read: number
    /** Cache write tokens. */
    write: number
  }
}

/**
 * Estimate the Credits consumed by a single assistant turn. Returns 0 for models
 * with no Credit rate, such as currently-free TTS models or unknown ids.
 */
export function computeMimoCredits(input: {
  modelID: string
  tokens: MimoCreditTokens
  atMs: number
}): number {
  if (input.modelID === "mimo-v2.5-asr") {
    // For ASR, audio duration in seconds is stored in input.tokens.input
    const durationSec = input.tokens.input
    const totalCredits = (durationSec * 30_000_000) / 3600
    return totalCredits * mimoNighttimeCoefficient(input.atMs)
  }

  if (input.modelID.startsWith("mimo-v2.5-tts")) {
    return 0
  }

  const rate = MIMO_CREDIT_RATES[input.modelID]
  if (!rate) return 0

  const uncachedInputCredits = input.tokens.input * rate.input
  const cachedInputCredits = input.tokens.cache.read * rate.cacheRead
  const outputCredits = (input.tokens.output + input.tokens.reasoning) * rate.output

  const totalCredits = uncachedInputCredits + cachedInputCredits + outputCredits

  return totalCredits * mimoNighttimeCoefficient(input.atMs)
}

export function parseMimoCreditAmount(input: string | undefined): number | undefined {
  if (!input) return
  const normalized = input.trim().replace(/,/g, "").toLowerCase()
  const match = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(normalized)
  if (!match) return

  const value = Number(match[1])
  if (!Number.isFinite(value)) return

  const suffix = match[2]
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1
  return value * multiplier
}
