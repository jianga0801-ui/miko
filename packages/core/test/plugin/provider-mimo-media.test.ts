import { describe, expect, test } from "bun:test"
import {
  decodeMimoMediaSentinel,
  encodeMimoMediaSentinel,
  hasMimoMediaSentinel,
  isWebSearchUnsupported,
  makeMimoFetch,
  mimoBlockFromSentinel,
  resolveMimoWebSearchConfig,
  rewriteMimoRequestBody,
} from "@miko-ai/core/plugin/provider/mimo-media"

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

describe("isWebSearchUnsupported", () => {
  test("only true for error responses that name web search", () => {
    expect(isWebSearchUnsupported(200, "web_search whatever")).toBe(false)
    expect(isWebSearchUnsupported(400, "the web_search tool is not allowed")).toBe(true)
    expect(isWebSearchUnsupported(400, "invalid model")).toBe(false)
    expect(isWebSearchUnsupported(500, "web search unavailable")).toBe(true)
  })
})

describe("makeMimoFetch web_search degradation", () => {
  const webSearch = { type: "web_search" as const }
  const baseBody = JSON.stringify({ model: "mimo-v2.5-pro", messages: [{ role: "user", content: "hi" }] })

  function mockFetch(responses: Array<{ status: number; body: string }>) {
    const calls: Array<{ body: string }> = []
    const fn = (async (_input: any, init?: any) => {
      calls.push({ body: init?.body })
      const r = responses[Math.min(calls.length - 1, responses.length - 1)]
      return new Response(r.body, { status: r.status })
    }) as unknown as typeof fetch
    return { fn, calls }
  }

  test("retries without web_search when the server rejects it", async () => {
    const { fn, calls } = mockFetch([
      { status: 400, body: JSON.stringify({ error: "web_search not enabled for this key" }) },
      { status: 200, body: "ok" },
    ])
    const res = await makeMimoFetch(fn, { webSearch })("https://token-plan-cn.xiaomimimo.com/v1/chat/completions", {
      method: "POST",
      body: baseBody,
    } as any)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[0].body).tools).toEqual([{ type: "web_search" }])
    expect(JSON.parse(calls[1].body).tools).toBeUndefined()
  })

  test("does not retry on unrelated errors", async () => {
    const { fn, calls } = mockFetch([{ status: 400, body: JSON.stringify({ error: "bad model" }) }])
    const res = await makeMimoFetch(fn, { webSearch })("url", { method: "POST", body: baseBody } as any)
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(1)
  })

  test("passes success through untouched, with web_search injected", async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: "ok" }])
    const res = await makeMimoFetch(fn, { webSearch })("url", { method: "POST", body: baseBody } as any)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(JSON.parse(calls[0].body).tools).toEqual([{ type: "web_search" }])
  })
})

describe("rewriteMimoRequestBody reasoning and temperature", () => {
  test("injects top-level thinking and clamps temperature for mimo models", () => {
    const body = JSON.stringify({
      model: "mimo-v2.5-pro",
      temperature: 0.7,
      messages: [{ role: "user", content: "hello" }],
    })
    const out = JSON.parse(rewriteMimoRequestBody(body))
    expect(out.thinking).toEqual({ type: "enabled" })
    expect(out.extra_body).toBeUndefined()
    expect(out.temperature).toBe(0.2) // Clamped to max 0.2
  })

  test("injects top-level thinking and defaults temperature to 0.1 for xiaomi models", () => {
    const body = JSON.stringify({
      model: "xiaomi-token-plan-cn",
      messages: [{ role: "user", content: "hello" }],
    })
    const out = JSON.parse(rewriteMimoRequestBody(body))
    expect(out.thinking).toEqual({ type: "enabled" })
    expect(out.extra_body).toBeUndefined()
    expect(out.temperature).toBe(0.1) // Defaulted to 0.1
  })

  test("normalizes SDK-only extra_body and max_tokens into MiMo chat fields", () => {
    const body = JSON.stringify({
      model: "mimo-v2.5",
      max_tokens: 123,
      reasoning_effort: "high",
      reasoning: { effort: "high" },
      enable_thinking: true,
      extra_body: { thinking: { type: "enabled" } },
      messages: [{ role: "user", content: "hello" }],
    })
    const out = JSON.parse(rewriteMimoRequestBody(body))
    expect(out.max_tokens).toBeUndefined()
    expect(out.max_completion_tokens).toBe(123)
    expect(out.reasoning_effort).toBeUndefined()
    expect(out.reasoning).toBeUndefined()
    expect(out.enable_thinking).toBeUndefined()
    expect(out.thinking).toEqual({ type: "enabled" })
    expect(out.extra_body).toBeUndefined()
  })

  test("extracts assistant reasoning_content and sets it on the message object", () => {
    const body = JSON.stringify({
      model: "mimo-v2.5-pro",
      messages: [
        { role: "user", content: "hello" },
        {
          role: "assistant",
          content: [{ type: "text", text: "Here is code" }, { type: "reasoning", text: "Thinking process..." }],
          providerOptions: {
            openaiCompatible: {
              reasoning_content: "Encrypted thoughts",
            },
          },
        },
      ],
    })
    const out = JSON.parse(rewriteMimoRequestBody(body))
    expect(out.messages[1].reasoning_content).toBe("Encrypted thoughts")
    expect(out.messages[1].content).toEqual([{ type: "text", text: "Here is code" }])
  })
})
