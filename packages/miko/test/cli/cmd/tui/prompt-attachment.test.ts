import { describe, expect, test } from "bun:test"
import {
  normalizePastedFilePath,
  normalizePastedFilePaths,
  promptAttachmentKind,
  promptAttachmentLabel,
  readPromptAttachmentFile,
  stripPromptAttachmentLabels,
} from "../../../../src/cli/cmd/tui/component/prompt/attachment"

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

  test("normalizes pasted WSL UNC paths to Linux paths", () => {
    expect(
      normalizePastedFilePath(
        "//wsl.localhost/Ubuntu-26.04/home/linuu/Code/屏幕录制 2026-06-01 201104.mp4",
        "linux",
      ),
    ).toBe("/home/linuu/Code/屏幕录制 2026-06-01 201104.mp4")
    expect(
      normalizePastedFilePath(
        "//wsl.localhost/Ubuntu-26.04/home/linuu/Code/屏幕录制\\ 2026-06-01\\ 201104.mp4",
        "linux",
      ),
    ).toBe("/home/linuu/Code/屏幕录制 2026-06-01 201104.mp4")
    expect(normalizePastedFilePath("\\\\wsl.localhost\\Ubuntu-26.04\\home\\linuu\\Code\\clip.mp4", "linux")).toBe(
      "/home/linuu/Code/clip.mp4",
    )
    expect(normalizePastedFilePath("/home/linuu/Code/Screen\\ Recording.mp4", "linux")).toBe(
      "/home/linuu/Code/Screen Recording.mp4",
    )
  })

  test("normalizes pasted Windows drive paths for WSL", () => {
    expect(
      normalizePastedFilePath(
        '"C:\\Users\\14378\\Videos\\屏幕录制\\屏幕录制 2026-06-01 201104.mp4"',
        "linux",
      ),
    ).toBe("/mnt/c/Users/14378/Videos/屏幕录制/屏幕录制 2026-06-01 201104.mp4")
    expect(
      normalizePastedFilePath(
        "C:\\\\Users\\\\14378\\\\Videos\\\\屏幕录制\\\\屏幕录制\\ 2026-06-01\\ 201104.mp4",
        "linux",
      ),
    ).toBe("/mnt/c/Users/14378/Videos/屏幕录制/屏幕录制 2026-06-01 201104.mp4")
    expect(normalizePastedFilePath("C:/Users/14378/Videos/clip.mp4", "linux")).toBe(
      "/mnt/c/Users/14378/Videos/clip.mp4",
    )
    expect(normalizePastedFilePath("file:///C:/Users/14378/Videos/clip.mp4", "linux")).toBe(
      "/mnt/c/Users/14378/Videos/clip.mp4",
    )
  })

  test("normalizes multi-line pasted media paths", () => {
    expect(
      normalizePastedFilePaths(
        [
          "C:\\\\Users\\\\14378\\\\Videos\\\\屏幕录制\\\\屏幕录制\\ 2026-06-01\\ 201104.mp4",
          "\\\\wsl.localhost\\\\Ubuntu-26.04\\\\home\\\\linuu\\\\Code\\\\屏幕录制\\ 2026-06-01\\ 201104.mp4",
        ].join("\n"),
        "linux",
      ),
    ).toEqual([
      "/mnt/c/Users/14378/Videos/屏幕录制/屏幕录制 2026-06-01 201104.mp4",
      "/home/linuu/Code/屏幕录制 2026-06-01 201104.mp4",
    ])
  })

  test("normalizes pasted paths after existing attachment labels", () => {
    expect(stripPromptAttachmentLabels("[Video 1] C:/Users/14378/Videos/clip.mp4")).toBe(
      "C:/Users/14378/Videos/clip.mp4",
    )
    expect(normalizePastedFilePaths("[Video 1] C:/Users/14378/Videos/clip.mp4", "linux")).toEqual([
      "/mnt/c/Users/14378/Videos/clip.mp4",
    ])
  })

  test("reads a pasted media path as an attachment payload", async () => {
    const filepath = `/tmp/miko-prompt-attachment-${Date.now()}.mp4`
    await Bun.write(filepath, "miko")

    const attachment = await readPromptAttachmentFile(filepath)

    expect(attachment?.filename).toBe(filepath.split("/").at(-1))
    expect(attachment?.filepath).toBe(filepath)
    expect(attachment?.mime).toBe("video/mp4")
    expect(attachment?.content).toBe(Buffer.from("miko").toString("base64"))
  })

  test("reads pasted image and audio paths as attachment payloads", async () => {
    const imagePath = `/tmp/miko-prompt-attachment-${Date.now()}.png`
    const audioPath = `/tmp/miko-prompt-attachment-${Date.now()}.wav`
    await Bun.write(imagePath, "image")
    await Bun.write(audioPath, "audio")

    const image = await readPromptAttachmentFile(imagePath)
    const audio = await readPromptAttachmentFile(audioPath)

    expect(image?.mime).toBe("image/png")
    expect(image?.content).toBe(Buffer.from("image").toString("base64"))
    expect(audio?.mime).toBe("audio/wav")
    expect(audio?.content).toBe(Buffer.from("audio").toString("base64"))
  })
})
