/**
 * Bring-your-business wizard status contract tests (Task #322).
 *
 * The wizard's lane progress is DERIVED from real data (import_runs,
 * non-sample clients, compliance docs, custom forms, accounting connections,
 * users.tradeType). If any of those flows change shape, badges silently show
 * wrong progress. These tests seed each lane's data directly and pin the
 * GET /api/onboarding/bring-business/status contract against it.
 *
 * Run against the dev server:
 *   BASE_URL=http://localhost:5000 tsx tests/bring-business-status.test.ts
 */
import { db } from '../server/storage';
import { sql, eq } from 'drizzle-orm';
import {
  users,
  clients,
  importRuns,
  complianceDocuments,
  customForms,
  xeroConnections,
  userRoles,
  teamMembers,
} from '@shared/schema';
import { randomUUID } from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const RUN_ID = randomUUID().slice(0, 8);

let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Mint a Bearer token by inserting a session row (mirrors requireAuth's lookup). */
async function mintSession(userId: string): Promise<string> {
  const sid = `byb-test-${randomUUID()}`;
  const sess = JSON.stringify({
    cookie: { originalMaxAge: 3600000, httpOnly: true, path: '/' },
    userId,
  });
  await db.execute(
    sql`INSERT INTO session (sid, sess, expire) VALUES (${sid}, ${sess}::json, NOW() + INTERVAL '1 hour')`,
  );
  return sid;
}

async function getStatus(token?: string): Promise<{ status: number; body: any }> {
  const r = await fetch(`${BASE_URL}/api/onboarding/bring-business/status`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  let body: any = null;
  try {
    body = await r.json();
  } catch {}
  return { status: r.status, body };
}

async function run() {
  // ---------- Seed users ----------
  const [owner] = await db
    .insert(users)
    .values({
      email: `byb-owner-${RUN_ID}@test.local`,
      username: `byb-owner-${RUN_ID}`,
      firstName: 'Byb',
      lastName: 'Owner',
      emailVerified: true,
    })
    .returning();
  const [member] = await db
    .insert(users)
    .values({
      email: `byb-member-${RUN_ID}@test.local`,
      username: `byb-member-${RUN_ID}`,
      firstName: 'Byb',
      lastName: 'Member',
      emailVerified: true,
    })
    .returning();
  const [role] = await db
    .insert(userRoles)
    .values({ name: `byb-test-worker-${RUN_ID}`, permissions: ['read_jobs'] })
    .returning();
  await db.insert(teamMembers).values({
    businessOwnerId: owner.id,
    memberId: member.id,
    roleId: role.id,
    email: member.email!,
    inviteStatus: 'accepted',
    inviteAcceptedAt: new Date(),
  });

  const ownerToken = await mintSession(owner.id);
  const memberToken = await mintSession(member.id);

  try {
    // ---------- Auth contract ----------
    {
      const { status } = await getStatus();
      check('unauthenticated request → 401', status === 401, `got ${status}`);
    }
    {
      const { status } = await getStatus(memberToken);
      check('team member (non-owner) → 403', status === 403, `got ${status}`);
    }

    // ---------- Baseline: empty owner ----------
    {
      const { status, body } = await getStatus(ownerToken);
      check('empty owner → 200', status === 200, `got ${status}`);
      check(
        'baseline data lane zeroed',
        body?.data?.completedImports === 0 &&
          body?.data?.clientCount === 0 &&
          body?.data?.sampleClientCount === 0,
        JSON.stringify(body?.data),
      );
      check('baseline documents.count = 0', body?.documents?.count === 0);
      check('baseline forms.count = 0', body?.forms?.count === 0);
      check(
        'baseline accounting disconnected',
        body?.accounting?.xeroConnected === false && body?.accounting?.quickbooksConnected === false,
        JSON.stringify(body?.accounting),
      );
      check('baseline quickSetup.tradeType null', body?.quickSetup?.tradeType === null);
    }

    // ---------- Lane 1: data (import runs + sample/real client split) ----------
    await db.insert(importRuns).values({
      userId: owner.id,
      fileName: 'clients.csv',
      source: 'csv',
      type: 'clients',
      status: 'completed',
      recordsImported: 2,
      completedAt: new Date(),
    });
    // Non-completed runs must NOT count as completed imports.
    await db.insert(importRuns).values({
      userId: owner.id,
      fileName: 'pending.csv',
      source: 'csv',
      type: 'clients',
      status: 'pending',
    });
    await db.insert(clients).values([
      { userId: owner.id, name: `Real One ${RUN_ID}` }, // isSample null → real
      { userId: owner.id, name: `Real Two ${RUN_ID}`, isSample: false },
      { userId: owner.id, name: `Sample ${RUN_ID}`, isSample: true },
    ]);
    {
      const { body } = await getStatus(ownerToken);
      check('completedImports counts only completed runs', body?.data?.completedImports === 1, JSON.stringify(body?.data));
      check('clientCount excludes samples (null + false = 2)', body?.data?.clientCount === 2, JSON.stringify(body?.data));
      check('sampleClientCount counts only samples (= 1)', body?.data?.sampleClientCount === 1, JSON.stringify(body?.data));
    }

    // ---------- Lane 2: compliance documents ----------
    await db.insert(complianceDocuments).values({
      businessOwnerId: owner.id,
      type: 'licence',
      title: `Test licence ${RUN_ID}`,
    });
    {
      const { body } = await getStatus(ownerToken);
      check('documents.count reflects compliance_documents', body?.documents?.count === 1, JSON.stringify(body?.documents));
    }

    // ---------- Lane 3: custom forms ----------
    await db.insert(customForms).values({
      userId: owner.id,
      name: `Test form ${RUN_ID}`,
      fields: [],
    });
    {
      const { body } = await getStatus(ownerToken);
      check('forms.count reflects custom_forms', body?.forms?.count === 1, JSON.stringify(body?.forms));
    }

    // ---------- Accounting: xero connection health, not row existence ----------
    const [xero] = await db
      .insert(xeroConnections)
      .values({
        userId: owner.id,
        tenantId: `tenant-${RUN_ID}`,
        tenantName: 'Test Tenant',
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        status: 'active',
      })
      .returning();
    {
      const { body } = await getStatus(ownerToken);
      check('active xero connection → xeroConnected true', body?.accounting?.xeroConnected === true, JSON.stringify(body?.accounting));
    }
    await db.update(xeroConnections).set({ status: 'token_expired' }).where(eq(xeroConnections.id, xero.id));
    {
      const { body } = await getStatus(ownerToken);
      check(
        'expired xero connection does NOT count as connected',
        body?.accounting?.xeroConnected === false,
        JSON.stringify(body?.accounting),
      );
    }

    // ---------- Quick setup lane: POST quick-setup, then status reflects it ----------
    // (Set via the real endpoint, not a direct DB write — getUser is cached, and
    // this also pins the quick-setup POST contract.)
    {
      const r = await fetch(`${BASE_URL}/api/onboarding/quick-setup`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ tradeType: 'plumbing', teamSize: 'solo', seedSampleData: false }),
      });
      const setupBody: any = await r.json().catch(() => null);
      check('quick-setup → 200 success', r.status === 200 && setupBody?.success === true, `got ${r.status}: ${JSON.stringify(setupBody)}`);
      const { body } = await getStatus(ownerToken);
      check('quickSetup.tradeType reflects quick-setup', body?.quickSetup?.tradeType === 'plumbing', JSON.stringify(body?.quickSetup));
      check('quickSetup rates populated from trade defaults', body?.quickSetup?.defaultHourlyRate != null && body?.quickSetup?.calloutFee != null, JSON.stringify(body?.quickSetup));
    }
    {
      // Member is also blocked from quick-setup (owner-only wizard).
      const r = await fetch(`${BASE_URL}/api/onboarding/quick-setup`, {
        method: 'POST',
        headers: { authorization: `Bearer ${memberToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ tradeType: 'plumbing' }),
      });
      check('team member quick-setup → 403', r.status === 403, `got ${r.status}`);
    }

    // ---------- Contract shape: keys the client (BringYourBusiness.tsx) relies on ----------
    {
      const { body } = await getStatus(ownerToken);
      const requiredPaths = [
        ['data', 'completedImports'],
        ['data', 'clientCount'],
        ['data', 'sampleClientCount'],
        ['documents', 'count'],
        ['forms', 'count'],
        ['accounting', 'xeroConnected'],
        ['accounting', 'quickbooksConnected'],
        ['quickSetup', 'tradeType'],
        ['quickSetup', 'teamSize'],
        ['quickSetup', 'defaultHourlyRate'],
        ['quickSetup', 'calloutFee'],
      ];
      const missing = requiredPaths.filter(([a, b]) => body?.[a] === undefined || body[a][b] === undefined);
      check('response contains every key the wizard UI reads', missing.length === 0, `missing: ${missing.map(p => p.join('.')).join(', ')}`);
    }
  } finally {
    // ---------- Cleanup (users cascade to clients/import_runs/docs/forms/xero/team_members) ----------
    await db.delete(users).where(eq(users.id, owner.id));
    await db.delete(users).where(eq(users.id, member.id));
    await db.delete(userRoles).where(eq(userRoles.id, role.id));
    await db.execute(sql`DELETE FROM session WHERE sid IN (${ownerToken}, ${memberToken})`);
  }

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll bring-business status contract tests passed.');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
