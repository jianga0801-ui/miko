import { describe, expect, test } from "bun:test"
import {
  computeMimoCredits,
  isTokenPlanProviderID,
  mimoNighttimeCoefficient,
  parseMimoCreditAmount,
} from "@/provider/mimo-credits"

const DAY = new Date("2026-06-04T10:00:00Z").getTime() // UTC 10:00 → full rate
const NIGHT = new Date("2026-06-04T18:00:00Z").getTime() // UTC 18:00 → 0.8x

describe("isTokenPlanProviderID", () => {
  test("only token-plan providers", () => {
    expect(isTokenPlanProviderID("xiaomi-token-plan-cn")).toBe(true)
    expect(isTokenPlanProviderID("xiaomi-token-plan-sgp")).toBe(true)
    expect(isTokenPlanProviderID("xiaomi-token-plan-ams")).toBe(true)
    expect(isTokenPlanProviderID("xiaomi")).toBe(false)
    expect(isTokenPlanProviderID("mimo")).toBe(false)
  })
})

describe("mimoNighttimeCoefficient", () => {
  test("0.8x during UTC 16:00–24:00 (Beijing 00:00–08:00), else 1x", () => {
    expect(mimoNighttimeCoefficient(DAY)).toBe(1)
    expect(mimoNighttimeCoefficient(NIGHT)).toBe(0.8)
    expect(mimoNighttimeCoefficient(new Date("2026-06-04T16:00:00Z").getTime())).toBe(0.8)
    expect(mimoNighttimeCoefficient(new Date("2026-06-04T15:59:00Z").getTime())).toBe(1)
    expect(mimoNighttimeCoefficient(new Date("2026-06-04T23:59:00Z").getTime())).toBe(0.8)
    expect(mimoNighttimeCoefficient(new Date("2026-06-04T00:00:00Z").getTime())).toBe(1)
  })
})

describe("computeMimoCredits", () => {
  const tokens = { input: 1000, output: 100, reasoning: 50, cache: { read: 500, write: 200 } }

  test("pro: calculates based on official rates", () => {
    // 1000 * 300 + 500 * 2.5 + (100 + 50) * 600 = 300000 + 1250 + 90000 = 391250
    expect(computeMimoCredits({ modelID: "mimo-v2.5-pro", tokens, atMs: DAY })).toBe(391250)
  })

  test("omni: calculates based on official rates", () => {
    // 1000 * 100 + 500 * 2 + (100 + 50) * 200 = 100000 + 1000 + 30000 = 131000
    expect(computeMimoCredits({ modelID: "mimo-v2.5", tokens, atMs: DAY })).toBe(131000)
  })

  test("nighttime applies 0.8x", () => {
    expect(computeMimoCredits({ modelID: "mimo-v2.5-pro", tokens, atMs: NIGHT })).toBe(391250 * 0.8)
  })

  test("cache write is free (not counted)", () => {
    const noWrite = { ...tokens, cache: { read: 500, write: 0 } }
    expect(computeMimoCredits({ modelID: "mimo-v2.5-pro", tokens: noWrite, atMs: DAY })).toBe(391250)
  })

  test("TTS / unknown models are free (0 credits)", () => {
    expect(computeMimoCredits({ modelID: "mimo-v2.5-tts", tokens, atMs: DAY })).toBe(0)
    expect(computeMimoCredits({ modelID: "gpt-4o", tokens, atMs: DAY })).toBe(0)
  })

  test("asr calculates based on duration", () => {
    // 1800 seconds (30 mins) @ 30M credits/hr = 15,000,000 credits
    const asrTokens = { input: 1800, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
    expect(computeMimoCredits({ modelID: "mimo-v2.5-asr", tokens: asrTokens, atMs: DAY })).toBe(15000000)
    expect(computeMimoCredits({ modelID: "mimo-v2.5-asr", tokens: asrTokens, atMs: NIGHT })).toBe(15000000 * 0.8)
  })
})

describe("parseMimoCreditAmount", () => {
  test("accepts raw, comma, and compact credit amounts", () => {
    expect(parseMimoCreditAmount("1000")).toBe(1000)
    expect(parseMimoCreditAmount("1,000,000")).toBe(1000000)
    expect(parseMimoCreditAmount("1.5m")).toBe(1500000)
    expect(parseMimoCreditAmount("2b")).toBe(2000000000)
  })

  test("rejects empty or malformed values", () => {
    expect(parseMimoCreditAmount(undefined)).toBeUndefined()
    expect(parseMimoCreditAmount("")).toBeUndefined()
    expect(parseMimoCreditAmount("ten")).toBeUndefined()
    expect(parseMimoCreditAmount("1mb")).toBeUndefined()
  })
})
