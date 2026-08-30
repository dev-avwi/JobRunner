#!/usr/bin/env node
/**
 * check-vite-aliases.mjs
 *
 * Ensures every @shared/* import path used in artifacts/jobrunner/src has a
 * matching alias entry in vite.config.ts.
 *
 * Exit 0 → all aliases present.
 * Exit 1 → at least one import is missing an alias (prints which ones).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Extract alias keys from vite.config.ts
// ---------------------------------------------------------------------------
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');

/** Matches lines like:  '@shared/foo': path.resolve(...) */
const aliasPattern = /['"](@shared\/[^'"]+)['"]\s*:/g;
const registeredAliases = new Set();
for (const [, alias] of viteConfig.matchAll(aliasPattern)) {
  registeredAliases.add(alias);
}

// ---------------------------------------------------------------------------
// 2. Collect every @shared/* import path used inside src/
// ---------------------------------------------------------------------------
const srcDir = join(root, 'src');

/**
 * Recursively walk a directory and collect files whose names end with one of
 * the given extensions.
 */
function walkFiles(dir, extensions) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const sourceFiles = walkFiles(srcDir, ['.ts', '.tsx']);

/** Matches both single- and double-quoted @shared/* import specifiers */
const importPattern = /from\s+['"](@shared\/[^'"]+)['"]/g;

const usedAliases = new Set();
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  for (const [, alias] of content.matchAll(importPattern)) {
    usedAliases.add(alias);
  }
}

// ---------------------------------------------------------------------------
// 3. Report & exit
// ---------------------------------------------------------------------------
const missing = [...usedAliases].filter((a) => !registeredAliases.has(a));

if (missing.length === 0) {
  console.log(
    `✓ All ${usedAliases.size} @shared/* import(s) have a matching Vite alias.`,
  );
  console.log('  Registered:', [...registeredAliases].sort().join(', '));
  process.exit(0);
} else {
  console.error(
    `✗ ${missing.length} @shared/* import(s) are NOT registered as Vite aliases:\n`,
  );
  for (const alias of missing) {
    console.error(`  Missing alias: ${alias}`);

    // Show which files use the missing alias
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      if (content.includes(`'${alias}'`) || content.includes(`"${alias}"`)) {
        const rel = file.replace(root + '/', '');
        console.error(`    used in: ${rel}`);
      }
    }
  }

  console.error(
    '\nAdd the missing alias(es) to the resolve.alias map in vite.config.ts.',
  );
  process.exit(1);
}
