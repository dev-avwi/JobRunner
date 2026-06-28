import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage, db } from './storage';
import { activityLogs, inviteCodes, userRoles, subcontractorTokens, swmsDocuments, swmsHazards, swmsSignatures } from '@shared/schema';
import { tradeCatalog } from '../shared/tradeCatalog';
import { eq, and, sql } from 'drizzle-orm';
import { getErrorMessage } from "./lib/errors";

// ============================================
// DEMO USER CREDENTIALS
// ============================================
export const DEMO_USER = {
  email: 'demo@jobrunner.com.au',
  password: 'demo123',
  name: 'Mike Thompson',
  businessName: "Mike's Plumbing Services",
  phone: '+61407888123',
};

export const VISITOR_USER = {
  email: 'visitor@jobrunner.com.au',
  password: 'visitor_readonly_' + Date.now(),
  name: 'Demo Visitor',
};

// Public-facing demo account. Holds the SAME rich data as DEMO_USER but is the
// one the public "Try the Demo" flow actually edits, so the real demo@ account
// is never touched. Wiped + reseeded on every demo start and daily (see
// resetTryDemoData), so visitors always get fresh, current-dated data.
export const TRY_DEMO_USER = {
  email: 'trydemo@jobrunner.com.au',
  password: 'trydemo123',
  name: 'Mike Thompson',
  businessName: "Mike's Plumbing Services",
  phone: '+61407888123',
};

export const DEMO_WORKER = {
  email: 'worker@jobrunner.com.au',
  password: 'worker123',
  name: 'Jake Morrison',
  phone: '+61412555888',
  role: 'worker' as const,
};

