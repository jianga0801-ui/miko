import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { syncCurrentOption } from "@/cli/cmd/tui/ui/dialog-select"

test("keeps current option selected when options are rebuilt", async () => {
  let rebuild: (() => void) | undefined
  let move: ((index: number) => void) | undefined
  let selected: (() => number) | undefined

  const dispose = createRoot((dispose) => {
    const [options, setOptions] = createSignal([
      { title: "A", value: "a" },
      { title: "B", value: "b" },
      { title: "C", value: "c" },
    ])
    const [index, setIndex] = createSignal(0)

    syncCurrentOption({
      options,
      current: () => "b",
      selected: index,
      select: setIndex,
    })

    rebuild = () =>
      setOptions([
        { title: "C", value: "c" },
        { title: "A", value: "a" },
        { title: "B", value: "b" },
      ])
    move = setIndex
    selected = index
    return dispose
  })

  try {
    await Promise.resolve()
    expect(selected?.()).toBe(1)

    move?.(0)
    await Promise.resolve()
    expect(selected?.()).toBe(0)

    rebuild?.()
    await Promise.resolve()
    expect(selected?.()).toBe(2)
  } finally {
    dispose()
  }
})
