/* Fixture: all of these are allowed — type-only usage of @shared/schema,
   plus lookalikes in strings and comments that must NOT be flagged. */
// import { jobs } from '@shared/schema' — comment, not code
import type { Job } from '@shared/schema';
import { type Invoice, type Quote } from '@shared/schema';
export type { Job as JobAlias } from '@shared/schema';
export { type Invoice as InvoiceAlias } from '@shared/schema';

const lookalike = "import { jobs } from '@shared/schema'";
const template = `import('@shared/schema')`;

export const use = (j: Job, i: Invoice, q: Quote) => [j, i, q, lookalike, template];
