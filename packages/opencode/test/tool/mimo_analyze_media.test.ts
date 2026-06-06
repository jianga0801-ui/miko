import { describe, expect, test } from "bun:test"
import type { SessionV1 } from "@opencode-ai/core/v1/session"
import { collectMedia, extractText, mediaBlock } from "../../src/tool/mimo_analyze_media"

function user(parts: SessionV1.Part[]): SessionV1.WithParts {
  return { info: { role: "user" }, parts } as SessionV1.WithParts
}

function file(mime: string, filename: string): SessionV1.Part {
  return { type: "file", mime, filename, url: `data:${mime};base64,AA` } as SessionV1.Part
}

describe("mimo_analyze_media helpers", () => {
  test("collects latest image audio and video attachments", () => {
    const messages = [
      user([file("image/png", "old.png")]),
      user([
        { type: "text", text: "look" } as SessionV1.Part,
        file("image/png", "shot.png"),
        file("audio/wav", "voice.wav"),
        file("video/mp4", "clip.mp4"),
        file("text/plain", "note.txt"),
      ]),
    ]

    expect(collectMedia(messages, { scope: "latest", maxItems: 6 })).toEqual([
      { kind: "image", mime: "image/png", filename: "shot.png", url: "data:image/png;base64,AA" },
      { kind: "audio", mime: "audio/wav", filename: "voice.wav", url: "data:audio/wav;base64,AA" },
      { kind: "video", mime: "video/mp4", filename: "clip.mp4", url: "data:video/mp4;base64,AA" },
    ])
  })

  test("caps collected media at the requested item count", () => {
    expect(
      collectMedia([user([file("image/png", "a.png"), file("image/png", "b.png")])], {
        scope: "latest",
        maxItems: 1,
      }),
    ).toEqual([{ kind: "image", mime: "image/png", filename: "a.png", url: "data:image/png;base64,AA" }])
  })

  test("builds official MiMo content blocks", () => {
    expect(mediaBlock({ kind: "image", mime: "image/png", url: "https://x/i.png" })).toEqual({
      type: "image_url",
      image_url: { url: "https://x/i.png" },
    })
    expect(mediaBlock({ kind: "audio", mime: "audio/wav", url: "https://x/a.wav" })).toEqual({
      type: "input_audio",
      input_audio: { data: "https://x/a.wav" },
    })
    expect(mediaBlock({ kind: "video", mime: "video/mp4", url: "https://x/v.mp4" })).toEqual({
      type: "video_url",
      video_url: { url: "https://x/v.mp4" },
      fps: 2,
      media_resolution: "default",
    })
  })

  test("extracts text from MiMo chat responses", () => {
    expect(extractText({ choices: [{ message: { content: "screen text" } }] })).toBe("screen text")
    expect(extractText({ choices: [{ message: { content: [{ text: "a" }, { text: "b" }] } }] })).toBe("a\nb")
    expect(extractText({ choices: [] })).toBeUndefined()
  })
})
