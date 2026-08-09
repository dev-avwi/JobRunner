// Centralized display-name helpers.
//
// Many name columns are intentionally nullable (multi-login support makes
// email/password nullable by design, and users.firstName/lastName are nullable
// from Replit Auth claims). Rendering those raw values can produce blank names
// on generated PDFs (quotes, invoices, proof packs) and in the UI. These
// helpers always return a non-empty, human-readable name with context-aware
// fallbacks so a missing name never renders blank.

export interface NameLike {
  // Pre-built single-string names (preferred when present)
  displayName?: string | null;
  fullName?: string | null;
  name?: string | null;
  workerName?: string | null;
  // Split name parts (e.g. users / team_members tables)
  firstName?: string | null;
  lastName?: string | null;
  // Business / org name (useful for sole traders whose person name is missing)
  businessName?: string | null;
  // Identity fallbacks
  email?: string | null;
  username?: string | null;
}

function clean(value?: string | null): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emailPrefix(email?: string | null): string | null {
  const cleaned = clean(email);
  if (!cleaned) return null;
  const at = cleaned.indexOf("@");
  const prefix = at > 0 ? cleaned.slice(0, at) : cleaned;
  return clean(prefix);
}

/**
 * Returns a non-empty display name from a person/client-like record.
 *
 * Resolution order:
 *  1. pre-built single-string name (displayName / fullName / name / workerName)
 *  2. firstName + lastName (whichever parts exist)
 *  3. businessName
 *  4. email prefix (the part before "@")
 *  5. username
 *  6. the supplied fallback (default "Customer")
 *
 * @param record  Any object that may carry name fields. Null/undefined is safe.
 * @param fallback Last-resort label when nothing else is available.
 */
export function getDisplayName(
  record: NameLike | null | undefined,
  fallback: string = "Customer",
): string {
  if (!record) return fallback;

  const prebuilt =
    clean(record.displayName) ||
    clean(record.fullName) ||
    clean(record.name) ||
    clean(record.workerName);
  if (prebuilt) return prebuilt;

  const combined = [clean(record.firstName), clean(record.lastName)]
    .filter(Boolean)
    .join(" ");
  if (combined) return combined;

  return (
    clean(record.businessName) ||
    emailPrefix(record.email) ||
    clean(record.username) ||
    fallback
  );
}

/** Display name for a client/customer on documents and UI. Fallback: "Customer". */
export function getClientDisplayName(
  record: NameLike | null | undefined,
  fallback: string = "Customer",
): string {
  return getDisplayName(record, fallback);
}

/** Display name for a worker/team member. Fallback: "Team member". */
export function getWorkerDisplayName(
  record: NameLike | null | undefined,
  fallback: string = "Team member",
): string {
  return getDisplayName(record, fallback);
}

/**
 * Ensures an already-resolved name string is non-empty, applying a fallback
 * when it is null/blank. Useful where a name was built upstream but may be "".
 */
export function ensureDisplayName(
  value: string | null | undefined,
  fallback: string = "Customer",
): string {
  return clean(value) || fallback;
}
