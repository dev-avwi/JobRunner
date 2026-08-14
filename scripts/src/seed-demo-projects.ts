/**
 * seed-demo-projects.ts
 *
 * Seeds realistic project demo data for demo@jobrunner.com.au via direct DB.
 *
 * DESIGN NOTES
 * ─────────────
 * - Inserts go directly into the database, bypassing the API layer entirely.
 *   This avoids triggering notification services, Xero/MYOB sync, email/SMS
 *   side effects, or any other workflow that fires on API state transitions.
 * - Idempotent and fully resumable: each record is upserted by a natural key
 *   (phaseCode, claimNumber, variation number, PO number, defect title). A
 *   mid-run failure leaves no orphans; re-running picks up exactly where it
 *   stopped. Each project is wrapped in its own transaction for atomicity.
 *
 * DEV USAGE (DATABASE_URL already set in the shell):
 *   pnpm --filter @workspace/scripts run seed-demo-projects
 *
 * PRODUCTION USAGE:
 *   Supply the production Neon connection string as DATABASE_URL.
 *   Obtain it from the Replit deployment environment variables or the
 *   database pane (Settings > Production > Connection string).
 *
 *   DATABASE_URL="<prod-connection-string>" \
 *   pnpm --filter @workspace/scripts run seed-demo-projects
 *
 *   DEMO_EMAIL can be overridden if the account email differs:
 *   DATABASE_URL="..." DEMO_EMAIL="demo@example.com" pnpm ...
 */

import pg from "pg";

const { Pool } = pg;

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@jobrunner.com.au";

// ─── Date helpers ────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Helpers that run within an existing client/transaction ──────────────────

