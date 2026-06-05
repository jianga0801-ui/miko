export type PromptPart = { type: "text"; text: string }

export function buildPromptParts(input: string): PromptPart[] {
  const text = input.trim()
  if (!text) return []
  return [{ type: "text", text }]
}
