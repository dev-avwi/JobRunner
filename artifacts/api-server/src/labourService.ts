import { storage } from './storage';
import type { TimeEntry, TeamMember, BusinessSettings, JobAssignment, InvoiceLineItem, InsertInvoiceLineItem } from '@workspace/db';

interface LocationStamp {
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  timestamp: Date | null;
}

interface AttendanceRecord {
  workerId: string;
  workerName: string;
  clockIn: LocationStamp;
  clockOut: LocationStamp;
  durationMinutes: number;
  origin: string;
  gpsVerified: boolean;
}

interface LabourLine {
  workerId: string;
  workerName: string;
  hourlyRate: number;
  totalMinutes: number;
  roundedHours: number;
  total: number;
  hideNameOnInvoice: boolean;
  workPeriodStart: Date | null;
  workPeriodEnd: Date | null;
  sessionCount: number;
  attendanceRecords: AttendanceRecord[];
  hasGpsProof: boolean;
}

export interface LabourSummary {
  labourLines: LabourLine[];
  workPeriodStart: Date | null;
  workPeriodEnd: Date | null;
  totalBillableHours: number;
  totalLabourAmount: number;
  gpsVerified: boolean;
  trackingInterruptions: number;
  manualEdits: number;
  locationProof: AttendanceRecord[];
}