async function upsertClient(
  client: pg.PoolClient,
  userId: string,
  name: string,
  email: string,
  phone: string,
  address: string
): Promise<string> {
  // The clients table has no unique constraint on (user_id, name), so we must
  // SELECT before INSERT — ON CONFLICT would not trigger and would create dupes.
  const existing = await client.query(
    `SELECT id FROM clients WHERE user_id = $1 AND name = $2 LIMIT 1`,
    [userId, name]
  );
  if (existing.rowCount! > 0) return existing.rows[0].id as string;
  const res = await client.query(
    `INSERT INTO clients (user_id, name, email, phone, address)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [userId, name, email, phone, address]
  );
  return res.rows[0].id as string;
}

/** Mirror the buildScheduleOfValues formula used by the claims API route. */
function computeClaimTotals(
  lineItems: Array<{ thisClaim: string; retentionPercent?: string }>,
  defaultRetentionPercent: string,
  gstEnabled: boolean
): { subtotal: string; gstAmount: string; total: string; retentionAmount: string } {
  let thisClaimTotal = 0;
  let retentionTotal = 0;
  for (const li of lineItems) {
    const thisClaim = parseFloat(li.thisClaim);
    const retPct = parseFloat(li.retentionPercent ?? defaultRetentionPercent);
    const retention = (thisClaim * retPct) / 100;
    thisClaimTotal += thisClaim;
    retentionTotal += retention;
  }
  const subtotal = thisClaimTotal - retentionTotal;
  const gstAmount = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;
  return {
    subtotal: subtotal.toFixed(2),
    gstAmount: gstAmount.toFixed(2),
    total: total.toFixed(2),
    retentionAmount: retentionTotal.toFixed(2),
  };
}

/** Returns the job id — creates it if absent, returns existing id if present. */
async function upsertProject(
  client: pg.PoolClient,
  userId: string,
  data: {
    clientId: string;
    title: string;
    description: string;
    address: string;
    status: string;
    scheduledAt: Date;
    budgetedCost: string;
    materialMarkupPct: string;
  }
): Promise<{ id: string; created: boolean }> {
  const existing = await client.query(
    `SELECT id FROM jobs WHERE user_id = $1 AND title = $2 AND job_type = 'project' LIMIT 1`,
    [userId, data.title]
  );
  if (existing.rowCount! > 0) return { id: existing.rows[0].id as string, created: false };
  const res = await client.query(
    `INSERT INTO jobs (
       user_id, client_id, title, description, address,
       status, scheduled_at, budgeted_cost,
       job_type, material_markup_pct
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'project',$9) RETURNING id`,
    [
      userId,
      data.clientId,
      data.title,
      data.description,
      data.address,
      data.status,
      data.scheduledAt.toISOString(),
      data.budgetedCost,
      data.materialMarkupPct,
    ]
  );
  return { id: res.rows[0].id as string, created: true };
}

/** Upsert a phase by (jobId, phaseCode). */
async function upsertPhase(
  client: pg.PoolClient,
  userId: string,
  data: {
    jobId: string;
    phaseCode: string;
    name: string;
    description?: string;
    status: string;
    sortOrder: number;
    scheduledStart?: Date;
    scheduledEnd?: Date;
    bookedHours?: string;
  }
): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM job_phases WHERE job_id = $1 AND phase_code = $2 LIMIT 1`,
    [data.jobId, data.phaseCode]
  );
  if (existing.rowCount! > 0) return existing.rows[0].id as string;
  const res = await client.query(
    `INSERT INTO job_phases (
       job_id, user_id, phase_code, name, description,
       status, sort_order, scheduled_start, scheduled_end, booked_hours
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      data.jobId, userId, data.phaseCode, data.name,
      data.description ?? null, data.status, data.sortOrder,
      data.scheduledStart?.toISOString() ?? null,
      data.scheduledEnd?.toISOString() ?? null,
      data.bookedHours ?? null,
    ]
  );
  return res.rows[0].id as string;
}

/** Upsert a variation by (jobId, number). */
async function upsertVariation(
  client: pg.PoolClient,
  userId: string,
  data: {
    jobId: string;
    number: string;
    title: string;
    description: string;
    reason: string;
    additionalAmount: string;
    status: string;
    phaseId?: string;
    approvedAt?: Date;
  }
): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM job_variations WHERE job_id = $1 AND number = $2 LIMIT 1`,
    [data.jobId, data.number]
  );
  if (existing.rowCount! > 0) return existing.rows[0].id as string;
  const gst = (parseFloat(data.additionalAmount) * 0.1).toFixed(2);
  const total = (parseFloat(data.additionalAmount) + parseFloat(gst)).toFixed(2);
  const res = await client.query(
    `INSERT INTO job_variations (
       user_id, job_id, number, title, description, reason,
       additional_amount, gst_amount, total_amount,
       status, phase_id, approved_at, approved_by_name, approval_method
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      userId, data.jobId, data.number, data.title,
      data.description, data.reason,
      data.additionalAmount, gst, total,
      data.status,
      data.phaseId ?? null,
      data.approvedAt?.toISOString() ?? null,
      data.status === "approved" ? "Westfield Retail Group" : null,
      data.status === "approved" ? "email" : null,
    ]
  );
  return res.rows[0].id as string;
}

/** Upsert a claim by (jobId, claimNumber). */
async function upsertClaim(
  client: pg.PoolClient,
  userId: string,
  gstEnabled: boolean,
  data: {
    jobId: string;
    claimNumber: string;
    status: string;
    claimDate: Date;
    periodStart: string;
    periodEnd: string;
    retentionPercent?: string;
    notes?: string;
    submittedAt?: Date;
    lineItems: Array<{
      phaseId: string;
      variationId?: string;
      description: string;
      contractValue: string;
      previouslyClaimed: string;
      thisClaim: string;
      retentionPercent?: string;
      sortOrder: number;
    }>;
  }
): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM claims WHERE job_id = $1 AND claim_number = $2 LIMIT 1`,
    [data.jobId, data.claimNumber]
  );
  if (existing.rowCount! > 0) return existing.rows[0].id as string;

  const retPct = data.retentionPercent ?? "0.00";
  // Mirror buildScheduleOfValues: subtotal = sum(thisClaim) - sum(retention per line)
  const totals = computeClaimTotals(data.lineItems, retPct, gstEnabled);

  const claimRes = await client.query(
    `INSERT INTO claims (
       job_id, user_id, claim_number, status, claim_date,
       period_start, period_end, subtotal, gst_amount, total,
       retention_percent, retention_amount, notes, submitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      data.jobId, userId, data.claimNumber, data.status,
      data.claimDate.toISOString(),
      data.periodStart, data.periodEnd,
      totals.subtotal, totals.gstAmount, totals.total,
      retPct, totals.retentionAmount,
      data.notes ?? null,
      data.submittedAt?.toISOString() ?? null,
    ]
  );
  const claimId = claimRes.rows[0].id as string;

  for (const li of data.lineItems) {
    await client.query(
      `INSERT INTO claim_line_items (
         claim_id, phase_id, variation_id, description,
         contract_value, previously_claimed, this_claim,
         retention_percent, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        claimId, li.phaseId, li.variationId ?? null, li.description,
        li.contractValue, li.previouslyClaimed, li.thisClaim,
        li.retentionPercent ?? retPct, li.sortOrder,
      ]
    );
  }
  return claimId;
}

