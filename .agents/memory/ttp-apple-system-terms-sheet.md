---
name: Tap to Pay Apple system terms sheet
description: Apple entitlement review requires their system-provided T&C sheet, not a custom terms screen
---
Apple's TTP entitlement review (case 20927765) rejected videos showing our custom Terms screen: acceptance MUST happen via Apple's system-provided Tap to Pay T&C sheet.
**Why:** iOS presents that sheet automatically on the FIRST-ever Stripe Terminal tapToPay reader connection on the device/account.
**How to apply:** setup flow's "configuring" step now really calls terminal.initialize()+connectReader() on real iOS (non-simulation) so the sheet appears during onboarding; custom terms screen is reworded as JobRunner's own payment terms ("Apple's sheet next"). connectReader already tolerates a 90s wait for the sheet. Re-record demo videos after resetting: Apple's sheet only shows once per device/Apple ID — a device that already accepted won't show it again (may need a different device/account to re-capture).