export const TEST_USERS = [
  {
    email: 'mike@northqldplumbing.com.au',
    password: 'mikesullivan',
    name: 'Mike Sullivan',
    businessName: 'North QLD Plumbing & Gas',
    phone: '+61407123456',
  },
  {
    email: 'admin@jobrunner.app',
    password: 'admin123',
    name: 'Admin User',
    businessName: 'JobRunner Demo',
    phone: '+61400000001',
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTodayAt(hours: number, minutes: number = 0): Date {
  const today = new Date();
  const aestOffset = 10;
  today.setUTCHours(hours - aestOffset, minutes, 0, 0);
  return today;
}

function getDaysFromNow(days: number): Date {
  const date = new Date();
  const aestOffset = 10;
  date.setUTCHours(9 - aestOffset, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Get a date X months ago, with an optional day offset within that month
function getMonthsAgo(months: number, dayOfMonth: number = 15): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setDate(Math.min(dayOfMonth, 28)); // Avoid issues with shorter months
  return date;
}

// Realistic invoice data spread across 12 months for a busy tradie
// Australian FY runs July-June, so we'll spread data across the current FY
// 17 paid invoices for receipts (+ 3 non-paid invoices = 20 total invoices, 20 receipts with 3 additional cash receipts)
const MONTHLY_PAID_INVOICES = [
  // Each month has 1-2 paid invoices representing typical tradie workload
  // Month 0 = current month, Month 1 = last month, etc.
  { month: 11, title: 'Commercial Kitchen Fit-Out', description: 'Full plumbing installation for cafe kitchen', subtotal: 4850, payDay: 18 },
  { month: 10, title: 'Bathroom Renovation - Stage 1', description: 'Rough-in plumbing for master ensuite', subtotal: 3200, payDay: 12 },
  { month: 10, title: 'Gas Cooktop Installation', description: 'Connected new 5-burner gas cooktop', subtotal: 380, payDay: 22 },
  { month: 9, title: 'Blocked Sewer Main', description: 'High-pressure jetter service - tree roots removed', subtotal: 650, payDay: 8 },
  { month: 9, title: 'Rainwater Tank Connection', description: 'Connected 5000L rainwater tank to toilet and laundry', subtotal: 1850, payDay: 28 },
  { month: 8, title: 'Emergency After Hours - Burst Pipe', description: 'Weekend callout for burst copper pipe under house', subtotal: 680, payDay: 3 },
  { month: 7, title: 'New Build - Final Fix', description: 'Final fix plumbing for 4-bed residence', subtotal: 5200, payDay: 10 },
  { month: 7, title: 'Dishwasher Installation', description: 'Connected new Miele dishwasher', subtotal: 180, payDay: 24 },
  { month: 6, title: 'TMV Compliance Testing', description: 'Thermostatic mixing valve testing and certification', subtotal: 320, payDay: 5 },
  { month: 5, title: 'Gas Heater Service', description: 'Annual gas heater service and CO testing', subtotal: 195, payDay: 11 },
  { month: 5, title: 'Toilet Suite Replacement', description: 'Removed old separate and installed new close-coupled suite', subtotal: 485, payDay: 22 },
  { month: 4, title: 'Commercial Backflow Testing', description: 'Annual backflow prevention device testing - 3 devices', subtotal: 540, payDay: 7 },
  { month: 3, title: 'Shower Regrouting & Waterproofing', description: 'Complete shower base waterproofing and tile regrout', subtotal: 890, payDay: 14 },
  { month: 2, title: 'Hot Water System Service', description: 'Annual service on solar hot water system', subtotal: 245, payDay: 9 },
  { month: 2, title: 'Outdoor Shower Installation', description: 'Installed poolside outdoor shower with hot/cold mixing', subtotal: 720, payDay: 21 },
  { month: 1, title: 'Vanity Installation', description: 'Installed new bathroom vanity with tapware', subtotal: 680, payDay: 16 },
  { month: 0, title: 'Kitchen Tap Replacement', description: 'Replaced mixer tap with pull-out spray model', subtotal: 385, payDay: 3 },
];

// Counter for deterministic IDs - ensures same data in dev and production
let xeroIdCounter = 100001;
let tokenCounter = 1;
// Payment tokens are globally unique, so each demo account needs its own prefix
// (demo@ keeps DEMO_TOKEN_; trydemo@ uses TRYDEMO_TKN_) to avoid collisions.
let demoTokenPrefix = 'DEMO_TOKEN_';

function generateXeroId(prefix: string): string {
  // Use deterministic IDs so dev and production have identical data
  return `${prefix}-${xeroIdCounter++}`;
}

function generatePaymentToken(): string {
  // Use deterministic tokens so dev and production have identical data
  const baseToken = `${demoTokenPrefix}${String(tokenCounter++).padStart(4, '0')}`;
  // Pad to 32 chars
  return baseToken.padEnd(32, 'X');
}

// Reset counters for consistent seeding
export function resetDemoCounters() {
  xeroIdCounter = 100001;
  tokenCounter = 1;
}

export async function fixTestUserPasswords() {
  for (const testUser of TEST_USERS) {
    const user = await storage.getUserByEmail(testUser.email);
    if (user) {
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      console.log(`✅ Fixed password for ${testUser.email}`);
    }
  }
}

// ============================================
// HELPER: Ensure business settings and team exist without recreating data
// ============================================
async function ensureDemoBusinessAndTeam(demoUser: any) {
  // Ensure business settings exist and have GST enabled
  let businessSettings = await storage.getBusinessSettings(demoUser.id);
  if (!businessSettings) {
    businessSettings = await storage.createBusinessSettings({
      userId: demoUser.id,
      businessName: DEMO_USER.businessName,
      businessAddress: '15 Mulgrave Road, Cairns QLD 4870',
      businessPhone: DEMO_USER.phone,
      businessEmail: 'info@demoplumbing.com.au',
      abn: '12 345 678 901',
      bankName: 'Commonwealth Bank',
      bsb: '064-123',
      accountNumber: '12345678',
      accountName: 'Demo Plumbing & Gas Pty Ltd',
      gstEnabled: true,
      teamSize: 'medium',
      qbccLicense: 'QBCC 1234567',
      insurancePolicy: 'QBE-PLB-987654',
      onboardingCompleted: true,
      bookingSlug: 'mike-s-plumbing-services',
      bookingPageEnabled: true,
      bookingPageDescription: 'Book a plumbing service with Mike\'s Plumbing Services. We service the Cairns and surrounding areas for all residential and commercial plumbing needs.',
      bookingPageServices: [
        { name: 'General Plumbing', duration: 60, price: 120, description: 'Tap repairs, toilet fixes, minor pipe work' },
        { name: 'Hot Water System', duration: 90, price: 250, description: 'Installation, repair, and servicing of hot water systems' },
        { name: 'Blocked Drain', duration: 60, price: 150, description: 'Drain unblocking and CCTV inspection' },
        { name: 'Emergency Call-Out', duration: 30, price: 180, description: '24/7 emergency plumbing service' },
      ],
    } as any);
    console.log('✅ Business settings created');
  } else if (!businessSettings.gstEnabled) {
    await storage.updateBusinessSettings(demoUser.id, { gstEnabled: true });
    console.log('✅ Business settings updated: GST enabled');
  }

  if (businessSettings && !businessSettings.onboardingCompleted) {
    await storage.updateBusinessSettings(demoUser.id, { onboardingCompleted: true } as any);
    console.log('✅ Business settings updated: onboarding marked complete');
  }

  if (businessSettings && (businessSettings as any).teamSize === 'solo') {
    await storage.updateBusinessSettings(demoUser.id, { teamSize: 'medium' } as any);
    console.log('✅ Business settings updated: teamSize → medium (demo has team members)');
  }

  if (businessSettings && !businessSettings.bookingSlug) {
    await storage.updateBusinessSettings(demoUser.id, {
      bookingSlug: 'mike-s-plumbing-services',
      bookingPageEnabled: true,
      bookingPageDescription: 'Book a plumbing service with Mike\'s Plumbing Services. We service the Cairns and surrounding areas for all residential and commercial plumbing needs.',
      bookingPageServices: [
        { name: 'General Plumbing', duration: 60, price: 120, description: 'Tap repairs, toilet fixes, minor pipe work' },
        { name: 'Hot Water System', duration: 90, price: 250, description: 'Installation, repair, and servicing of hot water systems' },
        { name: 'Blocked Drain', duration: 60, price: 150, description: 'Drain unblocking and CCTV inspection' },
        { name: 'Emergency Call-Out', duration: 30, price: 180, description: '24/7 emergency plumbing service' },
      ],
    } as any);
    console.log('✅ Booking page enabled for demo');
  }

  // Ensure demo worker exists AND has the correct password (re-hash every
  // boot so the documented credentials always work for live demos, same as
  // the demo owner above).
  let workerUser = await storage.getUserByEmail(DEMO_WORKER.email);
  const hashedWorkerPassword = await bcrypt.hash(DEMO_WORKER.password, 10);
  const [workerFirstName, ...workerLastNameParts] = DEMO_WORKER.name.split(' ');
  if (!workerUser) {
    workerUser = await storage.createUser({
      email: DEMO_WORKER.email,
      password: hashedWorkerPassword,
      firstName: workerFirstName,
      lastName: workerLastNameParts.join(' '),
    });
    await storage.updateUser(workerUser.id, {
      phone: DEMO_WORKER.phone,
      emailVerified: true,
    } as any);
    console.log('✅ Demo worker user created');
  } else {
    await storage.updateUser(workerUser.id, {
      password: hashedWorkerPassword,
      name: DEMO_WORKER.name,
      phone: DEMO_WORKER.phone,
      emailVerified: true,
    } as any);
    console.log('✅ Demo worker password refreshed');
  }

  // Ensure team member relationship exists
  const existingTeam = await storage.getTeamMembers(demoUser.id);
  const workerTeamMember = existingTeam.find(m => m.memberId === workerUser?.id);
  if (!workerTeamMember && workerUser) {
    const existingRoles = await storage.getUserRoles();
    let workerRole = existingRoles.find(r => r.name.toLowerCase() === 'worker' || r.name.toLowerCase() === 'field worker');
    if (!workerRole) {
      workerRole = await storage.createUserRole({
        name: 'Worker',
        permissions: ['read_jobs', 'update_job_status', 'create_time_entries', 'read_clients'],
        description: 'Field worker with job access',
        isActive: true,
      });
    }
    await storage.createTeamMember({
      businessOwnerId: demoUser.id,
      memberId: workerUser.id,
      roleId: workerRole.id,
      email: DEMO_WORKER.email,
      inviteStatus: 'accepted',
      isActive: true,
    });
    console.log('✅ Demo worker added to team');
  }

  // Seed default safety forms if not already present
  try {
    const existingForms = await storage.getCustomForms(demoUser.id);
    const defaultForms = existingForms.filter(f => f.isDefault);
    if (defaultForms.length === 0) {
      await storage.seedDefaultSafetyForms(demoUser.id);
      console.log('✅ Demo safety forms seeded');
    }
  } catch (err) {
    console.error('Failed to seed demo safety forms:', err);
  }
}

// ============================================
// REFRESH DEMO DATES: Update scheduled jobs to be current with today's date
// ============================================
export async function refreshDemoDates(demoUserId: string) {
  try {
    console.log('[DemoRefresh] Refreshing demo dates to keep data current...');
    
    const jobs = await storage.getJobs(demoUserId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let scheduledCount = 0;
    let inProgressCount = 0;
    
    for (const job of jobs) {
      // Update scheduled jobs to be in the near future (today + 0-5 days)
      if (job.status === 'scheduled' && job.scheduledAt) {
        const scheduledDate = new Date(job.scheduledAt);
        // Only update if the scheduled date is in the past
        if (scheduledDate < today) {
          // Spread scheduled jobs across today and the next few days
          const daysOffset = scheduledCount % 6; // 0-5 days from now
          const newScheduledAt = new Date();
          newScheduledAt.setDate(newScheduledAt.getDate() + daysOffset);
          // Keep original time of day
          newScheduledAt.setHours(
            scheduledDate.getHours() || 9,
            scheduledDate.getMinutes() || 0,
            0, 0
          );
          
          await storage.updateJob(job.id, demoUserId, {
            scheduledAt: newScheduledAt,
          });
          scheduledCount++;
        }
      }
      
      // Update in_progress jobs to have started today or yesterday
      if (job.status === 'in_progress') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(8, 0, 0, 0);
        
        // Set startedAt to yesterday for some, today for others
        const startOffset = inProgressCount % 2; // 0 or 1 days ago
        const newStartedAt = new Date();
        newStartedAt.setDate(newStartedAt.getDate() - startOffset);
        newStartedAt.setHours(8 + (inProgressCount % 3), 0, 0, 0);
        
        await storage.updateJob(job.id, demoUserId, {
          startedAt: newStartedAt,
          scheduledAt: newStartedAt,
        });
        inProgressCount++;
      }
    }
    
    console.log(`[DemoRefresh] Updated ${scheduledCount} scheduled jobs and ${inProgressCount} in-progress jobs`);
  } catch (error) {
    console.error('[DemoRefresh] Error refreshing demo dates:', error);
  }
}

// ============================================
// VISITOR USER CREATION (public demo, read-only)
// ============================================

export async function createVisitorUser(): Promise<{ id: string } | null> {
  try {
    let visitorUser = await storage.getUserByEmail(VISITOR_USER.email);
    if (!visitorUser) {
      const hashedPassword = await bcrypt.hash(VISITOR_USER.password, 10);
      visitorUser = await storage.createUser({
        email: VISITOR_USER.email,
        password: hashedPassword,
        firstName: 'Demo',
        lastName: 'Visitor',
      } as any);
      await storage.updateUser(visitorUser.id, {
        emailVerified: true,
      } as any);
      console.log('✅ Visitor user created:', visitorUser.email);
    } else {
      console.log('ℹ️ Visitor user already exists:', visitorUser.email);
    }
    return visitorUser;
  } catch (error) {
    console.error('Failed to create visitor user:', error);
    return null;
  }
}

// ============================================
// MAIN DEMO DATA CREATION
// ============================================

export async function createDemoUserAndData(
  account: { email: string; password: string; name: string; businessName?: string; phone?: string } = DEMO_USER,
  opts: { forceReseed?: boolean } = {},
) {
  // Reset counters for deterministic IDs
  resetDemoCounters();
  // Namespace globally-unique payment tokens per demo account.
  demoTokenPrefix = account.email === TRY_DEMO_USER.email ? 'TRYDEMO_TKN_' : 'DEMO_TOKEN_';
  
  try {
    let demoUser = await storage.getUserByEmail(account.email);

    if (!demoUser) {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      const [firstName, ...lastNameParts] = account.name.split(' ');
      const lastName = lastNameParts.join(' ');
      demoUser = await storage.createUser({
        email: account.email,
        password: hashedPassword,
        firstName,
        lastName,
      } as any);
      // Update with additional fields that aren't in InsertUser schema
      await storage.updateUser(demoUser.id, {
        phone: account.phone,
        emailVerified: true,
        // Demo seed provisions team members + invite codes, so the demo
        // owner must be on a team-capable tier.
        subscriptionTier: 'team',
      } as any);
      console.log('✅ Demo user created:', demoUser.email);
    } else {
      // Ensure demo user has correct password, name, and email verified set
      const hashedPassword = await bcrypt.hash(account.password, 10);
      const [firstName, ...lastNameParts] = account.name.split(' ');
      const lastName = lastNameParts.join(' ');
      await storage.updateUser(demoUser.id, { 
        password: hashedPassword,
        firstName,
        lastName,
        emailVerified: true,
        isActive: true,
        // Demo seed provisions 15 team members + invite codes, so the demo
        // owner must be on a tier that includes team-member seats. Without
        // this, the team-plan gate (requireTeamPlan) blocks the demo from
        // showcasing team features.
        subscriptionTier: 'team',
      } as any);
      console.log('ℹ️ Demo user already exists:', demoUser.email);
      console.log('✅ Demo user password reset to default');
    }

    // Check for existing demo data - PRESERVE it to maintain consistent IDs across web/mobile
    const existingClients = await storage.getClients(demoUser.id);
    if (existingClients.length > 0 && !opts.forceReseed) {
      console.log(`✅ Demo data already exists for ${demoUser.email} - preserving existing data for consistent IDs`);
      
      // Ensure business settings, team members exist but don't recreate clients/invoices/jobs/quotes
      // This keeps IDs stable across server restarts for mobile app compatibility
      await ensureDemoBusinessAndTeam(demoUser);
      
      // NOTE: Demo date refresh disabled to preserve user-modified data
      // The dates should only be set during initial demo data creation, not on every restart
      // await refreshDemoDates(demoUser.id);
      
      // Always refresh activity logs and notifications to show current data
      await createDemoActivityLogs(demoUser.id);
      await createDemoNotifications(demoUser.id);

      // Seed client tags and types if not already set
      await seedDemoClientTags(demoUser.id, existingClients);

      // Seed equipment and job-equipment assignments for dispatch board
      await seedDemoEquipment(demoUser.id);

      // Seed SWMS safety docs + expenses so WHS and financial areas aren't empty
      await seedDemoSafetyAndExpenses(demoUser.id);
      
      return demoUser;
    }

    // ============================================
    // CREATE BUSINESS SETTINGS
    // ============================================
    let businessSettings = await storage.getBusinessSettings(demoUser.id);
    if (!businessSettings) {
      businessSettings = await storage.createBusinessSettings({
        userId: demoUser.id,
        businessName: account.businessName ?? DEMO_USER.businessName,
        businessAddress: '15 Mulgrave Road, Cairns QLD 4870',
        businessPhone: account.phone ?? DEMO_USER.phone,
        businessEmail: 'info@demoplumbing.com.au',
        abn: '12 345 678 901',
        bankName: 'Commonwealth Bank',
        bsb: '064-123',
        accountNumber: '12345678',
        accountName: 'Demo Plumbing & Gas Pty Ltd',
        gstEnabled: true,
        teamSize: 'medium',
        qbccLicense: 'QBCC 1234567',
        insurancePolicy: 'QBE-PLB-987654',
        onboardingCompleted: true,
      } as any);
      console.log('✅ Business settings created');
    } else if (!businessSettings.gstEnabled) {
      await storage.updateBusinessSettings(demoUser.id, { gstEnabled: true });
      console.log('✅ Business settings updated: GST enabled');
    }

    if (businessSettings && !businessSettings.onboardingCompleted) {
      await storage.updateBusinessSettings(demoUser.id, { onboardingCompleted: true } as any);
      console.log('✅ Business settings updated: onboarding marked complete');
    }

    if (businessSettings && (businessSettings as any).teamSize === 'solo') {
      await storage.updateBusinessSettings(demoUser.id, { teamSize: 'medium' } as any);
      console.log('✅ Business settings updated: teamSize → medium (demo has team members)');
    }

    // ============================================
    // CREATE DEMO WORKER (TEAM MEMBER)
    // ============================================
    let workerUser = await storage.getUserByEmail(DEMO_WORKER.email);
    if (!workerUser) {
      const hashedWorkerPassword = await bcrypt.hash(DEMO_WORKER.password, 10);
      const [workerFirstName, ...workerLastNameParts] = DEMO_WORKER.name.split(' ');
      workerUser = await storage.createUser({
        email: DEMO_WORKER.email,
        password: hashedWorkerPassword,
        firstName: workerFirstName,
        lastName: workerLastNameParts.join(' '),
      });
      await storage.updateUser(workerUser.id, {
        phone: DEMO_WORKER.phone,
      } as any);
      console.log('✅ Demo worker created:', workerUser.email);
    }

    // ============================================
    // CREATE 10 CLIENTS (Australian names, Cairns QLD addresses)
    // ============================================
    const clientsData = [
      { name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com.au', phone: '+61412345678', address: '15 Digger Street, Cairns North QLD 4870' },
      { name: 'David O\'Connor', email: 'david.oconnor@gmail.com', phone: '+61423456789', address: '28 Mulgrave Road, Parramatta Park QLD 4870' },
      { name: 'Emma Thompson', email: 'emma.t@outlook.com.au', phone: '+61434567890', address: '7 Anderson Street, Manunda QLD 4870' },
      { name: 'James Wilson', email: 'james.wilson@bigpond.com', phone: '+61445678901', address: '92 Pease Street, Edge Hill QLD 4870' },
      { name: 'Lisa Chen', email: 'lisa.chen@email.com', phone: '+61456789012', address: '45 Greenslopes Street, Whitfield QLD 4870' },
      { name: 'Michael Brown', email: 'michael.brown@work.com.au', phone: '+61467890123', address: '12 Collins Avenue, Edge Hill QLD 4870' },
      { name: 'Rachel Green', email: 'rachel.g@email.com', phone: '+61478901234', address: '33 McCormack Street, Manunda QLD 4870' },
      { name: 'Peter Johnson', email: 'peter.johnson@business.com.au', phone: '+61489012345', address: '78 Lyons Street, Westcourt QLD 4870' },
      { name: 'Amanda White', email: 'amanda.white@email.com', phone: '+61490123456', address: '56 Aumuller Street, Bungalow QLD 4870' },
      { name: 'Chris Taylor', email: 'chris.taylor@company.com.au', phone: '+61401234567', address: '19 Richardson Street, Woree QLD 4868' },
    ];

    const createdClients = [];
    for (const clientData of clientsData) {
      const client = await storage.createClient({
        userId: demoUser.id,
        ...clientData,
      });
      createdClients.push(client);
    }
    console.log(`✅ ${createdClients.length} Demo clients created`);

    // ============================================
    // CREATE 30 JOBS (with varied statuses)
    // Status distribution: 4 pending, 8 scheduled (4 today + 4 upcoming), 6 in_progress, 6 done, 5 invoiced, 1 cancelled
    // ============================================
    const createdJobs = [];

    // PENDING JOBS (4)
    const pendingJobs = [
      { clientIdx: 0, title: 'Leaking Kitchen Tap', description: 'Customer reports kitchen mixer tap dripping constantly', address: clientsData[0].address },
      { clientIdx: 1, title: 'Toilet Running Continuously', description: 'Toilet cistern not filling properly, water keeps running', address: clientsData[1].address },
      { clientIdx: 2, title: 'Blocked Bathroom Drain', description: 'Shower drain draining slowly, needs investigation', address: clientsData[2].address },
      { clientIdx: 3, title: 'Hot Water System Quote', description: 'Customer wants quote for new hot water system replacement', address: clientsData[3].address },
    ];

    for (const job of pendingJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'pending',
        estimatedDuration: 60,
      });
      createdJobs.push(createdJob);
    }

    // SCHEDULED JOBS (8) - 4 today, 4 upcoming in next days
    const scheduledJobs = [
      // 4 JOBS TODAY
      { clientIdx: 0, title: 'Annual Hot Water Service', description: 'Annual service and maintenance check', address: clientsData[0].address, scheduledAt: getTodayAt(9, 0), scheduledTime: '09:00' },
      { clientIdx: 1, title: 'Bathroom Tap Replacement', description: 'Replace old bathroom taps with new mixers', address: clientsData[1].address, scheduledAt: getTodayAt(11, 30), scheduledTime: '11:30' },
      { clientIdx: 2, title: 'Emergency Valve Check', description: 'Check and test emergency shutoff valves', address: clientsData[2].address, scheduledAt: getTodayAt(14, 0), scheduledTime: '14:00' },
      { clientIdx: 5, title: 'Dishwasher Installation', description: 'Install new Bosch dishwasher, connect to water and waste', address: clientsData[5].address, scheduledAt: getTodayAt(16, 0), scheduledTime: '16:00' },
      // 4 JOBS UPCOMING (next few days)
      { clientIdx: 6, title: 'Garden Tap Installation', description: 'Install new outdoor tap near garden shed', address: clientsData[6].address, scheduledAt: getDaysFromNow(1), scheduledTime: '09:00', isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 7, title: 'Shower Head Replacement', description: 'Replace old shower head with water-efficient model', address: clientsData[7].address, scheduledAt: getDaysFromNow(2), scheduledTime: '14:00' },
      { clientIdx: 8, title: 'Pipe Inspection', description: 'CCTV camera inspection of sewer line', address: clientsData[8].address, scheduledAt: getDaysFromNow(3), scheduledTime: '08:00', isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 9, title: 'Water Pressure Check', description: 'Investigate low water pressure complaints', address: clientsData[9].address, scheduledAt: getDaysFromNow(4), scheduledTime: '11:00' },
    ];

    for (const job of scheduledJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'scheduled',
        scheduledAt: job.scheduledAt,
        scheduledTime: job.scheduledTime,
        estimatedDuration: 90,
        isXeroImport: job.isXeroImport || false,
        xeroJobId: job.xeroJobId || null,
      });
      createdJobs.push(createdJob);
    }

    // IN_PROGRESS JOBS (4)
    const inProgressJobs = [
      { clientIdx: 3, title: 'Bathroom Renovation Plumbing', description: 'Full bathroom rough-in for renovation', address: clientsData[3].address, startedAt: getDaysAgo(2) },
      { clientIdx: 4, title: 'Hot Water System Replacement', description: 'Replacing old electric HWS with heat pump', address: clientsData[4].address, startedAt: getDaysAgo(1) },
      { clientIdx: 5, title: 'Kitchen Sink Installation', description: 'Installing new undermount kitchen sink', address: clientsData[5].address, startedAt: getDaysAgo(0) },
      { clientIdx: 6, title: 'Gas Line Extension', description: 'Extending gas line to new BBQ area', address: clientsData[6].address, startedAt: getDaysAgo(3), isXeroImport: true, xeroJobId: generateXeroId('JOB') },
    ];

    for (const job of inProgressJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'in_progress',
        startedAt: job.startedAt,
        estimatedDuration: 120,
        isXeroImport: job.isXeroImport || false,
        xeroJobId: job.xeroJobId || null,
      });
      createdJobs.push(createdJob);
    }

    // DONE JOBS (6) - completed but not yet invoiced
    const doneJobs = [
      { clientIdx: 0, title: 'Tap Washer Replacement', description: 'Replaced washers on 3 taps', address: clientsData[0].address, completedAt: getDaysAgo(1) },
      { clientIdx: 1, title: 'Toilet Cistern Repair', description: 'Replaced flush valve and fill valve', address: clientsData[1].address, completedAt: getDaysAgo(2) },
      { clientIdx: 2, title: 'Drain Unblocking', description: 'Cleared blocked laundry drain', address: clientsData[2].address, completedAt: getDaysAgo(3) },
      { clientIdx: 3, title: 'Gas Appliance Service', description: 'Annual service of gas heater', address: clientsData[3].address, completedAt: getDaysAgo(4) },
      { clientIdx: 4, title: 'Shower Mixer Replacement', description: 'Installed new thermostatic shower mixer', address: clientsData[4].address, completedAt: getDaysAgo(5), isXeroImport: true, xeroJobId: generateXeroId('JOB') },
      { clientIdx: 5, title: 'Outdoor Tap Repair', description: 'Fixed leaking garden tap', address: clientsData[5].address, completedAt: getDaysAgo(6) },
    ];

    for (const job of doneJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'done',
        completedAt: job.completedAt,
        estimatedDuration: 60,
        isXeroImport: job.isXeroImport || false,
        xeroJobId: job.xeroJobId || null,
      });
      createdJobs.push(createdJob);
    }

    // INVOICED JOBS (5) - with complete journey dates (scheduled -> started -> completed -> invoiced)
    const invoicedJobs = [
      { clientIdx: 8, title: 'Emergency Pipe Repair', description: 'Repaired burst pipe under house', address: clientsData[8].address, scheduledAt: getDaysAgo(12), startedAt: getDaysAgo(11), completedAt: getDaysAgo(10), invoicedAt: getDaysAgo(9) },
      { clientIdx: 9, title: 'Hot Water Thermostat', description: 'Replaced faulty thermostat on HWS', address: clientsData[9].address, scheduledAt: getDaysAgo(14), startedAt: getDaysAgo(13), completedAt: getDaysAgo(12), invoicedAt: getDaysAgo(11) },
      { clientIdx: 0, title: 'Bathroom Fit-Out Complete', description: 'Final fix plumbing for bathroom reno', address: clientsData[0].address, scheduledAt: getDaysAgo(17), startedAt: getDaysAgo(16), completedAt: getDaysAgo(15), invoicedAt: getDaysAgo(14) },
      { clientIdx: 1, title: 'Kitchen Plumbing Upgrade', description: 'Upgraded kitchen plumbing for renovation', address: clientsData[1].address, scheduledAt: getDaysAgo(20), startedAt: getDaysAgo(19), completedAt: getDaysAgo(18), invoicedAt: getDaysAgo(17) },
      { clientIdx: 2, title: 'Gas Compliance Certificate', description: 'Annual gas safety inspection', address: clientsData[2].address, scheduledAt: getDaysAgo(22), startedAt: getDaysAgo(21), completedAt: getDaysAgo(20), invoicedAt: getDaysAgo(19) },
    ];

    for (const job of invoicedJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'invoiced',
        scheduledAt: job.scheduledAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        invoicedAt: job.invoicedAt,
        estimatedDuration: 90,
      });
      createdJobs.push(createdJob);
    }

    // ADDITIONAL IN_PROGRESS JOBS (2) - converted from cancelled for better demo presentation
    const additionalInProgressJobs = [
      { clientIdx: 6, title: 'Pool Pump Repair', description: 'Replacing worn pool pump motor and seals', address: clientsData[6].address },
      { clientIdx: 7, title: 'Solar Hot Water Install', description: 'Installing solar hot water system on north-facing roof', address: clientsData[7].address },
    ];

    for (const job of additionalInProgressJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'in_progress',
        scheduledAt: getDaysAgo(1),
        startedAt: getDaysAgo(0),
        estimatedDuration: 180,
      });
      createdJobs.push(createdJob);
    }

    // CANCELLED JOBS (1) - reduced from 3 for better demo presentation
    const cancelledJobs = [
      { clientIdx: 8, title: 'Grease Trap Replacement', description: 'Commercial job - restaurant closed', address: clientsData[8].address, cancellationReason: 'Restaurant permanently closed' },
    ];

    for (const job of cancelledJobs) {
      const createdJob = await storage.createJob({
        userId: demoUser.id,
        clientId: createdClients[job.clientIdx].id,
        title: job.title,
        description: job.description,
        address: job.address,
        status: 'cancelled',
        cancellationReason: job.cancellationReason,
        estimatedDuration: 120,
      });
      createdJobs.push(createdJob);
    }

    console.log(`✅ ${createdJobs.length} Demo jobs created (4 pending, 8 scheduled [4 today], 6 in_progress, 6 done, 5 invoiced, 1 cancelled)`);

    // ============================================
    // CREATE QUOTES (25 total: 4 draft, 11 sent, 8 accepted, 2 rejected)
    // With line items for proper preview display
    // ============================================

    // Helper function to create quote with line items
    const createQuoteWithLineItems = async (
      quoteData: Parameters<typeof storage.createQuote>[0],
      lineItems: Array<{ description: string; quantity: string; unitPrice: string; total: string }>
    ) => {
      const quote = await storage.createQuote(quoteData);
      for (let i = 0; i < lineItems.length; i++) {
        await storage.createQuoteLineItem({
          quoteId: quote.id,
          description: lineItems[i].description,
          quantity: lineItems[i].quantity,
          unitPrice: lineItems[i].unitPrice,
          total: lineItems[i].total,
          sortOrder: i,
        });
      }
      return quote;
    };

    // DRAFT QUOTES (4)
    const draft1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Bathroom Renovation Plumbing',
      description: 'Complete plumbing rough-in and fit-out for master bathroom renovation',
      status: 'draft' as const,
      subtotal: '3200.00',
      gstAmount: '320.00',
      total: '3520.00',
      validUntil: getDaysFromNow(30),
      number: draft1Num,
    }, [
      { description: 'Rough-in plumbing - shower, toilet, vanity', quantity: '1', unitPrice: '1800.00', total: '1800.00' },
      { description: 'Supply and install new toilet', quantity: '1', unitPrice: '650.00', total: '650.00' },
      { description: 'Supply and install vanity basin mixer', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Labour - fit-out and connections', quantity: '4', unitPrice: '100.00', total: '400.00' },
    ]);

    const draft2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Hot Water System Replacement',
      description: 'Supply and install new 315L heat pump hot water system',
      status: 'draft' as const,
      subtotal: '4500.00',
      gstAmount: '450.00',
      total: '4950.00',
      validUntil: getDaysFromNow(30),
      number: draft2Num,
    }, [
      { description: 'Reclaim 315L Heat Pump Hot Water System', quantity: '1', unitPrice: '3200.00', total: '3200.00' },
      { description: 'Removal and disposal of old hot water system', quantity: '1', unitPrice: '250.00', total: '250.00' },
      { description: 'Plumbing connections and commissioning', quantity: '1', unitPrice: '650.00', total: '650.00' },
      { description: 'Electrical connection (by licensed electrician)', quantity: '1', unitPrice: '400.00', total: '400.00' },
    ]);

    const draft3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Granny Flat Plumbing Package',
      description: 'Complete plumbing for new granny flat build',
      status: 'draft' as const,
      subtotal: '8500.00',
      gstAmount: '850.00',
      total: '9350.00',
      validUntil: getDaysFromNow(30),
      number: draft3Num,
    }, [
      { description: 'Rough-in plumbing (bathroom, kitchen, laundry)', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Hot water system supply and install', quantity: '1', unitPrice: '2800.00', total: '2800.00' },
      { description: 'Fit-out and fixtures', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
    ]);

    const draft4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Pool Plumbing Installation',
      description: 'New pool plumbing including pump and filtration connections',
      status: 'draft' as const,
      subtotal: '2800.00',
      gstAmount: '280.00',
      total: '3080.00',
      validUntil: getDaysFromNow(30),
      number: draft4Num,
    }, [
      { description: 'Pool pump and filter connections', quantity: '1', unitPrice: '1800.00', total: '1800.00' },
      { description: 'Backwash line installation', quantity: '1', unitPrice: '600.00', total: '600.00' },
      { description: 'Testing and commissioning', quantity: '1', unitPrice: '400.00', total: '400.00' },
    ]);

    // SENT QUOTES (9)
    const sent1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[4].id,
      title: 'Kitchen Plumbing Upgrade',
      description: 'Relocate sink and install new dishwasher connection',
      status: 'sent' as const,
      subtotal: '1850.00',
      gstAmount: '185.00',
      total: '2035.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(3),
      number: sent1Num,
      isXeroImport: true,
      xeroQuoteId: generateXeroId('QUO'),
      xeroContactId: generateXeroId('CON'),
    }, [
      { description: 'Relocate sink waste and water supply', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Install dishwasher connection', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Supply and install kitchen mixer tap', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Miscellaneous fittings and materials', quantity: '1', unitPrice: '200.00', total: '200.00' },
    ]);

    const sent2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[5].id,
      title: 'Gas BBQ Connection',
      description: 'Run new gas line from meter to outdoor BBQ area',
      status: 'sent' as const,
      subtotal: '980.00',
      gstAmount: '98.00',
      total: '1078.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(5),
      number: sent2Num,
      isXeroImport: true,
      xeroQuoteId: generateXeroId('QUO'),
      xeroContactId: generateXeroId('CON'),
    }, [
      { description: 'Run 15m gas line from meter to BBQ area', quantity: '1', unitPrice: '580.00', total: '580.00' },
      { description: 'Gas bayonet fitting with isolation valve', quantity: '1', unitPrice: '220.00', total: '220.00' },
      { description: 'Pressure test and compliance certificate', quantity: '1', unitPrice: '180.00', total: '180.00' },
    ]);

    const sent3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[6].id,
      title: 'Ensuite Addition Plumbing',
      description: 'Complete plumbing for new ensuite bathroom',
      status: 'sent' as const,
      subtotal: '5600.00',
      gstAmount: '560.00',
      total: '6160.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(7),
      number: sent3Num,
    }, [
      { description: 'Rough-in plumbing for ensuite (shower, toilet, vanity)', quantity: '1', unitPrice: '2400.00', total: '2400.00' },
      { description: 'Supply and install frameless shower screen', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
      { description: 'Wall-hung vanity and basin package', quantity: '1', unitPrice: '1100.00', total: '1100.00' },
      { description: 'Wall-hung toilet with concealed cistern', quantity: '1', unitPrice: '900.00', total: '900.00' },
    ]);

    const sent4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[7].id,
      title: 'Commercial Kitchen Fit-Out',
      description: 'Full plumbing for new cafe kitchen',
      status: 'sent' as const,
      subtotal: '12500.00',
      gstAmount: '1250.00',
      total: '13750.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(4),
      number: sent4Num,
    }, [
      { description: 'Grease trap supply and installation', quantity: '1', unitPrice: '3500.00', total: '3500.00' },
      { description: 'Commercial sink connections (3 sinks)', quantity: '3', unitPrice: '1200.00', total: '3600.00' },
      { description: 'Gas connections for cooking equipment', quantity: '1', unitPrice: '2800.00', total: '2800.00' },
      { description: 'Hot water system upgrade', quantity: '1', unitPrice: '2600.00', total: '2600.00' },
    ]);

    const sent5Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[8].id,
      title: 'Stormwater Drainage System',
      description: 'New stormwater drainage for property',
      status: 'sent' as const,
      subtotal: '4200.00',
      gstAmount: '420.00',
      total: '4620.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(6),
      number: sent5Num,
    }, [
      { description: 'Excavation and trenching', quantity: '1', unitPrice: '1500.00', total: '1500.00' },
      { description: 'PVC stormwater pipe supply and install', quantity: '30', unitPrice: '45.00', total: '1350.00' },
      { description: 'Stormwater pits (2)', quantity: '2', unitPrice: '450.00', total: '900.00' },
      { description: 'Connection to council drain', quantity: '1', unitPrice: '450.00', total: '450.00' },
    ]);

    const sent6Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[9].id,
      title: 'Rainwater Tank System',
      description: 'Supply and install 10,000L rainwater tank with pump',
      status: 'sent' as const,
      subtotal: '5800.00',
      gstAmount: '580.00',
      total: '6380.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(2),
      number: sent6Num,
    }, [
      { description: '10,000L poly rainwater tank', quantity: '1', unitPrice: '2800.00', total: '2800.00' },
      { description: 'Tank pump and pressure controller', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
      { description: 'Connection to downpipes', quantity: '1', unitPrice: '800.00', total: '800.00' },
      { description: 'Connection to toilets and laundry', quantity: '1', unitPrice: '1000.00', total: '1000.00' },
    ]);

    const sent7Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Spa Bath Installation',
      description: 'Install new spa bath with plumbing connections',
      status: 'sent' as const,
      subtotal: '1950.00',
      gstAmount: '195.00',
      total: '2145.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(8),
      number: sent7Num,
    }, [
      { description: 'Spa bath plumbing rough-in', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Waste and overflow connections', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Hot and cold water supply', quantity: '1', unitPrice: '650.00', total: '650.00' },
    ]);

    const sent8Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Backflow Prevention Upgrade',
      description: 'Install testable backflow prevention devices',
      status: 'sent' as const,
      subtotal: '1450.00',
      gstAmount: '145.00',
      total: '1595.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(1),
      number: sent8Num,
    }, [
      { description: 'Reduced pressure zone device', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Installation and testing', quantity: '1', unitPrice: '400.00', total: '400.00' },
      { description: 'Compliance certification', quantity: '1', unitPrice: '200.00', total: '200.00' },
    ]);

    const sent9Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Water Softener Installation',
      description: 'Whole house water softener system',
      status: 'sent' as const,
      subtotal: '3200.00',
      gstAmount: '320.00',
      total: '3520.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(9),
      number: sent9Num,
    }, [
      { description: 'Water softener unit', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
      { description: 'Installation and plumbing', quantity: '1', unitPrice: '750.00', total: '750.00' },
      { description: 'Bypass valve installation', quantity: '1', unitPrice: '250.00', total: '250.00' },
    ]);

    // ACCEPTED QUOTES (7)
    const accepted1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Outdoor Shower Installation',
      description: 'Install outdoor shower near pool area',
      status: 'accepted' as const,
      subtotal: '1200.00',
      gstAmount: '120.00',
      total: '1320.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(10),
      acceptedAt: getDaysAgo(7),
      acceptedBy: 'Michael Brown',
      number: accepted1Num,
    }, [
      { description: 'Run hot and cold water lines to outdoor area', quantity: '1', unitPrice: '550.00', total: '550.00' },
      { description: 'Outdoor shower mixer and head (marine grade)', quantity: '1', unitPrice: '380.00', total: '380.00' },
      { description: 'Drainage connection to stormwater', quantity: '1', unitPrice: '270.00', total: '270.00' },
    ]);

    const accepted2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[4].id,
      title: 'Laundry Renovation Plumbing',
      description: 'Relocate washing machine and add new trough',
      status: 'accepted' as const,
      subtotal: '1650.00',
      gstAmount: '165.00',
      total: '1815.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(14),
      acceptedAt: getDaysAgo(10),
      acceptedBy: 'Rachel Green',
      number: accepted2Num,
      isXeroImport: true,
      xeroQuoteId: generateXeroId('QUO'),
      xeroContactId: generateXeroId('CON'),
    }, [
      { description: 'Relocate washing machine taps and waste', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Supply and install stainless steel laundry trough', quantity: '1', unitPrice: '580.00', total: '580.00' },
      { description: 'Install new laundry mixer tap', quantity: '1', unitPrice: '320.00', total: '320.00' },
      { description: 'Connect to existing drainage', quantity: '1', unitPrice: '300.00', total: '300.00' },
    ]);

    const accepted3Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[5].id,
      title: 'Gas Heater Installation',
      description: 'Supply and install new gas heater',
      status: 'accepted' as const,
      subtotal: '2400.00',
      gstAmount: '240.00',
      total: '2640.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(12),
      acceptedAt: getDaysAgo(8),
      acceptedBy: 'David Chen',
      number: accepted3Num,
    }, [
      { description: 'Gas heater unit supply', quantity: '1', unitPrice: '1600.00', total: '1600.00' },
      { description: 'Gas connection and flue installation', quantity: '1', unitPrice: '600.00', total: '600.00' },
      { description: 'Compliance certificate', quantity: '1', unitPrice: '200.00', total: '200.00' },
    ]);

    const accepted4Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[6].id,
      title: 'Toilet Suite Upgrade',
      description: 'Replace 3 toilet suites throughout house',
      status: 'accepted' as const,
      subtotal: '2850.00',
      gstAmount: '285.00',
      total: '3135.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(11),
      acceptedAt: getDaysAgo(6),
      acceptedBy: 'Sarah Mitchell',
      number: accepted4Num,
    }, [
      { description: 'Close-coupled toilet suites (3)', quantity: '3', unitPrice: '750.00', total: '2250.00' },
      { description: 'Removal of old toilets', quantity: '3', unitPrice: '100.00', total: '300.00' },
      { description: 'Installation labour', quantity: '3', unitPrice: '100.00', total: '300.00' },
    ]);

    const accepted5Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[7].id,
      title: 'Kitchen Mixer Replacement',
      description: 'Supply and install new pull-out kitchen mixer',
      status: 'accepted' as const,
      subtotal: '580.00',
      gstAmount: '58.00',
      total: '638.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(5),
      acceptedAt: getDaysAgo(3),
      acceptedBy: 'Peter Johnson',
      number: accepted5Num,
    }, [
      { description: 'Grohe pull-out kitchen mixer', quantity: '1', unitPrice: '420.00', total: '420.00' },
      { description: 'Installation and testing', quantity: '1', unitPrice: '160.00', total: '160.00' },
    ]);

    const accepted6Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[8].id,
      title: 'Shower Screen Door Seal',
      description: 'Replace shower base and reseal',
      status: 'accepted' as const,
      subtotal: '1100.00',
      gstAmount: '110.00',
      total: '1210.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(9),
      acceptedAt: getDaysAgo(5),
      acceptedBy: 'Amanda White',
      number: accepted6Num,
    }, [
      { description: 'Remove existing tiles and waterproofing', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Apply new waterproofing membrane', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Retile shower base', quantity: '1', unitPrice: '300.00', total: '300.00' },
    ]);

    const accepted7Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[9].id,
      title: 'Downpipe Replacement',
      description: 'Replace damaged downpipes on house',
      status: 'accepted' as const,
      subtotal: '890.00',
      gstAmount: '89.00',
      total: '979.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(7),
      acceptedAt: getDaysAgo(4),
      acceptedBy: 'Chris Taylor',
      number: accepted7Num,
    }, [
      { description: 'Remove old downpipes', quantity: '1', unitPrice: '200.00', total: '200.00' },
      { description: 'Supply and install new PVC downpipes', quantity: '4', unitPrice: '120.00', total: '480.00' },
      { description: 'Connection to stormwater', quantity: '1', unitPrice: '210.00', total: '210.00' },
    ]);

    // ADDITIONAL SENT QUOTES (3) - converted from rejected for better demo presentation
    const extraSent1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Whole House Repipe',
      description: 'Replace all copper pipes with PEX throughout house',
      status: 'sent' as const,
      subtotal: '12000.00',
      gstAmount: '1200.00',
      total: '13200.00',
      validUntil: getDaysFromNow(14),
      sentAt: getDaysAgo(3),
      number: extraSent1Num,
    }, [
      { description: 'Remove existing copper piping throughout house', quantity: '1', unitPrice: '2500.00', total: '2500.00' },
      { description: 'Install new PEX piping system (whole house)', quantity: '1', unitPrice: '6500.00', total: '6500.00' },
      { description: 'New main water shutoff valve', quantity: '1', unitPrice: '450.00', total: '450.00' },
      { description: 'Pressure test and compliance', quantity: '1', unitPrice: '350.00', total: '350.00' },
      { description: 'Make good - patch walls and ceilings', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
    ]);

    const extraSent2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[1].id,
      title: 'Solar Hot Water System',
      description: 'Supply and install rooftop solar hot water system',
      status: 'sent' as const,
      subtotal: '8500.00',
      gstAmount: '850.00',
      total: '9350.00',
      validUntil: getDaysFromNow(21),
      sentAt: getDaysAgo(5),
      number: extraSent2Num,
    }, [
      { description: 'Solar collector panels (2 x 2m)', quantity: '2', unitPrice: '1800.00', total: '3600.00' },
      { description: 'Solar storage tank 315L', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
      { description: 'Mounting frame and hardware', quantity: '1', unitPrice: '850.00', total: '850.00' },
      { description: 'Plumbing connections and pump', quantity: '1', unitPrice: '950.00', total: '950.00' },
      { description: 'Installation labour (full day)', quantity: '1', unitPrice: '900.00', total: '900.00' },
    ]);

    // ADDITIONAL ACCEPTED QUOTE (1) - converted from rejected for better demo presentation
    const extraAccepted1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Sewer Line Replacement',
      description: 'Replace old terracotta sewer line with PVC',
      status: 'accepted' as const,
      subtotal: '6500.00',
      gstAmount: '650.00',
      total: '7150.00',
      validUntil: getDaysFromNow(30),
      sentAt: getDaysAgo(10),
      acceptedAt: getDaysAgo(7),
      number: extraAccepted1Num,
    }, [
      { description: 'Excavation and trenching (25m)', quantity: '1', unitPrice: '2500.00', total: '2500.00' },
      { description: 'PVC sewer pipe supply and install', quantity: '1', unitPrice: '2200.00', total: '2200.00' },
      { description: 'Connection to main sewer', quantity: '1', unitPrice: '800.00', total: '800.00' },
      { description: 'Backfill and restoration', quantity: '1', unitPrice: '1000.00', total: '1000.00' },
    ]);

    // REJECTED QUOTES (2) - reduced from 5 for better demo presentation
    const rejected1Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[3].id,
      title: 'Luxury Bathroom Package',
      description: 'High-end bathroom renovation with premium fixtures',
      status: 'rejected' as const,
      subtotal: '18500.00',
      gstAmount: '1850.00',
      total: '20350.00',
      validUntil: getDaysAgo(8),
      sentAt: getDaysAgo(22),
      number: rejected1Num,
    }, [
      { description: 'Complete strip-out and waterproofing', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Premium freestanding bath', quantity: '1', unitPrice: '5500.00', total: '5500.00' },
      { description: 'Walk-in shower with rain head', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Dual vanity with stone top', quantity: '1', unitPrice: '4000.00', total: '4000.00' },
    ]);

    const rejected2Num = await storage.generateQuoteNumber(demoUser.id);
    await createQuoteWithLineItems({
      userId: demoUser.id,
      clientId: createdClients[4].id,
      title: 'Grey Water System',
      description: 'Install grey water recycling system',
      status: 'rejected' as const,
      subtotal: '7200.00',
      gstAmount: '720.00',
      total: '7920.00',
      validUntil: getDaysAgo(12),
      sentAt: getDaysAgo(28),
      number: rejected2Num,
    }, [
      { description: 'Grey water treatment system', quantity: '1', unitPrice: '4500.00', total: '4500.00' },
      { description: 'Diversion plumbing from bathroom/laundry', quantity: '1', unitPrice: '1500.00', total: '1500.00' },
      { description: 'Garden irrigation connections', quantity: '1', unitPrice: '1200.00', total: '1200.00' },
    ]);

    console.log('✅ 25 Demo quotes created (4 draft, 11 sent, 8 accepted, 2 rejected)');

    // ============================================
    // CREATE INVOICES (20 total: 1 draft, 1 sent, 1 overdue, 17 paid)
    // ============================================

    // DRAFT INVOICE (1)
    const draftInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const draftInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[0].id,
      title: 'Tap Washer Replacement',
      description: 'Replaced washers on 3 taps throughout house',
      status: 'draft' as const,
      subtotal: '180.00',
      gstAmount: '18.00',
      total: '198.00',
      dueDate: getDaysFromNow(14),
      number: draftInv1Num,
    });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice1.id, description: 'Tap Washers (3 sets)', quantity: '3.00', unitPrice: '15.00', total: '45.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: draftInvoice1.id, description: 'Labour (1.5 hours)', quantity: '1.50', unitPrice: '90.00', total: '135.00', sortOrder: 2 });

    // SENT INVOICE (1) - with online payment enabled
    const sentInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const sentInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[2].id,
      title: 'Drain Unblocking Service',
      description: 'Cleared blocked laundry drain with high-pressure jetter',
      status: 'sent' as const,
      subtotal: '320.00',
      gstAmount: '32.00',
      total: '352.00',
      dueDate: getDaysFromNow(21),
      sentAt: getDaysAgo(5),
      number: sentInv1Num,
      isXeroImport: true,
      xeroInvoiceId: generateXeroId('INV'),
      xeroContactId: generateXeroId('CON'),
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice1.id, description: 'High-Pressure Jetter Service', quantity: '1.00', unitPrice: '280.00', total: '280.00', sortOrder: 1 });
    await storage.createInvoiceLineItem({ invoiceId: sentInvoice1.id, description: 'Call-Out Fee', quantity: '1.00', unitPrice: '40.00', total: '40.00', sortOrder: 2 });

    // OVERDUE INVOICE (1) - also has online payment enabled
    const overdueInv1Num = await storage.generateInvoiceNumber(demoUser.id);
    const overdueInvoice1 = await storage.createInvoice({
      userId: demoUser.id,
      clientId: createdClients[5].id,
      title: 'Outdoor Tap Repair',
      description: 'Fixed leaking garden tap and replaced washers',
      status: 'sent' as const,
      subtotal: '135.00',
      gstAmount: '13.50',
      total: '148.50',
      dueDate: getDaysAgo(14),
      sentAt: getDaysAgo(35),
      number: overdueInv1Num,
      allowOnlinePayment: true,
      paymentToken: generatePaymentToken(),
    });
    await storage.createInvoiceLineItem({ invoiceId: overdueInvoice1.id, description: 'Garden Tap Repair', quantity: '1.00', unitPrice: '135.00', total: '135.00', sortOrder: 1 });

    // PAID INVOICES - Spread across 12 months for realistic reporting
    const paymentMethods = ['bank_transfer', 'card', 'cash', 'eftpos'] as const;
    const createdPaidInvoices: { invoice: any; invoiceData: typeof MONTHLY_PAID_INVOICES[0] }[] = [];
    
    for (let i = 0; i < MONTHLY_PAID_INVOICES.length; i++) {
      const invoiceData = MONTHLY_PAID_INVOICES[i];
      const gstAmount = invoiceData.subtotal * 0.1; // 10% GST
      const total = invoiceData.subtotal + gstAmount;
      const paidAt = getMonthsAgo(invoiceData.month, invoiceData.payDay);
      const sentAt = new Date(paidAt);
      sentAt.setDate(sentAt.getDate() - 14); // Sent 2 weeks before payment
      const dueAt = new Date(paidAt);
      dueAt.setDate(dueAt.getDate() + 7); // Due 1 week after payment (already paid)
      
      const invNum = await storage.generateInvoiceNumber(demoUser.id);
      const clientIndex = i % createdClients.length;
      
      const invoice = await storage.createInvoice({
        userId: demoUser.id,
        clientId: createdClients[clientIndex].id,
        title: invoiceData.title,
        description: invoiceData.description,
        status: 'paid' as const,
        subtotal: invoiceData.subtotal.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        total: total.toFixed(2),
        dueDate: dueAt,
        sentAt: sentAt,
        paidAt: paidAt,
        number: invNum,
      });
      
      await storage.createInvoiceLineItem({
        invoiceId: invoice.id,
        description: invoiceData.title,
        quantity: '1.00',
        unitPrice: invoiceData.subtotal.toFixed(2),
        total: invoiceData.subtotal.toFixed(2),
        sortOrder: 1
      });
      
      createdPaidInvoices.push({ invoice, invoiceData });
    }

    console.log(`✅ ${3 + MONTHLY_PAID_INVOICES.length} Demo invoices created (1 draft, 1 sent, 1 overdue, ${MONTHLY_PAID_INVOICES.length} paid across 12 months)`);

    // ============================================
    // CREATE RECEIPTS (20 total: 17 from paid invoices + 3 cash receipts)
    // ============================================

    for (let i = 0; i < createdPaidInvoices.length; i++) {
      const { invoice, invoiceData } = createdPaidInvoices[i];
      const gstAmount = invoiceData.subtotal * 0.1;
      const total = invoiceData.subtotal + gstAmount;
      const paidAt = getMonthsAgo(invoiceData.month, invoiceData.payDay);
      const clientIndex = i % createdClients.length;
      
      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: invoice.id,
        clientId: createdClients[clientIndex].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(3, '0')}`,
        amount: total.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        subtotal: invoiceData.subtotal.toFixed(2),
        description: `Payment for ${invoiceData.title.toLowerCase()}`,
        paymentMethod: paymentMethods[i % paymentMethods.length],
        paidAt: paidAt,
      });
    }

    // Additional cash receipts (3) for small jobs without formal invoices
    const cashReceiptsData = [
      { clientIdx: 7, description: 'Cash payment for emergency tap washer', subtotal: 75, daysAgo: 15 },
      { clientIdx: 8, description: 'Cash payment for blocked drain clearing', subtotal: 120, daysAgo: 22 },
      { clientIdx: 9, description: 'Cash payment for toilet repair', subtotal: 95, daysAgo: 30 },
    ];

    for (let i = 0; i < cashReceiptsData.length; i++) {
      const receiptData = cashReceiptsData[i];
      const gstAmount = receiptData.subtotal * 0.1;
      const total = receiptData.subtotal + gstAmount;
      
      await storage.createReceipt({
        userId: demoUser.id,
        invoiceId: null,
        clientId: createdClients[receiptData.clientIdx].id,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-${String(MONTHLY_PAID_INVOICES.length + i + 1).padStart(3, '0')}`,
        amount: total.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        subtotal: receiptData.subtotal.toFixed(2),
        description: receiptData.description,
        paymentMethod: 'cash',
        paidAt: getDaysAgo(receiptData.daysAgo),
      });
    }

    console.log(`✅ 20 Demo receipts created (17 from paid invoices + 3 cash receipts)`);

    // ============================================
    // CREATE SMS CONVERSATIONS (for demo)
    // ============================================
    const existingSmsConversations = await storage.getSmsConversationsByBusiness(demoUser.id);
    if (existingSmsConversations.length === 0) {
      const smsConversations = [
        {
          businessOwnerId: demoUser.id,
          clientId: createdClients[0].id,
          clientPhone: clientsData[0].phone,
          clientName: clientsData[0].name,
          lastMessageAt: new Date(),
          unreadCount: 1,
        },
        {
          businessOwnerId: demoUser.id,
          clientId: null,
          clientPhone: '+61499888777',
          clientName: 'Unknown Caller',
          lastMessageAt: getDaysAgo(1),
          unreadCount: 1,
        },
      ];

      const createdConversations = [];
      for (const convData of smsConversations) {
        const conv = await storage.createSmsConversation(convData);
        createdConversations.push(conv);
      }

      const smsMessages = [
        {
          conversationId: createdConversations[0].id,
          direction: 'inbound' as const,
          body: 'Hi, can you come out tomorrow to look at my leaking kitchen tap? It\'s gotten worse overnight.',
          status: 'delivered' as const,
          isJobRequest: true,
          intentConfidence: 'high' as const,
          intentType: 'job_request' as const,
          suggestedJobTitle: 'Leaking Kitchen Tap',
          suggestedDescription: 'Customer reports kitchen tap leak has worsened. Requesting urgent visit.',
        },
        {
          conversationId: createdConversations[1].id,
          direction: 'inbound' as const,
          body: 'G\'day mate, got a burst pipe in the laundry! Water everywhere. Can you come ASAP? I\'m at 67 Grove Street Whitfield.',
          status: 'delivered' as const,
          isJobRequest: true,
          intentConfidence: 'high' as const,
          intentType: 'job_request' as const,
          suggestedJobTitle: 'Emergency Burst Pipe',
          suggestedDescription: 'Emergency - burst pipe in laundry causing flooding. Location: 67 Grove Street Whitfield.',
        },
      ];

      for (const msgData of smsMessages) {
        await storage.createSmsMessage(msgData);
      }

      console.log('✅ Demo SMS conversations created');
    }

    // ============================================
    // SEED TEMPLATES (if needed)
    // ============================================
    const templates = await storage.getDocumentTemplates(demoUser.id);
    const existingJobTemplates = templates.filter(t => t.type === 'job');
    const needsSeeding = templates.length < 15 || existingJobTemplates.length < 10;
    
    if (needsSeeding) {
      console.log('🔄 Seeding tradie templates...');
      try {
        const { tradieQuoteTemplates, tradieLineItems, tradieRateCards } = await import('./tradieTemplates');

        let templateCount = 0;
        let itemCount = 0;
        let rateCardCount = 0;

        // Get existing family keys to avoid duplicates
        const existingFamilyKeys = new Set(templates.map(t => `${t.type}-${t.familyKey}`));

        for (const template of tradieQuoteTemplates) {
          const key = `${template.type}-${template.familyKey}`;
          if (existingFamilyKeys.has(key)) continue;
          
          try {
            await storage.createDocumentTemplate({
              type: template.type,
              familyKey: template.familyKey,
              name: template.name,
              tradeType: template.tradeType,
              userId: demoUser.id,
              styling: template.styling,
              sections: template.sections,
              defaults: template.defaults,
              defaultLineItems: template.defaultLineItems,
            });
            templateCount++;
          } catch (error) {
            // Template might already exist
          }
        }

        for (const item of tradieLineItems) {
          try {
            await storage.createLineItemCatalogItem({
              tradeType: item.tradeType,
              name: item.name,
              description: item.description,
              unit: item.unit,
              unitPrice: item.unitPrice.toString(),
              defaultQty: item.defaultQty.toString(),
              userId: demoUser.id,
              tags: [],
            });
            itemCount++;
          } catch (error) {
            // Line item might already exist
          }
        }

        for (const rateCard of tradieRateCards) {
          try {
            await storage.createRateCard({
              name: rateCard.name,
              tradeType: rateCard.tradeType,
              hourlyRate: rateCard.hourlyRate.toString(),
              calloutFee: rateCard.calloutFee.toString(),
              materialMarkupPct: '15',
              afterHoursMultiplier: rateCard.afterHoursMultiplier.toString(),
              gstEnabled: true,
              userId: demoUser.id,
            });
            rateCardCount++;
          } catch (error) {
            // Rate card might already exist
          }
        }

        console.log(`✅ Templates seeded: ${templateCount} new templates, ${itemCount} line items, ${rateCardCount} rate cards`);
      } catch (error) {
        console.error('Error seeding templates:', error);
      }
    } else {
      console.log(`✅ Templates already exist: ${templates.length} templates (${existingJobTemplates.length} job templates)`);
    }

    // ============================================
    // CREATE ACTIVITY LOGS for Recent Activity
    // ============================================
    await createDemoActivityLogs(demoUser.id);
    
    // CREATE NOTIFICATIONS for "What You Missed" popup
    // ============================================
    await createDemoNotifications(demoUser.id);

    // Seed equipment, SWMS safety docs + expenses for the fresh demo
    await seedDemoEquipment(demoUser.id);
    await seedDemoSafetyAndExpenses(demoUser.id);

    return demoUser;
  } catch (error) {
    console.error('Error setting up demo data:', error);
    return null;
  }
}

