import { describe, expect, test } from "bun:test"
import { shouldExposeMimoAnalyzeMediaTool } from "@/session/tools"
import type { Provider } from "@/provider/provider"
import type { SessionLegacy } from "@miko-ai/core/session/legacy"

function model(input: Partial<Provider.Model["capabilities"]["input"]>): Provider.Model {
  return {
    id: "mimo-v2.5",
    providerID: "xiaomi-token-plan-cn",
    api: { id: "mimo-v2.5", url: "https://token-plan-cn.xiaomimimo.com/v1", npm: "@ai-sdk/openai-compatible" },
    name: "MiMo",
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false, ...input },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 128000, output: 4096 },
    status: "active",
    options: {},
    headers: {},
  } as Provider.Model
}

function message(mime: string): SessionLegacy.WithParts {
  return {
    info: { role: "user" },
    parts: [{ type: "file", mime, filename: "media", url: `data:${mime};base64,AA` }],
  } as SessionLegacy.WithParts
}

describe("SessionTools.shouldExposeMimoAnalyzeMediaTool", () => {
  test("keeps the media tool for image attachments when the current model cannot inspect images", () => {
    expect(shouldExposeMimoAnalyzeMediaTool(model({ image: false }), [message("image/png")])).toBe(true)
  })

  test("hides the media tool for image attachments when the current model can inspect images natively", () => {
    expect(shouldExposeMimoAnalyzeMediaTool(model({ image: true }), [message("image/png")])).toBe(false)
  })

  test("hides the media tool for audio and video attachments when the current model can inspect them natively", () => {
    expect(
      shouldExposeMimoAnalyzeMediaTool(model({ image: true, audio: true, video: true }), [
        message("audio/wav"),
        message("video/mp4"),
      ]),
    ).toBe(false)
  })
})
