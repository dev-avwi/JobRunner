---
name: Vapi webhook secret rollout
description: How Vapi webhook auth really works and the safe order to enable VAPI_WEBHOOK_SECRET
---
Vapi does NOT HMAC-sign webhooks. It sends the assistant's `serverUrlSecret` VERBATIM in the `x-vapi-secret` header. `verifyVapiWebhook` accepts that (timingSafeEqual) first, keeps an HMAC `x-vapi-signature` path for forward compat, and — only while `VAPI_WEBHOOK_SECRET` is unset — falls back to accepting payloads with a known assistantId/event type (spoofable, temporary).

**Why:** the original code HMAC-verified `x-vapi-signature`; enabling the secret would have rejected ALL real Vapi webhooks (Vapi never sends that header), silently killing the AI receptionist.

**How to apply (safe rollout order):**
1. Set `VAPI_WEBHOOK_SECRET` in BOTH dev and production env (prod first matters — assistants point at prod webhook URL).
2. Publish so the prod server accepts the verbatim secret.
3. Resync/update every assistant (create/update/config-PATCH paths all thread `serverUrlSecret` from env) so Vapi starts sending the header.
4. Then remove the unsigned fallback in `verifyVapiWebhook` to fail closed.
Never resync assistants from dev with a secret prod doesn't have yet — that breaks live webhooks.
