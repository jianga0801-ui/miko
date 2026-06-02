import { describe, expect, test } from "bun:test"
import {
  createWavBuffer,
  parseDirectShowAudioDevices,
  readVoiceInputFile,
  resolveManagedFFmpegPath,
  selectVoiceRecorder,
} from "../../../../src/cli/cmd/tui/util/voice-input"

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
      "linux",
    )

    expect(recorder?.cmd).toBe("/managed/ffmpeg")
    expect(recorder?.args("/tmp/voice.wav")).toContain("alsa")
  })

  test("uses DirectShow for the managed ffmpeg binary on Windows", () => {
    const recorder = selectVoiceRecorder(
      (cmd) => cmd === "C:\\Users\\me\\AppData\\Local\\Programs\\Miko\\bin\\ffmpeg.exe",
      "C:\\Users\\me\\AppData\\Local\\Programs\\Miko\\bin\\ffmpeg.exe",
      "",
      "win32",
    )

    expect(recorder?.cmd).toBe("C:\\Users\\me\\AppData\\Local\\Programs\\Miko\\bin\\ffmpeg.exe")
    expect(recorder?.args("C:\\Temp\\voice.wav", "麦克风 (2- K5 TX)")).toEqual([
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "dshow",
      "-i",
      "audio=麦克风 (2- K5 TX)",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-y",
      "C:\\Temp\\voice.wav",
    ])
    expect(recorder?.stop).toBe("stdin-q")
  })

  test("parses DirectShow audio devices from ffmpeg output", () => {
    expect(
      parseDirectShowAudioDevices(`
[dshow @ 000001] DirectShow video devices
[dshow @ 000001]  "Integrated Camera"
[dshow @ 000001] DirectShow audio devices
[dshow @ 000001]  "麦克风 (2- K5 TX)"
[dshow @ 000001]     Alternative name "@device_cm_{...}"
[dshow @ 000001]  "AI Noise-Canceling Microphone (ASUS Utility)"
dummy: Immediate exit requested
`),
    ).toEqual(["麦克风 (2- K5 TX)", "AI Noise-Canceling Microphone (ASUS Utility)"])
  })

  test("ignores stale managed ffmpeg paths from the build host", () => {
    expect(
      resolveManagedFFmpegPath(
        ["C:\\home\\runner\\work\\miko\\miko\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe"],
        () => false,
      ),
    ).toBeUndefined()
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

  test("reports missing recorder output without leaking ENOENT", async () => {
    await expect(readVoiceInputFile("/tmp/missing-voice.wav", async () => {
      const error = new Error("ENOENT: no such file or directory, open '/tmp/missing-voice.wav'")
      ;(error as NodeJS.ErrnoException).code = "ENOENT"
      throw error
    })).rejects.toThrow("Voice recorder did not create an audio file. Check microphone access.")
  })
})
