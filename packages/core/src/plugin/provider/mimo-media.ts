/**
 * MiMo multimodal-input support for the AI SDK path.
 *
 * MiMo understands audio and video through its OpenAI-compatible
 * `/chat/completions` endpoint, but with non-standard content blocks:
 *
 *   audio: { "type": "input_audio", "input_audio": { "data": "<url|data-uri>" } }
 *   video: { "type": "video_url", "video_url": { "url": "<url|data-uri>" },
 *            "fps": 2, "media_resolution": "default" }
 *
 * The `@ai-sdk/openai-compatible` provider cannot emit these — it throws on
 * video and reshapes/limits audio — and that throw happens *before* any custom
 * `fetch` runs. So audio/video parts are carried through the AI SDK as opaque
 * sentinel text parts (which the SDK passes verbatim), and a custom `fetch` on
 * the MiMo provider rewrites the final request body back into the blocks above.
 * Images need none of this: MiMo's image schema is the standard `image_url`
 * that the AI SDK already produces.
 */

const PREFIX = "mimo:media:"

export type MimoMediaKind = "audio" | "video"

export interface MimoMediaSentinel {
  kind: MimoMediaKind
  url: string
  mediaType: string
  fps?: number
  mediaResolution?: string
}

/** Encode a media reference as a sentinel string safe to carry inside a text part. */
export function encodeMimoMediaSentinel(input: MimoMediaSentinel): string {
  const json = JSON.stringify(input)
  return PREFIX + Buffer.from(json, "utf8").toString("base64")
}

/** Decode a sentinel string back into its media reference, or undefined if it isn't one. */
export function decodeMimoMediaSentinel(text: string): MimoMediaSentinel | undefined {
  if (typeof text !== "string" || !text.startsWith(PREFIX)) return undefined
  try {
    const json = Buffer.from(text.slice(PREFIX.length), "base64").toString("utf8")
    const parsed = JSON.parse(json) as MimoMediaSentinel
    if (!parsed || (parsed.kind !== "audio" && parsed.kind !== "video") || typeof parsed.url !== "string") {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

/** Build the MiMo content block for a decoded sentinel. */
export function mimoBlockFromSentinel(sentinel: MimoMediaSentinel): Record<string, unknown> {
  if (sentinel.kind === "audio") {
    return { type: "input_audio", input_audio: { data: sentinel.url } }
  }
  return {
    type: "video_url",
    video_url: { url: sentinel.url },
    fps: sentinel.fps ?? 2,
    media_resolution: sentinel.mediaResolution ?? "default",
  }
}

function sentinelToBlock(text: string): Record<string, unknown> | undefined {
  const decoded = decodeMimoMediaSentinel(text)
  return decoded ? mimoBlockFromSentinel(decoded) : undefined
}

/**
 * Rewrite an OpenAI-compatible chat request body, replacing any sentinel text
 * parts in user messages with MiMo audio/video content blocks. Returns the
 * input unchanged when there is nothing to rewrite (including unparsable bodies).
 */
export function rewriteMimoRequestBody(bodyText: string): string {
  let body: any
  try {
    body = JSON.parse(bodyText)
  } catch {
    return bodyText
  }
  if (!body || !Array.isArray(body.messages)) return bodyText

  let changed = false
  for (const message of body.messages) {
    if (!message || message.role !== "user") continue

    // AI SDK collapses a single-text user message to a plain string.
    if (typeof message.content === "string") {
      const block = sentinelToBlock(message.content)
      if (block) {
        message.content = [block]
        changed = true
      }
      continue
    }

    if (!Array.isArray(message.content)) continue
    for (let i = 0; i < message.content.length; i++) {
      const part = message.content[i]
      if (part && part.type === "text" && typeof part.text === "string") {
        const block = sentinelToBlock(part.text)
        if (block) {
          message.content[i] = block
          changed = true
        }
      }
    }
  }

  return changed ? JSON.stringify(body) : bodyText
}

/** True when a request body may contain MiMo media sentinels worth rewriting. */
export function hasMimoMediaSentinel(bodyText: unknown): bodyText is string {
  return typeof bodyText === "string" && bodyText.includes(PREFIX)
}

/**
 * Wrap a `fetch` so outgoing MiMo chat requests have their sentinel media parts
 * rewritten into MiMo audio/video blocks. Non-matching requests pass through
 * untouched.
 */
export function makeMimoFetch(baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return ((input: any, init?: any) => {
    if (init && hasMimoMediaSentinel(init.body)) {
      return baseFetch(input, { ...init, body: rewriteMimoRequestBody(init.body) })
    }
    return baseFetch(input, init)
  }) as typeof fetch
}