// Helper function to seed templates for any user
export async function seedTemplatesForUser(userId: string) {
  try {
    const templates = await storage.getDocumentTemplates(userId);
    const existingJobTemplates = templates.filter(t => t.type === 'job');
    
    if (existingJobTemplates.length >= 10) {
      return; // User already has enough job templates
    }
    
    console.log(`🔄 Seeding templates for user ${userId}...`);
    const { tradieQuoteTemplates, tradieLineItems, tradieRateCards } = await import('./tradieTemplates');
    
    let templateCount = 0;
    const existingFamilyKeys = new Set(templates.map(t => `${t.type}-${t.familyKey}`));
    
    for (const template of tradieQuoteTemplates) {
      const key = `${template.type}-${template.familyKey}`;
      if (existingFamilyKeys.has(key)) continue;
      
      try {
        await storage.createDocumentTemplate({
          type: template.type,
          familyKey: template.familyKey,
          name: template.name,
          tradeType: template.tradeType,
          userId: userId,
          styling: template.styling,
          sections: template.sections,
          defaults: template.defaults,
          defaultLineItems: template.defaultLineItems,
        });
        templateCount++;
      } catch (error) {
        // Template might already exist
      }
    }
    
    if (templateCount > 0) {
      console.log(`✅ Seeded ${templateCount} templates for user`);
    }
  } catch (error) {
    console.error('Error seeding templates for user:', error);
  }
}

