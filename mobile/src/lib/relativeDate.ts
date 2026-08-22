/**
 * relativeDate — human-friendly date labels for mobile lists.
 *
 * Rules:
 *  < 60 s   → "just now"
 *  < 60 min → "X min ago"
 *  today    → "Today · HH:MM am/pm"
 *  yesterday→ "Yesterday · HH:MM am/pm"
 *  < 7 days → "Monday · HH:MM am/pm"
 *  otherwise→ "12 Jan 2025"
 *
 * If the date is invalid, returns the fallback string (default "Unknown date").
 */
export function relativeDate(
  value: string | Date | null | undefined,
  fallback = 'Unknown date',
): string {
  if (!value) return fallback;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return fallback;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;

  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysDiff = Math.round((todayStart.getTime() - dayStart.getTime()) / 86400000);

  if (daysDiff === 0) return `Today · ${time}`;
  if (daysDiff === 1) return `Yesterday · ${time}`;
  if (daysDiff < 7) {
    const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' });
    return `${weekday} · ${time}`;
  }

  // Absolute fallback
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * relativeDateGroup — label for grouped list headers (no time component).
 *
 * today     → "Today"
 * yesterday → "Yesterday"
 * < 7 days  → "Monday"
 * otherwise → "12 Jan 2025"
 */
export function relativeDateGroup(
  value: string | Date | null | undefined,
  fallback = 'Unknown date',
): string {
  if (!value) return fallback;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return fallback;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysDiff = Math.round((todayStart.getTime() - dayStart.getTime()) / 86400000);

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return d.toLocaleDateString('en-AU', { weekday: 'long' });
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
