import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import path from "path"
import * as Tool from "./tool"
import DESCRIPTION from "./speak.txt"
import { Auth } from "../auth"
import { which } from "@/util/which"
import { Config } from "@/config/config"
import { AppFileSystem } from "@miko-ai/core/filesystem"
import { Global } from "@miko-ai/core/global"
import { resolveMimoEndpoint } from "@miko-ai/core/plugin/provider/mimo"

const DEFAULT_MODEL = process.env.MIMO_TTS_MODEL || "mimo-v2.5-tts"
const DEFAULT_VOICE = process.env.MIMO_TTS_VOICE || "mimo_default"
const MAX_TEXT = 4096
// MiMo TTS emits 24 kHz mono audio; pcm16 output is raw and needs these
// parameters to be played back.
const SAMPLE_RATE = 24000

const FORMAT_MIME: Record<string, string> = {
  wav: "audio/wav",
  pcm16: "audio/L16",
}

const FORMAT_EXT: Record<string, string> = {
  wav: "wav",
  pcm16: "pcm",
}

// Audio players ranked per format. wav is self-describing; pcm16 is raw and
// only players we can hand explicit format flags to can play it.
const PLAYERS: Record<string, string[]> = {
  wav: ["paplay", "aplay", "ffplay", "mpv"],
  pcm16: ["aplay", "paplay", "ffplay"],
}

function playerArgs(cmd: string, format: string, file: string): string[] {
  const raw = format === "pcm16"
  switch (cmd) {
    case "ffplay":
      return raw
        ? ["-nodisp", "-autoexit", "-loglevel", "quiet", "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", file]
        : ["-nodisp", "-autoexit", "-loglevel", "quiet", file]
    case "aplay":
      return raw ? ["-f", "S16_LE", "-r", String(SAMPLE_RATE), "-c", "1", file] : [file]
    case "paplay":
      return raw ? ["--raw", "--format=s16le", `--rate=${SAMPLE_RATE}`, "--channels=1", file] : [file]
    case "mpv":
      return ["--no-video", "--really-quiet", file]
    default:
      return [file]
  }
}

/**
 * Pick the first available terminal audio player for `format`. `lookup` reports
 * whether a command exists on PATH; isolating it keeps selection testable
 * without touching real audio devices.
 */
export function selectPlaybackCommand(
  format: string,
  lookup: (cmd: string) => boolean,
): { cmd: string; args: (file: string) => string[] } | undefined {
  const candidates = PLAYERS[format] ?? ["ffplay", "mpv"]
  for (const cmd of candidates) {
    if (lookup(cmd)) return { cmd, args: (file: string) => playerArgs(cmd, format, file) }
  }
  return undefined
}

export interface MimoCredentials {
  apiKey: string
  region?: string
  baseURL: string
}

/**
 * Resolve the MiMo API key + region, then the matching endpoint. Precedence is
 * Auth (the key saved during MiMo onboarding) → project config → environment,
 * which is exactly how the MiMo chat provider resolves its credentials. This
 * guarantees TTS uses the *same* key and endpoint the user configured for MiMo
 * rather than a separate TTS credential.
 */
export function resolveMimoCredentials(input: {
  auth?: { type: string; key?: string; metadata?: Record<string, string> } | undefined
  configApiKey?: string
  configRegion?: string
  envApiKey?: string
  envRegion?: string
}): MimoCredentials | undefined {
  const authKey = input.auth?.type === "api" ? input.auth.key : undefined
  const authRegion = input.auth?.type === "api" ? input.auth.metadata?.region : undefined
  const apiKey = authKey || input.configApiKey || input.envApiKey
  if (!apiKey) return undefined
  const region = authRegion || input.configRegion || input.envRegion
  return { apiKey, region, baseURL: resolveMimoEndpoint(apiKey, region) }
}

/**
 * Pull the base64 audio payload out of a MiMo TTS chat-completion response.
 * The synthesized audio is returned as `choices[0].message.audio.data`.
 */
export function extractAudioData(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  const message = (choices[0] as { message?: unknown }).message
  if (typeof message !== "object" || message === null) return undefined
  const audio = (message as { audio?: unknown }).audio
  if (typeof audio !== "object" || audio === null) return undefined
  const data = (audio as { data?: unknown }).data
  return typeof data === "string" && data.length > 0 ? data : undefined
}

export const Parameters = Schema.Struct({
  text: Schema.String.annotate({ description: "The text to convert to speech" }),
  voice: Schema.optional(Schema.String).annotate({
    description:
      "Optional MiMo voice id, e.g. mimo_default, 冰糖, 茉莉, 苏打, 白桦, Mia, Chloe, Milo, Dean. Defaults to mimo_default.",
  }),
  instructions: Schema.optional(Schema.String).annotate({
    description: "Optional style / delivery instructions for the voice (sent as the user message).",
  }),
  model: Schema.optional(Schema.String).annotate({
    description: "Optional MiMo TTS model id (mimo-v2.5-tts, mimo-v2.5-tts-voicedesign). Defaults to mimo-v2.5-tts.",
  }),
  format: Schema.Literals(["wav", "pcm16"])
    .annotate({ description: "Audio format to generate (wav or pcm16). Defaults to wav.", default: "wav" })
    .pipe(Schema.optional, Schema.withDecodingDefault(Effect.succeed("wav" as const))),
  play: Schema.optional(Schema.Boolean).annotate({
    description: "Play the audio through the terminal if a player is available. Defaults to true.",
  }),
})

