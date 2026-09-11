import { describe, it, expect } from "vitest";
import { applyLinePrefix, applyInline } from "../lib/markdownEditor";

// ─── applyLinePrefix ──────────────────────────────────────────────────────────

describe("applyLinePrefix — H2", () => {
  it("adds ## prefix to a plain line", () => {
    expect(applyLinePrefix("Hello", { start: 0, end: 0 }, "## ")).toBe("## Hello");
  });

  it("toggles ## off when already present", () => {
    expect(applyLinePrefix("## Hello", { start: 0, end: 0 }, "## ")).toBe("Hello");
  });

  it("replaces an existing H3 prefix with H2", () => {
    expect(applyLinePrefix("### Hello", { start: 0, end: 0 }, "## ")).toBe("## Hello");
  });

  it("replaces a bullet prefix with H2", () => {
    expect(applyLinePrefix("- Hello", { start: 0, end: 0 }, "## ")).toBe("## Hello");
  });

  it("applies only to the current line when multiline", () => {
    const text = "Line one\nLine two";
    const result = applyLinePrefix(text, { start: 9, end: 9 }, "## ");
    expect(result).toBe("Line one\n## Line two");
  });
});

describe("applyLinePrefix — bullet list", () => {
  it("adds '- ' prefix to a plain line", () => {
    expect(applyLinePrefix("Item", { start: 0, end: 0 }, "- ")).toBe("- Item");
  });

  it("toggles bullet off when already present", () => {
    expect(applyLinePrefix("- Item", { start: 0, end: 0 }, "- ")).toBe("Item");
  });

  it("replaces numbered prefix with bullet", () => {
    expect(applyLinePrefix("1. Item", { start: 0, end: 0 }, "- ")).toBe("- Item");
  });
});

describe("applyLinePrefix — numbered list", () => {
  it("adds '1. ' prefix to a plain line", () => {
    expect(applyLinePrefix("Step", { start: 0, end: 0 }, "1. ")).toBe("1. Step");
  });

  it("toggles numbered off when already present", () => {
    expect(applyLinePrefix("1. Step", { start: 0, end: 0 }, "1. ")).toBe("Step");
  });
});

// ─── applyInline ─────────────────────────────────────────────────────────────

describe("applyInline — bold (**)", () => {
  it("wraps selected text with **", () => {
    const text = "hello world";
    const result = applyInline(text, { start: 6, end: 11 }, "**");
    expect(result).toBe("hello **world**");
  });

  it("uses 'text' placeholder when nothing is selected", () => {
    const result = applyInline("", { start: 0, end: 0 }, "**");
    expect(result).toBe("**text**");
  });

  it("unwraps when selection itself is the wrapped span", () => {
    const text = "hello **world**";
    // select "**world**" (positions 6–15)
    const result = applyInline(text, { start: 6, end: 15 }, "**");
    expect(result).toBe("hello world");
  });

  it("unwraps when markers are just outside the selection", () => {
    const text = "hello **world**";
    // select just "world" (7–12) — markers are outside at 6,12
    const result = applyInline(text, { start: 8, end: 13 }, "**");
    expect(result).toBe("hello world");
  });

  it("does not double-wrap if applied twice (second call unwraps)", () => {
    const text = "word";
    const wrapped = applyInline(text, { start: 0, end: 4 }, "**");
    // wrapped = "**word**"; selection now covers full string
    const unwrapped = applyInline(wrapped, { start: 0, end: 8 }, "**");
    expect(unwrapped).toBe("word");
  });
});

describe("applyInline — italic (*)", () => {
  it("wraps selected text with *", () => {
    const text = "hello world";
    const result = applyInline(text, { start: 6, end: 11 }, "*");
    expect(result).toBe("hello *world*");
  });

  it("unwraps when selection itself is wrapped", () => {
    const text = "*world*";
    const result = applyInline(text, { start: 0, end: 7 }, "*");
    expect(result).toBe("world");
  });
});

// ─── Plain-text fallback (no markdown) ───────────────────────────────────────

describe("plain-text compatibility", () => {
  it("applyLinePrefix on empty string produces the prefix only", () => {
    expect(applyLinePrefix("", { start: 0, end: 0 }, "- ")).toBe("- ");
  });

  it("applyInline on empty string wraps placeholder", () => {
    expect(applyInline("", { start: 0, end: 0 }, "**")).toBe("**text**");
  });
});
