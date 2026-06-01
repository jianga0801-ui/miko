import path from "path"
import { fileURLToPath } from "url"
import { Filesystem } from "@/util/filesystem"

export type PromptAttachmentKind = "image" | "pdf" | "audio" | "video"

export function stripPromptAttachmentLabels(text: string) {
  return text.replace(/\[(?:Image|PDF|Audio|Video) \d+\]\s*/g, "").trim()
}

function normalizeWindowsPathTail(text: string) {
  return text.replace(/\\([ \t])/g, "$1").replace(/\\+/g, "/").replace(/\/+/g, "/")
}

export function normalizePastedFilePath(text: string, platform: typeof process.platform = process.platform) {
  const raw = text.trim().replace(/^['"]+|['"]+$/g, "")
  if (raw.startsWith("file://")) {
    try {
      return normalizePastedFilePath(fileURLToPath(raw), platform)
    } catch {}
  }

  const wslForwardPath = raw.match(/^\/\/wsl(?:\.localhost|\$)\/[^/]+(\/.*)$/i)?.[1]
  if (wslForwardPath) return wslForwardPath.replace(/\\(.)/g, "$1")
  const wslBackslashPath = raw.match(/^\\+wsl(?:\.localhost|\$)\\+[^\\]+\\+(.*)$/i)?.[1]
  if (wslBackslashPath) return `/${normalizeWindowsPathTail(wslBackslashPath)}`
  const drivePath = raw.match(/^([a-zA-Z]):[\\/](.*)$/)
  if (drivePath && platform !== "win32") {
    return `/mnt/${drivePath[1]!.toLowerCase()}/${normalizeWindowsPathTail(drivePath[2]!).replace(/^\/+/, "")}`
  }
  const fileUrlDrivePath = raw.match(/^\/([a-zA-Z]):\/(.*)$/)
  if (fileUrlDrivePath && platform !== "win32") {
    return `/mnt/${fileUrlDrivePath[1]!.toLowerCase()}/${fileUrlDrivePath[2]}`
  }
  if (platform === "win32") return raw
  return raw.replace(/\\(.)/g, "$1")
}

export function normalizePastedFilePaths(text: string, platform: typeof process.platform = process.platform) {
  return stripPromptAttachmentLabels(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalizePastedFilePath(line, platform))
}

export async function readPromptAttachmentFile(filepath: string) {
  const mime = await Filesystem.mimeType(filepath)
  if (!promptAttachmentKind(mime)) return

  const content = await Filesystem.readArrayBuffer(filepath)
    .then((buffer) => Buffer.from(buffer).toString("base64"))
    .catch(() => undefined)
  if (!content) return

  return {
    filename: path.basename(filepath),
    filepath,
    mime,
    content,
  }
}

export function promptAttachmentKind(mime: string): PromptAttachmentKind | undefined {
  if (mime.startsWith("image/")) return "image"
  if (mime === "application/pdf") return "pdf"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  return undefined
}

export function promptAttachmentLabel(mime: string, existing: number) {
  const kind = promptAttachmentKind(mime)
  if (kind === "pdf") return `[PDF ${existing + 1}]`
  if (kind === "audio") return `[Audio ${existing + 1}]`
  if (kind === "video") return `[Video ${existing + 1}]`
  return `[Image ${existing + 1}]`
}
