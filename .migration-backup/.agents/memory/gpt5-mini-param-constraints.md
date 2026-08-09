---
name: gpt-5-mini param constraints
description: API differences when moving OpenAI chat calls from gpt-4o-mini to gpt-5-mini (reasoning model)
---

When migrating any `openai.chat.completions.create` call from `gpt-4o-mini` (or other gpt-4o family) to a gpt-5 family model (`gpt-5-mini` etc), a plain model-string swap is NOT enough — gpt-5 is a reasoning model with a stricter API:

- `max_tokens` is rejected → must rename to `max_completion_tokens`.
- `temperature` only accepts the default (1) → any custom value (0.1/0.2/0.7…) returns HTTP 400. Remove the param entirely.
- Reasoning tokens are counted against `max_completion_tokens`. A small budget (e.g. 50) is fully consumed by reasoning and returns `content: ""` with `finish_reason: "length"`. Bump small budgets up (use ~2000+ even for short outputs).
- `response_format: { type: "json_object" }` still works and still requires the word "json" somewhere in the messages (same as gpt-4o) — existing JSON prompts are fine.

**Why:** verified live against the Replit AI integration base URL (`AI_INTEGRATIONS_OPENAI_BASE_URL`) in June 2026; all four behaviours reproduced.

**How to apply:** in this repo the direct LLM calls live in `server/ai.ts`, `server/voiceNoteService.ts`, and a few in `server/routes.ts`. The `aiModel` field in `server/vapiService.ts` / `shared/schema.ts` `ai_model` column is a SEPARATE thing — that's the Vapi.ai realtime voice receptionist model (latency-sensitive, user-selectable enum), NOT a direct OpenAI call; do not blindly switch it to a gpt-5 reasoning model.
