import { db } from "./storage";
import { systemEvents } from "@shared/schema";

export async function logSystemEvent(
  source: 'stripe' | 'twilio' | 'vapi' | 'system',
  severity: 'info' | 'warning' | 'error' | 'critical',
  eventType: string,
  message: string,
  metadata?: Record<string, any>,
  userId?: string
): Promise<void> {
  try {
    await db.insert(systemEvents).values({
      source,
      severity,
      eventType,
      message,
      metadata: metadata || {},
      userId: userId || null,
    });
  } catch (err) {
    console.error('[SystemEvent] Failed to log system event:', err);
  }
}
