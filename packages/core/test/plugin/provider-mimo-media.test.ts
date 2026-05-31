import { describe, expect, test } from "bun:test"
import {
  decodeMimoMediaSentinel,
  encodeMimoMediaSentinel,
  hasMimoMediaSentinel,
  mimoBlockFromSentinel,
  resolveMimoWebSearchConfig,
  rewriteMimoRequestBody,
} from "@opencode-ai/core/plugin/provider/mimo-media"

describe("mimo-media sentinel", () => {
  test("roundtrips an audio sentinel", () => {
    const s = encodeMimoMediaSentinel({ kind: "audio", url: "https://x/a.wav", mediaType: "audio/wav" })
    expect(hasMimoMediaSentinel(s)).toBe(true)
    expect(decodeMimoMediaSentinel(s)).toEqual({ kind: "audio", url: "https://x/a.wav", mediaType: "audio/wav" })
  })

  test("ignores non-sentinel text", () => {
    expect(decodeMimoMediaSentinel("just some text")).toBeUndefined()
    expect(hasMimoMediaSentinel("just some text")).toBe(false)
  })

  test("builds the official audio and video content blocks", () => {
    expect(mimoBlockFromSentinel({ kind: "audio", url: "data:audio/wav;base64,AA", mediaType: "audio/wav" })).toEqual({
      type: "input_audio",
      input_audio: { data: "data:audio/wav;base64,AA" },
    })
    expect(mimoBlockFromSentinel({ kind: "video", url: "https://x/v.mp4", mediaType: "video/mp4" })).toEqual({
      type: "video_url",
      video_url: { url: "https://x/v.mp4" },
      fps: 2,
      media_resolution: "default",
    })
  })
})

describe("rewriteMimoRequestBody", () => {
  test("rewrites audio + video sentinels in a user message content array", () => {
    const audio = encodeMimoMediaSentinel({ kind: "audio", url: "https://x/a.mp3", mediaType: "audio/mpeg" })
    const video = encodeMimoMediaSentinel({ kind: "video", url: "https://x/v.mp4", mediaType: "video/mp4" })
    const body = JSON.stringify({
      model: "mimo-v2.5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: audio },
            { type: "text", text: video },
            { type: "text", text: "describe these" },
          ],
        },
      ],
    })
    const out = JSON.parse(rewriteMimoRequestBody(body))
    expect(out.messages[0].content).toEqual([
      { type: "input_audio", input_audio: { data: "https://x/a.mp3" } },
      { type: "video_url", video_url: { url: "https://x/v.mp4" }, fps: 2, media_resolution: "default" },
      { type: "text", text: "describe these" },
    ])
  })

  test("expands a collapsed single-string sentinel content into a block array", () => {
    const audio = encodeMimoMediaSentinel({ kind: "audio", url: "data:audio/wav;base64,AA", mediaType: "audio/wav" })
    const body = JSON.stringify({ messages: [{ role: "user", content: audio }] })
    const out = JSON.parse(rewriteMimoRequestBody(body))
    expect(out.messages[0].content).toEqual([{ type: "input_audio", input_audio: { data: "data:audio/wav;base64,AA" } }])
  })

  test("leaves image_url and plain bodies untouched", () => {
    const body = JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "https://x/i.png" } },
            { type: "text", text: "what is this" },
          ],
        },
      ],
    })
    // Unchanged body is returned verbatim (no re-serialization).
    expect(rewriteMimoRequestBody(body)).toBe(body)
    expect(rewriteMimoRequestBody("not json")).toBe("not json")
  })
})

describe("resolveMimoWebSearchConfig", () => {
  test("is undefined when the toggle is off or absent", () => {
    expect(resolveMimoWebSearchConfig({})).toBeUndefined()
    expect(resolveMimoWebSearchConfig({ MIMO_WEB_SEARCH: "0" })).toBeUndefined()
  })

  test("builds the web_search tool with optional params", () => {
    expect(
      resolveMimoWebSearchConfig({
        MIMO_WEB_SEARCH: "true",
        MIMO_WEB_SEARCH_FORCE: "yes",
        MIMO_WEB_SEARCH_LIMIT: "2",
        MIMO_WEB_SEARCH_MAX_KEYWORD: "3",
        MIMO_WEB_SEARCH_COUNTRY: "China",
        MIMO_WEB_SEARCH_CITY: "Wuhan",
      }),
    ).toEqual({
      type: "web_search",
      max_keyword: 3,
      limit: 2,
      force_search: true,
      user_location: { type: "approximate", country: "China", city: "Wuhan" },
    })
  })

  test("minimal config is just the tool type", () => {
    expect(resolveMimoWebSearchConfig({ MIMO_WEB_SEARCH: "1" })).toEqual({ type: "web_search" })
  })
})

describe("rewriteMimoRequestBody web_search injection", () => {
  const tool = { type: "web_search" as const, force_search: true }

  test("adds a tools array when none exists", () => {
    const body = JSON.stringify({ model: "mimo-v2.5-pro", messages: [{ role: "user", content: "hi" }] })
    const out = JSON.parse(rewriteMimoRequestBody(body, { webSearch: tool }))
    expect(out.tools).toEqual([{ type: "web_search", force_search: true }])
  })

  test("appends to existing function tools without dropping them", () => {
    const body = JSON.stringify({ messages: [], tools: [{ type: "function", function: { name: "read" } }] })
    const out = JSON.parse(rewriteMimoRequestBody(body, { webSearch: tool }))
    expect(out.tools).toEqual([{ type: "function", function: { name: "read" } }, { type: "web_search", force_search: true }])
  })

  test("is idempotent when web_search is already present", () => {
    const body = JSON.stringify({ messages: [], tools: [{ type: "web_search" }] })
    expect(rewriteMimoRequestBody(body, { webSearch: tool })).toBe(body)
  })
})
