/**
 * Fails when frontend code in artifacts/jobrunner/src imports runtime values
 * (non-type-only) from @shared/schema. Runtime imports pull the full drizzle
 * schema (+drizzle-orm+zod, ~240 kB min) into that page's chunk.
 *
 * Allowed:   import type { Job } from '@shared/schema'
 *            import { type Job, type Invoice } from '@shared/schema'
 *            export type { Job } from '@shared/schema'
 * Blocked:   import { jobs } from '@shared/schema'
 *            import * as schema from '@shared/schema'
 *            import schema from '@shared/schema'
 *            import '@shared/schema'
 *            await import('@shared/schema')
 *            export { x } from '@shared/schema'   (non-type)
 *            export * from '@shared/schema'
 *
 * Runtime constants belong in the dependency-free modules:
 * @shared/permissions, @shared/pricing, @shared/safety-forms.
 *
 * Uses the TypeScript compiler API (AST traversal), so comments, multiline
 * statements, and string/comment lookalikes are handled correctly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..', '..');
// CHECK_SCHEMA_IMPORTS_DIR override is used by the self-test fixtures.
const TARGET_DIR = process.env.CHECK_SCHEMA_IMPORTS_DIR
  ? resolve(process.env.CHECK_SCHEMA_IMPORTS_DIR)
  : join(ROOT, 'artifacts', 'jobrunner', 'src');
const MODULE = '@shared/schema';

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules') continue;
      yield* walkFiles(full);
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf('.')))) {
      yield full;
    }
  }
}

type Violation = { file: string; line: number; reason: string };
const violations: Violation[] = [];

function isTargetSpecifier(expr: ts.Expression | undefined): boolean {
  if (!expr) return false;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text === MODULE;
  }
  return false;
}

function checkFile(filePath: string): void {
  const sourceText = readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );

  const record = (node: ts.Node, reason: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    violations.push({ file: relative(ROOT, filePath), line: line + 1, reason });
  };

  const visit = (node: ts.Node): void => {
    // import ... from '@shared/schema'  /  import '@shared/schema'
    if (ts.isImportDeclaration(node) && isTargetSpecifier(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (!clause) {
        record(node, 'side-effect import');
      } else if (!clause.isTypeOnly) {
        if (clause.name) {
          record(node, 'default import');
        } else if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            record(node, 'namespace import');
          } else {
            const runtimeSpecs = clause.namedBindings.elements.filter(
              (el) => !el.isTypeOnly,
            );
            if (runtimeSpecs.length > 0) {
              record(
                node,
                `runtime named import(s): ${runtimeSpecs.map((s) => s.name.text).join(', ')}`,
              );
            }
          }
        }
      }
    }

    // export ... from '@shared/schema'
    if (ts.isExportDeclaration(node) && isTargetSpecifier(node.moduleSpecifier)) {
      if (!node.isTypeOnly) {
        if (!node.exportClause) {
          record(node, 'export * re-export');
        } else if (ts.isNamespaceExport(node.exportClause)) {
          record(node, 'namespace re-export');
        } else {
          const runtimeSpecs = node.exportClause.elements.filter(
            (el) => !el.isTypeOnly,
          );
          if (runtimeSpecs.length > 0) {
            record(
              node,
              `runtime re-export(s): ${runtimeSpecs.map((s) => s.name.text).join(', ')}`,
            );
          }
        }
      }
    }

    // import('@shared/schema')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      isTargetSpecifier(node.arguments[0])
    ) {
      record(node, 'dynamic import()');
    }

    // require('@shared/schema')
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      isTargetSpecifier(node.arguments[0])
    ) {
      record(node, 'require()');
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const file of walkFiles(TARGET_DIR)) {
  checkFile(file);
}

if (violations.length > 0) {
  console.error(
    `Found ${violations.length} runtime import(s) of ${MODULE} in ${relative(ROOT, TARGET_DIR)}.\n` +
      `Runtime imports pull the entire drizzle schema (~240 kB min) into the page chunk.\n` +
      `Use \`import type\` for types; move runtime constants to a dependency-free module\n` +
      `(@shared/permissions, @shared/pricing, @shared/safety-forms).\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.reason}`);
  }
  process.exit(1);
}

console.log(`OK: no runtime imports of ${MODULE} in ${relative(ROOT, TARGET_DIR)}.`);
