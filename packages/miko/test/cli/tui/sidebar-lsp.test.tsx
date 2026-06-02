/** @jsxImportSource @opentui/solid */
import { afterEach, describe, expect, test } from "bun:test"
import { testRender, type JSX } from "@opentui/solid"
import { View } from "../../../src/cli/cmd/tui/feature-plugins/sidebar/lsp"
import { createTuiPluginApi } from "../../fixture/tui-plugin"

let testSetup: Awaited<ReturnType<typeof testRender>> | undefined

afterEach(() => {
  testSetup?.renderer.destroy()
  testSetup = undefined
})

async function renderFrame(component: () => JSX.Element) {
  testSetup = await testRender(component, { width: 60, height: 6 })
  await testSetup.renderOnce()
  await Bun.sleep(25)
  await testSetup.renderOnce()

  return testSetup
    .captureCharFrame()
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd()
}

describe("Sidebar LSP", () => {
  test("treats omitted lsp config as enabled", async () => {
    const api = createTuiPluginApi({ state: { config: {}, lsp: () => [] } })

    const frame = await renderFrame(() => <View api={api} />)

    expect(frame).toContain("LSPs will activate as files are read")
    expect(frame).not.toContain("LSPs are disabled")
  })

  test("shows disabled only when lsp is explicitly false", async () => {
    const api = createTuiPluginApi({ state: { config: { lsp: false }, lsp: () => [] } })

    const frame = await renderFrame(() => <View api={api} />)

    expect(frame).toContain("LSPs are disabled")
  })
})
