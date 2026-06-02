export function shouldIgnoreVoiceToggleEvent(event?: { repeated?: boolean; eventType?: string }) {
  return event?.repeated === true || event?.eventType === "repeat"
}

export type VoiceToggleAction = "start" | "stop" | "ignore"

export function createVoiceToggleController(input?: { quietWindowMs?: number; minimumRecordingMs?: number }) {
  const quietWindowMs = input?.quietWindowMs ?? 900
  const minimumRecordingMs = input?.minimumRecordingMs ?? 800
  let lastEventAt: number | undefined
  let recordingStartedAt: number | undefined

  return (input: { recording: boolean; event?: { repeated?: boolean; eventType?: string }; now?: number }): VoiceToggleAction => {
    const now = input.now ?? Date.now()
    const previousEventAt = lastEventAt
    lastEventAt = now

    if (!input.recording) {
      if (shouldIgnoreVoiceToggleEvent(input.event)) return "ignore"
      recordingStartedAt = now
      return "start"
    }

    if (shouldIgnoreVoiceToggleEvent(input.event)) return "ignore"
    if (recordingStartedAt !== undefined && now - recordingStartedAt < minimumRecordingMs) return "ignore"
    if (previousEventAt !== undefined && now - previousEventAt <= quietWindowMs) return "ignore"

    recordingStartedAt = undefined
    return "stop"
  }
}