export const SpeakTool = Tool.define(
  "speak",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const auth = yield* Auth.Service
    const config = yield* Config.Service
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const text = params.text.trim()
          if (!text) throw new Error("speak: text must not be empty")
          if (text.length > MAX_TEXT) throw new Error(`speak: text exceeds ${MAX_TEXT} characters`)
          const format = params.format ?? "wav"

          const cfg = yield* config.get()
          const mimoConfig = cfg.provider?.["mimo"]?.options as Record<string, unknown> | undefined
          const authInfo = yield* auth.get("mimo").pipe(Effect.orElseSucceed(() => undefined))

          const creds = resolveMimoCredentials({
            auth: authInfo as { type: string; key?: string; metadata?: Record<string, string> } | undefined,
            configApiKey: typeof mimoConfig?.["apiKey"] === "string" ? (mimoConfig["apiKey"] as string) : undefined,
            configRegion: typeof mimoConfig?.["region"] === "string" ? (mimoConfig["region"] as string) : undefined,
            envApiKey: process.env.MIMO_API_KEY,
            envRegion: process.env.MIMO_REGION,
          })

          if (!creds) {
            throw new Error(
              "speak: no MiMo API key found. Set up MiMo (MIMO_API_KEY, provider.mimo.options.apiKey, or the MiMo onboarding) — TTS reuses the same key.",
            )
          }

          // MiMo TTS is served from the same OpenAI-compatible chat-completions
          // endpoint as MiMo chat, so the API base and key stay aligned.
          const url = `${creds.baseURL}/chat/completions`
          yield* ctx.ask({
            permission: "webfetch",
            patterns: [url],
            always: ["*"],
            metadata: { url, voice: params.voice ?? DEFAULT_VOICE, format },
          })

          // The text to synthesize goes in the assistant message; an optional
          // user message carries style/delivery instructions.
          const messages: { role: string; content: string }[] = []
          if (params.instructions?.trim()) messages.push({ role: "user", content: params.instructions.trim() })
          messages.push({ role: "assistant", content: text })

          const request = yield* HttpClientRequest.post(url).pipe(
            HttpClientRequest.setHeaders({
              // MiMo documents `api-key`; the chat path uses Bearer. Send both so
              // TTS works regardless of which the gateway honors for this key.
              "api-key": creds.apiKey,
              Authorization: `Bearer ${creds.apiKey}`,
            }),
            HttpClientRequest.bodyJson({
              model: params.model ?? DEFAULT_MODEL,
              messages,
              audio: { format, voice: params.voice ?? DEFAULT_VOICE },
              stream: false,
            }),
          )

          const response = yield* http.execute(request)
          const rawText = yield* response.text.pipe(Effect.orElseSucceed(() => ""))
          if (response.status >= 400) {
            throw new Error(`speak: MiMo TTS request failed (${response.status}): ${rawText.slice(0, 500)}`)
          }

          const parsed = yield* Effect.sync(() => {
            try {
              return JSON.parse(rawText) as unknown
            } catch {
              return undefined
            }
          })
          const base64 = extractAudioData(parsed)
          if (!base64) {
            throw new Error(`speak: MiMo response did not contain audio data: ${rawText.slice(0, 300)}`)
          }
          const bytes = new Uint8Array(Buffer.from(base64, "base64"))
          if (bytes.byteLength === 0) throw new Error("speak: MiMo returned empty audio")

          const ext = FORMAT_EXT[format] ?? format
          const filePath = path.join(Global.Path.tmp, "tts", `speak-${Date.now()}.${ext}`)
          yield* fs.writeWithDirs(filePath, bytes).pipe(Effect.mapError((err) => new Error(`speak: ${err.message}`)))

          // Best-effort terminal playback. A missing player (or a player that
          // errors) must never fail the conversation — the file path is the
          // primary result.
          let played = false
          const wantPlay = params.play ?? true
          if (wantPlay) {
            const player = selectPlaybackCommand(format, (cmd) => which(cmd) !== null)
            if (player) {
              played = yield* Effect.sync(() => {
                try {
                  Bun.spawn([player.cmd, ...player.args(filePath)], {
                    stdout: "ignore",
                    stderr: "ignore",
                    stdin: "ignore",
                  })
                  return true
                } catch {
                  return false
                }
              })
            }
          }

          const mime = FORMAT_MIME[format] ?? "application/octet-stream"
          const sizeKb = (bytes.byteLength / 1024).toFixed(1)
          const playbackNote = played
            ? "Playing through the terminal."
            : wantPlay
              ? "No terminal audio player found; saved file only."
              : "Saved file only (playback disabled)."

          return {
            title: `speak (${format}, ${sizeKb} KB)`,
            output: [`Saved spoken audio to ${filePath}`, playbackNote].join("\n"),
            metadata: {
              path: filePath,
              mime,
              bytes: bytes.byteLength,
              played,
              endpoint: url,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
