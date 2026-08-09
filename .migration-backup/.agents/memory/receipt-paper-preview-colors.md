---
name: Receipt/document paper previews stay light
description: Which hardcoded colours are intentional in mobile document preview renders during theme cleanups
---
The in-app "document preview" renders (e.g. the receipt preview card in mobile/app/more/receipt/[id].tsx: previewDocumentCard + inline preview JSX using #ffffff/#1a1a1a/#6b7280/#e5e7eb) are deliberately hardcoded light — they emulate a paper/PDF document and must look identical in dark mode.

**Why:** Users share/print these documents; theming them to dark would produce wrong-looking receipts.
**How to apply:** In any colour-token sweep, skip document/paper preview blocks (and Google Maps style JSON, third-party brand colours, ColorPicker palettes, decorative multi-hue category palettes with no token). App chrome around them (e.g. payment summary sections) IS themable.
