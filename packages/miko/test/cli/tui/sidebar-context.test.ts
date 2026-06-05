import { describe, expect, test } from "bun:test"
import { computeTokenPlanSessionCredits } from "@/cli/cmd/tui/feature-plugins/sidebar/context"

describe("sidebar context", () => {
  test("sums only Token Plan assistant credits", () => {
    const messages = [
      {
        role: "user",
        content: "hello",
      },
      {
        role: "assistant",
        providerID: "xiaomi-token-plan-cn",
        modelID: "mimo-v2.5",
        tokens: {
          input: 1000,
          output: 100,
          reasoning: 50,
          cache: { read: 500, write: 100 },
        },
        time: { created: new Date("2026-06-04T10:00:00Z").getTime() },
      },
      {
        role: "assistant",
        providerID: "xiaomi", // pay-as-you-go, not token plan
        modelID: "mimo-v2.5",
        tokens: {
          input: 1000,
          output: 100,
          reasoning: 50,
          cache: { read: 500, write: 100 },
        },
        time: { created: new Date("2026-06-04T10:00:00Z").getTime() },
      },
    ]

    // Only the first assistant message counts because providerID for the second is "xiaomi" (non-token-plan)
    // 1000 * 100 + 500 * 2 + (100 + 50) * 200 = 131,000 credits
    expect(computeTokenPlanSessionCredits(messages)).toBe(131000)
  })
})
