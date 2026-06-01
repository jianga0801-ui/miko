import { describe, expect, test } from "bun:test"
import { selectVoiceRecorder } from "../../../../src/cli/cmd/tui/util/voice-input"

describe("voice input helpers", () => {
  test("prefers the managed ffmpeg binary", () => {
    const recorder = selectVoiceRecorder((cmd) => cmd === "/managed/ffmpeg" || cmd === "arecord", "/managed/ffmpeg")

    expect(recorder?.cmd).toBe("/managed/ffmpeg")
    expect(recorder?.args("/tmp/voice.wav")).toContain("alsa")
  })

  test("selects the first available recorder without a fixed duration", () => {
    const recorder = selectVoiceRecorder((cmd) => cmd === "arecord")

    expect(recorder?.cmd).toBe("arecord")
    expect(recorder?.args("/tmp/voice.wav")).toEqual([
      "-q",
      "-t",
      "wav",
      "-f",
      "S16_LE",
      "-r",
      "16000",
      "-c",
      "1",
      "/tmp/voice.wav",
    ])
  })
})