async function upsertSupplier(
  client: pg.PoolClient,
  userId: string,
  name: string,
  contact: string,
  email: string
): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM suppliers WHERE user_id = $1 AND name = $2 LIMIT 1`,
    [userId, name]
  );
  if (existing.rowCount! > 0) return existing.rows[0].id as string;
  const res = await client.query(
    `INSERT INTO suppliers (user_id, name, contact_name, email, payment_terms)
     VALUES ($1,$2,$3,$4,'Net 30') RETURNING id`,
    [userId, name, contact, email]
  );
  return res.rows[0].id as string;
}

/** Upsert a PO by (userId, poNumber). */
async function upsertPO(
  client: pg.PoolClient,
  userId: string,
  data: {
    supplierId: string;
    jobId: string;
    poNumber: string;
    status: string;
    orderDate: Date;
    requiredDate: Date;
    items: Array<{ description: string; quantity: number; unitPrice: string }>;
  }
): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM purchase_orders WHERE user_id = $1 AND po_number = $2 LIMIT 1`,
    [userId, data.poNumber]
  );
  if (existing.rowCount! > 0) return existing.rows[0].id as string;

  let subtotal = 0;
  for (const item of data.items) subtotal += parseFloat(item.unitPrice) * item.quantity;
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const poRes = await client.query(
    `INSERT INTO purchase_orders (
       user_id, supplier_id, job_id, po_number, order_date, required_date,
       status, subtotal, gst_amount, total
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      userId, data.supplierId, data.jobId, data.poNumber,
      data.orderDate.toISOString(), data.requiredDate.toISOString(),
      data.status, subtotal.toFixed(2), gst.toFixed(2), total.toFixed(2),
    ]
  );
  const poId = poRes.rows[0].id as string;

  for (const item of data.items) {
    await client.query(
      `INSERT INTO purchase_order_items (po_id, description, quantity, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [poId, item.description, item.quantity, item.unitPrice,
       (parseFloat(item.unitPrice) * item.quantity).toFixed(2)]
    );
  }
  return poId;
}

