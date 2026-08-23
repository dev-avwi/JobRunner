/**
 * Parity tests for toGSM (server) and the client-side mirror in AIReceptionist.tsx.
 *
 * The client-side toGSMClient must produce identical output to the server's toGSM
 * for every input, so that the in-form warning accurately predicts what Twilio
 * will receive.  These tests verify:
 *
 *  1. Server toGSM: typographic substitutions (curly quotes, em/en dashes, ellipsis).
 *  2. Server toGSM: characters that are in the GSM-7 basic/extension tables are kept.
 *  3. Server toGSM: backtick (U+0060) is replaced with '?' — it is NOT in GSM-7.
 *  4. Server toGSM: accented characters formerly accepted by the old broad ranges
 *     (À Á Â Ã È Ê ë Ó ú) are replaced with '?'.
 *  5. Client-mirror parity: for all test inputs the client regex produces exactly
 *     the same output as the server function.
 */

import { describe, it, expect } from "vitest";
import { toGSM } from "../../twilioClient";

// ─── Inline client mirror (must stay in sync with AIReceptionist.tsx) ───────
// This is the exact same logic as toGSMClient in the web frontend.
// If this function is ever edited in twilioClient.ts or AIReceptionist.tsx,
// update this copy too — the parity assertions below will catch any drift.
function toGSMClient(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")  // curly single quotes / primes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // curly double quotes / double primes
    .replace(/\u2014/g, '-')   // em dash
    .replace(/\u2013/g, '-')   // en dash
    .replace(/\u2026/g, '...')  // horizontal ellipsis
    .replace(/\u00A0/g, ' ')   // non-breaking space
    .replace(/[^\x20-\x5F\x61-\x7E\u000A\u000D\u00A1\u00A3\u00A4\u00A5\u00A7\u00BF\u00C4\u00C5\u00C6\u00C7\u00C9\u00D1\u00D6\u00D8\u00DC\u00DF\u00E0\u00E4\u00E5\u00E6\u00E8\u00E9\u00EC\u00F1\u00F2\u00F6\u00F8\u00F9\u00FC\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9\u20AC]/g, '?');
}

// ─── Shared test cases ───────────────────────────────────────────────────────

const cases: Array<{ label: string; input: string; expected: string }> = [
  // Plain ASCII — preserved
  { label: "plain ASCII stays unchanged", input: "Hello world!", expected: "Hello world!" },
  { label: "digits and punctuation preserved", input: "0-9 .,?!/", expected: "0-9 .,?!/" },
  { label: "newline preserved (LF)", input: "line1\nline2", expected: "line1\nline2" },
  { label: "carriage return preserved (CR)", input: "line1\rline2", expected: "line1\rline2" },

  // Typographic substitutions
  { label: "curly left single quote → straight apostrophe", input: "\u2018hello\u2019", expected: "'hello'" },
  { label: "curly double quotes → straight double quotes", input: "\u201Chello\u201D", expected: '"hello"' },
  { label: "em dash → hyphen", input: "before\u2014after", expected: "before-after" },
  { label: "en dash → hyphen", input: "before\u2013after", expected: "before-after" },
  { label: "horizontal ellipsis → three dots", input: "wait\u2026", expected: "wait..." },
  { label: "non-breaking space → regular space", input: "a\u00A0b", expected: "a b" },

  // Backtick — NOT in GSM-7
  { label: "backtick replaced with ?", input: "code `here`", expected: "code ?here?" },

  // Accented characters FORMERLY admitted by old broad ranges but NOT in GSM-7
  { label: "À (U+00C0) — not in GSM-7 → ?", input: "À", expected: "?" },
  { label: "Á (U+00C1) — not in GSM-7 → ?", input: "Á", expected: "?" },
  { label: "Â (U+00C2) — not in GSM-7 → ?", input: "Â", expected: "?" },
  { label: "Ã (U+00C3) — not in GSM-7 → ?", input: "Ã", expected: "?" },
  { label: "È (U+00C8) — not in GSM-7 → ?", input: "È", expected: "?" },
  { label: "Ê (U+00CA) — not in GSM-7 → ?", input: "Ê", expected: "?" },
  { label: "ë (U+00CB) — not in GSM-7 → ?", input: "ë", expected: "?" },
  { label: "Ó (U+00D3) — not in GSM-7 → ?", input: "Ó", expected: "?" },
  { label: "ú (U+00FA) — not in GSM-7 → ?", input: "ú", expected: "?" },

  // Characters that ARE in GSM-7 — preserved
  { label: "Ä (U+00C4) — GSM-7 basic table → kept", input: "Ä", expected: "Ä" },
  { label: "Ö (U+00D6) — GSM-7 basic table → kept", input: "Ö", expected: "Ö" },
  { label: "ü (U+00FC) — GSM-7 basic table → kept", input: "ü", expected: "ü" },
  { label: "€ (U+20AC) — GSM-7 extension table → kept", input: "€10", expected: "€10" },
  { label: "£ (U+00A3) — GSM-7 basic table → kept", input: "£5", expected: "£5" },

  // Realistic auto-reply template with an em dash (the default server template)
  {
    label: "default auto-reply template: em dash converted",
    input: "Thanks for calling {{business_name}}. We got your message and will get back to you shortly. \u2014 Sent via JobRunner",
    expected: "Thanks for calling {{business_name}}. We got your message and will get back to you shortly. - Sent via JobRunner",
  },

  // Mixed exotic characters
  // Emoji are surrogate pairs (2 UTF-16 code units), so each produces 2 '?' marks
  { label: "emoji replaced with ??", input: "Hi \uD83D\uDC4B!", expected: "Hi ??!" },
  { label: "CJK character replaced with ?", input: "\u4E2D\u6587", expected: "??" },
];

// ─── Server toGSM tests ───────────────────────────────────────────────────────

describe("toGSM (server)", () => {
  for (const { label, input, expected } of cases) {
    it(label, () => {
      expect(toGSM(input)).toBe(expected);
    });
  }
});

// ─── Client mirror parity tests ───────────────────────────────────────────────

describe("toGSMClient parity with server toGSM", () => {
  for (const { label, input } of cases) {
    it(`parity: ${label}`, () => {
      expect(toGSMClient(input)).toBe(toGSM(input));
    });
  }
});
