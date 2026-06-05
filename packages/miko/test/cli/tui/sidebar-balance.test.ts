import { describe, expect, test } from "bun:test"
import {
  computeTokenPlanSessionCredits,
  tokenPlanRemaining,
} from "../../../src/cli/cmd/tui/feature-plugins/sidebar/balance"

const DAY = new Date("2026-06-04T10:00:00Z").getTime()

function assistant(input: { providerID: string; modelID: string; tokens?: Partial<any> }) {
  return {
    role: "assistant",
    providerID: input.providerID,
    modelID: input.modelID,
    time: { created: DAY },
    tokens: {
      input: 100,
      output: 10,
      reasoning: 5,
      cache: { read: 20, write: 200 },
      ...input.tokens,
    },
  }
}

describe("sidebar balance", () => {
  test("sums only Token Plan assistant credits", () => {
    const messages = [
      assistant({ providerID: "xiaomi-token-plan-cn", modelID: "mimo-v2.5" }),
      assistant({ providerID: "xiaomi", modelID: "mimo-v2.5-pro" }),
      assistant({ providerID: "xiaomi-token-plan-cn", modelID: "mimo-v2.5-pro" }),
    ]

    // V2.5: 135 * 1, V2.5-Pro: 135 * 2.
    expect(computeTokenPlanSessionCredits(messages)).toBe(405)
  })

  test("subtracts session usage from the local remaining-credit baseline", () => {
    expect(tokenPlanRemaining({ current: 1000, used: 405 })).toBe(595)
    expect(tokenPlanRemaining({ current: 100, used: 405 })).toBe(0)
    expect(tokenPlanRemaining({ used: 405 })).toBeUndefined()
  })
})
