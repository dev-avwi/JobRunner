---
name: Booking page funnels into Leads
description: The public self-booking page creates a Lead, not a separate booking inbox; all customer intake converges on the Leads pipeline.
---

The public booking page (`/book/:slug`) does NOT have its own owner inbox or its
own table. Every submission creates a **Lead** (`source: 'booking_page'`) with the
chosen service + requested time written into the lead description and `followUpDate`.
The owner manages and converts it from the existing Leads page.

**Why:** The app already funnels other intake into Leads — the AI receptionist and
the website contact/booking form (`/api/public/website-booking/:businessId`, source
`website_booking`) both create Leads. A separate "Booking Requests" inbox was built
first (request-and-approve, its own `booking_requests` table + page + nav) but the
user pivoted (2026-06-27): one pipeline, not two. The owner has no website yet; the
booking page is just a shareable client-facing link.

**How to apply:** Keep all customer self-service intake (booking page, website forms,
AI receptionist) creating Leads. Do NOT reintroduce a parallel booking inbox/table.
"Approve a booking" = the existing Leads convert flow (`/api/leads/:id/convert`),
which creates client + job (+ quote) and marks the lead `won`. The `booking_requests`
DB table may still exist in some environments (orphaned; we never drop tables) but is
unused — do not wire it back up. Booking availability (`buildBookingAvailability` in
server/routes.ts) now subtracts only existing jobs, not pending requests.