// Seed SMS data for test users
export async function seedSmsDataForTestUsers() {
  try {
    const testUser = await storage.getUserByEmail('mike@northqldplumbing.com.au');
    if (!testUser) {
      console.log('No test user found for SMS demo data');
      return;
    }
    
    // Seed templates for test user if missing
    await seedTemplatesForUser(testUser.id);

    const existingSmsConversations = await storage.getSmsConversationsByBusiness(testUser.id);
    if (existingSmsConversations.length > 0) {
      console.log(`✅ Test user already has ${existingSmsConversations.length} SMS conversations`);
      return;
    }

    const clients = await storage.getClients(testUser.id);
    const firstClient = clients[0];

    const smsConversations = [
      {
        businessOwnerId: testUser.id,
        clientId: firstClient?.id || null,
        clientPhone: '+61412345678',
        clientName: firstClient?.name || 'Sarah Johnson',
        lastMessageAt: new Date(),
        unreadCount: 1,
      },
    ];

    const createdConversations = [];
    for (const convData of smsConversations) {
      const conv = await storage.createSmsConversation(convData);
      createdConversations.push(conv);
    }

    const smsMessages = [
      {
        conversationId: createdConversations[0].id,
        direction: 'inbound' as const,
        body: 'Hi, can you come look at my hot water system? It\'s not heating properly.',
        status: 'delivered' as const,
        isJobRequest: true,
        intentConfidence: 'high' as const,
        intentType: 'quote_request' as const,
        suggestedJobTitle: 'Hot Water System Inspection',
        suggestedDescription: 'Customer reports hot water system not heating properly.',
      },
    ];

    for (const msgData of smsMessages) {
      await storage.createSmsMessage(msgData);
    }

    console.log('✅ Test user SMS demo data seeded');
  } catch (error) {
    console.error('Error seeding SMS data for test users:', error);
  }
}

// Create demo team members with location data
export async function createDemoTeamMembers(account: { email: string } = DEMO_USER) {
  try {
    const demoUser = await storage.getUserByEmail(account.email);
    if (!demoUser) {
      console.log('No demo user found for team creation');
      return;
    }

    console.log('🔧 Setting up demo team members...');

    // Cairns QLD area locations for demo team members
    const cairnsLocations = [
      { lat: -16.9186, lng: 145.7781, address: 'Cairns City QLD 4870', status: 'working' },
      { lat: -16.9230, lng: 145.7540, address: 'Parramatta Park QLD 4870', status: 'driving' },
      { lat: -16.9080, lng: 145.7460, address: 'Edge Hill QLD 4870', status: 'online' },
      { lat: -16.9320, lng: 145.7350, address: 'Manunda QLD 4870', status: 'working' },
      { lat: -16.8960, lng: 145.7380, address: 'Whitfield QLD 4870', status: 'online' },
    ];

    // Get or create a worker role
    const existingRoles = await storage.getUserRoles();
    let workerRole = existingRoles.find(r => r.name.toLowerCase() === 'worker' || r.name.toLowerCase() === 'field worker');
    if (!workerRole) {
      workerRole = await storage.createUserRole({
        name: 'Worker',
        permissions: ['read_jobs', 'update_job_status', 'create_time_entries', 'read_clients'],
        description: 'Field worker with job access',
        isActive: true,
      });
      console.log('✅ Created Worker role for team members');
    }

    // Team member data
    const teamMemberData = [
      { name: 'Jake Morrison', email: DEMO_WORKER.email, phone: DEMO_WORKER.phone },
      { name: 'Tom Richards', email: 'tom@demoplumbing.com.au', phone: '+61412111222' },
      { name: 'Sam Cooper', email: 'sam@demoplumbing.com.au', phone: '+61412333444' },
      { name: 'Kate Williams', email: 'kate@demoplumbing.com.au', phone: '+61412555666' },
    ];

    // Check existing team members
    const existingTeam = await storage.getTeamMembers(demoUser.id);
    console.log(`ℹ️ Found ${existingTeam.length} existing team members`);

    for (let i = 0; i < teamMemberData.length; i++) {
      const memberInfo = teamMemberData[i];
      const location = cairnsLocations[i % cairnsLocations.length];
      const nameParts = memberInfo.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // Create or get user account
      let memberUser = await storage.getUserByEmail(memberInfo.email);
      if (!memberUser) {
        const hashedPassword = await bcrypt.hash('worker123', 10);
        memberUser = await storage.createUser({
          email: memberInfo.email,
          password: hashedPassword,
          firstName,
          lastName,
        });
        await storage.updateUser(memberUser.id, {
          phone: memberInfo.phone,
        } as any);
        console.log(`✅ Created user: ${memberInfo.name}`);
      }

      // Check if team member record exists
      const existingMember = existingTeam.find(m => m.memberId === memberUser!.id || m.email === memberInfo.email);
      if (!existingMember) {
        // Create team member record
        await storage.createTeamMember({
          businessOwnerId: demoUser.id,
          memberId: memberUser.id,
          roleId: workerRole.id,
          email: memberInfo.email,
          firstName,
          lastName,
          phone: memberInfo.phone,
          inviteStatus: 'accepted',
          inviteAcceptedAt: new Date(),
          isActive: true,
          allowLocationSharing: true,
          locationEnabledByOwner: true,
        });
        console.log(`✅ Registered team member: ${memberInfo.name}`);
      }

      // Create or update tradieStatus with location data for map display
      // Use deterministic battery levels based on index for consistency between dev and production
      const batteryLevels = [85, 72, 91, 68, 78, 65, 82, 55, 88, 75];
      const batteryLevel = batteryLevels[i % batteryLevels.length];
      
      await storage.upsertTradieStatus({
        userId: memberUser.id,
        businessOwnerId: demoUser.id,
        currentLatitude: location.lat.toString(),
        currentLongitude: location.lng.toString(),
        currentAddress: location.address,
        activityStatus: location.status,
        lastSeenAt: new Date(),
        lastLocationUpdate: new Date(),
        batteryLevel,
        isCharging: batteryLevel > 80,
      });
      console.log(`📍 Set location for ${memberInfo.name}: ${location.address}`);
    }

    const finalTeam = await storage.getTeamMembers(demoUser.id);
    console.log(`✅ Demo team has ${finalTeam.length} members with location data`);
  } catch (error) {
    console.error('Error creating demo team members:', error);
  }
}

export async function createDemoSubcontractorsAndInviteCodes(account: { email: string } = DEMO_USER) {
  try {
    const demoUser = await storage.getUserByEmail(account.email);
    if (!demoUser) {
      console.log('No demo user found for subcontractor creation');
      return;
    }

    console.log('🔧 Setting up demo subcontractors and invite codes...');

    let subRole = (await storage.getUserRoles()).find(
      (r: any) => r.name.toLowerCase() === 'subcontractor'
    );
    if (!subRole) {
      subRole = await storage.createUserRole({
        name: 'Subcontractor',
        permissions: ['read_jobs', 'update_job_status', 'create_time_entries'],
        description: 'External subcontractor with limited access',
        isActive: true,
      });
      console.log('✅ Created Subcontractor role');
    }

    const subData = [
      { name: 'Dave Nguyen', email: 'dave.sub@demoplumbing.com.au', phone: '+61412777001', trade: 'electrical' },
      { name: 'Sarah Chen', email: 'sarah.sub@demoplumbing.com.au', phone: '+61412777002', trade: 'painting' },
      { name: 'Liam O\'Brien', email: 'liam.sub@demoplumbing.com.au', phone: '+61412777003', trade: 'carpentry' },
    ];

    const existingTeam = await storage.getTeamMembers(demoUser.id);

    for (const sub of subData) {
      const nameParts = sub.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      let subUser = await storage.getUserByEmail(sub.email);
      if (!subUser) {
        const hashedPassword = await bcrypt.hash('subbie123', 10);
        subUser = await storage.createUser({
          email: sub.email,
          password: hashedPassword,
          firstName,
          lastName,
        });
        await storage.updateUser(subUser.id, {
          phone: sub.phone,
        } as any);
        console.log(`✅ Created subcontractor user: ${sub.name}`);
      }

      const existingMember = existingTeam.find(
        (m: any) => m.memberId === subUser!.id || m.email === sub.email
      );
      if (!existingMember) {
        await storage.createTeamMember({
          businessOwnerId: demoUser.id,
          memberId: subUser.id,
          roleId: subRole.id,
          email: sub.email,
          firstName,
          lastName,
          phone: sub.phone,
          inviteStatus: 'accepted',
          inviteAcceptedAt: new Date(),
          isActive: true,
        });
        console.log(`✅ Added subcontractor to team: ${sub.name}`);
      }
    }

    const existingCodes = await db.select().from(inviteCodes)
      .where(eq(inviteCodes.businessOwnerId, demoUser.id));

    const allRoles = await storage.getUserRoles();
    const workerRole = allRoles.find((r: any) => r.name.toLowerCase() === 'worker' || r.name.toLowerCase() === 'field worker');
    let managerRole = allRoles.find((r: any) => r.name.toLowerCase() === 'manager');
    if (!managerRole) {
      managerRole = await storage.createUserRole({
        name: 'Manager',
        permissions: ['read_jobs', 'write_jobs', 'manage_team', 'read_clients', 'write_clients', 'read_invoices', 'write_invoices'],
        description: 'Team manager with full access',
        isActive: true,
      });
      console.log('✅ Created Manager role');
    }

    // Invite codes are globally unique, so each demo account needs its own set
    // (demo@ keeps DEMO01-03; trydemo@ uses TRYD01-03) to avoid collisions.
    const codePrefix = account.email === TRY_DEMO_USER.email ? 'TRYD0' : 'DEMO0';
    const demoCodes = [
      { code: `${codePrefix}1`, roleType: 'worker', maxUses: 50, roleId: workerRole?.id || null },
      { code: `${codePrefix}2`, roleType: 'subcontractor', maxUses: 50, roleId: subRole.id },
      { code: `${codePrefix}3`, roleType: 'manager', maxUses: 10, roleId: managerRole?.id || null },
    ];

    for (const dc of demoCodes) {
      const existing = existingCodes.find((c: any) => c.code === dc.code);
      if (!existing) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 2);
        await db.insert(inviteCodes).values({
          businessOwnerId: demoUser.id,
          code: dc.code,
          roleType: dc.roleType,
          roleId: dc.roleId,
          maxUses: dc.maxUses,
          usedCount: 0,
          expiresAt,
          isActive: true,
        });
        console.log(`✅ Created invite code: ${dc.code} (${dc.roleType})`);
      }
    }

    const demoJobs = await storage.getJobs(demoUser.id);
    if (demoJobs.length >= 1) {
      const existingTokens = await db.select()
        .from(subcontractorTokens)
        .where(eq(subcontractorTokens.userId, demoUser.id));

      const magicLinkSeed = [
        {
          contactName: 'Bruno Walsh',
          contactPhone: '+61412888001',
          contactEmail: 'bruno.walsh@example.com.au',
          status: 'pending',
          jobIndex: 0,
          lastAccessedHoursAgo: null,
          createdHoursAgo: 6,
        },
        {
          contactName: 'Tara Mitchell',
          contactPhone: '+61412888002',
          contactEmail: 'tara.mitchell@example.com.au',
          status: 'accepted',
          jobIndex: Math.min(1, demoJobs.length - 1),
          lastAccessedHoursAgo: 2,
          createdHoursAgo: 48,
        },
        {
          contactName: 'Jordan Reilly',
          contactPhone: '+61412888003',
          contactEmail: 'jordan.reilly@example.com.au',
          status: 'accepted',
          jobIndex: Math.min(2, demoJobs.length - 1),
          lastAccessedHoursAgo: 72,
          createdHoursAgo: 168,
        },
      ];

      for (const m of magicLinkSeed) {
        const already = existingTokens.find(
          (t: any) => (t.contactPhone || '').toLowerCase() === m.contactPhone.toLowerCase()
        );
        if (already) continue;

        const job = demoJobs[m.jobIndex];
        if (!job) continue;

        const now = Date.now();
        const createdAt = new Date(now - m.createdHoursAgo * 60 * 60 * 1000);
        const lastAccessedAt = m.lastAccessedHoursAgo != null
          ? new Date(now - m.lastAccessedHoursAgo * 60 * 60 * 1000)
          : null;
        const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
        const acceptedAt = m.status === 'accepted' ? createdAt : null;
        const tokenStr = crypto.randomBytes(32).toString('hex');

        await db.insert(subcontractorTokens).values({
          jobId: job.id,
          userId: demoUser.id,
          token: tokenStr,
          contactName: m.contactName,
          contactPhone: m.contactPhone,
          contactEmail: m.contactEmail,
          status: m.status,
          createdAt,
          acceptedAt,
          lastAccessedAt,
          expiresAt,
        } as any);
        console.log(`✅ Created demo magic-link sub: ${m.contactName} (${m.status})`);
      }
    }

    console.log('✅ Demo subcontractors and invite codes ready');
    console.log(`   Invite codes: ${demoCodes[0].code} (worker), ${demoCodes[1].code} (subcontractor), ${demoCodes[2].code} (manager)`);
  } catch (error) {
    console.error('Error creating demo subcontractors:', error);
  }
}

// Keep demo team members "alive" by periodically updating their activity timestamps
// This simulates real mobile app usage and keeps web/mobile data in sync
// Uses deterministic values so dev and production stay in sync
export async function refreshDemoTeamActivity() {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) return;

    const teamMembers = await storage.getTeamMembers(demoUser.id);
    const activeMembers = teamMembers.filter(m => m.inviteStatus === 'accepted' && m.isActive);

    // Cairns QLD area - deterministic locations for each team member slot
    const memberLocations = [
      { lat: -16.9186, lng: 145.7781, status: 'working', battery: 85, speed: 0 },
      { lat: -16.9230, lng: 145.7540, status: 'driving', battery: 72, speed: 12 },
      { lat: -16.9080, lng: 145.7460, status: 'online', battery: 91, speed: 0 },
      { lat: -16.9320, lng: 145.7350, status: 'working', battery: 68, speed: 0 },
      { lat: -16.8960, lng: 145.7380, status: 'working', battery: 78, speed: 0 },
      { lat: -16.9400, lng: 145.7600, status: 'online', battery: 65, speed: 0 },
      { lat: -16.9100, lng: 145.7700, status: 'driving', battery: 82, speed: 14 },
      { lat: -16.9500, lng: 145.7450, status: 'idle', battery: 55, speed: 0 },
    ];

    // Fixed number of active members (8) for consistency between dev and production
    const activeCount = Math.min(8, activeMembers.length);

    // Sort by member ID for deterministic ordering
    const sortedMembers = [...activeMembers].sort((a, b) => 
      (a.memberId || '').localeCompare(b.memberId || '')
    );

    for (let i = 0; i < sortedMembers.length; i++) {
      const member = sortedMembers[i];
      if (!member.memberId) continue;

      const location = memberLocations[i % memberLocations.length];
      const isOnline = i < activeCount;

      const activityStatus = isOnline ? location.status : 'offline';

      await storage.upsertTradieStatus({
        userId: member.memberId,
        businessOwnerId: demoUser.id,
        currentLatitude: location.lat.toString(),
        currentLongitude: location.lng.toString(),
        currentAddress: location.status === 'working' ? 'On job site' : undefined,
        activityStatus,
        speed: location.speed.toString(),
        heading: activityStatus === 'driving' ? '180' : undefined,
        lastSeenAt: isOnline ? new Date() : new Date(Date.now() - 30 * 60 * 1000),
        lastLocationUpdate: isOnline ? new Date() : undefined,
        batteryLevel: location.battery,
        isCharging: location.battery > 80,
      });
    }

    console.log(`[DemoRefresh] Updated ${activeCount} active team members`);
  } catch (error) {
    console.error('[DemoRefresh] Error refreshing demo team activity:', error);
  }
}