/** Look up whether the account has GST enabled — mirrors the claims API. */
async function getGstEnabled(client: pg.PoolClient, userId: string): Promise<boolean> {
  const res = await client.query(
    `SELECT gst_enabled FROM business_settings WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return (res.rows[0]?.gst_enabled as boolean | undefined) ?? false;
}

/** Upsert a defect by (jobId, title). */
async function upsertDefect(
  client: pg.PoolClient,
  userId: string,
  data: {
    jobId: string;
    clientId: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    reportedAt: Date;
  }
): Promise<void> {
  const existing = await client.query(
    `SELECT id FROM defects WHERE job_id = $1 AND title = $2 LIMIT 1`,
    [data.jobId, data.title]
  );
  if (existing.rowCount! > 0) return;
  await client.query(
    `INSERT INTO defects (job_id, user_id, client_id, title, description, severity, status, reported_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [data.jobId, userId, data.clientId, data.title, data.description,
     data.severity, data.status, data.reportedAt.toISOString()]
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL (or NEON_DATABASE_URL) must be set.");
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const poolClient = await pool.connect();

  try {
    // Find demo user
    const userRes = await poolClient.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [DEMO_EMAIL]
    );
    if (userRes.rowCount === 0) {
      throw new Error(`Demo user ${DEMO_EMAIL} not found in this database.`);
    }
    const userId: string = userRes.rows[0].id;
    console.log(`[seed] Demo user found: ${userId}`);

    // Mirror the claims API: look up GST setting once and pass it to every claim insert.
    const gstEnabled = await getGstEnabled(poolClient, userId);
    console.log(`[seed] GST enabled: ${gstEnabled}`);

    // Detect whether PO tables exist — they may be absent in some environments
    // (e.g. a production Neon branch that hasn't had this migration applied).
    // Skipping POs with a clear message is preferable to rolling back all three
    // project transactions.
    const poTablesRes = await poolClient.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('purchase_orders', 'purchase_order_items')
    `);
    const hasPOTables = parseInt(poTablesRes.rows[0].cnt as string, 10) === 2;
    if (!hasPOTables) {
      console.log("[seed] purchase_orders / purchase_order_items tables not found — skipping PO data.");
    }

    // ── Project 1: Westfield Electrical Fitout (mid-build) ───────────────────
    // Each project is wrapped in a transaction. All child records use
    // upsert-by-natural-key, so the whole block is safely re-runnable.
    {
      await poolClient.query("BEGIN");
      try {
        const clientId = await upsertClient(
          poolClient, userId,
          "Westfield Retail Group", "projects@westfield.com.au",
          "02 9000 1234", "806 King Georges Rd, Hurstville NSW 2220"
        );
        const { id: p1, created } = await upsertProject(poolClient, userId, {
          clientId,
          title: "Westfield Hurstville - Retail Electrical Fitout",
          description:
            "Complete electrical fitout for three new retail tenancies at Westfield Hurstville. " +
            "Scope includes main distribution board upgrade, tenancy sub-boards, LED lighting, " +
            "GPO circuits, data/comms cabling, and testing and commissioning.",
          address: "806 King Georges Rd, Hurstville NSW 2220",
          status: "in_progress",
          scheduledAt: daysAgo(62),
          budgetedCost: "185000.00",
          materialMarkupPct: "20.00",
        });
        console.log(`[seed] Westfield project: ${created ? "created" : "already exists"} (${p1})`);

        const ph1 = await upsertPhase(poolClient, userId, {
          jobId: p1, phaseCode: "P1-ROUGH", name: "Rough-in & Conduit",
          description: "Install conduit, pull cable, rough-in all circuits",
          status: "complete", sortOrder: 0,
          scheduledStart: daysAgo(60), scheduledEnd: daysAgo(46), bookedHours: "120",
        });
        const ph2 = await upsertPhase(poolClient, userId, {
          jobId: p1, phaseCode: "P1-MDB", name: "Main Switchboard Upgrade",
          description: "Upgrade MDB and install tenant sub-boards",
          status: "complete", sortOrder: 1,
          scheduledStart: daysAgo(45), scheduledEnd: daysAgo(32), bookedHours: "80",
        });
        const ph3 = await upsertPhase(poolClient, userId, {
          jobId: p1, phaseCode: "P1-FIT", name: "Tenancy Fitout Circuits",
          description: "Install lighting, GPOs, data points per tenancy",
          status: "in_progress", sortOrder: 2,
          scheduledStart: daysAgo(31), scheduledEnd: daysFromNow(10), bookedHours: "160",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p1, phaseCode: "P1-FITOFF", name: "Fit-off & Connections",
          description: "Connect all outlets, switches, lights and fit covers",
          status: "not_started", sortOrder: 3,
          scheduledStart: daysFromNow(11), scheduledEnd: daysFromNow(24), bookedHours: "60",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p1, phaseCode: "P1-TC", name: "Testing & Commissioning",
          description: "Full electrical test, CCTV verification, handover",
          status: "not_started", sortOrder: 4,
          scheduledStart: daysFromNow(25), scheduledEnd: daysFromNow(32), bookedHours: "40",
        });

        await upsertVariation(poolClient, userId, {
          jobId: p1, number: "VO-001",
          title: "Additional GPOs - Tenancy 3",
          description:
            "Client requested 12 additional double GPOs in Tenancy 3 (Coffee shop) for espresso " +
            "machine and display fridges. Required dedicated 20A circuit not in original scope.",
          reason: "Owner variation request",
          additionalAmount: "4800.00",
          status: "approved",
          phaseId: ph3,
          approvedAt: daysAgo(18),
        });

        await upsertClaim(poolClient, userId, gstEnabled, {
          jobId: p1, claimNumber: "PC-001",
          status: "approved",
          claimDate: daysAgo(30),
          periodStart: dateStr(daysAgo(60)),
          periodEnd: dateStr(daysAgo(31)),
          retentionPercent: "10.00",
          notes: "Claim for completed rough-in and main switchboard works.",
          submittedAt: daysAgo(31),
          lineItems: [
            {
              phaseId: ph1, description: "Rough-in & Conduit — 100% complete",
              contractValue: "42000.00", previouslyClaimed: "0.00", thisClaim: "42000.00",
              retentionPercent: "10.00", sortOrder: 0,
            },
            {
              phaseId: ph2, description: "Main Switchboard Upgrade — 100% complete",
              contractValue: "26500.00", previouslyClaimed: "0.00", thisClaim: "26500.00",
              retentionPercent: "10.00", sortOrder: 1,
            },
          ],
        });

        if (hasPOTables) {
          const suppA = await upsertSupplier(
            poolClient, userId,
            "NHP Electrical Engineering Products", "Sales", "sales.nsw@nhp.com.au"
          );
          await upsertPO(poolClient, userId, {
            supplierId: suppA, jobId: p1, poNumber: "PO-2024-001",
            status: "received", orderDate: daysAgo(55), requiredDate: daysAgo(48),
            items: [
              { description: "2.5mm TPS Cable (100m roll) x 12", quantity: 12, unitPrice: "85.00" },
              { description: "4mm TPS Cable (100m roll) x 6", quantity: 6, unitPrice: "128.00" },
              { description: "6mm TPS Cable (50m roll) x 4", quantity: 4, unitPrice: "96.00" },
              { description: "20mm Grey Conduit 3m x 40", quantity: 40, unitPrice: "8.50" },
            ],
          });

          const suppB = await upsertSupplier(
            poolClient, userId,
            "Clipsal by Schneider Electric", "Trade Desk", "tradequotes@clipsal.com.au"
          );
          await upsertPO(poolClient, userId, {
            supplierId: suppB, jobId: p1, poNumber: "PO-2024-002",
            status: "partially_received", orderDate: daysAgo(20), requiredDate: daysFromNow(5),
            items: [
              { description: "Clipsal 500 Series 10A GPO x 120", quantity: 120, unitPrice: "12.40" },
              { description: "Clipsal 500 Series Lighting Switch x 60", quantity: 60, unitPrice: "9.80" },
              { description: "LED Downlight 10W Dimmable x 80", quantity: 80, unitPrice: "28.50" },
            ],
          });
        }

        await poolClient.query("COMMIT");
        console.log("[seed] Westfield project committed.");
      } catch (err) {
        await poolClient.query("ROLLBACK");
        throw err;
      }
    }

    // ── Project 2: Brighton St Bathroom Renovation (near completion) ──────────
    {
      await poolClient.query("BEGIN");
      try {
        const clientId = await upsertClient(
          poolClient, userId,
          "Callaghan Property Group", "property@callaghanpg.com.au",
          "03 9888 5500", "Level 4, 200 Collins St, Melbourne VIC 3000"
        );
        const { id: p2, created } = await upsertProject(poolClient, userId, {
          clientId,
          title: "Brighton St - Bathroom & Laundry Renovation",
          description:
            "Full bathroom and laundry renovation for a 12-unit residential investment property. " +
            "Scope covers demolition, waterproofing, tiling, plumbing fixtures, vanities, and final fit-off.",
          address: "22 Brighton St, Elwood VIC 3184",
          status: "in_progress",
          scheduledAt: daysAgo(90),
          budgetedCost: "94000.00",
          materialMarkupPct: "18.00",
        });
        console.log(`[seed] Brighton project: ${created ? "created" : "already exists"} (${p2})`);

        const ph1 = await upsertPhase(poolClient, userId, {
          jobId: p2, phaseCode: "P2-DEMO", name: "Strip-out & Demolition",
          description: "Remove existing tiles, vanities, baths and shower screens",
          status: "complete", sortOrder: 0,
          scheduledStart: daysAgo(88), scheduledEnd: daysAgo(79), bookedHours: "64",
        });
        const ph2 = await upsertPhase(poolClient, userId, {
          jobId: p2, phaseCode: "P2-WP", name: "Waterproofing",
          description: "Apply waterproofing membrane to all wet areas to AS 3740",
          status: "complete", sortOrder: 1,
          scheduledStart: daysAgo(78), scheduledEnd: daysAgo(65), bookedHours: "48",
        });
        const ph3 = await upsertPhase(poolClient, userId, {
          jobId: p2, phaseCode: "P2-TILE", name: "Tiling & Fixtures",
          description: "Set tiles, install bath, shower, toilet, vanity",
          status: "complete", sortOrder: 2,
          scheduledStart: daysAgo(64), scheduledEnd: daysAgo(28), bookedHours: "160",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p2, phaseCode: "P2-FITOFF", name: "Fit-off & Defects Rectification",
          description: "Fit tapware, accessories, mirrors; address any defects",
          status: "in_progress", sortOrder: 3,
          scheduledStart: daysAgo(27), scheduledEnd: daysFromNow(7), bookedHours: "40",
        });

        await upsertClaim(poolClient, userId, gstEnabled, {
          jobId: p2, claimNumber: "PC-001",
          status: "submitted",
          claimDate: daysAgo(25),
          periodStart: dateStr(daysAgo(88)),
          periodEnd: dateStr(daysAgo(28)),
          retentionPercent: "5.00",
          notes: "Final claim for all completed phases. Fit-off to be claimed on practical completion.",
          submittedAt: daysAgo(25),
          lineItems: [
            {
              phaseId: ph1, description: "Strip-out & Demolition — 100% complete (all 12 units)",
              contractValue: "14400.00", previouslyClaimed: "0.00", thisClaim: "14400.00",
              retentionPercent: "5.00", sortOrder: 0,
            },
            {
              phaseId: ph2, description: "Waterproofing — 100% complete (all 12 units)",
              contractValue: "18600.00", previouslyClaimed: "0.00", thisClaim: "18600.00",
              retentionPercent: "5.00", sortOrder: 1,
            },
            {
              phaseId: ph3, description: "Tiling & Fixtures — 100% complete (all 12 units)",
              contractValue: "45500.00", previouslyClaimed: "0.00", thisClaim: "45500.00",
              retentionPercent: "5.00", sortOrder: 2,
            },
          ],
        });

        await upsertDefect(poolClient, userId, {
          jobId: p2, clientId,
          title: "Grout cracking — Unit 7 ensuite floor",
          description:
            "Client reported hairline grout cracks appearing across the floor tiles in Unit 7 ensuite. " +
            "Likely due to sub-floor movement. Requires regrout of affected area and investigation of substrate.",
          severity: "medium",
          status: "acknowledged",
          reportedAt: daysAgo(10),
        });

        await poolClient.query("COMMIT");
        console.log("[seed] Brighton project committed.");
      } catch (err) {
        await poolClient.query("ROLLBACK");
        throw err;
      }
    }

    // ── Project 3: Mulgrave Industrial Warehouse (recently started / Gantt) ───
    {
      await poolClient.query("BEGIN");
      try {
        const clientId = await upsertClient(
          poolClient, userId,
          "Mulgrave Industrial Holdings Pty Ltd", "constructions@mulgraveind.com.au",
          "03 9791 4400", "Suite 2, 45 Springvale Rd, Mulgrave VIC 3170"
        );
        const { id: p3, created } = await upsertProject(poolClient, userId, {
          clientId,
          title: "Mulgrave Industrial Warehouse — Stage 1 Civil & Structure",
          description:
            "Stage 1 civil and structural works for a new 3,200 sqm industrial warehouse. " +
            "Scope includes site preparation, concrete slab, structural steel frame, roof cladding, " +
            "and all primary services connections. Building approval under NCC Class 8.",
          address: "14 Enterprise Dr, Mulgrave VIC 3170",
          status: "in_progress",
          scheduledAt: daysAgo(5),
          budgetedCost: "620000.00",
          materialMarkupPct: "15.00",
        });
        console.log(`[seed] Mulgrave project: ${created ? "created" : "already exists"} (${p3})`);

        await upsertPhase(poolClient, userId, {
          jobId: p3, phaseCode: "P3-SITE", name: "Site Setup & Earthworks",
          description: "Establish site compound, bulk earthworks, sediment control",
          status: "in_progress", sortOrder: 0,
          scheduledStart: daysAgo(5), scheduledEnd: daysFromNow(12), bookedHours: "120",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p3, phaseCode: "P3-SLAB", name: "Concrete Slab",
          description: "Form, reinforce and pour 200mm industrial slab with FFL RL +0.60",
          status: "not_started", sortOrder: 1,
          scheduledStart: daysFromNow(13), scheduledEnd: daysFromNow(35), bookedHours: "200",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p3, phaseCode: "P3-STEEL", name: "Structural Steel Frame",
          description: "Erect portal frame, columns, purlins and girts",
          status: "not_started", sortOrder: 2,
          scheduledStart: daysFromNow(36), scheduledEnd: daysFromNow(65), bookedHours: "320",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p3, phaseCode: "P3-CLAD", name: "Roof & Wall Cladding",
          description: "Install Colorbond roof sheeting, insulation and wall cladding panels",
          status: "not_started", sortOrder: 3,
          scheduledStart: daysFromNow(66), scheduledEnd: daysFromNow(90), bookedHours: "240",
        });
        await upsertPhase(poolClient, userId, {
          jobId: p3, phaseCode: "P3-SVC", name: "Primary Services",
          description: "Underground power, water, sewer connections to boundary",
          status: "not_started", sortOrder: 4,
          scheduledStart: daysFromNow(55), scheduledEnd: daysFromNow(95), bookedHours: "160",
        });

        if (hasPOTables) {
          const suppC = await upsertSupplier(
            poolClient, userId,
            "Coates Hire", "Trade Accounts", "hire@coates.com.au"
          );
          await upsertPO(poolClient, userId, {
            supplierId: suppC, jobId: p3, poNumber: "PO-2024-003",
            status: "sent", orderDate: daysAgo(3), requiredDate: daysFromNow(2),
            items: [
              { description: "20T Excavator hire (4 weeks)", quantity: 1, unitPrice: "9800.00" },
              { description: "Vibrating Compactor Plate hire (4 weeks)", quantity: 2, unitPrice: "680.00" },
              { description: "Site water cart hire (2 weeks)", quantity: 1, unitPrice: "2400.00" },
            ],
          });
        }

        await poolClient.query("COMMIT");
        console.log("[seed] Mulgrave project committed.");
      } catch (err) {
        await poolClient.query("ROLLBACK");
        throw err;
      }
    }

    console.log("[seed] Done. All projects seeded successfully.");
  } finally {
    poolClient.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
