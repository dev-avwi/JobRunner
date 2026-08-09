---
name: Voice note recording duration cap
description: Why voice-note recorders cap at 5 minutes and what that cap is coupled to
---

Both voice-note recorders (mobile `mobile/src/components/VoiceRecorder.tsx` expo-av,
web `client/src/components/ui/voice-recorder.tsx` MediaRecorder) auto-stop at
`MAX_RECORDING_SECONDS = 300` (5 min).

**Why:** voice notes upload as base64 `audioData` inside a JSON body, NOT multipart,
so the binding size limit is `express.json({ limit: '10mb' })` in `server/index.ts`
(the multer fileSize limits do NOT apply to the `POST /api/jobs/:id/voice-notes`
path). A 5-min mobile HIGH_QUALITY m4a (~128 kbps) is ~4.8MB raw → ~6.4MB base64,
comfortably under 10MB. Without a cap a long recording silently failed upload
("Failed to upload voice note") with no size reason.

**How to apply:** if you ever need longer voice notes, the cap and the 10MB body
limit move together — either raise `express.json` limit (global, affects all JSON
routes) OR lower the recording bitrate (speech is fine at much lower than 128 kbps),
not just the cap. Transcript/summary flow is independent (Whisper, 25MB limit) and
must not be touched. Mobile auto-stop calls `stopRecording()` (resilient via
`recordingRef.current` fallback); web stops via `mediaRecorderRef.current` with a
`state !== 'inactive'` guard to avoid double-stop.
