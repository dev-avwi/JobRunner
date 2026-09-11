/**
 * Markdown editor utilities — shared between CustomFormRenderer and tests.
 * Pure functions: no React, no DOM dependencies.
 */

export type Sel = { start: number; end: number };

/**
 * Insert/toggle a line-level prefix (## H2, ### H3, - bullet, 1. numbered).
 * Strips other block prefixes first so you can switch heading types cleanly.
 * Toggling the same prefix off removes it.
 */
export function applyLinePrefix(text: string, sel: Sel, prefix: string): string {
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  const before = text.slice(0, lineStart);
  const rest = text.slice(lineStart);
  if (rest.startsWith(prefix)) return before + rest.slice(prefix.length);
  const stripped = rest.replace(/^(#{2,3} |[-*] |\d+\. )/, '');
  return before + prefix + stripped;
}

/**
 * Wrap or unwrap selected text with an inline marker (** or *).
 * Three toggle cases:
 *   1. Selection itself is wrapped  → unwrap
 *   2. Markers are just outside the selection → unwrap
 *   3. Otherwise → wrap (uses "text" placeholder when nothing is selected)
 */
export function applyInline(text: string, sel: Sel, marker: string): string {
  const selected = text.slice(sel.start, sel.end);
  const before = text.slice(0, sel.start);
  const after = text.slice(sel.end);
  const ml = marker.length;

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > ml * 2) {
    return before + selected.slice(ml, selected.length - ml) + after;
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return before.slice(0, before.length - ml) + selected + after.slice(ml);
  }
  const textToWrap = selected || 'text';
  return before + marker + textToWrap + marker + after;
}
