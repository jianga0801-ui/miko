import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import * as Tool from "./tool"
import DESCRIPTION from "./mimo_analyze_media.txt"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { isMimoProviderID, MIMO_PROVIDER_IDS } from "@/provider/mimo-setup"
import { isRecord } from "@/util/record"
import { resolveMimoEndpoint } from "@miko-ai/core/plugin/provider/mimo"
import type { SessionLegacy } from "@miko-ai/core/session/legacy"

const DEFAULT_MODEL = process.env.MIMO_MULTIMODAL_MODEL || "mimo-v2.5"
const MAX_MEDIA = 6

type MediaKind = "image" | "audio" | "video"

export type MediaAttachment = {
  kind: MediaKind
  mime: string
  url: string
  filename?: string
}

type MimoContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string } }
  | { type: "video_url"; video_url: { url: string }; fps: number; media_resolution: string }

function mediaKind(mime: string): MediaKind | undefined {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  return undefined
}

export function collectMedia(
  messages: SessionLegacy.WithParts[],
  options: { scope: "latest" | "all"; maxItems: number },
): MediaAttachment[] {
  const source =
    options.scope === "latest"
      ? messages
          .filter((message) => message.info.role === "user" && message.parts.some((part) => part.type === "file"))
          .slice(-1)
      : messages

  return source
    .flatMap((message) =>
      message.parts.flatMap((part) => {
        if (part.type !== "file") return []
        const kind = mediaKind(part.mime)
        if (!kind) return []
        return [{ kind, mime: part.mime, url: part.url, filename: part.filename }]
      }),
    )
    .slice(0, options.maxItems)
}

export function mediaBlock(media: MediaAttachment): MimoContent {
  if (media.kind === "image") return { type: "image_url", image_url: { url: media.url } }
  if (media.kind === "audio") return { type: "input_audio", input_audio: { data: media.url } }
  return { type: "video_url", video_url: { url: media.url }, fps: 2, media_resolution: "default" }
}

export function extractText(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  const choices = body.choices
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  const first = choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return undefined
  const content = first.message.content
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return undefined
  const text = content
    .flatMap((item) => (isRecord(item) && typeof item.text === "string" ? [item.text] : []))
    .join("\n")
    .trim()
  return text || undefined
}

function currentProviderID(extra: Record<string, unknown> | undefined) {
  const model = extra?.model
  if (!isRecord(model)) return undefined
  const providerID = model.providerID
  return typeof providerID === "string" && isMimoProviderID(providerID) ? providerID : undefined
}

export const Parameters = Schema.Struct({
  prompt: Schema.optional(Schema.String).annotate({
    description:
      "What to understand from the media. Defaults to describing the media and extracting visible or audible details relevant to the user's request.",
  }),
  scope: Schema.Literals(["latest", "all"])
    .pipe(Schema.optional, Schema.withDecodingDefault(Effect.succeed("latest" as const)))
    .annotate({
      description: "Which conversation media to analyze. Use latest for the most recent attachment, all for all media in context.",
      default: "latest",
    }),
  maxItems: Schema.optional(Schema.Number).annotate({
    description: `Maximum number of media attachments to analyze, capped at ${MAX_MEDIA}.`,
    default: MAX_MEDIA,
  }),
  model: Schema.optional(Schema.String).annotate({
    description: `MiMo multimodal model id. Defaults to ${DEFAULT_MODEL}.`,
    default: DEFAULT_MODEL,
  }),
})

export const MimoAnalyzeMediaTool = Tool.define(
  "mimo_analyze_media",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const auth = yield* Auth.Service
    const config = yield* Config.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const cfg = yield* config.get()
          const mimoConfig = cfg.provider?.["mimo"]?.options as Record<string, unknown> | undefined
          const providerIDs = [
            currentProviderID(ctx.extra),
            "mimo",
            ...MIMO_PROVIDER_IDS,
          ].filter((providerID): providerID is string => typeof providerID === "string")
          const authInfo = yield* Effect.forEach(
            providerIDs,
            (providerID) => auth.get(providerID).pipe(Effect.orElseSucceed(() => undefined)),
            { concurrency: 1 },
          ).pipe(Effect.map((items) => items.find((item) => item?.type === "api")))
          const apiKey =
            authInfo?.type === "api"
              ? authInfo.key
              : typeof mimoConfig?.apiKey === "string"
                ? mimoConfig.apiKey
                : process.env.MIMO_API_KEY
          if (!apiKey) {
            throw new Error("mimo_analyze_media: no MiMo API key found. Set up MiMo first.")
          }

          const region =
            authInfo?.type === "api"
              ? authInfo.metadata?.region
              : typeof mimoConfig?.region === "string"
                ? mimoConfig.region
                : process.env.MIMO_REGION
          const media = collectMedia(ctx.messages, {
            scope: params.scope ?? "latest",
            maxItems: Math.min(Math.max(Math.floor(params.maxItems ?? MAX_MEDIA), 1), MAX_MEDIA),
          })
          if (media.length === 0) {
            throw new Error("mimo_analyze_media: no image, audio, or video attachments found in the conversation.")
          }

          const url = `${resolveMimoEndpoint(apiKey, region)}/chat/completions`
          yield* ctx.ask({
            permission: "webfetch",
            patterns: [url],
            always: ["*"],
            metadata: { url, model: params.model ?? DEFAULT_MODEL, media: media.map((item) => item.mime) },
          })

          const prompt =
            params.prompt?.trim() ||
            "Understand the attached media. Extract visible text, objects, UI details, spoken content, scene changes, and any details needed to answer the user's request. Be factual and concise."
          const request = yield* HttpClientRequest.post(url).pipe(
            HttpClientRequest.setHeaders({
              "api-key": apiKey,
              Authorization: `Bearer ${apiKey}`,
            }),
            HttpClientRequest.bodyJson({
              model: params.model ?? DEFAULT_MODEL,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    ...media.map(mediaBlock),
                  ] satisfies MimoContent[],
                },
              ],
              stream: false,
            }),
          )

          const response = yield* http.execute(request)
          const rawText = yield* response.text.pipe(Effect.orElseSucceed(() => ""))
          if (response.status >= 400) {
            throw new Error(`mimo_analyze_media: MiMo request failed (${response.status}): ${rawText.slice(0, 500)}`)
          }
          const parsed = yield* Effect.sync(() => {
            try {
              return JSON.parse(rawText) as unknown
            } catch {
              return undefined
            }
          })
          const output = extractText(parsed)
          if (!output) {
            throw new Error(`mimo_analyze_media: MiMo response did not contain text: ${rawText.slice(0, 300)}`)
          }

          return {
            title: `Analyzed ${media.length} media attachment${media.length === 1 ? "" : "s"}`,
            output,
            metadata: {
              model: params.model ?? DEFAULT_MODEL,
              media: media.map((item) => ({ kind: item.kind, mime: item.mime, filename: item.filename })),
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
