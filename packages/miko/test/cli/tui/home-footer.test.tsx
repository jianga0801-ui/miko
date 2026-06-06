/** @jsxImportSource @opentui/solid */
import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { TuiPluginApi } from "@miko-ai/plugin/tui"
import { View } from "@/cli/cmd/tui/feature-plugins/home/footer"
import { createTuiPluginApi } from "../../fixture/tui-plugin"

let setup: Awaited<ReturnType<typeof testRender>> | undefined

afterEach(() => {
  setup?.renderer.destroy()
  setup = undefined
})

test("hides which-key shortcut hint when its command is not registered", async () => {
  const api = createTuiPluginApi({
    keymap: {
      getCommandBindings: () => new Map(),
    } as unknown as TuiPluginApi["keymap"],
  })

  setup = await testRender(() => <View api={api} />, { width: 80, height: 4 })
  await setup.renderOnce()

  const frame = setup.captureCharFrame()
  expect(frame).not.toContain("F1")
  expect(frame).not.toContain("f1")
})
