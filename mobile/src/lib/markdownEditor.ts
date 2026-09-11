/**
 * Pure markdown editor utilities — no React Native / Expo dependencies.
 * Used by MarkdownToolbar.tsx and tested independently.
 */

export type MarkdownAction = 'h2' | 'h3' | 'bullet' | 'numbered' | 'bold' | 'italic';

export type Sel = { start: number; end: number };

/** Insert/toggle a line-level prefix (heading, bullet, numbered). */
export function applyLinePrefix(value: string, sel: Sel, prefix: string): string {
  const lineStart = value.lastIndexOf('\n', sel.start - 1) + 1;
  const before = value.slice(0, lineStart);
  const rest = value.slice(lineStart);
  if (rest.startsWith(prefix)) return before + rest.slice(prefix.length);
  const stripped = rest.replace(/^(#{2,3} |[-*] |\d+\. )/, '');
  return before + prefix + stripped;
}

/**
 * Wrap or unwrap selected text with an inline marker (** or *).
 * Three toggle cases:
 *   1. Selection itself is already wrapped → unwrap
 *   2. Markers are just outside the selection → unwrap
 *   3. Otherwise → wrap (uses "text" placeholder when nothing is selected)
 */
export function applyInlineWrap(value: string, sel: Sel, marker: string): string {
  const selected = value.slice(sel.start, sel.end);
  const before = value.slice(0, sel.start);
  const after = value.slice(sel.end);
  const ml = marker.length;

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > ml * 2) {
    return before + selected.slice(ml, selected.length - ml) + after;
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return before.slice(0, before.length - ml) + selected + after.slice(ml);
  }
  const text = selected || 'text';
  return before + marker + text + marker + after;
}

/** Apply a named toolbar action to a string at the given selection. */
export function applyMarkdownAction(value: string, sel: Sel, action: MarkdownAction): string {
  switch (action) {
    case 'h2':       return applyLinePrefix(value, sel, '## ');
    case 'h3':       return applyLinePrefix(value, sel, '### ');
    case 'bullet':   return applyLinePrefix(value, sel, '- ');
    case 'numbered': return applyLinePrefix(value, sel, '1. ');
    case 'bold':     return applyInlineWrap(value, sel, '**');
    case 'italic':   return applyInlineWrap(value, sel, '*');
    default:         return value;
  }
}
