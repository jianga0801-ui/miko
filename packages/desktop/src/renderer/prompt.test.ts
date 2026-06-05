import { expect, test } from "bun:test"
import { buildPromptParts } from "./prompt"

test("buildPromptParts wraps text into a single text part", () => {
  expect(buildPromptParts("hello")).toEqual([{ type: "text", text: "hello" }])
})

test("buildPromptParts trims surrounding whitespace", () => {
  expect(buildPromptParts("  hi  ")).toEqual([{ type: "text", text: "hi" }])
})

test("buildPromptParts returns empty array for blank input", () => {
  expect(buildPromptParts("   ")).toEqual([])
})
