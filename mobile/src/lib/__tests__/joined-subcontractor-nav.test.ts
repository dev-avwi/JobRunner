/**
 * Joined subcontractor navigation audit – static contract test
 *
 * These are static source-analysis tests. They do NOT render any components
 * or import React Native code, so they run without the expo preset's heavy
 * setup and remain fast and flake-free.
 *
 * What is a "joined subcontractor"?
 *   A subcontractor user who has accepted an invite code from another business.
 *   Their effective role is:
 *     - isSubcontractor = true
 *     - isStandaloneSubcontractor = false   (NOT operating in their own workspace)
 *     - userRole = 'subcontractor'
 *
 * Expected behaviour (audit criteria):
 *   HIDDEN items (must NOT appear in the More menu, must NOT open without error):
 *     Payment Hub, Collect Payment, Expenses, Clients, Reports
 *
 *   ACCESSIBLE items (must appear and open without a permission error):
 *     Schedule, Time Tracking, Chat, WHS Safety
 *
 *   Subbie Bills:  reached from SubcontractorDashboard (not the More menu),
 *     showInvoicing = !isStandaloneSubcontractor → true for joined subs.
 *
 *   OwnerOnlyGuard: every screen a joined sub must NOT reach (via deep-link)
 *     must be wrapped in <OwnerOnlyGuard>.  The guard's hasAccess condition
 *     is `isOwner || isManager || isStandaloneSubcontractor`, which evaluates
 *     to false for a joined subcontractor.
 *
 *   Workspace switch: WorkspaceSwitcher calls clearRoleCache() +
 *     useAuthStore.setState({ roleInfo: null }) + forceRefreshAuth() on every
 *     switch, preventing stale role state across workspace transitions.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(ROOT, 'mobile');

// ── helpers ──────────────────────────────────────────────────────────────────

function read(relPath: string): string {
  return fs.readFileSync(path.join(SRC, relPath), 'utf-8');
}

// ── 1. Hidden items: 'subcontractor' must NOT appear in their allowedRoles ───

describe('More menu – items hidden from joined subcontractors', () => {
  const navConfig = read('src/lib/navigation-config.ts');

  /**
   * Each entry: [screenTitle (substring to locate the allowedRoles block),
   *              the screen's route URL for the label]
   *
   * We look for the allowedRoles array that immediately follows the item's
   * title string in the source and assert 'subcontractor' is not in it.
   */
  const hiddenItems: Array<{ title: string; url: string }> = [
    { title: 'Payment Hub',     url: '/more/payment-hub' },
    { title: 'Collect Payment', url: '/more/collect-payment' },
    { title: 'Expenses',        url: '/more/expenses' },
    { title: 'Clients',         url: '/more/clients' },
    { title: 'Reports',         url: '/more/reports' },
    { title: 'Insights',        url: '/more/insights' },
    { title: 'Subscription',    url: '/more/subscription' },
  ];

  it.each(hiddenItems)(
    '"$title" ($url) does not include "subcontractor" in its allowedRoles',
    ({ title, url }) => {
      // Find the section of the config for this menu item by its title string.
      const titleEscaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the block between the item's title and the next closing brace that
      // ends its array entry, capturing the allowedRoles line if present.
      const blockRegex = new RegExp(
        `"${titleEscaped}"[\\s\\S]{1,600}?allowedRoles\\s*:\\s*\\[([^\\]]+)\\]`,
      );
      const match = blockRegex.exec(navConfig);

      // The item MUST declare allowedRoles (otherwise it would be visible to all).
      expect(match).not.toBeNull();

      const rolesList = match![1];
      // 'subcontractor' must not be in the roles array.
      expect(rolesList).not.toContain("'subcontractor'");
      expect(rolesList).not.toContain('"subcontractor"');
    },
  );
});

// ── 2. Accessible items: 'subcontractor' must appear in their allowedRoles ───

describe('More menu – items accessible to joined subcontractors', () => {
  const navConfig = read('src/lib/navigation-config.ts');

  const accessibleItems: Array<{ title: string }> = [
    { title: 'Time Tracking' },
    { title: 'Chat' },
    { title: 'WHS Safety' },
  ];

  it.each(accessibleItems)(
    '"$title" includes "subcontractor" in its allowedRoles',
    ({ title }) => {
      const titleEscaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blockRegex = new RegExp(
        `"${titleEscaped}"[\\s\\S]{1,600}?allowedRoles\\s*:\\s*\\[([^\\]]+)\\]`,
      );
      const match = blockRegex.exec(navConfig);
      expect(match).not.toBeNull();
      const rolesList = match![1];
      expect(rolesList).toContain("'subcontractor'");
    },
  );
});

// ── 3. OwnerOnlyGuard: all restricted screens are guarded ────────────────────