// ============================================
// PUBLIC "TRY THE DEMO" ACCOUNT (trydemo@)
// ============================================
// trydemo@ holds the same rich data as demo@ but is the account the public demo
// flow actually edits, so demo@ is never touched. It is wiped + reseeded with
// current dates on every demo start and daily (see resetTryDemoData), so every
// visitor / day starts from fresh, non-stale data.

// Module-level lock so concurrent demo starts don't reseed on top of each other.
// All trydemo@ seed/reset operations run through one serialization chain so a
// reset and an ensure (or two resets) can never interleave — interleaving
// deletes + inserts on the same account corrupts the data (partial seed).
let tryDemoChain: Promise<void> = Promise.resolve();
let tryDemoResetInFlight: Promise<void> | null = null;

function serializeTryDemoOp(fn: () => Promise<void>): Promise<void> {
  const next = tryDemoChain.then(fn, fn); // run after prior op regardless of its outcome
  tryDemoChain = next.catch(() => {}); // keep the chain from staying rejected
  return next;
}

// One-time seed: create + fully populate trydemo@ (core data + team + subs).
// No-ops if it already has data.
export async function ensureTryDemoData(): Promise<void> {
  return serializeTryDemoOp(async () => {
    const existing = await storage.getUserByEmail(TRY_DEMO_USER.email);
    if (existing) {
      const clients = await storage.getClients(existing.id);
      if (clients.length > 0) return; // already seeded
    }
    await createDemoUserAndData(TRY_DEMO_USER);
    const tryUser = await storage.getUserByEmail(TRY_DEMO_USER.email);
    if (tryUser) {
      await createDemoTeamMembers(TRY_DEMO_USER);
      await createDemoSubcontractorsAndInviteCodes(TRY_DEMO_USER);
    }
  });
}

// Total refresh: wipe the editable core data then rebuild it with current dates.
// Team/subs are not date-sensitive and are left in place (ensureTryDemoData
// creates them once). Concurrency-guarded via tryDemoResetInFlight.
export async function resetTryDemoData(): Promise<void> {
  // Dedupe: concurrent demo starts share one in-flight reset instead of queueing
  // a separate wipe+reseed each.
  if (tryDemoResetInFlight) return tryDemoResetInFlight;
  tryDemoResetInFlight = serializeTryDemoOp(async () => {
    try {
      const tryUser = await storage.getUserByEmail(TRY_DEMO_USER.email);
      if (!tryUser) {
        // No user yet: do the one-time seed inline (already inside the chain,
        // so don't re-enter ensureTryDemoData which would deadlock the chain).
        await createDemoUserAndData(TRY_DEMO_USER);
        const seeded = await storage.getUserByEmail(TRY_DEMO_USER.email);
        if (seeded) {
          await createDemoTeamMembers(TRY_DEMO_USER);
          await createDemoSubcontractorsAndInviteCodes(TRY_DEMO_USER);
        }
        return;
      }
      console.log('[TryDemo] Resetting public demo data...');
      // Receipts FK to invoices/clients with onDelete:set-null, so they survive
      // the wipe below and would accumulate on every reseed. Delete them first
      // (the reseed always creates a fresh set) to keep the refresh truly total.
      const receipts = await storage.getReceipts(tryUser.id);
      for (const r of receipts) await storage.deleteReceipt(r.id, tryUser.id);
      // Delete editable core data; DB-level cascades clean up all children
      // (line items, job equipment/assignments/time entries, etc.).
      // NOTE: getInvoices/getQuotes/getJobs(id, includeArchived) returns ONLY
      // active rows when false and ONLY archived rows when true, so we must pass
      // BOTH to catch visitor-archived records (deleting clients also cascades
      // these, but we delete explicitly so the refresh never relies on cascade).
      const invoices = [
        ...await storage.getInvoices(tryUser.id, false),
        ...await storage.getInvoices(tryUser.id, true),
      ];
      for (const inv of invoices) await storage.deleteInvoice(inv.id, tryUser.id);
      const quotes = [
        ...await storage.getQuotes(tryUser.id, false),
        ...await storage.getQuotes(tryUser.id, true),
      ];
      for (const q of quotes) await storage.deleteQuote(q.id, tryUser.id);
      const jobs = [
        ...await storage.getJobs(tryUser.id, false),
        ...await storage.getJobs(tryUser.id, true),
      ];
      for (const j of jobs) await storage.deleteJob(j.id, tryUser.id);
      const clients = await storage.getClients(tryUser.id);
      for (const c of clients) await storage.deleteClient(c.id, tryUser.id);

      // Rebuild core with current dates. Idempotent helpers (templates,
      // equipment, safety, SMS) no-op since their data survives the wipe;
      // activity logs + notifications clear-and-reinsert themselves.
      await createDemoUserAndData(TRY_DEMO_USER, { forceReseed: true });
      console.log('[TryDemo] Public demo data reset complete.');
    } catch (err) {
      // Re-throw: a half-finished wipe/reseed leaves trydemo@ partial, so the
      // caller (demo-login / daily scheduler) must know and refuse to serve it.
      console.error('[TryDemo] Reset failed:', getErrorMessage(err));
      throw err;
    } finally {
      tryDemoResetInFlight = null;
    }
  });
  return tryDemoResetInFlight;
}

// Start the demo data refresh scheduler (every 5 minutes)
export function startDemoDataRefreshScheduler() {
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  console.log('[DemoScheduler] Starting demo data refresh scheduler...');
  
  // Initial refresh immediately
  refreshDemoTeamActivity();
  
  // On startup, also refresh demo dates and screenshot data so dashboard shows current jobs
  (async () => {
    try {
      const demoUser = await storage.getUserByEmail(DEMO_USER.email);
      if (demoUser) {
        await refreshDemoDates(demoUser.id);
        await refreshDemoDataForScreenshots();
        console.log('[DemoScheduler] Demo dates and screenshot data refreshed on startup');
      }
    } catch (err) {
      console.warn('[DemoScheduler] Error refreshing demo dates on startup:', err);
    }
  })();
  
  // Then refresh every 5 minutes
  setInterval(() => {
    refreshDemoTeamActivity();
  }, REFRESH_INTERVAL);

  // Daily total refresh of the public "Try the Demo" account so it never goes
  // stale (fresh dates, visitor edits wiped).
  const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(() => {
    resetTryDemoData().catch((err) =>
      console.error('[TryDemo] Daily reset failed:', getErrorMessage(err)),
    );
  }, DAILY_INTERVAL);

  console.log('[DemoScheduler] Demo data refresh scheduler running every 5 minutes');
}

// ============================================
// FORCE RESET: Delete all demo data and recreate
// ============================================
export async function forceResetDemoData(): Promise<{ success: boolean; message: string }> {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) {
      return { success: false, message: 'Demo user not found' };
    }

    console.log('[DemoReset] Force resetting all demo data...');

    // Delete existing data in correct order (foreign key constraints)
    const existingReceipts = await storage.getReceipts(demoUser.id);
    for (const receipt of existingReceipts) {
      await storage.deleteReceipt(receipt.id, demoUser.id);
    }
    
    const existingJobs = await storage.getJobs(demoUser.id);
    for (const job of existingJobs) {
      await storage.deleteJob(job.id, demoUser.id);
    }

    const existingQuotes = await storage.getQuotes(demoUser.id);
    for (const quote of existingQuotes) {
      await storage.deleteQuote(quote.id, demoUser.id);
    }

    const existingInvoices = await storage.getInvoices(demoUser.id);
    for (const invoice of existingInvoices) {
      await storage.deleteInvoice(invoice.id, demoUser.id);
    }

    const existingClients = await storage.getClients(demoUser.id);
    for (const client of existingClients) {
      await storage.deleteClient(client.id, demoUser.id);
    }

    // Also delete existing activity logs
    const deletedLogsCount = await storage.deleteActivityLogs(demoUser.id);
    console.log(`[DemoReset] Deleted ${deletedLogsCount} activity logs`);

    console.log('[DemoReset] Existing demo data deleted, recreating...');

    // Reset counters for deterministic IDs
    resetDemoCounters();
    
    // Now call the main function which will create fresh data since there are no clients
    // This also creates activity logs at the end, so no need to call createDemoActivityLogs separately
    await createDemoUserAndData();

    return { success: true, message: 'Demo data reset complete. All clients, jobs, quotes, invoices, and receipts have been recreated with new IDs.' };
  } catch (error: unknown) {
    console.error('[DemoReset] Error resetting demo data:', error);
    return { success: false, message: getErrorMessage(error) || 'Failed to reset demo data' };
  }
}

// ============================================
// CREATE ACTIVITY LOGS: Generate Recent Activity items from existing data
// ============================================
export async function createDemoActivityLogs(userId: string): Promise<void> {
  try {
    console.log('[DemoActivity] Creating activity logs for Recent Activity...');
    
    // Clean up existing demo activity logs (preserve real delivery logs like email/SMS sends)
    await db.delete(activityLogs).where(
      and(
        eq(activityLogs.userId, userId),
        sql`NOT (
          metadata->>'clientEmail' IS NOT NULL OR 
          metadata->>'recipientEmail' IS NOT NULL OR 
          metadata->>'deliveryMethod' IS NOT NULL OR 
          metadata->>'smsMessageId' IS NOT NULL OR 
          metadata->>'clientPhone' IS NOT NULL OR 
          metadata->>'emailSubject' IS NOT NULL
        )`
      )
    );
    
    // Get recent jobs, quotes, and invoices
    const jobs = await storage.getJobs(userId);
    const quotes = await storage.getQuotes(userId);
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    // Create a client lookup map
    const clientMap = new Map(clients.map(c => [c.id, c]));
    
    const activityItems: Array<{
      userId: string;
      type: string;
      title: string;
      description: string;
      entityType: string;
      entityId: string;
      metadata: any;
      createdAt: Date;
    }> = [];
    
    // Add recent jobs (completed, scheduled, in progress)
    const recentJobs = jobs
      .filter(j => j.status !== 'cancelled')
      .sort((a, b) => {
        const dateA = a.completedAt || a.scheduledAt || a.createdAt;
        const dateB = b.completedAt || b.scheduledAt || b.createdAt;
        return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
      })
      .slice(0, 8);
    
    for (const job of recentJobs) {
      const client = clientMap.get(job.clientId!);
      let type = 'job';
      let title = job.title;
      let eventDate = job.createdAt || new Date();
      
      if (job.status === 'done' || job.status === 'invoiced') {
        type = 'job_completed';
        title = `Job Completed: ${job.title}`;
        eventDate = job.completedAt || job.createdAt || new Date();
      } else if (job.status === 'scheduled') {
        type = 'job_scheduled';
        title = `Job Scheduled: ${job.title}`;
        eventDate = job.scheduledAt || job.createdAt || new Date();
      } else if (job.status === 'in_progress') {
        type = 'job_started';
        title = `Job Started: ${job.title}`;
        eventDate = job.startedAt || job.createdAt || new Date();
      }
      
      activityItems.push({
        userId,
        type,
        title,
        description: client ? `For ${client.name}` : '',
        entityType: 'job',
        entityId: job.id,
        metadata: { clientName: client?.name, status: job.status },
        createdAt: eventDate,
      });
    }
    
    // Add journey activities for invoiced jobs (showing full workflow)
    const invoicedJobsWithJourney = jobs
      .filter(j => j.status === 'invoiced' && j.scheduledAt && j.startedAt && j.completedAt)
      .slice(0, 3); // Just show 3 complete journeys
    
    for (const job of invoicedJobsWithJourney) {
      const client = clientMap.get(job.clientId!);
      
      // Add scheduled activity
      if (job.scheduledAt) {
        activityItems.push({
          userId,
          type: 'job_scheduled',
          title: `Job Scheduled: ${job.title}`,
          description: client ? `For ${client.name}` : '',
          entityType: 'job',
          entityId: job.id,
          metadata: { clientName: client?.name, status: 'scheduled', journey: true },
          createdAt: job.scheduledAt,
        });
      }
      
      // Add started activity
      if (job.startedAt) {
        activityItems.push({
          userId,
          type: 'job_started',
          title: `Job Started: ${job.title}`,
          description: client ? `For ${client.name}` : '',
          entityType: 'job',
          entityId: job.id,
          metadata: { clientName: client?.name, status: 'in_progress', journey: true },
          createdAt: job.startedAt,
        });
      }
      
      // Add completed activity  
      if (job.completedAt) {
        activityItems.push({
          userId,
          type: 'job_completed',
          title: `Job Completed: ${job.title}`,
          description: client ? `For ${client.name}` : '',
          entityType: 'job',
          entityId: job.id,
          metadata: { clientName: client?.name, status: 'done', journey: true },
          createdAt: job.completedAt,
        });
      }
    }
    
    // Add recent quotes
    const recentQuotes = quotes
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6);
    
    for (const quote of recentQuotes) {
      const client = clientMap.get(quote.clientId!);
      let type = 'quote';
      let title = `Quote #${quote.number?.slice(-6) || quote.id.slice(-6)}`;
      let eventDate = quote.createdAt || new Date();
      
      if (quote.status === 'accepted') {
        type = 'quote_accepted';
        title = `Quote Accepted: #${quote.number?.slice(-6) || quote.id.slice(-6)}`;
        eventDate = quote.acceptedAt || quote.createdAt || new Date();
      } else if (quote.status === 'sent') {
        type = 'quote_sent';
        title = `Quote Sent: #${quote.number?.slice(-6) || quote.id.slice(-6)}`;
        eventDate = quote.sentAt || quote.createdAt || new Date();
      }
      
      activityItems.push({
        userId,
        type,
        title,
        description: client ? `To ${client.name} - $${quote.total}` : `$${quote.total}`,
        entityType: 'quote',
        entityId: quote.id,
        metadata: { clientName: client?.name, total: quote.total, status: quote.status, ...(type === 'quote_sent' && client ? { deliveryMethod: 'email', clientEmail: client.email } : {}) },
        createdAt: eventDate,
      });
    }
    
    // Add recent invoices
    const recentInvoices = invoices
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6);
    
    for (const invoice of recentInvoices) {
      const client = clientMap.get(invoice.clientId!);
      let type = 'invoice';
      let title = `Invoice #${invoice.number?.slice(-6) || invoice.id.slice(-6)}`;
      let eventDate = invoice.createdAt || new Date();
      
      if (invoice.status === 'paid') {
        type = 'invoice_paid';
        title = `Invoice Paid: #${invoice.number?.slice(-6) || invoice.id.slice(-6)}`;
        eventDate = invoice.paidAt || invoice.createdAt || new Date();
      } else if (invoice.status === 'sent') {
        type = 'invoice_sent';
        title = `Invoice Sent: #${invoice.number?.slice(-6) || invoice.id.slice(-6)}`;
        eventDate = invoice.sentAt || invoice.createdAt || new Date();
      }
      
      activityItems.push({
        userId,
        type,
        title,
        description: client ? `To ${client.name} - $${invoice.total}` : `$${invoice.total}`,
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: { clientName: client?.name, total: invoice.total, status: invoice.status, ...(type === 'invoice_sent' && client ? { deliveryMethod: 'email', clientEmail: client.email } : {}) },
        createdAt: eventDate,
      });
    }
    
    // Sort by date descending and take the most recent 15
    activityItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const topActivities = activityItems.slice(0, 15);
    
    // Create activity logs
    for (const activity of topActivities) {
      await storage.createActivityLog({
        userId: activity.userId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        entityType: activity.entityType,
        entityId: activity.entityId,
        metadata: activity.metadata,
      });
    }
    
    console.log(`[DemoActivity] Created ${topActivities.length} activity logs for Recent Activity`);
  } catch (error) {
    console.error('[DemoActivity] Error creating activity logs:', error);
  }
}

// CREATE DEMO NOTIFICATIONS: Generate varied notifications for "What You Missed" popup
export async function createDemoNotifications(userId: string): Promise<void> {
  try {
    console.log('[DemoNotifications] Creating diverse notifications for What You Missed...');
    
    // Get recent jobs, quotes, and invoices for realistic notifications
    const jobs = await storage.getJobs(userId);
    const quotes = await storage.getQuotes(userId);
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    // Create a client lookup map
    const clientMap = new Map(clients.map(c => [c.id, c]));
    
    // Delete existing notifications first
    const existingNotifications = await storage.getNotifications(userId);
    for (const n of existingNotifications) {
      await storage.deleteNotification(n.id, userId);
    }
    
    const notifications: Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
      relatedId?: string;
      relatedType?: string;
      priority?: string;
      actionUrl?: string;
      actionLabel?: string;
    }> = [];
    
    // Get a variety of jobs/quotes/invoices for notifications
    const completedJobs = jobs.filter(j => j.status === 'done' || j.status === 'invoiced').slice(0, 3);
    const scheduledJobs = jobs.filter(j => j.status === 'scheduled').slice(0, 2);
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted').slice(0, 2);
    const paidInvoices = invoices.filter(i => i.status === 'paid').slice(0, 3);
    const sentInvoices = invoices.filter(i => i.status === 'sent').slice(0, 1);
    
    // Add job completed notifications
    for (const job of completedJobs) {
      const client = clientMap.get(job.clientId!);
      notifications.push({
        userId,
        type: 'job_completed',
        title: 'Job Completed',
        message: `${job.title} for ${client?.name || 'Client'} has been completed`,
        relatedId: job.id,
        relatedType: 'job',
        priority: 'important',
        actionUrl: `/jobs/${job.id}`,
        actionLabel: 'View Job',
      });
    }
    
    // Add job scheduled notifications
    for (const job of scheduledJobs) {
      const client = clientMap.get(job.clientId!);
      notifications.push({
        userId,
        type: 'job_scheduled',
        title: 'Job Scheduled',
        message: `${job.title} scheduled for ${client?.name || 'Client'}`,
        relatedId: job.id,
        relatedType: 'job',
        priority: 'info',
        actionUrl: `/jobs/${job.id}`,
        actionLabel: 'View Job',
      });
    }
    
    // Add quote accepted notifications
    for (const quote of acceptedQuotes) {
      const client = clientMap.get(quote.clientId!);
      notifications.push({
        userId,
        type: 'quote_accepted',
        title: 'Quote Accepted',
        message: `Quote ${quote.number || quote.id.slice(0,6)} was accepted by ${client?.name || 'Client'}`,
        relatedId: quote.id,
        relatedType: 'quote',
        priority: 'urgent',
        actionUrl: `/quotes/${quote.id}`,
        actionLabel: 'Create Invoice',
      });
    }
    
    // Add payment received notifications
    for (const invoice of paidInvoices) {
      const client = clientMap.get(invoice.clientId!);
      const total = Number(invoice.total) || 0;
      notifications.push({
        userId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `$${total.toFixed(2)} received from ${client?.name || 'Client'}`,
        relatedId: invoice.id,
        relatedType: 'invoice',
        priority: 'urgent',
        actionUrl: `/invoices/${invoice.id}`,
        actionLabel: 'View Invoice',
      });
    }
    
    // Add invoice sent notification
    for (const invoice of sentInvoices) {
      const client = clientMap.get(invoice.clientId!);
      notifications.push({
        userId,
        type: 'invoice_sent',
        title: 'Invoice Sent',
        message: `Invoice ${invoice.number || invoice.id.slice(0,6)} sent to ${client?.name || 'Client'}`,
        relatedId: invoice.id,
        relatedType: 'invoice',
        priority: 'info',
        actionUrl: `/invoices/${invoice.id}`,
        actionLabel: 'View Invoice',
      });
    }
    
    // Shuffle and take top 10 for variety
    const shuffled = notifications.sort(() => Math.random() - 0.5).slice(0, 10);
    
    // Create notifications with staggered timestamps for realistic display
    const now = Date.now();
    const minutesAgoList = [5, 15, 28, 45, 72, 120, 180, 300, 480, 720];
    for (let i = 0; i < shuffled.length; i++) {
      const minutesAgo = minutesAgoList[i] || (i * 60);
      const createdAt = new Date(now - minutesAgo * 60 * 1000);
      await storage.createNotification(shuffled[i], createdAt);
    }
    
    console.log(`[DemoNotifications] Created ${shuffled.length} diverse notifications`);
  } catch (error) {
    console.error('[DemoNotifications] Error creating notifications:', error);
  }
}

