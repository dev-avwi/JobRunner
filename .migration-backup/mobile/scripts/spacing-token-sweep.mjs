#!/usr/bin/env node
// Idempotent codemod (task #333): replace raw spacing literals in the listed
// mobile files with tokens from src/lib/design-tokens.ts.
//   2 -> spacing.xxs   4 -> spacing.xs    8 -> spacing.sm   12 -> spacing.md
//  16 -> spacing.lg   20 -> spacing.xl   24 -> spacing['2xl']
//  32 -> spacing['3xl']  40 -> spacing['4xl']
// Only exact matches are swapped; other values (6, 10, 14, negatives, etc.)
// are intentional odd values and left untouched. Purely visual-neutral.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const tokensAbs = path.resolve(__dirname, '../src/lib/design-tokens');

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'app/more/invoice/[id].tsx',
      'app/more/quote/[id].tsx',
      'app/job/[id].tsx',
      'app/more/quote/new.tsx',
      'app/more/invoice/new.tsx',
      'src/components/LiveDocumentPreview.tsx',
      'app/more/admin.tsx',
      'app/(onboarding)/setup.tsx',
      'app/more/receipt/[id].tsx',
      'app/more/create-job.tsx',
    ].map((f) => path.join(mobileRoot, f));

const valueMap = {
  2: 'spacing.xxs',
  4: 'spacing.xs',
  8: 'spacing.sm',
  12: 'spacing.md',
  16: 'spacing.lg',
  20: 'spacing.xl',
  24: "spacing['2xl']",
  32: "spacing['3xl']",
  40: "spacing['4xl']",
};

const props = [
  'padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop',
  'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd',
  'margin', 'marginHorizontal', 'marginVertical', 'marginTop', 'marginBottom',
  'marginLeft', 'marginRight', 'marginStart', 'marginEnd',
  'gap', 'rowGap', 'columnGap',
];
const propRe = new RegExp(
  `\\b(${props.join('|')})\\s*:\\s*(\\d+)(?![\\d.])`,
  'g'
);

let total = 0;
for (const file of files) {
  if (!fs.existsSync(file)) { console.warn(`skip (missing): ${file}`); continue; }
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  let count = 0;

  src = src.replace(propRe, (m, prop, n) => {
    const rep = valueMap[Number(n)];
    if (!rep) return m;
    count++;
    return `${prop}: ${rep}`;
  });

  if (src === orig) { console.log(`no-op: ${path.relative(mobileRoot, file)}`); continue; }

  // Ensure `spacing` is imported from design-tokens.
  const importRe = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]*design-tokens)\2;?/;
  const m = src.match(importRe);
  if (m) {
    const existing = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (!existing.includes('spacing')) {
      src = src.replace(importRe, `import { ${[...existing, 'spacing'].join(', ')} } from ${m[2]}${m[3]}${m[2]};`);
    }
  } else if (!/import[^;]*\bspacing\b[^;]*design-tokens/s.test(src)) {
    let rel = path.relative(path.dirname(file), tokensAbs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    const line = `import { spacing } from '${rel}';\n`;
    const lastImport = [...src.matchAll(/^import[^\n]*\n/gm)].pop();
    if (lastImport) {
      const idx = lastImport.index + lastImport[0].length;
      src = src.slice(0, idx) + line + src.slice(idx);
    } else {
      src = line + src;
    }
  }

  fs.writeFileSync(file, src);
  total += count;
  console.log(`${path.relative(mobileRoot, file)}: ${count} replacements`);
}
console.log(`total: ${total}`);
