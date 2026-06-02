import { describe, expect, test } from "bun:test"
import {
  createVoiceToggleController,
  shouldIgnoreVoiceToggleEvent,
} from "../../../../src/cli/cmd/tui/component/prompt/voice-toggle"

describe("voice toggle repeat handling", () => {
  test("ignores keyboard repeat events", () => {
    expect(shouldIgnoreVoiceToggleEvent({ repeated: true, eventType: "press" })).toBe(true)
    expect(shouldIgnoreVoiceToggleEvent({ repeated: false, eventType: "repeat" })).toBe(true)
  })

  test("keeps normal presses toggleable", () => {
    expect(shouldIgnoreVoiceToggleEvent({ repeated: false, eventType: "press" })).toBe(false)
    expect(shouldIgnoreVoiceToggleEvent(undefined)).toBe(false)
  })

  test("starts immediately when idle", () => {
    const toggle = createVoiceToggleController({ quietWindowMs: 900, minimumRecordingMs: 800 })

    expect(toggle({ recording: false, now: 1_000 })).toBe("start")
  })

  test("ignores repeat events while idle without arming a recording", () => {
    const toggle = createVoiceToggleController({ quietWindowMs: 900, minimumRecordingMs: 800 })

    expect(toggle({ recording: false, event: { repeated: true, eventType: "press" }, now: 1_000 })).toBe("ignore")
    expect(toggle({ recording: false, now: 1_100 })).toBe("start")
  })

  test("does not stop from the same physical key hold", () => {
    const toggle = createVoiceToggleController({ quietWindowMs: 900, minimumRecordingMs: 800 })

    expect(toggle({ recording: false, now: 1_000 })).toBe("start")
    expect(toggle({ recording: true, now: 1_040 })).toBe("ignore")
    expect(toggle({ recording: true, now: 1_700 })).toBe("ignore")
    expect(toggle({ recording: true, now: 2_300 })).toBe("ignore")
  })

  test("stops after the key stream goes quiet and the user presses again", () => {
    const toggle = createVoiceToggleController({ quietWindowMs: 900, minimumRecordingMs: 800 })

    expect(toggle({ recording: false, now: 1_000 })).toBe("start")
    expect(toggle({ recording: true, now: 1_600 })).toBe("ignore")
    expect(toggle({ recording: true, now: 2_700 })).toBe("stop")
  })
})
