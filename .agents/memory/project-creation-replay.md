---
name: Project creation replay safety
description: Durable retry requirements for multi-record creation flows when a client can lose the success response.
---

Persist the exact creation request on the client before sending it, and pair it with a database-enforced identity scoped to the authenticated owner. Keep the saved request until the server record and any non-transactional follow-up queue have both been reconciled.

**Why:** A server can commit successfully while the client times out or closes before receiving the response. An in-memory request ID or short-lived idempotency cache then allows a delayed retry to create a duplicate. Adding uniqueness later can also block startup if historical duplicates are not repaired first.

**How to apply:** For creation flows spanning related records, replay the unchanged saved payload after restart, enforce a durable partial unique constraint, recheck identity inside the transaction, and make the unique-index rollout preserve rows while deterministically clearing duplicate identities.