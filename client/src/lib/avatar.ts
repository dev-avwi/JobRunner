// Shared avatar helpers so the same person renders identically everywhere:
// same photo, or the same initials on the same deterministic colour.

export type WorkStatus =
  | "online"
  | "working"
  | "driving"
  | "idle"
  | "offline";

// Status dot colours (used for the small corner dot on an avatar). The dot
// shows live work status without ever recolouring the identity circle itself.
export const STATUS_DOT_COLORS: Record<WorkStatus, string> = {
  online: "#22C55E",
  driving: "#3B82F6",
  working: "#F59E0B",
  idle: "#6B7280",
  offline: "#4B5563",
};

// Deterministic identity palette. Saturated enough that white text on top is
// always readable. Picked by hashing a stable user id so the same person keeps
// the same colour on every screen.
const AVATAR_PALETTE = [
  "#2563EB", // blue
  "#7C3AED", // violet
  "#DB2777", // pink
  "#DC2626", // red
  "#EA580C", // orange
  "#CA8A04", // amber
  "#16A34A", // green
  "#0891B2", // cyan
  "#4F46E5", // indigo
  "#9333EA", // purple
  "#0D9488", // teal
  "#B45309", // brown/amber-dark
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force 32-bit int
  }
  return Math.abs(hash);
}

/**
 * Resolve a person's avatar background colour.
 * - An owner's saved theme colour always wins (their chosen identity colour).
 * - Otherwise a deterministic palette colour keyed on a stable id (or name).
 */
export function getAvatarColor(
  id?: string | number | null,
  themeColor?: string | null,
): string {
  if (themeColor && /^#?[0-9a-fA-F]{3,8}$/.test(themeColor.trim())) {
    const c = themeColor.trim();
    return c.startsWith("#") ? c : `#${c}`;
  }
  const key = (id ?? "").toString() || "default";
  return AVATAR_PALETTE[hashString(key) % AVATAR_PALETTE.length];
}

/**
 * Build up to two uppercase initials from a name, falling back to email.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  const trimmed = (name || "").trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  const e = (email || "").trim();
  if (e) return e[0].toUpperCase();
  return "?";
}

/**
 * Compose a full name from first/last/email parts.
 */
export function composeName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const full = `${firstName || ""} ${lastName || ""}`.trim();
  if (full) return full;
  if (email) return email.split("@")[0];
  return "";
}
