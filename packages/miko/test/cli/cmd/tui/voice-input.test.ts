import { describe, expect, test } from "bun:test"
import { createWavBuffer, selectVoiceRecorder } from "../../../../src/cli/cmd/tui/util/voice-input"

describe("voice input helpers", () => {
  test("prefers the integrated PulseAudio recorder for WSLg microphone input", () => {
    const recorder = selectVoiceRecorder((cmd) => cmd === "/managed/ffmpeg", "/managed/ffmpeg", "/mnt/wslg/PulseServer")

    expect(recorder?.cmd).toBe("pulseaudio.js")
  })

  test("prefers the managed ffmpeg binary", () => {
    const recorder = selectVoiceRecorder(
      (cmd) => cmd === "/managed/ffmpeg" || cmd === "arecord",
      "/managed/ffmpeg",
      "",
    )

    expect(recorder?.cmd).toBe("/managed/ffmpeg")
    expect(recorder?.args("/tmp/voice.wav")).toContain("alsa")
  })

  test("selects the first available recorder without a fixed duration", () => {
    const recorder = selectVoiceRecorder((cmd) => cmd === "arecord", undefined, "")

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

  test("wraps recorded pcm as mono 16khz wav", () => {
    const wav = createWavBuffer(Buffer.from([1, 0, 2, 0]))

    expect(wav.subarray(0, 4).toString()).toBe("RIFF")
    expect(wav.subarray(8, 12).toString()).toBe("WAVE")
    expect(wav.subarray(12, 16).toString()).toBe("fmt ")
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(16000)
    expect(wav.subarray(36, 40).toString()).toBe("data")
    expect(wav.readUInt32LE(40)).toBe(4)
  })
})
