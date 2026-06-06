import { defer } from "@/util/defer"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CliRenderer } from "@opentui/core"
import { Filesystem } from "@/util/filesystem"
import { Process } from "@/util/process"

export async function open(opts: { value: string; renderer: CliRenderer; cwd?: string }): Promise<string | undefined> {
  // VISUAL/EDITOR are usually unset on Windows, so fall back to Notepad there
  // instead of silently doing nothing when "Open editor" is triggered.
  const editor = process.env["VISUAL"] || process.env["EDITOR"] || (process.platform === "win32" ? "notepad" : undefined)
  if (!editor) return

  const filepath = join(tmpdir(), `${Date.now()}.md`)
  await using _ = defer(async () => rm(filepath, { force: true }))

  await Filesystem.write(filepath, opts.value)
  opts.renderer.suspend()
  opts.renderer.currentRenderBuffer.clear()
  try {
    const parts = editor.split(" ")
    const proc = Process.spawn([...parts, filepath], {
      cwd: opts.cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      shell: process.platform === "win32",
    })
    await proc.exited
    const content = await Filesystem.readText(filepath)
    return content || undefined
  } finally {
    opts.renderer.currentRenderBuffer.clear()
    opts.renderer.resume()
    opts.renderer.requestRender()
  }
}

export * as Editor from "./editor"