describe('OwnerOnlyGuard – restricted screens are guarded against deep-link access', () => {
  const SCREENS_DIR = path.join(SRC, 'app/more');

  /**
   * Every screen a joined subcontractor must NOT reach (they are not in their
   * More menu), but COULD navigate to via a back-stack or push notification
   * deep link.  Each must be wrapped with <OwnerOnlyGuard> so a joined sub
   * is immediately redirected away.
   */
  const restrictedScreens: Array<{ file: string; label: string }> = [
    { file: 'clients.tsx',          label: '/more/clients' },
    { file: 'documents.tsx',        label: '/more/documents' },
    { file: 'payment-hub.tsx',      label: '/more/payment-hub' },
    { file: 'expenses.tsx',         label: '/more/expenses' },
    { file: 'collect-payment.tsx',  label: '/more/collect-payment' },
    { file: 'inventory.tsx',        label: '/more/inventory' },
    { file: 'communications.tsx',   label: '/more/communications' },
    { file: 'leads.tsx',            label: '/more/leads' },
    { file: 'ai-receptionist.tsx',  label: '/more/ai-receptionist' },
    { file: 'integrations.tsx',     label: '/more/integrations' },
    { file: 'branding.tsx',         label: '/more/branding' },
    { file: 'custom-website.tsx',   label: '/more/custom-website' },
    { file: 'subscription.tsx',     label: '/more/subscription' },
    { file: 'reports.tsx',          label: '/more/reports' },
    { file: 'insights.tsx',         label: '/more/insights' },
    { file: 'action-center.tsx',    label: '/more/action-center' },
    { file: 'autopilot.tsx',        label: '/more/autopilot' },
    { file: 'dispatch-board.tsx',   label: '/more/dispatch-board' },
    { file: 'team-management.tsx',  label: '/more/team-management' },
    { file: 'team-operations.tsx',  label: '/more/team-operations' },
  ];

  it.each(restrictedScreens)(
    '$label is wrapped with <OwnerOnlyGuard>',
    ({ file }) => {
      const source = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf-8');
      expect(source).toMatch(/import\s*\{[^}]*\bOwnerOnlyGuard\b[^}]*\}/);
      expect(source).toMatch(/<OwnerOnlyGuard\b/);
      expect(source).toMatch(/<\/OwnerOnlyGuard>/);
    },
  );
});

// ── 4. OwnerOnlyGuard: hasAccess correctly excludes joined subs ──────────────

describe('OwnerOnlyGuard component – hasAccess logic', () => {
  const guardSource = read('src/components/ui/OwnerOnlyGuard.tsx');

  it('uses isOwner || isManager || isStandaloneSubcontractor as the access condition', () => {
    // The guard must grant access to standalone subcontractors (they have full
    // owner powers in their own workspace) but NOT to joined subcontractors
    // (isStandaloneSubcontractor = false).
    expect(guardSource).toContain('isStandaloneSubcontractor');
    expect(guardSource).toMatch(/isOwner\s*\|\|\s*isManager\s*\|\|\s*isStandaloneSubcontractor/);
  });

  it('renders a redirect/loading state when access is denied (no flash of restricted content)', () => {
    // Joined subs must see a spinner or be immediately redirected — not the
    // screen content — while the role is resolving or after a deny decision.
    expect(guardSource).toMatch(/if\s*\(isLoading\s*\|\|\s*!hasAccess\)/);
  });
});

// ── 5. Workspace switch: role cache is cleared on every switch ───────────────

describe('WorkspaceSwitcher – stale role state on switch', () => {
  const switcherSource = read('src/components/WorkspaceSwitcher.tsx');

  it('calls clearRoleCache() before resolving a workspace switch', () => {
    expect(switcherSource).toContain('clearRoleCache()');
  });

  it('clears roleInfo in the auth store before resolving a workspace switch', () => {
    expect(switcherSource).toContain("roleInfo: null");
  });

  it('calls forceRefreshAuth() to re-hydrate user data for the new workspace', () => {
    expect(switcherSource).toContain('forceRefreshAuth()');
  });
});

// ── 6. SubcontractorDashboard – Subbie Bills visible to joined subs ──────────

describe('SubcontractorDashboard – Subbie Bills accessibility', () => {
  const dashboardSource = read('src/components/SubcontractorDashboard.tsx');

  it('sets showInvoicing = !isStandaloneSubcontractor (true for joined subs)', () => {
    // showInvoicing drives the "Build Quote or Invoice" / subbie-bill section.
    // For a joined subcontractor isStandaloneSubcontractor=false, so the
    // expression evaluates to true and the section is rendered.
    expect(dashboardSource).toContain('setShowInvoicing(!isStandaloneSubcontractor)');
  });

  it('navigates to /more/subbie-bill from the invoicing section', () => {
    expect(dashboardSource).toContain('/more/subbie-bill');
  });
});

// ── 7. Subbie Bill screen – no guard blocking joined subs ────────────────────

describe('subbie-bill screen – no OwnerOnlyGuard blocking joined subs', () => {
  const subbieBillSource = read('app/more/subbie-bill.tsx');

  it('does not import OwnerOnlyGuard (it is intended for joined subcontractors)', () => {
    expect(subbieBillSource).not.toMatch(/import.*OwnerOnlyGuard/);
  });
});