// ============================================
// REFRESH FOR SCREENSHOTS: Update dates for App Store screenshots
// ============================================
export async function refreshDemoDataForScreenshots(): Promise<{ success: boolean; message: string; updated: any }> {
  try {
    const demoUser = await storage.getUserByEmail(DEMO_USER.email);
    if (!demoUser) {
      return { success: false, message: 'Demo user not found', updated: {} };
    }

    console.log('[DemoScreenshots] Refreshing demo data for App Store screenshots...');
    
    const jobs = await storage.getJobs(demoUser.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const updated = {
      todaysJobs: 0,
      thisWeekJobs: 0,
      upcomingJobs: 0,
      activityLogs: 0,
    };
    
    // Sort scheduled jobs by ID for consistency
    const scheduledJobs = jobs
      .filter(j => j.status === 'scheduled')
      .sort((a, b) => a.id.localeCompare(b.id));
    
    // Distribute scheduled jobs across today and next 2 weeks
    const scheduleTimes = [
      { day: 0, hour: 9, minute: 0 },   // Today 9:00 AM
      { day: 0, hour: 11, minute: 30 }, // Today 11:30 AM
      { day: 0, hour: 14, minute: 0 },  // Today 2:00 PM
      { day: 1, hour: 10, minute: 0 },  // Tomorrow 10:00 AM
      { day: 1, hour: 14, minute: 30 }, // Tomorrow 2:30 PM
      { day: 2, hour: 9, minute: 0 },   // Day 2
      { day: 3, hour: 11, minute: 0 },  // Day 3
      { day: 4, hour: 9, minute: 30 },  // Day 4
      { day: 7, hour: 10, minute: 0 },  // Next week
      { day: 8, hour: 14, minute: 0 },  // Next week
      { day: 10, hour: 9, minute: 0 },  // Next week
      { day: 14, hour: 11, minute: 30 },// 2 weeks
    ];
    
    for (let i = 0; i < scheduledJobs.length && i < scheduleTimes.length; i++) {
      const job = scheduledJobs[i];
      const slot = scheduleTimes[i];
      
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + slot.day);
      newDate.setHours(slot.hour, slot.minute, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        scheduledAt: newDate,
        scheduledTime: `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`,
      });
      
      if (slot.day === 0) updated.todaysJobs++;
      else if (slot.day <= 7) updated.thisWeekJobs++;
      else updated.upcomingJobs++;
    }
    
    // Update in-progress jobs to have started recently
    const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
    for (let i = 0; i < inProgressJobs.length; i++) {
      const job = inProgressJobs[i];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (i % 3)); // Started 0-2 days ago
      startDate.setHours(8 + (i % 4), 0, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        startedAt: startDate,
        scheduledAt: startDate,
      });
    }
    
    // Update completed/invoiced jobs with complete journey dates (scheduled -> started -> completed -> invoiced)
    const doneJobs = jobs.filter(j => j.status === 'done');
    for (let i = 0; i < doneJobs.length && i < 5; i++) {
      const job = doneJobs[i];
      const daysAgo = i + 1; // 1-5 days ago
      
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() - (daysAgo + 2));
      scheduledDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const startedDate = new Date();
      startedDate.setDate(startedDate.getDate() - (daysAgo + 1));
      startedDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - daysAgo);
      completedDate.setHours(15 + (i % 3), 0, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        scheduledAt: scheduledDate,
        startedAt: startedDate,
        completedAt: completedDate,
      });
    }
    
    // Update invoiced jobs with complete journey including invoice date
    const invoicedJobs = jobs.filter(j => j.status === 'invoiced');
    for (let i = 0; i < invoicedJobs.length && i < 8; i++) {
      const job = invoicedJobs[i];
      const baseDays = (i + 1) * 3; // 3, 6, 9, 12, 15, 18, 21, 24 days ago
      
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() - (baseDays + 3));
      scheduledDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const startedDate = new Date();
      startedDate.setDate(startedDate.getDate() - (baseDays + 2));
      startedDate.setHours(9 + (i % 4), 0, 0, 0);
      
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - (baseDays + 1));
      completedDate.setHours(15 + (i % 3), 0, 0, 0);
      
      const invoicedDate = new Date();
      invoicedDate.setDate(invoicedDate.getDate() - baseDays);
      invoicedDate.setHours(10, 0, 0, 0);
      
      await storage.updateJob(job.id, demoUser.id, {
        scheduledAt: scheduledDate,
        startedAt: startedDate,
        completedAt: completedDate,
        invoicedAt: invoicedDate,
      });
    }
    
    // Recreate activity logs with current dates
    // Delete existing logs first
    const deletedCount = await storage.deleteActivityLogs(demoUser.id);
    console.log(`[DemoScreenshots] Deleted ${deletedCount} existing activity logs`);
    
    // Create fresh activity logs
    await createDemoActivityLogs(demoUser.id);
    updated.activityLogs = 15;
    
    try {
      const { db } = await import('./storage');
      const { swmsDocuments } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const swmsDocs = await db.update(swmsDocuments)
        .set({ status: 'active' })
        .where(eq(swmsDocuments.userId, demoUser.id))
        .returning();
      if (swmsDocs.length > 0) {
        console.log(`[DemoScreenshots] Updated ${swmsDocs.length} SWMS documents to 'active' status`);
      }
    } catch (swmsErr) {
      console.error('[DemoScreenshots] Error updating SWMS status:', swmsErr);
    }

    console.log(`[DemoScreenshots] Updated jobs: ${updated.todaysJobs} today, ${updated.thisWeekJobs} this week, ${updated.upcomingJobs} upcoming`);
    
    return { 
      success: true, 
      message: `Demo data refreshed for screenshots: ${updated.todaysJobs} jobs today, ${updated.thisWeekJobs} this week, ${updated.upcomingJobs} upcoming. Activity logs updated.`,
      updated
    };
  } catch (error: unknown) {
    console.error('[DemoScreenshots] Error refreshing demo data:', error);
    return { success: false, message: getErrorMessage(error) || 'Failed to refresh demo data', updated: {} };
  }
}

// ============================================
// SEED DEMO DATA FOR NEW USERS (Onboarding)
// Creates trade-specific sample data so new users can explore the app with real examples
// ============================================

interface TradeSpecificDemoData {
  clients: Array<{ name: string; email: string; phone: string; address: string }>;
  jobs: Array<{ client: number; title: string; description: string; status: string; address?: string; scheduledAt?: Date }>;
  quotes: Array<{ client: number; job: number; title: string; items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>; status: string; subtotal: number; gst: number; total: number }>;
  invoices: Array<{ client: number; job: number; title: string; items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>; status: string; subtotal: number; gst: number; total: number }>;
}

