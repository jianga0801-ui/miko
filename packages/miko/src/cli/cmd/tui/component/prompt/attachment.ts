export type PromptAttachmentKind = "image" | "pdf" | "audio" | "video"

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
