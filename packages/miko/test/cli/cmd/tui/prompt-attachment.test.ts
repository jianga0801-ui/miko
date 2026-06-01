import { describe, expect, test } from "bun:test"
import { promptAttachmentKind, promptAttachmentLabel } from "../../../../src/cli/cmd/tui/component/prompt/attachment"

describe("prompt attachment helpers", () => {
  test("labels media attachments by type", () => {
    expect(promptAttachmentLabel("image/png", 0)).toBe("[Image 1]")
    expect(promptAttachmentLabel("application/pdf", 1)).toBe("[PDF 2]")
    expect(promptAttachmentLabel("audio/wav", 2)).toBe("[Audio 3]")
    expect(promptAttachmentLabel("video/mp4", 3)).toBe("[Video 4]")
  })

  test("accepts image pdf audio and video attachments", () => {
    expect(promptAttachmentKind("image/jpeg")).toBe("image")
    expect(promptAttachmentKind("application/pdf")).toBe("pdf")
    expect(promptAttachmentKind("audio/mpeg")).toBe("audio")
    expect(promptAttachmentKind("video/webm")).toBe("video")
    expect(promptAttachmentKind("text/plain")).toBeUndefined()
  })
})
