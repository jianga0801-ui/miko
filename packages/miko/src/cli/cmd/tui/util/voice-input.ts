import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import ffmpeg from "@ffmpeg-installer/ffmpeg"
import { Global } from "@miko-ai/core/global"
import { which } from "@/util/which"

type Recorder = {
  cmd: string
  args(file: string): string[]
}

function bundledFFmpegPath() {
  return typeof ffmpeg.path === "string" && ffmpeg.path.length > 0 ? ffmpeg.path : undefined
}

function ffmpegRecorder(cmd: string, managed: boolean): Recorder {
  return {
    cmd,
    args: (file) => [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      managed ? "alsa" : "pulse",
      "-i",
      "default",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-y",
      file,
    ],
  }
}

const RECORDERS: Recorder[] = [
  {
    cmd: "ffmpeg",
    args: (file) => [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "pulse",
      "-i",
      "default",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-y",
      file,
    ],
  },
  {
    cmd: "arecord",
    args: (file) => [
      "-q",
      "-t",
      "wav",
      "-f",
      "S16_LE",
      "-r",
      "16000",
      "-c",
      "1",
      file,
    ],
  },
  {
    cmd: "sox",
    args: (file) => ["-q", "-d", "-r", "16000", "-c", "1", file],
  },
]

export function selectVoiceRecorder(
  lookup: (cmd: string) => boolean = (cmd) => (path.isAbsolute(cmd) ? existsSync(cmd) : which(cmd) !== null),
  managedFFmpeg = bundledFFmpegPath(),
) {
  return [
    ...(managedFFmpeg ? [ffmpegRecorder(managedFFmpeg, true)] : []),
    ...RECORDERS,
  ].find((recorder) => lookup(recorder.cmd))
}

export async function startVoiceInput() {
  const recorder = selectVoiceRecorder()
  if (!recorder) {
    throw new Error("No voice recorder available. Miko includes FFmpeg, but it could not be started on this system.")
  }

  const dir = path.join(Global.Path.tmp, "voice")
  await mkdir(dir, { recursive: true })

  const file = path.join(dir, `voice-${Date.now()}.wav`)
  const proc = Bun.spawn([recorder.cmd, ...recorder.args(file)], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  })
  return { file, proc }
}
