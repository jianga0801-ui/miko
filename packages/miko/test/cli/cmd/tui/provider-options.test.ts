import { describe, expect, test } from "bun:test"
import { providerOptions } from "../../../../src/cli/cmd/tui/component/dialog-provider"

describe("providerOptions", () => {
  test("does not include a synthetic Other option", () => {
    expect(providerOptions([{ id: "xiaomi-token-plan-cn", name: "Xiaomi Token Plan (China)" }])).toEqual([
      {
        type: "provider",
        title: "Xiaomi Token Plan (China)",
        value: "xiaomi-token-plan-cn",
        providerID: "xiaomi-token-plan-cn",
        description: "(Recommended)",
        category: "Popular",
      },
    ])
  })

  test("uses Providers as the fallback category", () => {
    expect(providerOptions([{ id: "some-provider", name: "Some Provider" }])[0]?.category).toBe("Providers")
  })

  test("orders MiMo providers first", () => {
    const values = providerOptions([
      { id: "xiaomi-token-plan-ams", name: "Xiaomi Token Plan (Europe)" },
      { id: "xiaomi-token-plan-cn", name: "Xiaomi Token Plan (China)" },
      { id: "xiaomi", name: "Xiaomi" },
    ]).map((option) => option.value)
    expect(values).toEqual(["xiaomi-token-plan-cn", "xiaomi", "xiaomi-token-plan-ams"])
  })
})
