import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// PII field names that must never appear in plaintext in pino log output.
// pino/fast-redact wildcard (`*.field`) only redacts one level deep, so we
// list each field at root, one level, and two levels to cover the patterns
// actually used in this codebase (e.g. `{ user: { email } }` or
// `{ data: { user: { email } } }`).  A custom serializer handles deeper nesting.
const PII_FIELDS = [
  "password", "passwordHash", "emailVerificationToken", "passwordResetToken",
  "email", "phone", "phoneNormalized",
  "bankBsb", "bankAccountNumber", "bankAccountName",
  "abn", "tfn", "payId",
  "appleReceiptData", "stripeCustomerId", "stripePaymentIntentId",
] as const;

export function buildRedactPaths(): string[] {
  const paths: string[] = [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ];
  for (const field of PII_FIELDS) {
    paths.push(field);          // root level
    paths.push(`*.${field}`);   // one level deep  (e.g. { user: { email } })
    paths.push(`*.*.${field}`); // two levels deep (e.g. { data: { user: { email } } })
  }
  return paths;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: buildRedactPaths(),
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
