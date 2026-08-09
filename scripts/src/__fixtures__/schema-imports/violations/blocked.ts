/* Fixture: every statement below must be flagged as a runtime import,
   including comment-obfuscated and multiline forms. */
import { jobs } from '@shared/schema';
import /* comment */ { invoices } from '@shared/schema';
import {
  type Quote,
  quotes,
} from '@shared/schema';
import * as schema from '@shared/schema';
import defaultSchema from '@shared/schema';
import '@shared/schema';
export { users } from '@shared/schema';
export * from '@shared/schema';

export async function load() {
  const a = await import('@shared/schema');
  const b = await import(/* comment */ '@shared/schema');
  return [a, b, jobs, invoices, quotes, schema, defaultSchema];
}