function roundMinutes(minutes: number, roundTo: number): number {
  if (roundTo <= 1) return minutes;
  return Math.ceil(minutes / roundTo) * roundTo;
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function buildAttendanceRecord(entry: TimeEntry, workerName: string): AttendanceRecord {
  const hasClockInGps = !!(entry.clockInLatitude && entry.clockInLongitude);
  const hasClockOutGps = !!(entry.clockOutLatitude && entry.clockOutLongitude);
  const isGeofence = entry.origin === 'geofence';

  return {
    workerId: entry.userId,
    workerName,
    clockIn: {
      latitude: entry.clockInLatitude || null,
      longitude: entry.clockInLongitude || null,
      address: entry.clockInAddress || null,
      timestamp: entry.startTime ? new Date(entry.startTime) : null,
    },
    clockOut: {
      latitude: entry.clockOutLatitude || null,
      longitude: entry.clockOutLongitude || null,
      address: entry.clockOutAddress || null,
      timestamp: entry.endTime ? new Date(entry.endTime) : null,
    },
    durationMinutes: entry.duration || 0,
    origin: entry.origin || 'manual',
    gpsVerified: hasClockInGps || hasClockOutGps || isGeofence,
  };
}

export async function generateLabourSummary(
  jobId: string,
  businessOwnerId: string
): Promise<LabourSummary> {
  const [timeEntriesAll, assignments, businessArr] = await Promise.all([
    storage.getTimeEntriesForJob(jobId),
    storage.getJobAssignments(jobId),
    storage.getBusinessSettings(businessOwnerId),
  ]);
  
  const business = businessArr;
  const roundingMinutes = business?.timeRoundingMinutes ?? 5;
  const companyDefaultRate = parseFloat(String(business?.defaultHourlyRate ?? '100'));
  const minimumCalloutHours = parseFloat(String(business?.minimumCalloutHours ?? '0'));
  
  // Breaks are only billed when the business opts in via the "Bill for breaks"
  // setting; otherwise they are excluded from billable labour.
  const billBreaks = !!business?.billBreaks;
  const billableEntries = timeEntriesAll.filter(e => {
    if (e.isBreak) return billBreaks;
    return e.isBillable !== false;
  });
  
  const byWorker = new Map<string, TimeEntry[]>();
  for (const entry of billableEntries) {
    const key = entry.userId;
    if (!byWorker.has(key)) byWorker.set(key, []);
    byWorker.get(key)!.push(entry);
  }
  
  const labourLines: LabourLine[] = [];
  const allAttendance: AttendanceRecord[] = [];
  let overallStart: Date | null = null;
  let overallEnd: Date | null = null;
  
  for (const [workerId, entries] of Array.from(byWorker)) {
    const assignment = assignments.find(a => a.userId === workerId);
    const teamMember = await storage.getTeamMemberByOwnerAndMemberId(businessOwnerId, workerId);
    
    let effectiveRate: number;
    if (assignment?.hourlyRateOverride) {
      effectiveRate = parseFloat(String(assignment.hourlyRateOverride));
    } else if (teamMember?.hourlyRate) {
      effectiveRate = parseFloat(String(teamMember.hourlyRate));
    } else if (entries[0]?.hourlyRate) {
      effectiveRate = parseFloat(String(entries[0].hourlyRate));
    } else {
      effectiveRate = companyDefaultRate;
    }
    
    let totalRawMinutes = 0;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    
    let workerName = 'Worker';
    if (assignment?.displayName) {
      workerName = assignment.displayName;
    } else if (teamMember?.firstName) {
      workerName = [teamMember.firstName, teamMember.lastName].filter(Boolean).join(' ');
    }
    
    const attendanceRecords: AttendanceRecord[] = [];
    
    for (const entry of entries) {
      const mins = entry.duration || 0;
      totalRawMinutes += mins;
      
      const start = new Date(entry.startTime);
      const end = entry.endTime ? new Date(entry.endTime) : start;
      
      if (!periodStart || start < periodStart) periodStart = start;
      if (!periodEnd || end > periodEnd) periodEnd = end;
      if (!overallStart || start < overallStart) overallStart = start;
      if (!overallEnd || end > overallEnd) overallEnd = end;
      
      const record = buildAttendanceRecord(entry, workerName);
      attendanceRecords.push(record);
      allAttendance.push(record);
    }
    
    const roundedMinutes = roundMinutes(totalRawMinutes, roundingMinutes);
    let roundedHours = minutesToHours(roundedMinutes);
    
    if (minimumCalloutHours > 0 && roundedHours < minimumCalloutHours && roundedHours > 0) {
      roundedHours = minimumCalloutHours;
    }
    
    const hasGpsProof = attendanceRecords.some(r => r.gpsVerified);
    
    labourLines.push({
      workerId,
      workerName,
      hourlyRate: effectiveRate,
      totalMinutes: totalRawMinutes,
      roundedHours,
      total: Math.round(roundedHours * effectiveRate * 100) / 100,
      hideNameOnInvoice: assignment?.hideNameOnInvoice ?? false,
      workPeriodStart: periodStart,
      workPeriodEnd: periodEnd,
      sessionCount: entries.length,
      attendanceRecords,
      hasGpsProof,
    });
  }
  
  const totalBillableHours = labourLines.reduce((sum, l) => sum + l.roundedHours, 0);
  const totalLabourAmount = labourLines.reduce((sum, l) => sum + l.total, 0);
  
  return {
    labourLines,
    workPeriodStart: overallStart,
    workPeriodEnd: overallEnd,
    totalBillableHours,
    totalLabourAmount,
    gpsVerified: timeEntriesAll.some(e => e.origin === 'geofence') || allAttendance.some(r => r.gpsVerified),
    trackingInterruptions: 0,
    manualEdits: 0,
    locationProof: allAttendance,
  };
}

export async function generateLabourLineItems(
  jobId: string,
  invoiceId: string,
  businessOwnerId: string
): Promise<InvoiceLineItem[]> {
  const summary = await generateLabourSummary(jobId, businessOwnerId);
  const businessSettings = await storage.getBusinessSettings(businessOwnerId);
  const includeGpsProof = businessSettings?.includeLocationProofOnInvoices !== false;
  
  const existingItems = await storage.getInvoiceLineItems(invoiceId);
  const existingLabourItems = existingItems.filter(item => 
    item.description.startsWith('Labour —') || item.description.startsWith('Labour -')
  );
  for (const item of existingLabourItems) {
    await storage.deleteInvoiceLineItem(item.id);
  }
  
  const maxSortOrder = existingItems
    .filter(item => !existingLabourItems.includes(item))
    .reduce((max, item) => Math.max(max, item.sortOrder || 0), -1);
  
  const createdItems: InvoiceLineItem[] = [];
  
  for (let i = 0; i < summary.labourLines.length; i++) {
    const line = summary.labourLines[i];
    const nameDisplay = line.hideNameOnInvoice ? 'Labour' : `Labour — ${line.workerName}`;
    const gpsTag = includeGpsProof && line.hasGpsProof ? ' [GPS Verified]' : '';
    const description = `${nameDisplay} — $${line.hourlyRate.toFixed(2)}/hr${gpsTag}`;
    
    const item = await storage.createInvoiceLineItem({
      invoiceId,
      description,
      quantity: String(line.roundedHours),
      unitPrice: String(line.hourlyRate),
      total: String(line.total),
      sortOrder: maxSortOrder + 1 + i,
      sourceType: 'labour',
      sourceId: line.workerId,
      rateSnapshot: String(line.hourlyRate),
    });
    
    createdItems.push(item);
  }
  
  return createdItems;
}
