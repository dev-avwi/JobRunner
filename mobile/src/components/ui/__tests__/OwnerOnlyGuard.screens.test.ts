/**
 * OwnerOnlyGuard – screen integration contract tests
 *
 * These are static source-contract tests. They do NOT render the screens
 * (which have hundreds of dependencies), but they DO directly verify that
 * each guarded screen file:
 *   1. Imports OwnerOnlyGuard from the shared guard module.
 *   2. Renders <OwnerOnlyGuard> around the screen content in its
 *      default-exported component.
 *
 * Why static? Rendering each full screen would require mocking dozens of
 * hooks and stores. A static check is sufficient to catch the regression we
 * care about: a developer removing or forgetting the guard wrapper during a
 * refactor. It catches that regression immediately and with zero flakiness.
 *
 * Screens verified (all guarded in Task #645):
 *   mobile/app/more/clients.tsx
 *   mobile/app/more/documents.tsx
 *   mobile/app/more/payment-hub.tsx
 *   mobile/app/more/expenses.tsx
 *   mobile/app/more/collect-payment.tsx
 *   mobile/app/more/inventory.tsx
 *   mobile/app/more/communications.tsx
 *   mobile/app/more/leads.tsx
 *   mobile/app/more/ai-receptionist.tsx
 *   mobile/app/more/integrations.tsx
 *   mobile/app/more/branding.tsx
 *   mobile/app/more/custom-website.tsx
 *   mobile/app/more/subscription.tsx
 */

import * as fs from 'fs';
import * as path from 'path';

// Paths are relative to the mobile/ workspace root (where Jest runs).
const SCREENS_DIR = path.resolve(__dirname, '../../../../app/more');

const GUARDED_SCREENS: Array<{ file: string; label: string }> = [
  { file: 'clients.tsx',         label: '/more/clients' },
  { file: 'documents.tsx',       label: '/more/documents' },
  { file: 'payment-hub.tsx',     label: '/more/payment-hub' },
  { file: 'expenses.tsx',        label: '/more/expenses' },
  { file: 'collect-payment.tsx', label: '/more/collect-payment' },
  { file: 'inventory.tsx',       label: '/more/inventory' },
  { file: 'communications.tsx',  label: '/more/communications' },
  { file: 'leads.tsx',           label: '/more/leads' },
  { file: 'ai-receptionist.tsx', label: '/more/ai-receptionist' },
  { file: 'integrations.tsx',    label: '/more/integrations' },
  { file: 'branding.tsx',        label: '/more/branding' },
  { file: 'custom-website.tsx',  label: '/more/custom-website' },
  { file: 'subscription.tsx',    label: '/more/subscription' },
];

/**
 * Normalise an import path: remove trailing '.tsx' / '.ts' and any leading
 * './' so comparisons work regardless of minor style differences.
 */
const normaliseImportPath = (p: string) =>
  p.replace(/['"`]/g, '').replace(/\.(tsx?|jsx?)$/, '').replace(/^\.\//, '');

describe('OwnerOnlyGuard – screen integration contracts', () => {
  it.each(GUARDED_SCREENS)(
    '$label imports OwnerOnlyGuard from the shared guard module',
    ({ file }) => {
      const fullPath = path.join(SCREENS_DIR, file);
      const source = fs.readFileSync(fullPath, 'utf-8');

      // Match lines like:
      //   import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';
      //   import { OwnerOnlyGuard } from "../../src/components/ui/OwnerOnlyGuard"
      const importRegex =
        /import\s*\{[^}]*\bOwnerOnlyGuard\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/;
      const match = importRegex.exec(source);

      expect(match).not.toBeNull();

      // Confirm it imports from the canonical location (not a re-export).
      const importedFrom = normaliseImportPath(match![1]);
      expect(importedFrom).toContain('OwnerOnlyGuard');
    },
  );

  it.each(GUARDED_SCREENS)(
    '$label wraps its default-export content with <OwnerOnlyGuard>',
    ({ file }) => {
      const fullPath = path.join(SCREENS_DIR, file);
      const source = fs.readFileSync(fullPath, 'utf-8');

      // The JSX open tag for the guard must appear in the file.
      expect(source).toMatch(/<OwnerOnlyGuard\b/);

      // The JSX close tag must also be present (guard is not self-closing).
      expect(source).toMatch(/<\/OwnerOnlyGuard>/);
    },
  );

  it.each(GUARDED_SCREENS)(
    '$label has OwnerOnlyGuard as the outermost JSX element returned by the default export',
    ({ file }) => {
      const fullPath = path.join(SCREENS_DIR, file);
      const source = fs.readFileSync(fullPath, 'utf-8');

      // Find the last `export default function` (the screen component).
      // After the return keyword the first non-trivial JSX open tag must be
      // OwnerOnlyGuard (allowing for whitespace, parens, or a React.Fragment
      // that itself immediately contains OwnerOnlyGuard).
      //
      // We locate the `return (` inside the last export default function and
      // then check the immediately following JSX tag.
      const exportDefaultIdx = source.lastIndexOf('export default function');
      expect(exportDefaultIdx).toBeGreaterThan(-1);

      const afterExport = source.slice(exportDefaultIdx);

      // Find the first `return` with an opening paren (return (...)).
      const returnMatch = /\breturn\s*\(/.exec(afterExport);
      expect(returnMatch).not.toBeNull();

      const afterReturn = afterExport.slice(returnMatch!.index + returnMatch![0].length);

      // Skip over whitespace / newlines to reach the first JSX tag.
      // The first non-whitespace content after `return (` must be <OwnerOnlyGuard.
      const firstTagMatch = /^\s*<(\w+)/.exec(afterReturn);
      expect(firstTagMatch).not.toBeNull();
      expect(firstTagMatch![1]).toBe('OwnerOnlyGuard');
    },
  );
});
