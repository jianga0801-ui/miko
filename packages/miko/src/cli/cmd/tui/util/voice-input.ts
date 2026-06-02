import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import { createRequire } from "module"
import path from "path"
import { Global } from "@miko-ai/core/global"
import { which } from "@/util/which"

type Recorder = {
  cmd: string
  pulseServer?: string
  stop?: "stdin-q"
  platform?: NodeJS.Platform
  args(file: string, audioDevice?: string): string[]
}

export type VoiceInput = {
  file: string
  exited: Promise<number>
  stop(): Promise<void>
}

const require = createRequire(import.meta.url)

function packageFFmpegPath() {
  try {
    const ffmpeg = require("@ffmpeg-installer/ffmpeg") as unknown
    const ffmpegPath = typeof ffmpeg === "object" && ffmpeg !== null && "path" in ffmpeg ? ffmpeg.path : undefined
    return typeof ffmpegPath === "string" && ffmpegPath.length > 0 ? ffmpegPath : undefined
  } catch {
    return undefined
  }
}

function siblingFFmpegPath() {
  return path.join(path.dirname(process.execPath), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")
}

export function resolveManagedFFmpegPath(candidates = [process.env.MIKO_FFMPEG_PATH, siblingFFmpegPath(), packageFFmpegPath()], exists = existsSync) {
  return candidates.filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0).find((candidate) => exists(candidate))
}

function pulseRecorder(pulseServer: string): Recorder {
  return {
    cmd: "pulseaudio.js",
    pulseServer,
    args: () => [],
  }
}

function ffmpegRecorder(cmd: string, managed: boolean, platform = process.platform): Recorder {
  return {
    cmd,
    platform,
    stop: platform === "win32" ? "stdin-q" : undefined,
    args: (file, audioDevice) => [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      platform === "win32" ? "dshow" : managed ? "alsa" : "pulse",
      "-i",
      platform === "win32" ? `audio=${audioDevice ?? process.env.MIKO_FFMPEG_AUDIO_DEVICE ?? "default"}` : "default",
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

export function wslPulseServerPath(value = process.env.PULSE_SERVER, exists = existsSync) {
  const server = value?.startsWith("unix:") ? value.slice("unix:".length) : value
  if (server && path.isAbsolute(server) && exists(server)) return server
  if (exists("/mnt/wslg/PulseServer")) return "/mnt/wslg/PulseServer"
}

export function selectVoiceRecorder(
  lookup: (cmd: string) => boolean = (cmd) => (path.isAbsolute(cmd) ? existsSync(cmd) : which(cmd) !== null),
  managedFFmpeg = resolveManagedFFmpegPath(),
  pulseServer = wslPulseServerPath(),
  platform = process.platform,
) {
  return [
    ...(pulseServer ? [pulseRecorder(pulseServer)] : []),
    ...(managedFFmpeg ? [ffmpegRecorder(managedFFmpeg, true, platform)] : []),
    ...RECORDERS,
  ].find((recorder) => recorder.pulseServer !== undefined || lookup(recorder.cmd))
}

export function createWavBuffer(pcm: Buffer, sampleRate = 16000, channels = 1) {
  const bytesPerSample = 2
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
  header.writeUInt16LE(channels * bytesPerSample, 32)
  header.writeUInt16LE(bytesPerSample * 8, 34)
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

export function parseDirectShowAudioDevices(output: string) {
  const devices: string[] = []
  let inAudio = false
  for (const line of output.split(/\r?\n/)) {
    if (line.includes("DirectShow audio devices")) {
      inAudio = true
      continue
    }
    if (!inAudio) continue
    if (line.includes("DirectShow video devices")) break
    if (line.includes("Alternative name")) continue
    const match = line.match(/^\[dshow[^\]]*\]\s+"(.+)"\s*$/)
    if (match?.[1]) devices.push(match[1])
  }
  return devices
}

export async function resolveDirectShowAudioDevice(cmd: string, configured = process.env.MIKO_FFMPEG_AUDIO_DEVICE) {
  const trimmed = configured?.trim()
  if (trimmed) return trimmed

  const proc = Bun.spawn([cmd, "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  })
  const stderr = proc.stderr ? await new Response(proc.stderr).text() : ""
  await proc.exited.catch(() => undefined)
  const device = parseDirectShowAudioDevices(stderr)[0]
  if (!device) {
    throw new Error("No DirectShow audio input device found. Check microphone access or set MIKO_FFMPEG_AUDIO_DEVICE.")
  }
  return device
}

export async function readVoiceInputFile(file: string, read = (filepath: string) => Bun.file(filepath).arrayBuffer()) {
  try {
    return await read(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error("Voice recorder did not create an audio file. Check microphone access.")
    }
    throw error
  }
}

async function startPulseVoiceInput(file: string, pulseServer: string): Promise<VoiceInput> {
  const { PA_SAMPLE_FORMAT, PulseAudio } = await import("pulseaudio.js")
  const pulse = new PulseAudio("Miko", undefined, pulseServer)
  await pulse.connect()
  const stream = await pulse.createRecordStream({ sampleSpec: { format: PA_SAMPLE_FORMAT.S16LE, rate: 44100, channels: 2 } })
  const chunks: Buffer[] = []
  let finished = false
  let resolveExited!: (code: number) => void
  const exited = new Promise<number>((resolve) => {
    resolveExited = resolve
  })

  async function finish(code: number) {
    if (finished) return
    finished = true
    const closed = new Promise<void>((resolve) => stream.once("close", () => resolve()))
    if (!stream.destroyed) {
      stream.destroy()
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 500))])
    }
    await pulse.disconnect().catch(() => undefined)
    if (code === 0) await Bun.write(file, createWavBuffer(Buffer.concat(chunks), 44100, 2))
    resolveExited(code)
  }

  stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
  stream.once("error", () => void finish(1))
  stream.once("close", () => void finish(finished ? 0 : 1))
  stream.resume()

  return {
    file,
    exited,
    stop: async () => {
      await finish(0)
    },
  }
}

export async function startVoiceInput() {
  const recorder = selectVoiceRecorder()
  if (!recorder) {
    throw new Error("No voice recorder available. Miko includes FFmpeg, but it could not be started on this system.")
  }

  const dir = path.join(Global.Path.tmp, "voice")
  await mkdir(dir, { recursive: true })

  const file = path.join(dir, `voice-${Date.now()}.wav`)
  if (recorder.pulseServer) return startPulseVoiceInput(file, recorder.pulseServer)

  const audioDevice = recorder.platform === "win32" ? await resolveDirectShowAudioDevice(recorder.cmd) : undefined
  const proc = Bun.spawn([recorder.cmd, ...recorder.args(file, audioDevice)], {
    stdin: recorder.stop === "stdin-q" ? "pipe" : "ignore",
    stdout: "ignore",
    stderr: "ignore",
  })
  return {
    file,
    exited: proc.exited,
    stop: async () => {
      if (recorder.stop === "stdin-q" && proc.stdin) {
        const written = proc.stdin.write("q")
        if (written instanceof Promise) await written
        proc.stdin.end()
        const exited = await Promise.race([proc.exited, new Promise<undefined>((resolve) => setTimeout(resolve, 1000))])
        if (exited !== undefined) return
      }
      proc.kill("SIGINT")
      await proc.exited.catch(() => undefined)
    },
  }
}
