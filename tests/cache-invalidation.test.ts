/**
 * Cache invalidation regression tests.
 *
 * The hot-read cache (server/cache.ts) wraps the read paths for users,
 * business settings, team rosters, line-item catalog, rate cards, and the
 * unified dashboard. Every write path is expected to call the matching
 * invalidate*() helper. These tests enforce that contract: for each cache
 * namespace they seed data, read once (warming the cache), mutate via the
 * storage API, read again, and assert the second read reflects the change
 * WITHIN the cache TTL. A write path that forgets to invalidate makes the
 * second read return the stale cached value and fails the test.
 *
 * Runs directly against the storage layer (no HTTP server needed):
 *   npx tsx tests/cache-invalidation.test.ts
 *
 * Uses the configured dev database; all rows are created with unique
 * test-prefixed identifiers and deleted in a finally block.
 */

import { randomUUID } from "crypto";
import { storage, db } from "../server/storage";
import {
  users,
  businessSettings,
  teamMembers,
  lineItemCatalog,
  rateCards,
  userRoles,
  clients,
  jobs,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  aggregateDashboardCache,
  userCache,
  businessSettingsCache,
  teamRosterCache,
  lineItemCatalogCache,
  rateCardCache,
} from "../server/cache";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const RUN = randomUUID().slice(0, 8);
const OWNER_ID = `cachetest-${RUN}-owner`;
const MEMBER_USER_ID = `cachetest-${RUN}-member`;

let testRoleId: string | undefined;

async function ensureTestRole(): Promise<string> {
  if (!testRoleId) {
    const [role] = await db
      .insert(userRoles)
      .values({ name: `cachetest-${RUN}-role`, permissions: [] } as any)
      .returning();
    testRoleId = role.id;
  }
  return testRoleId;
}

async function cleanup() {
  try { await db.delete(jobs).where(eq(jobs.userId, OWNER_ID)); } catch {}
  try { await db.delete(clients).where(eq(clients.userId, OWNER_ID)); } catch {}
  try { await db.delete(teamMembers).where(eq(teamMembers.businessOwnerId, OWNER_ID)); } catch {}
  try { if (testRoleId) await db.delete(userRoles).where(eq(userRoles.id, testRoleId)); } catch {}
  try { await db.delete(lineItemCatalog).where(eq(lineItemCatalog.userId, OWNER_ID)); } catch {}
  try { await db.delete(rateCards).where(eq(rateCards.userId, OWNER_ID)); } catch {}
  try { await db.delete(businessSettings).where(eq(businessSettings.userId, OWNER_ID)); } catch {}
  try { await db.delete(users).where(eq(users.id, OWNER_ID)); } catch {}
  try { await db.delete(users).where(eq(users.id, MEMBER_USER_ID)); } catch {}
}

async function testUserCache() {
  console.log("\nuser cache:");
  await db.insert(users).values({
    id: OWNER_ID,
    email: `cachetest-${RUN}@example.test`,
    firstName: "Before",
    lastName: "Cache",
  } as any);

  const first = await storage.getUser(OWNER_ID);
  assert(first?.firstName === "Before", "warm read returns seeded user");

  await storage.updateUser(OWNER_ID, { firstName: "After" });
  const second = await storage.getUser(OWNER_ID);
  assert(
    second?.firstName === "After",
    "updateUser invalidates user cache",
    `expected firstName "After", got "${second?.firstName}"`,
  );
}

async function testBusinessSettingsCache() {
  console.log("\nbusinessSettings cache:");
  await storage.createBusinessSettings({
    userId: OWNER_ID,
    businessName: `Cache Test Biz ${RUN}`,
  } as any);
  // createBusinessSettings doesn't invalidate; clear so the warm read below
  // is guaranteed to observe the created row, then test the update contract.
  businessSettingsCache.invalidate(OWNER_ID);

  const first = await storage.getBusinessSettings(OWNER_ID);
  assert(first?.businessName === `Cache Test Biz ${RUN}`, "warm read returns seeded settings");

  await storage.updateBusinessSettings(OWNER_ID, { businessName: `Renamed Biz ${RUN}` } as any);
  const second = await storage.getBusinessSettings(OWNER_ID);
  assert(
    second?.businessName === `Renamed Biz ${RUN}`,
    "updateBusinessSettings invalidates businessSettings cache",
    `got "${second?.businessName}"`,
  );
}

async function testTeamRosterCache() {
  console.log("\nteamRoster cache:");
  const before = await storage.getTeamMembers(OWNER_ID);
  assert(before.length === 0, "warm read returns empty roster");

  await db.insert(users).values({
    id: MEMBER_USER_ID,
    email: `cachetest-${RUN}-member@example.test`,
    firstName: "Team",
    lastName: "Member",
  } as any);
  const created = await storage.createTeamMember({
    businessOwnerId: OWNER_ID,
    memberId: MEMBER_USER_ID,
    roleId: await ensureTestRole(),
    email: `cachetest-${RUN}-member@example.test`,
    name: "Team Member",
    isActive: true,
  } as any);

  const afterCreate = await storage.getTeamMembers(OWNER_ID);
  assert(
    afterCreate.some((m) => m.id === created.id),
    "createTeamMember invalidates teamRoster cache",
    `roster size ${afterCreate.length}, new member missing`,
  );

  await storage.deleteTeamMember(created.id, OWNER_ID);
  const afterDelete = await storage.getTeamMembers(OWNER_ID);
  assert(
    !afterDelete.some((m) => m.id === created.id),
    "deleteTeamMember invalidates teamRoster cache",
  );
}

