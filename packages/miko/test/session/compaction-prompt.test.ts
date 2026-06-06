import { expect, test } from "bun:test"
import { buildPrompt } from "../../src/session/compaction"

test("asks compaction summaries to follow the user's language", () => {
  const prompt = buildPrompt({ context: [] })

  expect(prompt).toContain("predominant language used by the user's recent messages")
  expect(prompt).toContain("translating the template labels")
})
