import { expect, test } from "bun:test"
import { tipsVisible } from "@/cli/cmd/tui/feature-plugins/home/tips"

test("shows home tips unless the user explicitly hides them", () => {
  expect(tipsVisible(false)).toBe(true)
  expect(tipsVisible(true)).toBe(false)
})