async function testLineItemCatalogCache() {
  console.log("\nlineItemCatalog cache:");
  const before = await storage.getLineItemCatalog(OWNER_ID);
  const baseline = before.length; // shared items may exist

  const created = await storage.createLineItemCatalogItem({
    userId: OWNER_ID,
    name: `Cache Test Item ${RUN}`,
    description: `Cache invalidation test item ${RUN}`,
    tradeType: "general",
    unitPrice: "10.00",
    unit: "each",
  } as any);
  const afterCreate = await storage.getLineItemCatalog(OWNER_ID);
  assert(
    afterCreate.some((i) => i.id === created.id),
    "createLineItemCatalogItem invalidates catalog cache",
    `count ${baseline} -> ${afterCreate.length}, new item missing`,
  );

  await storage.updateLineItemCatalogItem(created.id, { name: `Renamed Item ${RUN}` } as any);
  const afterUpdate = await storage.getLineItemCatalog(OWNER_ID);
  assert(
    afterUpdate.find((i) => i.id === created.id)?.name === `Renamed Item ${RUN}`,
    "updateLineItemCatalogItem invalidates catalog cache",
  );

  await storage.deleteLineItemCatalogItem(created.id);
  const afterDelete = await storage.getLineItemCatalog(OWNER_ID);
  assert(
    !afterDelete.some((i) => i.id === created.id),
    "deleteLineItemCatalogItem invalidates catalog cache",
  );
}

async function testRateCardCache() {
  console.log("\nrateCards cache:");
  await storage.getRateCards(OWNER_ID); // warm (may contain shared cards)

  const created = await storage.createRateCard({
    userId: OWNER_ID,
    name: `Cache Test Rate ${RUN}`,
    tradeType: "general",
    hourlyRate: "80.00",
  } as any);
  const afterCreate = await storage.getRateCards(OWNER_ID);
  assert(
    afterCreate.some((r) => r.id === created.id),
    "createRateCard invalidates rateCards cache",
  );

  await storage.updateRateCard(created.id, { name: `Renamed Rate ${RUN}` } as any);
  const afterUpdate = await storage.getRateCards(OWNER_ID);
  assert(
    afterUpdate.find((r) => r.id === created.id)?.name === `Renamed Rate ${RUN}`,
    "updateRateCard invalidates rateCards cache",
  );

  await storage.deleteRateCard(created.id);
  const afterDelete = await storage.getRateCards(OWNER_ID);
  assert(
    !afterDelete.some((r) => r.id === created.id),
    "deleteRateCard invalidates rateCards cache",
  );
}

async function testAggregateDashboardCache() {
  console.log("\naggregateDashboard cache:");
  // The unified dashboard payload is assembled in the route handler, so at the
  // storage layer we assert the invalidation half of the contract: a cached
  // dashboard entry for a user must be dropped by writes that change it.
  const sentinel = { sentinel: RUN };

  aggregateDashboardCache.set(OWNER_ID, sentinel);
  await storage.updateBusinessSettings(OWNER_ID, { businessName: `Dash Biz ${RUN}` } as any);
  assert(
    aggregateDashboardCache.get(OWNER_ID) === undefined,
    "updateBusinessSettings invalidates aggregateDashboard cache",
  );

  aggregateDashboardCache.set(OWNER_ID, sentinel);
  const member = await storage.createTeamMember({
    businessOwnerId: OWNER_ID,
    memberId: MEMBER_USER_ID,
    roleId: await ensureTestRole(),
    email: `cachetest-${RUN}-member@example.test`,
    name: "Team Member",
    isActive: true,
  } as any);
  assert(
    aggregateDashboardCache.get(OWNER_ID) === undefined,
    "createTeamMember invalidates aggregateDashboard cache",
  );
  await storage.deleteTeamMember(member.id, OWNER_ID);

  const [client] = await db
    .insert(clients)
    .values({ userId: OWNER_ID, name: `Cache Test Client ${RUN}` } as any)
    .returning();

  aggregateDashboardCache.set(OWNER_ID, sentinel);
  const job = await storage.createJob({
    userId: OWNER_ID,
    clientId: client.id,
    title: `Cache Test Job ${RUN}`,
    status: "pending",
  } as any);
  assert(
    aggregateDashboardCache.get(OWNER_ID) === undefined,
    "createJob invalidates aggregateDashboard cache",
  );

  aggregateDashboardCache.set(OWNER_ID, sentinel);
  await storage.updateJob(job.id, OWNER_ID, { status: "in_progress" } as any);
  assert(
    aggregateDashboardCache.get(OWNER_ID) === undefined,
    "updateJob invalidates aggregateDashboard cache",
  );

  aggregateDashboardCache.set(OWNER_ID, sentinel);
  await storage.deleteJob(job.id, OWNER_ID);
  assert(
    aggregateDashboardCache.get(OWNER_ID) === undefined,
    "deleteJob invalidates aggregateDashboard cache",
  );
}

async function run() {
  console.log(`Cache invalidation tests (run ${RUN})`);
  try {
    await testUserCache();
    await testBusinessSettingsCache();
    await testTeamRosterCache();
    await testLineItemCatalogCache();
    await testRateCardCache();
    await testAggregateDashboardCache();
  } catch (err) {
    failed++;
    console.error("Unexpected error:", err);
  } finally {
    await cleanup();
    // Drop any test keys left in shared process caches.
    userCache.invalidate(OWNER_ID);
    businessSettingsCache.invalidate(OWNER_ID);
    teamRosterCache.invalidate(OWNER_ID);
    lineItemCatalogCache.invalidatePrefix(`${OWNER_ID}:`);
    rateCardCache.invalidatePrefix(`${OWNER_ID}:`);
    aggregateDashboardCache.invalidate(OWNER_ID);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
