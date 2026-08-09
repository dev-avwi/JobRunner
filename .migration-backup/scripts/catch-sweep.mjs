#!/usr/bin/env node
// One-shot codemod for Task #170 backend `any` sweep.
//
// 1. catch (error: any)/catch (err: any)/catch (e: any)  ->  catch (X: unknown)
// 2. <name>.message  ->  getErrorMessage(<name>)   (only when <name> is the
//    catch variable for the enclosing catch block; we scope by re-parsing each
//    catch body via brace counting).
// 3. Injects `import { getErrorMessage } from "<rel>/lib/errors";` if any
//    .message rewrite happened in that file.

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

function relImport(file) {
  const fromDir = path.dirname(file);
  let rel = path.relative(fromDir, path.join(ROOT, 'lib/errors'));
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\\/g, '/');
}

function findMatchingBrace(src, openIdx) {
  // openIdx is the position of '{' — find matching close.
  let depth = 0;
  let inStr = null;
  let inLineCmt = false;
  let inBlockCmt = false;
  let inTpl = false;
  let tplDepth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
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

const stats = { files: 0, catchRewrites: 0, msgRewrites: 0, imports: 0 };

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;
  let msgRewritesInFile = 0;
  let catchRewritesInFile = 0;

  // Find all `catch (name: any)` occurrences. Process from end to start so
  // indices stay valid as we rewrite.
  const catchRe = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*any\s*\)\s*\{/g;
  const matches = [];
  let m;
  while ((m = catchRe.exec(src)) !== null) {
    matches.push({ idx: m.index, full: m[0], name: m[1], openBrace: m.index + m[0].length - 1 });
  }

  for (let k = matches.length - 1; k >= 0; k--) {
    const { idx, full, name, openBrace } = matches[k];
    const close = findMatchingBrace(src, openBrace);
    if (close === -1) continue;

    const before = src.slice(0, openBrace + 1);
    const body = src.slice(openBrace + 1, close);
    const after = src.slice(close);

    // Rewrite `name.message` and `name?.message` inside the body. Use word
    // boundary on the left to avoid matching `other.error.message`.
    const msgRe = new RegExp(`(?<![\\w$.])${name}\\??\\.message\\b`, 'g');
    let bodyMsgCount = 0;
    const newBody = body.replace(msgRe, () => { bodyMsgCount++; return `getErrorMessage(${name})`; });

    // Rewrite the catch header: drop `: any` -> `: unknown`.
    const newFull = full.replace(/:\s*any\s*\)/, ': unknown)');

    const newSrc = before.slice(0, idx) + newFull + newBody + after;
    src = newSrc;
    changed = true;
    catchRewritesInFile++;
    msgRewritesInFile += bodyMsgCount;
  }

  if (changed) {
    if (msgRewritesInFile > 0 && !/getErrorMessage/.test(src.slice(0, 4000))) {
      // Inject import after the last top-level import line.
      const importRe = /^(import[^\n]*\n)+/m;
      const im = src.match(importRe);
      const imp = `import { getErrorMessage } from "${relImport(file)}";\n`;
      if (im) {
        const end = im.index + im[0].length;
        src = src.slice(0, end) + imp + src.slice(end);
      } else {
        src = imp + src;
      }
      stats.imports++;
    }
    fs.writeFileSync(file, src);
    stats.files++;
    stats.catchRewrites += catchRewritesInFile;
    stats.msgRewrites += msgRewritesInFile;
  }
}

console.log('Catch sweep complete:');
console.log(`  files modified:   ${stats.files}`);
console.log(`  catch rewrites:   ${stats.catchRewrites}`);
console.log(`  .message → helper:${stats.msgRewrites}`);
console.log(`  imports injected: ${stats.imports}`);
