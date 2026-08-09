#!/usr/bin/env node
// Idempotent codemod: replace raw fontSize/fontWeight literals in mobile/app
// with tokens from src/lib/design-tokens.ts. Mapping mirrors task #327:
//   9,10,11 -> typography.sizes.xs        12 -> typography.captionSmall.fontSize
//   13 -> typography.sizes.sm             14 -> typography.button.fontSize
//   15 -> typography.sizes.md             16 -> typography.subtitle.fontSize
//   17,18 -> typography.sizes.lg          20 -> typography.sizes.xl
//   22 -> typography.sizes['2xl']         24 -> typography.sizes.xxl
//   26,28 -> typography.sizes['3xl']      30,32 -> typography.sizes['4xl']
//   >32 left untouched (no token; visuals must stay unchanged)
// Weights: '400'->regular '500'->medium '600'->semibold '700'->bold '800'->extrabold
// ('200' etc. left untouched — no token.)
// Ternary weight literals (fontWeight: cond ? '600' : '400') are intentionally
// left alone, consistent with the #327 sweep.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '../app');
const tokensAbs = path.resolve(__dirname, '../src/lib/design-tokens');

const sizeMap = {
  9: 'typography.sizes.xs', 10: 'typography.sizes.xs', 11: 'typography.sizes.xs',
  12: 'typography.captionSmall.fontSize',
  13: 'typography.sizes.sm',
  14: 'typography.button.fontSize',
  15: 'typography.sizes.md',
  16: 'typography.subtitle.fontSize',
  17: 'typography.sizes.lg', 18: 'typography.sizes.lg',
  20: 'typography.sizes.xl',
  22: "typography.sizes['2xl']",
  24: 'typography.sizes.xxl',
  26: "typography.sizes['3xl']", 28: "typography.sizes['3xl']",
  30: "typography.sizes['4xl']", 32: "typography.sizes['4xl']",
};
const weightMap = {
  400: 'fontWeights.regular', 500: 'fontWeights.medium',
  600: 'fontWeights.semibold', 700: 'fontWeights.bold', 800: 'fontWeights.extrabold',
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

let changedFiles = 0, sizeCount = 0, weightCount = 0;
for (const file of walk(appDir)) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  let usesTypography = false, usesWeights = false;

  src = src.replace(/fontSize:\s*(\d+)(?![\d.])/g, (m, n) => {
    const rep = sizeMap[Number(n)];
    if (!rep) return m;
    sizeCount++; usesTypography = true;
    return `fontSize: ${rep}`;
  });
  src = src.replace(/fontWeight:\s*'(\d+)'(\s+as\s+const)?/g, (m, n) => {
    const rep = weightMap[Number(n)];
    if (!rep) return m;
    weightCount++; usesWeights = true;
    // drop any trailing `as const` — TS1355 forbids it on a reference,
    // and fontWeights.* are already literal-typed.
    return `fontWeight: ${rep}`;
  });

  // Semantic + conditional weight literals: on any line that sets fontWeight,
  // replace quoted weights ('bold', 'normal', '400'..'800') with tokens — this
  // catches ternaries like `fontWeight: isActive ? '700' : '500'`.
  src = src.split('\n').map(line => {
    if (!/fontWeight/.test(line)) return line;
    return line.replace(/'(bold|normal|[45678]00)'/g, (m, w) => {
      const rep = w === 'bold' ? 'fontWeights.bold'
        : w === 'normal' ? 'fontWeights.regular'
        : weightMap[Number(w)];
      if (!rep) return m;
      weightCount++; usesWeights = true;
      return rep;
    });
  }).join('\n');

  if (src === orig) continue;

  // Ensure imports for the identifiers we introduced (only if not already
  // imported and actually referenced).
  const need = [];
  if (usesTypography && !/\btypography\b\s*[,}]/.test(src.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*design-tokens['"]/)?.[0] ?? '') && !/import[^;]*\btypography\b[^;]*design-tokens/.test(src)) need.push('typography');
  if (usesWeights && !/import[^;]*\bfontWeights\b[^;]*design-tokens/s.test(src)) need.push('fontWeights');

  if (need.length) {
    const importRe = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]*design-tokens)\2;?/;
    const m = src.match(importRe);
    if (m) {
      const existing = m[1].split(',').map(s => s.trim()).filter(Boolean);
      const add = need.filter(n => !existing.includes(n));
      if (add.length) {
        src = src.replace(importRe, `import { ${[...existing, ...add].join(', ')} } from ${m[2]}${m[3]}${m[2]};`);
      }
    } else {
      // No design-tokens import at all: add one with a correct relative path.
      let rel = path.relative(path.dirname(file), tokensAbs).replace(/\\/g, '/');
      if (!rel.startsWith('.')) rel = './' + rel;
      const line = `import { ${need.join(', ')} } from '${rel}';\n`;
      // insert after last import
      const lastImport = [...src.matchAll(/^import[^\n]*\n/gm)].pop();
      if (lastImport) {
        const idx = lastImport.index + lastImport[0].length;
        src = src.slice(0, idx) + line + src.slice(idx);
      } else {
        src = line + src;
      }
    }
  }

  fs.writeFileSync(file, src);
  changedFiles++;
}
console.log(`changed ${changedFiles} files; ${sizeCount} fontSize + ${weightCount} fontWeight replacements`);

// --verify: fail if any non-exempt raw literal remains under app/.
// Exempt: fontSize > 32 (no token on the scale) and fontWeight '100'-'300'
// (no thin/light tokens) — these must stay literal to keep visuals unchanged.
if (process.argv.includes('--verify')) {
  const offenders = [];
  for (const file of walk(appDir)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const fsizes = [...line.matchAll(/fontSize:\s*(\d+)(?![\d.])/g)]
        .filter(m => Number(m[1]) <= 32);
      const fweights = /fontWeight/.test(line)
        ? [...line.matchAll(/'(bold|normal|[45678]00)'/g)]
        : [];
      if (fsizes.length || fweights.length) {
        offenders.push(`${path.relative(appDir, file)}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  if (offenders.length) {
    console.error(`VERIFY FAILED: ${offenders.length} non-exempt font literal(s) remain:`);
    offenders.slice(0, 50).forEach(o => console.error('  ' + o));
    process.exit(1);
  }
  console.log('VERIFY OK: no non-exempt fontSize/fontWeight literals under app/.');
}
