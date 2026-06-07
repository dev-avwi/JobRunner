---
name: Pricing plan — target tiers (not yet applied)
description: Planned AUD pricing changes and the rule for when to apply them. Captured at user request 2026-06-07; NOT implemented.
---

**Rule: do NOT change pricing until there are paying users.** Acquire first customers at current prices, then raise. (User decision, 2026-06-07.)

Source of truth for live prices: `shared/schema.ts` → `PRICING` (values in cents AUD). Current snapshot when this was written:
- Pro $39.99/mo
- Team $89.99/mo (up to 5 workers)
- Business $129.99/mo (up to 15 workers)
- AI Receptionist add-on $60/mo; Dedicated number $10/mo

## Target pricing (when ready to raise)
- Pro → **$49.99**
- Team → **$149.99**
- Business → **$249.99** (psychological, sits under $250)
- AI Receptionist add-on → **$79–89**

## Caveats / notes
- Prices are coupled to **Apple In-App Purchase** product tiers (PRICING comment "matches Apple IAP") — changing them requires updating the IAP products too, not just the code constant.
- Business jump ($129.99→$249.99) is ~2x; ensure the Business tier's extra value (15 workers, advanced reporting, future job costing) justifies it, else consider ~$199.99 for a smoother Team→Business ladder.
- Pitch/marketing angle: Jobber's AU-equivalent stack (Grow $199 + AI Receptionist $99 USD ≈ $460 AUD/mo) vs JobRunner $49–$259 AUD with more AU-specific features (WHS/SWMS, subcontractors, Tap to Pay, voice AI receptionist, two-way SMS).
