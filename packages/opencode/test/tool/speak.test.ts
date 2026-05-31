import { describe, expect, test } from "bun:test"
import { extractAudioData, resolveMimoCredentials, selectPlaybackCommand } from "../../src/tool/speak"

describe("speak.resolveMimoCredentials", () => {
  test("prefers the auth key + region saved during MiMo onboarding", () => {
    const creds = resolveMimoCredentials({
      auth: { type: "api", key: "tp-auth-key", metadata: { region: "sgp" } },
      configApiKey: "sk-config-key",
      configRegion: "ams",
      envApiKey: "sk-env-key",
      envRegion: "cn",
    })
    expect(creds).toBeDefined()
    expect(creds!.apiKey).toBe("tp-auth-key")
    expect(creds!.region).toBe("sgp")
    // Routed to the same region endpoint the MiMo chat provider would use.
    expect(creds!.baseURL).toBe("https://token-plan-sgp.xiaomimimo.com/v1")
  })

  test("falls back to project config when no auth key exists", () => {
    const creds = resolveMimoCredentials({
      auth: undefined,
      configApiKey: "tp-config-key",
      configRegion: "ams",
      envApiKey: "sk-env-key",
    })
    expect(creds!.apiKey).toBe("tp-config-key")
    expect(creds!.region).toBe("ams")
    expect(creds!.baseURL).toBe("https://token-plan-ams.xiaomimimo.com/v1")
  })

  test("falls back to environment variables last", () => {
    const creds = resolveMimoCredentials({
      auth: undefined,
      envApiKey: "sk-env-key",
    })
    expect(creds!.apiKey).toBe("sk-env-key")
    // sk- keys always route to the global endpoint regardless of region.
    expect(creds!.baseURL).toBe("https://api.xiaomimimo.com/v1")
  })

  test("returns undefined when no key is configured anywhere", () => {
    expect(resolveMimoCredentials({ auth: undefined })).toBeUndefined()
    // An oauth-style auth record carries no api key for TTS.
    expect(resolveMimoCredentials({ auth: { type: "oauth" } })).toBeUndefined()
  })
})

describe("speak.extractAudioData", () => {
  test("reads base64 audio from choices[0].message.audio.data", () => {
    const body = { choices: [{ message: { audio: { data: "QUJD" } } }] }
    expect(extractAudioData(body)).toBe("QUJD")
  })

  test("returns undefined for responses without audio", () => {
    expect(extractAudioData({ choices: [{ message: { content: "hi" } }] })).toBeUndefined()
    expect(extractAudioData({ choices: [] })).toBeUndefined()
    expect(extractAudioData({})).toBeUndefined()
    expect(extractAudioData(undefined)).toBeUndefined()
  })
})

describe("speak.selectPlaybackCommand", () => {
  test("picks the first available player for wav and passes the file directly", () => {
    const available = new Set(["aplay", "ffplay"])
    const player = selectPlaybackCommand("wav", (cmd) => available.has(cmd))
    expect(player?.cmd).toBe("aplay")
    expect(player?.args("/tmp/a.wav")).toEqual(["/tmp/a.wav"])
  })

  test("passes raw format flags for pcm16 playback", () => {
    const player = selectPlaybackCommand("pcm16", (cmd) => cmd === "aplay")
    expect(player?.cmd).toBe("aplay")
    expect(player?.args("/tmp/a.pcm")).toEqual(["-f", "S16_LE", "-r", "24000", "-c", "1", "/tmp/a.pcm"])
  })

  test("ffplay gets raw decode flags for pcm16", () => {
    const player = selectPlaybackCommand("pcm16", (cmd) => cmd === "ffplay")
    expect(player?.args("/tmp/a.pcm")).toEqual([
      "-nodisp",
      "-autoexit",
      "-loglevel",
      "quiet",
      "-f",
      "s16le",
      "-ar",
      "24000",
      "-ac",
      "1",
      "/tmp/a.pcm",
    ])
  })

  test("returns undefined when no player command is available", () => {
    expect(selectPlaybackCommand("wav", () => false)).toBeUndefined()
  })
})
