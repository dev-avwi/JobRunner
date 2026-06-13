---
name: Vapi assistant config write paths
description: Any new per-config AI-receptionist field must be threaded through ALL Vapi write paths or it silently drops/desyncs.
---

Adding a per-config field to the AI Receptionist (e.g. `recordingEnabled`) requires touching every write path or the field silently fails to persist/sync to Vapi:

1. `shared/schema.ts` `aiReceptionistConfig` column (add via raw `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — never `db:push`, it wants destructive drops on this DB). **Prod DB needs the same raw ALTER at deploy time** — the column won't exist in prod otherwise and writes/reads break.
2. `server/vapiService.ts`:
   - `VapiAssistantConfig` + both update-fn param types.
   - `createAssistant` (sets the field on the assistant; was hardcoded for recording — defaulted `true`).
   - `updateAssistant` (recompute derived fields like the spoken first-message notice here).
   - `updateReceptionistConfig` AND `updateReceptionistConfigById` (persist + needsVapiSync + updateAssistant call).
3. `server/routes.ts` — there are **multiple** routes, easy to miss:
   - `POST /api/ai-receptionist/config` (CREATE path — separate destructure + `createAiReceptionistConfig` insert + JSON response).
   - `PATCH /api/ai-receptionist/config` (and PATCH-by-id) — zod schema, destructure, persist, sync.
   - `POST /api/ai-receptionist/resync` — re-pushes a hand-built `updateAssistant({...})` object; must include the field or `updateAssistant` recomputes derived values (e.g. recording disclosure) from `undefined` and drops them.
   - All GET/response payloads that surface config.
4. `client/src/pages/AIReceptionist.tsx` — interface, formData state type + initForm, ConfigPayload, handleSave, and the Switch/UI.

**Why:** Vapi recording defaults ON at Vapi's side; when recording is enabled the assistant's spoken `firstMessage` must include a recording disclosure (callers consent burden). The disclosure is derived at write time, so any path that rebuilds the assistant (especially resync, which builds its own object) must pass the flag or it pushes a first message without the disclosure while recording stays on.

**How to apply:** when adding any AI-receptionist config field, grep for all `updateAssistant(`, `createAiReceptionistConfig`, `createAssistant`, and the 4+ `/api/ai-receptionist/*` routes; the create and resync routes are the ones most easily missed.

Footgun: `read` tool is unreliable on `server/routes.ts` (~47k lines) — use `grep -n` + `sed -n 'A,Bp'` for locating, `edit` (string match) for changes.