function getTradeSpecificDemoData(tradeType: string): TradeSpecificDemoData {
  const tradeConfig = tradeCatalog[tradeType];

  const australianClients = [
    { name: 'Sarah Mitchell', email: 'sarah.mitchell@example.com', phone: '+61412345678', address: '15 Sheridan Street, Cairns QLD 4870' },
    { name: 'David Wilson', email: 'david.wilson@example.com', phone: '+61423456789', address: '28 Lake Street, Cairns QLD 4870' },
    { name: 'Emma Thompson', email: 'emma.t@example.com', phone: '+61434567890', address: '7 Esplanade, Cairns QLD 4870' },
    { name: 'James Brown', email: 'james.brown@example.com', phone: '+61445678901', address: '92 Mulgrave Road, Earlville QLD 4870' },
    { name: 'Lisa Chen', email: 'lisa.chen@example.com', phone: '+61456789012', address: '45 Anderson Street, Manunda QLD 4870' },
  ];

  if (!tradeConfig) {
    return getGenericDemoData(australianClients);
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const rateCard = tradeConfig.defaultRateCard || { hourlyRate: 85, calloutFee: 80 };

  const tradeDataMap: Record<string, () => TradeSpecificDemoData> = {
    electrical: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Switchboard Upgrade', description: 'Replace old ceramic fuse board with modern safety switch board. Install RCDs on all circuits.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'LED Downlight Installation', description: 'Supply and install 12x LED downlights in living area and kitchen. Remove existing halogen fittings.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Power Point Installation', description: 'Install 4x double GPOs in home office. Run new circuit from switchboard.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Switchboard Upgrade Quote', items: [
          { description: 'New switchboard with safety switches (RCDs)', quantity: 1, unitPrice: 1200, total: 1200 },
          { description: 'Labour - Licensed electrician', quantity: 6, unitPrice: rateCard.hourlyRate, total: 6 * rateCard.hourlyRate },
          { description: 'Certificate of electrical safety', quantity: 1, unitPrice: 120, total: 120 },
        ], status: 'sent', subtotal: 1890, gst: 189, total: 2079 },
        { client: 1, job: 1, title: 'LED Downlight Installation Quote', items: [
          { description: 'LED Downlight (warm white, dimmable)', quantity: 12, unitPrice: 45, total: 540 },
          { description: 'Wiring and connection labour', quantity: 4, unitPrice: rateCard.hourlyRate, total: 4 * rateCard.hourlyRate },
          { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
        ], status: 'accepted', subtotal: 540 + 4 * rateCard.hourlyRate + rateCard.calloutFee, gst: (540 + 4 * rateCard.hourlyRate + rateCard.calloutFee) * 0.1, total: (540 + 4 * rateCard.hourlyRate + rateCard.calloutFee) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Power Point Installation - Invoice', items: [
          { description: 'Power Point (Double GPO)', quantity: 4, unitPrice: 35, total: 140 },
          { description: 'Cable (2.5mm TPS)', quantity: 25, unitPrice: 4.50, total: 112.50 },
          { description: 'Labour - Licensed electrician', quantity: 3, unitPrice: rateCard.hourlyRate, total: 3 * rateCard.hourlyRate },
          { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
        ], status: 'sent', subtotal: 140 + 112.50 + 3 * rateCard.hourlyRate + rateCard.calloutFee, gst: (140 + 112.50 + 3 * rateCard.hourlyRate + rateCard.calloutFee) * 0.1, total: (140 + 112.50 + 3 * rateCard.hourlyRate + rateCard.calloutFee) * 1.1 },
      ],
    }),
    plumbing: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Hot Water System Replacement', description: 'Remove old electric hot water system and install new 250L Rheem electric unit. Include tempering valve.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Blocked Drain Clearing', description: 'Kitchen sink draining slowly. Inspect with CCTV camera and clear blockage with high pressure jetter.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Bathroom Tap Replacement', description: 'Replace basin and shower mixer taps. Customer has selected Caroma fixtures.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Hot Water System Replacement Quote', items: [
          { description: 'Rheem 250L Electric Hot Water System', quantity: 1, unitPrice: 1350, total: 1350 },
          { description: 'Tempering valve supply and install', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'Labour - Licensed plumber', quantity: 4, unitPrice: rateCard.hourlyRate, total: 4 * rateCard.hourlyRate },
          { description: 'Removal and disposal of old unit', quantity: 1, unitPrice: 150, total: 150 },
        ], status: 'sent', subtotal: 1680 + 4 * rateCard.hourlyRate, gst: (1680 + 4 * rateCard.hourlyRate) * 0.1, total: (1680 + 4 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Drain Clearing Quote', items: [
          { description: 'CCTV drain inspection', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'High pressure drain jetting', quantity: 1, unitPrice: 320, total: 320 },
          { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
        ], status: 'accepted', subtotal: 500 + rateCard.calloutFee, gst: (500 + rateCard.calloutFee) * 0.1, total: (500 + rateCard.calloutFee) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Bathroom Tap Replacement - Invoice', items: [
          { description: 'Mixer Tap (Basin) - Caroma', quantity: 1, unitPrice: 185, total: 185 },
          { description: 'Mixer Tap (Shower) - Caroma', quantity: 1, unitPrice: 220, total: 220 },
          { description: 'Flexi hoses and fittings', quantity: 4, unitPrice: 25, total: 100 },
          { description: 'Labour - Licensed plumber', quantity: 2, unitPrice: rateCard.hourlyRate, total: 2 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 505 + 2 * rateCard.hourlyRate, gst: (505 + 2 * rateCard.hourlyRate) * 0.1, total: (505 + 2 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    building: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Timber Deck Construction', description: 'Build 6m x 4m hardwood deck off rear of house. Include stairs, handrails, and council approval.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Bathroom Renovation', description: 'Strip out and renovate main bathroom. New tiling, vanity, shower screen, and fixtures.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Pergola Installation', description: 'Install 4m x 3m steel frame pergola with polycarbonate roofing in backyard.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Timber Deck Construction Quote', items: [
          { description: 'Merbau decking (24m²)', quantity: 24, unitPrice: 85, total: 2040 },
          { description: 'Timber framing and substructure', quantity: 1, unitPrice: 1200, total: 1200 },
          { description: 'Labour - Builder', quantity: 24, unitPrice: rateCard.hourlyRate, total: 24 * rateCard.hourlyRate },
          { description: 'Council application fee', quantity: 1, unitPrice: 350, total: 350 },
        ], status: 'sent', subtotal: 3590 + 24 * rateCard.hourlyRate, gst: (3590 + 24 * rateCard.hourlyRate) * 0.1, total: (3590 + 24 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Bathroom Renovation Quote', items: [
          { description: 'Bathroom strip-out and demolition', quantity: 1, unitPrice: 800, total: 800 },
          { description: 'Tiling - floor and walls', quantity: 18, unitPrice: 75, total: 1350 },
          { description: 'Vanity, tapware, and fixtures', quantity: 1, unitPrice: 1800, total: 1800 },
          { description: 'Labour - Builder and trades coordination', quantity: 32, unitPrice: rateCard.hourlyRate, total: 32 * rateCard.hourlyRate },
        ], status: 'accepted', subtotal: 3950 + 32 * rateCard.hourlyRate, gst: (3950 + 32 * rateCard.hourlyRate) * 0.1, total: (3950 + 32 * rateCard.hourlyRate) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Pergola Installation - Invoice', items: [
          { description: 'Steel frame pergola (4m x 3m)', quantity: 1, unitPrice: 2200, total: 2200 },
          { description: 'Polycarbonate roofing panels', quantity: 12, unitPrice: 65, total: 780 },
          { description: 'Labour - Builder', quantity: 12, unitPrice: rateCard.hourlyRate, total: 12 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 2980 + 12 * rateCard.hourlyRate, gst: (2980 + 12 * rateCard.hourlyRate) * 0.1, total: (2980 + 12 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    landscaping: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Backyard Lawn Installation', description: 'Remove existing grass, level area, install Sir Walter Buffalo turf (80m²) with irrigation.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Garden Bed Design & Planting', description: 'Design and install 3 garden beds with native tropical plants, mulch, and edging.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Retaining Wall Construction', description: 'Build 8m timber sleeper retaining wall (600mm high) along rear boundary.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Lawn Installation Quote', items: [
          { description: 'Sir Walter Buffalo Turf', quantity: 80, unitPrice: 15, total: 1200 },
          { description: 'Site preparation and levelling', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Garden soil and underlay', quantity: 4, unitPrice: 85, total: 340 },
          { description: 'Labour - Landscaper', quantity: 8, unitPrice: rateCard.hourlyRate, total: 8 * rateCard.hourlyRate },
        ], status: 'sent', subtotal: 1990 + 8 * rateCard.hourlyRate, gst: (1990 + 8 * rateCard.hourlyRate) * 0.1, total: (1990 + 8 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Garden Bed Installation Quote', items: [
          { description: 'Tropical plants (mixed native)', quantity: 25, unitPrice: 18, total: 450 },
          { description: 'Hardwood mulch', quantity: 3, unitPrice: 85, total: 255 },
          { description: 'Garden edging (steel)', quantity: 12, unitPrice: 22, total: 264 },
          { description: 'Labour - Landscaper', quantity: 6, unitPrice: rateCard.hourlyRate, total: 6 * rateCard.hourlyRate },
        ], status: 'accepted', subtotal: 969 + 6 * rateCard.hourlyRate, gst: (969 + 6 * rateCard.hourlyRate) * 0.1, total: (969 + 6 * rateCard.hourlyRate) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Retaining Wall - Invoice', items: [
          { description: 'Hardwood sleepers (200x50)', quantity: 24, unitPrice: 35, total: 840 },
          { description: 'Steel star pickets and brackets', quantity: 8, unitPrice: 28, total: 224 },
          { description: 'Drainage gravel and ag pipe', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'Labour - Landscaper', quantity: 10, unitPrice: rateCard.hourlyRate, total: 10 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 1244 + 10 * rateCard.hourlyRate, gst: (1244 + 10 * rateCard.hourlyRate) * 0.1, total: (1244 + 10 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    painting: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Interior House Repaint', description: 'Full interior repaint of 3-bedroom home. Walls and ceilings in Dulux Wash & Wear.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Exterior House Paint', description: 'Prep and paint exterior of weatherboard home. Includes scraping, priming, and 2 coats.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Feature Wall & Trim', description: 'Paint feature wall in living room (dark accent) and repaint all door frames and skirting boards.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Interior House Repaint Quote', items: [
          { description: 'Dulux Wash & Wear paint (20L)', quantity: 3, unitPrice: 280, total: 840 },
          { description: 'Dulux ceiling paint (10L)', quantity: 2, unitPrice: 145, total: 290 },
          { description: 'Primer/sealer (10L)', quantity: 1, unitPrice: 120, total: 120 },
          { description: 'Labour - Painter', quantity: 32, unitPrice: rateCard.hourlyRate, total: 32 * rateCard.hourlyRate },
        ], status: 'sent', subtotal: 1250 + 32 * rateCard.hourlyRate, gst: (1250 + 32 * rateCard.hourlyRate) * 0.1, total: (1250 + 32 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Exterior House Paint Quote', items: [
          { description: 'Dulux Weathershield (15L)', quantity: 3, unitPrice: 320, total: 960 },
          { description: 'Surface preparation and scraping', quantity: 1, unitPrice: 650, total: 650 },
          { description: 'Scaffolding hire', quantity: 1, unitPrice: 800, total: 800 },
          { description: 'Labour - Painter', quantity: 40, unitPrice: rateCard.hourlyRate, total: 40 * rateCard.hourlyRate },
        ], status: 'accepted', subtotal: 2410 + 40 * rateCard.hourlyRate, gst: (2410 + 40 * rateCard.hourlyRate) * 0.1, total: (2410 + 40 * rateCard.hourlyRate) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Feature Wall & Trim - Invoice', items: [
          { description: 'Dulux Wash & Wear (accent colour)', quantity: 1, unitPrice: 95, total: 95 },
          { description: 'Trim paint (semi-gloss white)', quantity: 1, unitPrice: 85, total: 85 },
          { description: 'Labour - Painter', quantity: 6, unitPrice: rateCard.hourlyRate, total: 6 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 180 + 6 * rateCard.hourlyRate, gst: (180 + 6 * rateCard.hourlyRate) * 0.1, total: (180 + 6 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    hvac: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Split System AC Installation', description: 'Install Daikin 7.1kW split system in master bedroom. Includes bracket, pipe run, and electrical.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'AC System Service', description: 'Full service on ducted AC system. Clean filters, check refrigerant levels, inspect ductwork.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Ducted AC Repair', description: 'Compressor not engaging on Mitsubishi ducted unit. Diagnose fault and repair.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Split System Installation Quote', items: [
          { description: 'Daikin 7.1kW Inverter Split System', quantity: 1, unitPrice: 1850, total: 1850 },
          { description: 'Installation bracket and pipe cover', quantity: 1, unitPrice: 120, total: 120 },
          { description: 'Electrical connection', quantity: 1, unitPrice: 250, total: 250 },
          { description: 'Labour - HVAC technician', quantity: 5, unitPrice: rateCard.hourlyRate, total: 5 * rateCard.hourlyRate },
        ], status: 'sent', subtotal: 2220 + 5 * rateCard.hourlyRate, gst: (2220 + 5 * rateCard.hourlyRate) * 0.1, total: (2220 + 5 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'AC Service Quote', items: [
          { description: 'Ducted AC full service', quantity: 1, unitPrice: 250, total: 250 },
          { description: 'Filter replacement', quantity: 1, unitPrice: 65, total: 65 },
          { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
        ], status: 'accepted', subtotal: 315 + rateCard.calloutFee, gst: (315 + rateCard.calloutFee) * 0.1, total: (315 + rateCard.calloutFee) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Ducted AC Repair - Invoice', items: [
          { description: 'Compressor capacitor replacement', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'Diagnostic and testing', quantity: 1, unitPrice: 150, total: 150 },
          { description: 'Labour - HVAC technician', quantity: 2, unitPrice: rateCard.hourlyRate, total: 2 * rateCard.hourlyRate },
          { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
        ], status: 'sent', subtotal: 330 + 2 * rateCard.hourlyRate + rateCard.calloutFee, gst: (330 + 2 * rateCard.hourlyRate + rateCard.calloutFee) * 0.1, total: (330 + 2 * rateCard.hourlyRate + rateCard.calloutFee) * 1.1 },
      ],
    }),
    roofing: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Roof Leak Repair', description: 'Locate and repair leak above bedroom. Replace damaged ridge capping and re-bed tiles.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Gutter & Fascia Replacement', description: 'Replace 30m of guttering and fascia boards on rear of house. Install new Colorbond gutters.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Roof Restoration', description: 'Full roof restoration - pressure clean, re-point ridge caps, apply 2 coats roof membrane.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Roof Leak Repair Quote', items: [
          { description: 'Ridge capping replacement (3m)', quantity: 3, unitPrice: 45, total: 135 },
          { description: 'Tile replacement', quantity: 6, unitPrice: 15, total: 90 },
          { description: 'Bedding and pointing materials', quantity: 1, unitPrice: 85, total: 85 },
          { description: 'Labour - Roofer', quantity: 4, unitPrice: rateCard.hourlyRate, total: 4 * rateCard.hourlyRate },
        ], status: 'sent', subtotal: 310 + 4 * rateCard.hourlyRate, gst: (310 + 4 * rateCard.hourlyRate) * 0.1, total: (310 + 4 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Gutter & Fascia Replacement Quote', items: [
          { description: 'Colorbond quad gutter (30m)', quantity: 30, unitPrice: 18, total: 540 },
          { description: 'Fascia boards (treated pine)', quantity: 30, unitPrice: 12, total: 360 },
          { description: 'Downpipes and fittings', quantity: 4, unitPrice: 45, total: 180 },
          { description: 'Labour - Roofer', quantity: 12, unitPrice: rateCard.hourlyRate, total: 12 * rateCard.hourlyRate },
        ], status: 'accepted', subtotal: 1080 + 12 * rateCard.hourlyRate, gst: (1080 + 12 * rateCard.hourlyRate) * 0.1, total: (1080 + 12 * rateCard.hourlyRate) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Roof Restoration - Invoice', items: [
          { description: 'Pressure clean entire roof', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Ridge cap re-pointing', quantity: 1, unitPrice: 650, total: 650 },
          { description: 'Roof membrane (2 coats)', quantity: 1, unitPrice: 1200, total: 1200 },
          { description: 'Labour - Roofer', quantity: 16, unitPrice: rateCard.hourlyRate, total: 16 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 2300 + 16 * rateCard.hourlyRate, gst: (2300 + 16 * rateCard.hourlyRate) * 0.1, total: (2300 + 16 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    tiling: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Bathroom Floor Tiling', description: 'Supply and lay 600x600 porcelain tiles on bathroom floor (12m²). Includes waterproofing.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Kitchen Splashback', description: 'Install subway tile splashback behind kitchen bench and cooktop (8m²).', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Outdoor Patio Tiling', description: 'Lay non-slip porcelain tiles on covered patio area (20m²).', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Bathroom Floor Tiling Quote', items: [
          { description: 'Porcelain tiles 600x600 (matt finish)', quantity: 12, unitPrice: 55, total: 660 },
          { description: 'Waterproofing membrane', quantity: 12, unitPrice: 35, total: 420 },
          { description: 'Tile adhesive and grout', quantity: 1, unitPrice: 120, total: 120 },
          { description: 'Labour - Tiler', quantity: 10, unitPrice: rateCard.hourlyRate, total: 10 * rateCard.hourlyRate },
        ], status: 'sent', subtotal: 1200 + 10 * rateCard.hourlyRate, gst: (1200 + 10 * rateCard.hourlyRate) * 0.1, total: (1200 + 10 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Kitchen Splashback Quote', items: [
          { description: 'Subway tiles (white gloss)', quantity: 8, unitPrice: 40, total: 320 },
          { description: 'Tile adhesive and grout', quantity: 1, unitPrice: 65, total: 65 },
          { description: 'Tile trim (aluminium)', quantity: 6, unitPrice: 18, total: 108 },
          { description: 'Labour - Tiler', quantity: 6, unitPrice: rateCard.hourlyRate, total: 6 * rateCard.hourlyRate },
        ], status: 'accepted', subtotal: 493 + 6 * rateCard.hourlyRate, gst: (493 + 6 * rateCard.hourlyRate) * 0.1, total: (493 + 6 * rateCard.hourlyRate) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Outdoor Patio Tiling - Invoice', items: [
          { description: 'Non-slip porcelain tiles (20m²)', quantity: 20, unitPrice: 48, total: 960 },
          { description: 'Outdoor tile adhesive', quantity: 1, unitPrice: 95, total: 95 },
          { description: 'Grout (charcoal)', quantity: 1, unitPrice: 45, total: 45 },
          { description: 'Labour - Tiler', quantity: 12, unitPrice: rateCard.hourlyRate, total: 12 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 1100 + 12 * rateCard.hourlyRate, gst: (1100 + 12 * rateCard.hourlyRate) * 0.1, total: (1100 + 12 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    concreting: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'Driveway Replacement', description: 'Remove existing cracked driveway and pour new 100mm reinforced concrete driveway (45m²).', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Exposed Aggregate Patio', description: 'Pour exposed aggregate concrete patio (25m²) with control joints and sealer.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Garden Path', description: 'Form and pour 15m concrete garden path with brushed finish and step.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'Driveway Replacement Quote', items: [
          { description: 'Demolition and removal of existing driveway', quantity: 1, unitPrice: 800, total: 800 },
          { description: 'Concrete (32MPa, 45m² x 100mm)', quantity: 5, unitPrice: 250, total: 1250 },
          { description: 'Steel mesh reinforcement', quantity: 45, unitPrice: 12, total: 540 },
          { description: 'Labour - Concreter', quantity: 16, unitPrice: rateCard.hourlyRate, total: 16 * rateCard.hourlyRate },
        ], status: 'sent', subtotal: 2590 + 16 * rateCard.hourlyRate, gst: (2590 + 16 * rateCard.hourlyRate) * 0.1, total: (2590 + 16 * rateCard.hourlyRate) * 1.1 },
        { client: 1, job: 1, title: 'Exposed Aggregate Patio Quote', items: [
          { description: 'Exposed aggregate concrete (25m²)', quantity: 3, unitPrice: 320, total: 960 },
          { description: 'Formwork and preparation', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Sealer (2 coats)', quantity: 1, unitPrice: 280, total: 280 },
          { description: 'Labour - Concreter', quantity: 12, unitPrice: rateCard.hourlyRate, total: 12 * rateCard.hourlyRate },
        ], status: 'accepted', subtotal: 1690 + 12 * rateCard.hourlyRate, gst: (1690 + 12 * rateCard.hourlyRate) * 0.1, total: (1690 + 12 * rateCard.hourlyRate) * 1.1 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Garden Path - Invoice', items: [
          { description: 'Concrete (25MPa)', quantity: 1, unitPrice: 250, total: 250 },
          { description: 'Formwork and prep', quantity: 1, unitPrice: 350, total: 350 },
          { description: 'Labour - Concreter', quantity: 6, unitPrice: rateCard.hourlyRate, total: 6 * rateCard.hourlyRate },
        ], status: 'paid', subtotal: 600 + 6 * rateCard.hourlyRate, gst: (600 + 6 * rateCard.hourlyRate) * 0.1, total: (600 + 6 * rateCard.hourlyRate) * 1.1 },
      ],
    }),
    cleaning: () => ({
      clients: australianClients,
      jobs: [
        { client: 0, title: 'End of Lease Clean', description: 'Full bond clean for 3-bedroom rental property. Includes oven, carpets, and windows.', status: 'scheduled', address: australianClients[0].address, scheduledAt: tomorrow },
        { client: 1, title: 'Commercial Office Clean', description: 'Weekly office cleaning - vacuum, mop, bathrooms, kitchen, bins, and desks.', status: 'in_progress', address: australianClients[1].address },
        { client: 2, title: 'Pressure Washing', description: 'Pressure wash driveway, paths, and patio area. Remove moss and stains.', status: 'done', address: australianClients[2].address },
      ],
      quotes: [
        { client: 0, job: 0, title: 'End of Lease Clean Quote', items: [
          { description: 'Full bond clean (3-bed house)', quantity: 1, unitPrice: 450, total: 450 },
          { description: 'Carpet steam cleaning (3 rooms)', quantity: 3, unitPrice: 55, total: 165 },
          { description: 'Oven deep clean', quantity: 1, unitPrice: 85, total: 85 },
          { description: 'Window cleaning (interior & exterior)', quantity: 1, unitPrice: 120, total: 120 },
        ], status: 'sent', subtotal: 820, gst: 82, total: 902 },
        { client: 1, job: 1, title: 'Commercial Office Clean Quote', items: [
          { description: 'Weekly office clean (200m²)', quantity: 4, unitPrice: 180, total: 720 },
          { description: 'Consumables (toilet paper, soap, etc.)', quantity: 1, unitPrice: 65, total: 65 },
        ], status: 'accepted', subtotal: 785, gst: 78.50, total: 863.50 },
      ],
      invoices: [
        { client: 2, job: 2, title: 'Pressure Washing - Invoice', items: [
          { description: 'Pressure wash driveway (40m²)', quantity: 1, unitPrice: 280, total: 280 },
          { description: 'Pressure wash paths and patio', quantity: 1, unitPrice: 180, total: 180 },
          { description: 'Chemical treatment (moss removal)', quantity: 1, unitPrice: 65, total: 65 },
        ], status: 'paid', subtotal: 525, gst: 52.50, total: 577.50 },
      ],
    }),
  };

  const dataGenerator = tradeDataMap[tradeType];
  if (dataGenerator) {
    return dataGenerator();
  }

  if (tradeConfig) {
    return generateFromCatalog(tradeConfig, australianClients, rateCard, tomorrow);
  }

  return getGenericDemoData(australianClients);
}

function generateFromCatalog(
  tradeConfig: any,
  clients: Array<{ name: string; email: string; phone: string; address: string }>,
  rateCard: { hourlyRate: number; calloutFee: number },
  tomorrow: Date
): TradeSpecificDemoData {
  const tradeName = tradeConfig.name || 'Tradie';
  const jobs = (tradeConfig.typicalJobs || ['Service call', 'Repair', 'Installation']).slice(0, 3);
  const materials = (tradeConfig.defaultMaterials || tradeConfig.commonMaterials || []).slice(0, 3);

  const materialItem = materials.length > 0
    ? { description: materials[0].name || 'Materials', quantity: materials[0].defaultQty || 1, unitPrice: materials[0].defaultPrice || 100, total: (materials[0].defaultQty || 1) * (materials[0].defaultPrice || 100) }
    : { description: 'Materials', quantity: 1, unitPrice: 200, total: 200 };

  const q1Items = [
    { description: `Labour - ${tradeName}`, quantity: 4, unitPrice: rateCard.hourlyRate, total: 4 * rateCard.hourlyRate },
    materialItem,
    { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
  ];
  const q1Subtotal = q1Items.reduce((sum, i) => sum + i.total, 0);

  const q2Items = [
    { description: `Labour - ${tradeName}`, quantity: 3, unitPrice: rateCard.hourlyRate, total: 3 * rateCard.hourlyRate },
    { description: 'Materials and supplies', quantity: 1, unitPrice: 150, total: 150 },
  ];
  const q2Subtotal = q2Items.reduce((sum, i) => sum + i.total, 0);

  const inv1Items = [
    { description: `Labour - ${tradeName}`, quantity: 2, unitPrice: rateCard.hourlyRate, total: 2 * rateCard.hourlyRate },
    { description: 'Parts and materials', quantity: 1, unitPrice: 120, total: 120 },
    { description: 'Call-out fee', quantity: 1, unitPrice: rateCard.calloutFee, total: rateCard.calloutFee },
  ];
  const inv1Subtotal = inv1Items.reduce((sum, i) => sum + i.total, 0);

  return {
    clients,
    jobs: [
      { client: 0, title: jobs[0], description: `${jobs[0]} for residential customer. Inspect site and complete work.`, status: 'scheduled', address: clients[0].address, scheduledAt: tomorrow },
      { client: 1, title: jobs[1] || 'Repair Work', description: `${jobs[1] || 'Repair work'} as per customer request.`, status: 'in_progress', address: clients[1].address },
      { client: 2, title: jobs[2] || 'Maintenance', description: `${jobs[2] || 'Maintenance'} work completed.`, status: 'done', address: clients[2].address },
    ],
    quotes: [
      { client: 0, job: 0, title: `${jobs[0]} Quote`, items: q1Items, status: 'sent', subtotal: q1Subtotal, gst: q1Subtotal * 0.1, total: q1Subtotal * 1.1 },
      { client: 1, job: 1, title: `${jobs[1] || 'Repair Work'} Quote`, items: q2Items, status: 'accepted', subtotal: q2Subtotal, gst: q2Subtotal * 0.1, total: q2Subtotal * 1.1 },
    ],
    invoices: [
      { client: 2, job: 2, title: `${jobs[2] || 'Maintenance'} - Invoice`, items: inv1Items, status: 'paid', subtotal: inv1Subtotal, gst: inv1Subtotal * 0.1, total: inv1Subtotal * 1.1 },
    ],
  };
}

function getGenericDemoData(clients: Array<{ name: string; email: string; phone: string; address: string }>): TradeSpecificDemoData {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return {
    clients,
    jobs: [
      { client: 0, title: 'Service Call - Repair', description: 'Customer requested repair work. Inspect and provide assessment.', status: 'scheduled', address: clients[0].address, scheduledAt: tomorrow },
      { client: 1, title: 'New Installation', description: 'Install new equipment as per customer specifications.', status: 'in_progress', address: clients[1].address },
      { client: 2, title: 'Maintenance Visit', description: 'Regular maintenance check and servicing.', status: 'done', address: clients[2].address },
    ],
    quotes: [
      { client: 0, job: 0, title: 'Repair Work Quote', items: [
        { description: 'Labour', quantity: 3, unitPrice: 85, total: 255 },
        { description: 'Materials', quantity: 1, unitPrice: 150, total: 150 },
        { description: 'Call-out fee', quantity: 1, unitPrice: 80, total: 80 },
      ], status: 'sent', subtotal: 485, gst: 48.50, total: 533.50 },
      { client: 1, job: 1, title: 'Installation Quote', items: [
        { description: 'Equipment supply', quantity: 1, unitPrice: 1200, total: 1200 },
        { description: 'Installation labour', quantity: 4, unitPrice: 85, total: 340 },
      ], status: 'accepted', subtotal: 1540, gst: 154, total: 1694 },
    ],
    invoices: [
      { client: 2, job: 2, title: 'Maintenance Visit - Invoice', items: [
        { description: 'Service and inspection', quantity: 1, unitPrice: 180, total: 180 },
        { description: 'Replacement parts', quantity: 1, unitPrice: 95, total: 95 },
        { description: 'Call-out fee', quantity: 1, unitPrice: 80, total: 80 },
      ], status: 'paid', subtotal: 355, gst: 35.50, total: 390.50 },
    ],
  };
}

export async function seedUserDemoData(userId: string, tradeType?: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`[DemoSeed] Seeding demo data for user ${userId} (trade: ${tradeType || 'auto-detect'})...`);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    if (user.hasDemoData) {
      console.log(`[DemoSeed] User ${userId} already has demo data, skipping`);
      return { success: true, message: 'Demo data already exists' };
    }

    const effectiveTradeType = tradeType || user.tradeType || 'general';
    console.log(`[DemoSeed] Using trade type: ${effectiveTradeType}`);

    const demoData = getTradeSpecificDemoData(effectiveTradeType);
    
    const createdClients = [];
    for (const clientData of demoData.clients) {
      const client = await storage.createClient({
        userId,
        ...clientData,
      });
      createdClients.push(client);
    }
    console.log(`[DemoSeed] Created ${createdClients.length} sample clients`);

    const createdJobs = [];
    for (const job of demoData.jobs) {
      const createdJob = await storage.createJob({
        userId,
        clientId: createdClients[job.client].id,
        title: job.title,
        description: job.description,
        address: job.address || createdClients[job.client].address,
        status: job.status as any,
        scheduledAt: job.scheduledAt,
        estimatedDuration: 60,
      });
      createdJobs.push(createdJob);
    }
    console.log(`[DemoSeed] Created ${createdJobs.length} sample jobs`);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const createdQuotes = [];
    for (const quote of demoData.quotes) {
      const createdQuote = await storage.createQuote({
        userId,
        clientId: createdClients[quote.client].id,
        jobId: createdJobs[quote.job]?.id,
        title: quote.title,
        status: quote.status as any,
        subtotal: quote.subtotal.toFixed(2),
        gstAmount: quote.gst.toFixed(2),
        total: quote.total.toFixed(2),
        validUntil,
      });
      createdQuotes.push(createdQuote);
    }
    console.log(`[DemoSeed] Created ${createdQuotes.length} sample quotes`);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const createdInvoices = [];
    for (const invoice of demoData.invoices) {
      const createdInvoice = await storage.createInvoice({
        userId,
        clientId: createdClients[invoice.client].id,
        jobId: createdJobs[invoice.job]?.id,
        title: invoice.title,
        status: invoice.status as any,
        subtotal: invoice.subtotal.toFixed(2),
        gstAmount: invoice.gst.toFixed(2),
        total: invoice.total.toFixed(2),
        dueDate,
      });
      createdInvoices.push(createdInvoice);
    }
    console.log(`[DemoSeed] Created ${createdInvoices.length} sample invoices`);

    const demoDataIds = {
      clients: createdClients.map(c => c.id),
      jobs: createdJobs.map(j => j.id),
      quotes: createdQuotes.map(q => q.id),
      invoices: createdInvoices.map(i => i.id),
    };

    await storage.updateUser(userId, { 
      hasDemoData: true,
      demoDataIds: demoDataIds as any,
    });
    
    console.log(`[DemoSeed] Demo data seeding complete for user ${userId} (trade: ${effectiveTradeType})`);
    console.log(`[DemoSeed] Stored demo IDs: ${JSON.stringify(demoDataIds)}`);
    return { success: true, message: `Sample ${effectiveTradeType} data created successfully! You now have clients, jobs, quotes, and invoices to explore.` };
  } catch (error: unknown) {
    console.error('[DemoSeed] Error seeding demo data:', error);
    return { success: false, message: getErrorMessage(error) || 'Failed to seed demo data' };
  }
}

// ============================================
// CLEAR DEMO DATA FOR USER (Start Fresh)
// Removes ONLY sample data records that were created during onboarding
// Uses stored demo record IDs for precise deletion
// ============================================

interface DemoDataIds {
  clients: string[];
  jobs: string[];
  quotes: string[];
  invoices: string[];
}

export async function clearUserDemoData(userId: string): Promise<{ 
  success: boolean; 
  message: string; 
  deleted: { clients: number; jobs: number; quotes: number; invoices: number };
}> {
  try {
    console.log(`[DemoClear] Clearing demo data for user ${userId}...`);
    
    const user = await storage.getUser(userId);
    if (!user) {
      return { success: false, message: 'User not found', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
    }
    
    if (!user.hasDemoData) {
      console.log(`[DemoClear] User ${userId} has no demo data to clear`);
      return { success: true, message: 'No sample data to clear', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
    }
    
    // Get the stored demo data IDs
    const demoDataIds = user.demoDataIds as DemoDataIds | null;
    
    if (!demoDataIds) {
      console.log(`[DemoClear] User ${userId} has hasDemoData=true but no demoDataIds stored (legacy)`);
      // For legacy users who have hasDemoData but no IDs stored, just mark as cleared
      await storage.updateUser(userId, { hasDemoData: false, demoDataIds: null });
      return { success: true, message: 'Demo data flag cleared (no tracked IDs)', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
    }
    
    console.log(`[DemoClear] Found demo IDs to delete: ${JSON.stringify(demoDataIds)}`);
    
    const deleted = { clients: 0, jobs: 0, quotes: 0, invoices: 0 };
    
    // Delete in order: invoices -> quotes -> jobs -> clients (due to foreign keys)
    // Only delete records that match the stored demo IDs
    for (const invoiceId of demoDataIds.invoices || []) {
      try {
        await storage.deleteInvoice(invoiceId, userId);
        deleted.invoices++;
      } catch (e) {
        console.log(`[DemoClear] Invoice ${invoiceId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.invoices} demo invoices`);
    
    for (const quoteId of demoDataIds.quotes || []) {
      try {
        await storage.deleteQuote(quoteId, userId);
        deleted.quotes++;
      } catch (e) {
        console.log(`[DemoClear] Quote ${quoteId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.quotes} demo quotes`);
    
    for (const jobId of demoDataIds.jobs || []) {
      try {
        await storage.deleteJob(jobId, userId);
        deleted.jobs++;
      } catch (e) {
        console.log(`[DemoClear] Job ${jobId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.jobs} demo jobs`);
    
    for (const clientId of demoDataIds.clients || []) {
      try {
        await storage.deleteClient(clientId, userId);
        deleted.clients++;
      } catch (e) {
        console.log(`[DemoClear] Client ${clientId} already deleted or not found`);
      }
    }
    console.log(`[DemoClear] Deleted ${deleted.clients} demo clients`);
    
    // Mark user as no longer having demo data and clear stored IDs
    await storage.updateUser(userId, { hasDemoData: false, demoDataIds: null });
    
    console.log(`[DemoClear] Demo data cleared for user ${userId}`);
    return { 
      success: true, 
      message: 'Sample data cleared! You now have a fresh start.',
      deleted
    };
  } catch (error: unknown) {
    console.error('[DemoClear] Error clearing demo data:', error);
    return { success: false, message: getErrorMessage(error) || 'Failed to clear demo data', deleted: { clients: 0, jobs: 0, quotes: 0, invoices: 0 } };
  }
}

// Seed safety (SWMS with hazards + signatures) and financials (expenses) so the
// demo's WHS and money areas show real data instead of looking empty.
async function seedDemoSafetyAndExpenses(userId: string) {
  try {
    const allJobs = await storage.getJobs(userId);
    if (allJobs.length === 0) return;
    const teamMembers = await storage.getTeamMembers(userId);
    const activeMembers = teamMembers.filter((m: any) => m.status === 'active');
    const workerName = (m: any) =>
      m?.name || [m?.firstName, m?.lastName].filter(Boolean).join(' ') || 'Crew Member';
    const sig =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // ---- SWMS (idempotent) ----
    const existingSwms = await db
      .select()
      .from(swmsDocuments)
      .where(eq(swmsDocuments.userId, userId));
    if (existingSwms.length === 0) {
      const swmsDefs = [
        {
          title: 'SWMS - Hot Water System Replacement',
          description: 'Safe work method statement for removal and installation of gas/electric hot water systems.',
          workActivityDescription: 'Isolate, drain and remove existing unit; install and commission new hot water system.',
          ppeRequirements: ['Safety glasses', 'Cut-resistant gloves', 'Steel cap boots', 'Hi-vis', 'Hearing protection'],
          emergencyContact: '000 / Site Supervisor 0407 888 123',
          firstAidLocation: 'First aid kit in Ute #1 cab',
          hazards: [
            { stepNumber: 1, activityTask: 'Isolate gas and water supply', hazard: 'Gas leak / scalding from hot water', likelihood: 'possible', consequence: 'major', riskBefore: 'high', controlMeasures: 'Lock-out tag-out, gas detector check, allow unit to cool, drain to safe point', riskAfter: 'low', sortOrder: 1 },
            { stepNumber: 2, activityTask: 'Manual handling of old/new unit', hazard: 'Back/muscle strain, crush injury', likelihood: 'likely', consequence: 'moderate', riskBefore: 'high', controlMeasures: 'Two-person lift, use dolly, clear path, correct lifting technique', riskAfter: 'low', sortOrder: 2 },
            { stepNumber: 3, activityTask: 'Electrical connection', hazard: 'Electric shock', likelihood: 'unlikely', consequence: 'major', riskBefore: 'medium', controlMeasures: 'Licensed electrician, test for dead, RCD protected supply', riskAfter: 'low', sortOrder: 3 },
          ],
        },
        {
          title: 'SWMS - Drain Excavation & Repair',
          description: 'Safe work method statement for trenching and underground drain repair.',
          workActivityDescription: 'Locate services, excavate trench, repair/replace damaged drainage, backfill and reinstate.',
          ppeRequirements: ['Hard hat', 'Safety glasses', 'Hi-vis', 'Steel cap boots', 'Gloves'],
          emergencyContact: '000 / Site Supervisor 0407 888 123',
          firstAidLocation: 'First aid kit in Ute #2 cab',
          hazards: [
            { stepNumber: 1, activityTask: 'Underground service location', hazard: 'Strike live electrical/gas service', likelihood: 'possible', consequence: 'severe', riskBefore: 'high', controlMeasures: 'Dial Before You Dig, cable locator, pothole by hand near services', riskAfter: 'low', sortOrder: 1 },
            { stepNumber: 2, activityTask: 'Trench excavation', hazard: 'Trench collapse / fall into trench', likelihood: 'possible', consequence: 'severe', riskBefore: 'high', controlMeasures: 'Batter/bench walls, shoring for >1.5m, barricade edges, no lone work', riskAfter: 'medium', sortOrder: 2 },
            { stepNumber: 3, activityTask: 'Working in wet conditions', hazard: 'Slips, trips, biological hazard from sewage', likelihood: 'likely', consequence: 'moderate', riskBefore: 'medium', controlMeasures: 'Waterproof gloves, wash stations, vaccinations current, clean footing', riskAfter: 'low', sortOrder: 3 },
          ],
        },
      ];

      for (let i = 0; i < swmsDefs.length; i++) {
        const def = swmsDefs[i];
        const job = allJobs[i % allJobs.length];
        const [doc] = await db
          .insert(swmsDocuments)
          .values({
            userId,
            jobId: job?.id ?? null,
            title: def.title,
            description: def.description,
            siteAddress: (job as any)?.siteAddress || (job as any)?.address || 'Cairns QLD 4870',
            workActivityDescription: def.workActivityDescription,
            ppeRequirements: def.ppeRequirements,
            emergencyContact: def.emergencyContact,
            firstAidLocation: def.firstAidLocation,
            status: 'active',
          })
          .returning();

        for (const hz of def.hazards) {
          await db.insert(swmsHazards).values({ swmsId: doc.id, ...hz });
        }

        // Sign the first SWMS with up to two workers (with GPS) to showcase sign-off.
        if (i === 0) {
          const signers = activeMembers.slice(0, 2);
          if (signers.length === 0) signers.push({ memberId: null, name: 'Jake Morrison' } as any);
          for (const m of signers) {
            await db.insert(swmsSignatures).values({
              swmsId: doc.id,
              workerName: workerName(m),
              workerUserId: (m as any).memberId ?? null,
              signatureData: sig,
              latitude: '-16.9203',
              longitude: '145.7710',
              address: 'Cairns QLD 4870',
            });
          }
        }
      }
      console.log('✅ Demo SWMS seeded (2 docs, hazards + signatures)');
    }

    // ---- Expenses (idempotent) ----
    const existingExpenses = await storage.getExpenses(userId);
    if (existingExpenses.length === 0) {
      const category = await storage.createExpenseCategory({
        userId,
        name: 'Materials & Supplies',
        description: 'Job materials, parts and consumables',
      } as any);
      const fuelCat = await storage.createExpenseCategory({
        userId,
        name: 'Fuel & Vehicle',
        description: 'Fuel, tolls and vehicle running costs',
      } as any);

      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const expenseDefs = [
        { categoryId: category.id, amount: '486.20', gstAmount: '44.20', description: 'Rheem hot water unit 250L', vendor: 'Reece Plumbing', daysAgo: 2 },
        { categoryId: category.id, amount: '128.70', gstAmount: '11.70', description: 'Copper fittings & valves', vendor: 'Tradelink', daysAgo: 4 },
        { categoryId: category.id, amount: '312.40', gstAmount: '28.40', description: 'PVC drainage pipe & couplings', vendor: 'Reece Plumbing', daysAgo: 6 },
        { categoryId: fuelCat.id, amount: '95.50', gstAmount: '8.68', description: 'Diesel - Ute #1', vendor: 'BP Cairns', daysAgo: 1 },
        { categoryId: fuelCat.id, amount: '88.30', gstAmount: '8.03', description: 'Diesel - Ute #2', vendor: 'Caltex', daysAgo: 3 },
      ];
      for (let i = 0; i < expenseDefs.length; i++) {
        const e = expenseDefs[i];
        const job = allJobs[i % allJobs.length];
        await storage.createExpense({
          userId,
          jobId: job?.id ?? null,
          categoryId: e.categoryId,
          amount: e.amount,
          gstAmount: e.gstAmount,
          description: e.description,
          vendor: e.vendor,
          expenseDate: new Date(now - e.daysAgo * day),
          isBillable: true,
          status: 'approved',
        } as any);
      }
      console.log('✅ Demo expenses seeded (5 expenses across 2 categories)');
    }
  } catch (error) {
    console.error('Error seeding demo safety/expenses:', getErrorMessage(error));
  }
}

async function seedDemoEquipment(userId: string) {
  try {
    const existingEquipment = await storage.getEquipment(userId);
    const existingCategories = await storage.getEquipmentCategories(userId);
    const hasCategories = existingCategories.length > 0;
    if (existingEquipment.length > 0 && hasCategories) return;
    if (existingEquipment.length > 0 && !hasCategories) {
      for (const eq of existingEquipment) {
        await storage.deleteEquipment(eq.id, userId);
      }
    }

    const categoryDefs = [
      { name: 'Vehicles', description: 'Utes, trucks, and trailers' },
      { name: 'Power Tools', description: 'Electric and battery-powered tools' },
      { name: 'Heavy Machinery', description: 'Excavators, jetters, and large equipment' },
      { name: 'Diagnostic Equipment', description: 'Cameras, levels, and testing gear' },
    ];

    const catMap: Record<string, string> = {};
    for (const cat of categoryDefs) {
      const created = await storage.createEquipmentCategory({ ...cat, userId });
      catMap[cat.name] = created.id;
    }

    const teamMembers = await storage.getTeamMembers(userId);
    const activeMembers = teamMembers.filter((m: any) => m.status === 'active');

    const equipmentItems = [
      { name: 'Hilux Ute #1', model: 'Toyota Hilux SR5 2024', serialNumber: 'UTE-001', manufacturer: 'Toyota', status: 'active', location: 'On Site', categoryId: catMap['Vehicles'], assignedTo: activeMembers[0]?.memberId },
      { name: 'Excavator - Mini', model: 'Kubota U17-3', serialNumber: 'EXC-003', manufacturer: 'Kubota', status: 'active', location: 'Depot', categoryId: catMap['Heavy Machinery'] },
      { name: 'Pipe Threader', model: 'RIDGID 300 Compact', serialNumber: 'THR-012', manufacturer: 'RIDGID', status: 'active', location: 'Ute #1', categoryId: catMap['Power Tools'], assignedTo: activeMembers[1]?.memberId },
      { name: 'Drain Camera', model: 'RIDGID SeeSnake CS65x', serialNumber: 'CAM-008', manufacturer: 'RIDGID', status: 'active', location: 'Ute #2', categoryId: catMap['Diagnostic Equipment'], assignedTo: activeMembers[2]?.memberId },
      { name: 'Hot Water System Dolly', model: 'Heavy Duty 500kg', serialNumber: 'DOL-002', manufacturer: 'Sydney Trolleys', status: 'active', location: 'Depot' },
      { name: 'Jetter - High Pressure', model: 'Aussie Pumps Commander 3000', serialNumber: 'JET-006', manufacturer: 'Aussie Pumps', status: 'active', location: 'Trailer #1', categoryId: catMap['Heavy Machinery'] },
      { name: 'Hilux Ute #2', model: 'Toyota Hilux Workmate 2023', serialNumber: 'UTE-002', manufacturer: 'Toyota', status: 'active', location: 'On Site', categoryId: catMap['Vehicles'], assignedTo: activeMembers[3]?.memberId },
      { name: 'Generator 7kVA', model: 'Honda EU70is', serialNumber: 'GEN-004', manufacturer: 'Honda', status: 'active', location: 'Depot', categoryId: catMap['Heavy Machinery'] },
      { name: 'Copper Press Tool', model: 'Milwaukee M18 Force Logic', serialNumber: 'PRS-015', manufacturer: 'Milwaukee', status: 'maintenance', location: 'Service Centre', categoryId: catMap['Power Tools'] },
      { name: 'Laser Level', model: 'Dewalt DW089K', serialNumber: 'LSR-009', manufacturer: 'Dewalt', status: 'active', location: 'Ute #1', categoryId: catMap['Diagnostic Equipment'], assignedTo: activeMembers[0]?.memberId },
    ];

    const created: any[] = [];
    for (const eq of equipmentItems) {
      const item = await storage.createEquipment({ ...eq, userId });
      created.push(item);
    }

    const allJobs = await storage.getJobs(userId);
    const todayStr = new Date().toISOString().split('T')[0];
    const activeJobs = allJobs.filter(j => {
      const status = (j.status || '').toLowerCase();
      if (['done', 'completed', 'cancelled', 'archived'].includes(status)) return false;
      if (j.scheduledAt && new Date(j.scheduledAt).toISOString().split('T')[0] === todayStr) return true;
      return status === 'in_progress';
    });

    const assignableEquipment = created.filter(e => e.status === 'active');
    const jobsToAssign = activeJobs.slice(0, Math.min(4, activeJobs.length));
    for (let i = 0; i < jobsToAssign.length && i < assignableEquipment.length; i++) {
      await storage.addJobEquipment({
        jobId: jobsToAssign[i].id,
        equipmentId: assignableEquipment[i].id,
        userId,
        notes: `Assigned for ${jobsToAssign[i].title}`,
      });
      if (i + 4 < assignableEquipment.length) {
        await storage.addJobEquipment({
          jobId: jobsToAssign[i].id,
          equipmentId: assignableEquipment[i + 4].id,
          userId,
        });
      }
    }

    const materialsData = [
      { name: '15mm Copper Pipe', quantity: '20', unit: 'metres', status: 'needed', supplier: 'Reece Plumbing' },
      { name: 'PVC 100mm Drainage Pipe', quantity: '6', unit: 'metres', status: 'ordered', supplier: 'Tradelink' },
      { name: 'Rheem 250L Hot Water Unit', quantity: '1', unit: 'each', status: 'ordered', supplier: 'Reece Plumbing' },
      { name: 'Brazing Rods', quantity: '1', unit: 'pack', status: 'needed', supplier: 'BOC Gas' },
      { name: 'Waterproofing Membrane', quantity: '5', unit: 'sqm', status: 'shipped', supplier: 'Bunnings Trade' },
    ];

    let materialsAdded = 0;
    for (let i = 0; i < Math.min(materialsData.length, jobsToAssign.length); i++) {
      const mat = materialsData[i];
      await storage.createJobMaterial({
        jobId: jobsToAssign[i].id,
        userId,
        name: mat.name,
        quantity: mat.quantity,
        unit: mat.unit,
        status: mat.status,
        supplier: mat.supplier,
      });
      materialsAdded++;
    }
    if (materialsData.length > jobsToAssign.length) {
      for (let i = jobsToAssign.length; i < materialsData.length && jobsToAssign.length > 0; i++) {
        const mat = materialsData[i];
        await storage.createJobMaterial({
          jobId: jobsToAssign[i % jobsToAssign.length].id,
          userId,
          name: mat.name,
          quantity: mat.quantity,
          unit: mat.unit,
          status: mat.status,
          supplier: mat.supplier,
        });
        materialsAdded++;
      }
    }

    console.log(`🔧 Seeded ${created.length} equipment, assigned to ${jobsToAssign.length} jobs, ${materialsAdded} materials added`);
  } catch (error) {
    console.error('[DemoEquipment] Error seeding equipment:', error);
  }
}

async function seedDemoClientTags(userId: string, clients: any[]) {
  try {
    const tagConfigs = [
      { nameMatch: /smith|renovations/i, tags: ['VIP', 'Repeat Customer', 'Residential'], clientType: 'residential', referralSource: 'Referral' },
      { nameMatch: /jones|construction/i, tags: ['Commercial', 'High Value'], clientType: 'commercial', referralSource: 'Website' },
      { nameMatch: /wilson|property|strata/i, tags: ['Strata', 'Maintenance Contract'], clientType: 'strata', referralSource: 'Real Estate Agent' },
      { nameMatch: /brown|insurance/i, tags: ['Insurance Work', 'Urgent'], clientType: 'insurance', referralSource: 'Insurance Company' },
      { nameMatch: /taylor|williams/i, tags: ['Repeat Customer', 'Residential'], clientType: 'residential', referralSource: 'Word of Mouth' },
      { nameMatch: /johnson|davis/i, tags: ['Commercial', 'Government'], clientType: 'government', referralSource: 'Tender' },
      { nameMatch: /garcia|martinez|lee/i, tags: ['New Client'], clientType: 'residential', referralSource: 'Google' },
      { nameMatch: /anderson|thomas/i, tags: ['VIP', 'Commercial', 'High Value'], clientType: 'commercial', referralSource: 'Referral' },
      { nameMatch: /white|harris/i, tags: ['Slow Payer'], clientType: 'residential', referralSource: 'Facebook' },
    ];

    const defaultConfigs = [
      { tags: ['Residential'], clientType: 'residential', referralSource: 'Phone Enquiry' },
      { tags: ['Commercial', 'Repeat Customer'], clientType: 'commercial', referralSource: 'Website' },
      { tags: ['VIP', 'Residential'], clientType: 'residential', referralSource: 'Referral' },
      { tags: ['Strata'], clientType: 'strata', referralSource: 'Real Estate Agent' },
      { tags: ['New Client'], clientType: 'residential', referralSource: 'Google' },
    ];

    let updated = 0;
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      if (Array.isArray(client.tags) && client.tags.length > 0) continue;

      const matched = tagConfigs.find(tc => tc.nameMatch.test(client.name));
      const config = matched ?? defaultConfigs[i % defaultConfigs.length];

      await storage.updateClient(client.id, userId, {
        tags: config.tags,
        clientType: config.clientType,
        referralSource: config.referralSource,
      });
      updated++;
    }

    if (updated > 0) {
      console.log(`🏷️ Seeded tags for ${updated} demo clients`);
    }
  } catch (error) {
    console.error('[DemoTags] Error seeding client tags:', error);
  }
}
