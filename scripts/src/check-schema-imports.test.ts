/**
 * Self-test for check-schema-imports.ts using the fixtures in
 * __fixtures__/schema-imports. Ensures the clean fixture passes and the
 * violations fixture is fully detected (no bypasses, no false positives).
 */
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const HERE = import.meta.dirname;
const CHECKER = join(HERE, 'check-schema-imports.ts');
const FIXTURES = join(HERE, '__fixtures__', 'schema-imports');

function run(dir: string): { code: number; output: string } {
  try {
    const output = execFileSync('npx', ['tsx', CHECKER], {
      env: { ...process.env, CHECK_SCHEMA_IMPORTS_DIR: dir },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (err: any) {
    return { code: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

let failed = false;
const assert = (cond: boolean, msg: string) => {
  if (cond) {
    console.log(`  ok: ${msg}`);
  } else {
    console.error(`  FAIL: ${msg}`);
    failed = true;
  }
};

console.log('clean fixture (must pass, no false positives):');
const clean = run(resolve(FIXTURES, 'clean'));
assert(clean.code === 0, `exit code 0 (got ${clean.code})\n${clean.output}`);

console.log('violations fixture (must fail, all forms detected):');
const bad = run(resolve(FIXTURES, 'violations'));
assert(bad.code === 1, `exit code 1 (got ${bad.code})`);
const expected: Array<[string, RegExp]> = [
  ['plain named import', /runtime named import\(s\): jobs/],
  ['comment-obfuscated import', /runtime named import\(s\): invoices/],
  ['multiline mixed import (runtime part)', /runtime named import\(s\): quotes/],
  ['namespace import', /namespace import/],
  ['default import', /default import/],
  ['side-effect import', /side-effect import/],
  ['runtime re-export', /runtime re-export\(s\): users/],
  ['export * re-export', /export \* re-export/],
  ['dynamic import()', /dynamic import\(\)/],
];
for (const [label, re] of expected) {
  assert(re.test(bad.output), `${label} detected`);
}
// Both dynamic imports (plain + comment-obfuscated) must be caught.
assert(
  (bad.output.match(/dynamic import\(\)/g) ?? []).length === 2,
  'both dynamic imports detected',
);

if (failed) {
  console.error('\ncheck-schema-imports self-test FAILED');
  process.exit(1);
}
console.log('\ncheck-schema-imports self-test passed');
