#!/usr/bin/env node
// Revert `catch (X: unknown)` back to `catch (X: any)` for any catch block
// whose body still uses X in a way that needs `any` (e.g. X.code, X.response,
// X.errors, X.stack, X.status, X.statusCode, X.cause, X.name, JSON.stringify(X)
// with member access, etc).  Anything reduced purely to `getErrorMessage(X)`
// or a bare `X` reference stays as `unknown`.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('server');
const SKIP_DIR = new Set(['node_modules']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) out.push(p);
  }
  return out;
}

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  let inStr = null, inLineCmt = false, inBlockCmt = false, inTpl = false, tplDepth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLineCmt) { if (c === '\n') inLineCmt = false; continue; }
    if (inBlockCmt) { if (c === '*' && n === '/') { inBlockCmt = false; i++; } continue; }
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (inTpl) {
      if (c === '\\') { i++; continue; }
      if (c === '`' && tplDepth === 0) { inTpl = false; continue; }
      if (c === '$' && n === '{') { tplDepth++; i++; continue; }
      if (c === '}' && tplDepth > 0) { tplDepth--; continue; }
      continue;
    }
    if (c === '/' && n === '/') { inLineCmt = true; i++; continue; }
    if (c === '/' && n === '*') { inBlockCmt = true; i++; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

let reverted = 0, filesChanged = 0;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;

  const catchRe = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*unknown\s*\)\s*\{/g;
  const matches = [];
  let m;
  while ((m = catchRe.exec(src)) !== null) {
    matches.push({ idx: m.index, full: m[0], name: m[1], openBrace: m.index + m[0].length - 1 });
  }

  for (let k = matches.length - 1; k >= 0; k--) {
    const { idx, full, name, openBrace } = matches[k];
    const close = findMatchingBrace(src, openBrace);
    if (close === -1) continue;
    const body = src.slice(openBrace + 1, close);

    // Look for `name.X` or `name?.X` or `name[` access anywhere in body.
    // Member access is anything that's not the standalone identifier nor
    // already wrapped in getErrorMessage(...).
    const memberRe = new RegExp(`(?<![\\w$.])${name}(\\??\\.|\\[)`, 'g');
    if (!memberRe.test(body)) continue;

    // Revert catch header.
    const newFull = full.replace(': unknown)', ': any)');
    src = src.slice(0, idx) + newFull + src.slice(idx + full.length);
    changed = true;
    reverted++;
  }

  if (changed) {
    fs.writeFileSync(file, src);
    filesChanged++;
  }
}

console.log(`Revert pass: ${reverted} catches reverted to any across ${filesChanged} files`);
