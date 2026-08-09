/**
 * Compliance / training expiry alert dedupe tests (Task #347).
 *
 * Guards the fix for daily duplicate expiry alerts: both expiry passes in
 * server/reminderScheduler.ts (processComplianceExpiry and
 * processTrainingRecordExpiry) dedupe via an explicit existing-notification
 * check per record per urgency stage (info/important/urgent), because the
 * notifications table has no unique constraint.
 *
 * Covers:
 *  - Running each pass twice creates exactly ONE notification per record per stage
 *  - Escalation (30d -> 7d -> expired) still creates a new notification per stage
 *
 * The passes are invoked scoped to a dedicated throwaway test user (via the
 * scopeOwnerIds test hook) so no real users' records are processed and no
 * real notifications are created.
 *
 * Run: npx tsx tests/compliance-expiry.test.ts
 */

import { db } from '../server/storage';
import { processComplianceExpiry, processTrainingRecordExpiry } from '../server/reminderScheduler';
import { users, complianceDocuments, trainingRecords, notifications } from '../shared/schema';
import { eq, inArray } from 'drizzle-orm';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function dateStr(days: number): string {
  return daysFromNow(days).toISOString().slice(0, 10);
}

async function notificationsFor(relatedId: string) {
  return db.select().from(notifications).where(eq(notifications.relatedId, relatedId));
}

async function main() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Seed a dedicated test user (FK target for both tables)
  const [testUser] = await db.insert(users).values({
    email: `compliance-expiry-test-${suffix}@test.local`,
    username: `compliance-expiry-test-${suffix}`,
    firstName: 'Expiry',
    lastName: 'Test',
  }).returning();

  const docIds: string[] = [];
  const recordIds: string[] = [];

  try {
    // ── Seed: one compliance doc + one training record, both in the 30d window
    const [doc] = await db.insert(complianceDocuments).values({
      businessOwnerId: testUser.id,
      type: 'insurance',
      title: `Test Insurance ${suffix}`,
      expiryDate: daysFromNow(25),
    }).returning();
    docIds.push(doc.id);

    const [record] = await db.insert(trainingRecords).values({
      userId: testUser.id,
      workerName: 'Test Worker',
      courseCode: 'TEST101',
      courseName: `Test Course ${suffix}`,
      completionDate: dateStr(-365),
      expiryDate: dateStr(25),
    }).returning();
    recordIds.push(record.id);

    // ── Run the full expiry pass TWICE (processComplianceExpiry also runs the
    //    training pass), then once more for good measure on the training pass.
    console.log('Dedupe (same stage never repeats):');
    await processComplianceExpiry([testUser.id]);
    await processComplianceExpiry([testUser.id]);

    let docNotifs = await notificationsFor(doc.id);
    check('doc: exactly one notification after two passes', docNotifs.length === 1, `got ${docNotifs.length}`);
    check('doc: notification is info stage', docNotifs[0]?.priority === 'info', `got ${docNotifs[0]?.priority}`);
    check('doc: relatedType is compliance_document', docNotifs[0]?.relatedType === 'compliance_document');
    check('doc: notified user is the business owner', docNotifs[0]?.userId === testUser.id);

    let recNotifs = await notificationsFor(record.id);
    check('training: exactly one notification after two passes', recNotifs.length === 1, `got ${recNotifs.length}`);
    check('training: notification is info stage', recNotifs[0]?.priority === 'info', `got ${recNotifs[0]?.priority}`);
    check('training: relatedType is training_record', recNotifs[0]?.relatedType === 'training_record');

    // Direct extra run of the training pass alone must also not duplicate
    await processTrainingRecordExpiry([testUser.id]);
    recNotifs = await notificationsFor(record.id);
    check('training: still one notification after third pass', recNotifs.length === 1, `got ${recNotifs.length}`);

    // ── Escalation: 30d (info) -> 7d (important) -> expired (urgent)
    console.log('Escalation (each stage notifies exactly once):');

    await db.update(complianceDocuments).set({ expiryDate: daysFromNow(5) }).where(eq(complianceDocuments.id, doc.id));
    await db.update(trainingRecords).set({ expiryDate: dateStr(5) }).where(eq(trainingRecords.id, record.id));
    await processComplianceExpiry([testUser.id]);
    await processComplianceExpiry([testUser.id]); // repeat: important stage must not duplicate

    docNotifs = await notificationsFor(doc.id);
    check('doc: two notifications after escalating to 7d window', docNotifs.length === 2, `got ${docNotifs.length}`);
    check('doc: stages are info + important',
      new Set(docNotifs.map(n => n.priority)).size === 2 && docNotifs.some(n => n.priority === 'important'),
      `got ${docNotifs.map(n => n.priority).join(',')}`);

    recNotifs = await notificationsFor(record.id);
    check('training: two notifications after escalating to 7d window', recNotifs.length === 2, `got ${recNotifs.length}`);
    check('training: stages are info + important',
      new Set(recNotifs.map(n => n.priority)).size === 2 && recNotifs.some(n => n.priority === 'important'),
      `got ${recNotifs.map(n => n.priority).join(',')}`);

    await db.update(complianceDocuments).set({ expiryDate: daysFromNow(-1) }).where(eq(complianceDocuments.id, doc.id));
    await db.update(trainingRecords).set({ expiryDate: dateStr(-1) }).where(eq(trainingRecords.id, record.id));
    await processComplianceExpiry([testUser.id]);
    await processComplianceExpiry([testUser.id]); // repeat: urgent stage must not duplicate

    docNotifs = await notificationsFor(doc.id);
    check('doc: three notifications after expiry', docNotifs.length === 3, `got ${docNotifs.length}`);
    check('doc: stages are info + important + urgent',
      new Set(docNotifs.map(n => n.priority)).size === 3 && docNotifs.some(n => n.priority === 'urgent'),
      `got ${docNotifs.map(n => n.priority).join(',')}`);

    recNotifs = await notificationsFor(record.id);
    check('training: three notifications after expiry', recNotifs.length === 3, `got ${recNotifs.length}`);
    check('training: stages are info + important + urgent',
      new Set(recNotifs.map(n => n.priority)).size === 3 && recNotifs.some(n => n.priority === 'urgent'),
      `got ${recNotifs.map(n => n.priority).join(',')}`);
  } finally {
    // ── Cleanup: notifications first, then rows, then the test user
    const relatedIds = [...docIds, ...recordIds];
    if (relatedIds.length > 0) {
      await db.delete(notifications).where(inArray(notifications.relatedId, relatedIds));
    }
    if (docIds.length > 0) await db.delete(complianceDocuments).where(inArray(complianceDocuments.id, docIds));
    if (recordIds.length > 0) await db.delete(trainingRecords).where(inArray(trainingRecords.id, recordIds));
    await db.delete(users).where(eq(users.id, testUser.id));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
