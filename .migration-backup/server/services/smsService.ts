/**
 * SMS Service for JobRunner
 * Handles two-way SMS communication with clients via Twilio
 * 
 * Integration: connection:conn_twilio_01KB17KVHYEAGTVK0VVR1H47AA
 */

import { sendSMS, getTwilioPhoneNumber, isTwilioInitialized, smsTemplates } from '../twilioClient';
import { storage } from '../storage';
import type { SmsConversation, SmsMessage, InsertSmsConversation, InsertSmsMessage, BusinessSettings } from '@shared/schema';
import { broadcastSmsNotification } from '../websocket';
import { detectSmsJobIntent } from '../ai';
import { notifySmsReceived } from '../notifications';
import { notifySmsReceived as notifySmsReceivedPush } from '../pushNotifications';
import { logger } from '../logger';

interface SendSmsOptions {
  businessOwnerId: string;
  clientId?: string;
  clientPhone: string;
  clientName?: string;
  jobId?: string;
  message: string;
  senderUserId: string;
  isQuickAction?: boolean;
  quickActionType?: string;
  mediaUrls?: string[]; // MMS media URLs (max 10, each up to 5MB)
}

interface QuickActionOptions {
  conversationId: string;
  senderUserId: string;
  actionType: 'on_my_way' | 'just_arrived' | 'job_finished' | 'running_late' | 'need_materials';
  jobTitle?: string;
  businessName?: string;
  estimatedTime?: string;
  includeTrackingLink?: boolean;
  trackingLinkUrl?: string;
  businessPhone?: string;
  senderPhone?: string;
}

/**
 * Format Australian phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\s+/g, '').replace(/^0/, '+61');
  if (!formatted.startsWith('+')) {
    formatted = '+61' + formatted.replace(/^61/, '');
  }
  return formatted;
}

/**
 * Get or create an SMS conversation
 */
export async function getOrCreateConversation(options: {
  businessOwnerId: string;
  clientId?: string;
  clientPhone: string;
  clientName?: string;
  jobId?: string;
}): Promise<SmsConversation> {
  const formattedPhone = formatPhoneNumber(options.clientPhone);
  
  if (options.jobId) {
    const allConvos = await storage.getSmsConversationsByJobIds([options.jobId]);
    const jobConvo = allConvos.find(c => c.jobId === options.jobId && c.clientPhone === formattedPhone);
    if (jobConvo) return jobConvo;
    
    const newConvo = await storage.createSmsConversation({
      businessOwnerId: options.businessOwnerId,
      clientId: options.clientId || null,
      clientPhone: formattedPhone,
      clientName: options.clientName || null,
      jobId: options.jobId,
      lastMessageAt: new Date(),
      unreadCount: 0,
      isArchived: false,
      deletedAt: null,
    });
    return newConvo;
  }
  
  let conversation = await storage.getSmsConversationByPhone(
    options.businessOwnerId,
    formattedPhone
  );
  
  if (!conversation) {
    conversation = await storage.createSmsConversation({
      businessOwnerId: options.businessOwnerId,
      clientId: options.clientId || null,
      clientPhone: formattedPhone,
      clientName: options.clientName || null,
      jobId: null,
      lastMessageAt: new Date(),
      unreadCount: 0,
      isArchived: false,
      deletedAt: null,
    });
  }
  
  return conversation;
}

/**
 * Look up the registered alphanumeric sender ID for a business owner
 */
export async function getAlphanumericSenderId(businessOwnerId?: string): Promise<string | undefined> {
  if (!businessOwnerId) return undefined;
  try {
    const settings = await storage.getBusinessSettings(businessOwnerId);
    return settings?.twilioSenderId || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send a customer-facing auto-reply SMS using the correct sender for the business.
 * Uses dedicated number if available, otherwise shared platform number. Never alphanumeric.
 */
export async function sendCustomerReply(
  to: string,
  message: string,
  businessOwnerId: string
): Promise<{ success: boolean; messageId?: string; error?: string; simulated?: boolean; notConfigured?: boolean }> {
  return sendSmsPlatform(to, message, undefined, businessOwnerId);
}

/**
 * Send SMS via the platform Twilio account
 * Uses the business's dedicated number if configured, otherwise shared platform number
 */
async function sendSmsPlatform(
  to: string,
  message: string,
  mediaUrls?: string[],
  businessOwnerId?: string
): Promise<{ success: boolean; messageId?: string; error?: string; simulated?: boolean; notConfigured?: boolean }> {
  const formattedTo = formatPhoneNumber(to);
  const validMediaUrls = mediaUrls?.slice(0, 10) || [];

  // Business SMS must ALWAYS come from the business's own dedicated number.
  // The shared platform number is never used as a sender for business messaging:
  // multiple businesses texting the same customer from one number is confusing
  // and looks unprofessional. Businesses without a number must purchase one.
  let fromNumber: string | undefined;
  let alphanumericSenderId: string | undefined;
  if (!businessOwnerId) {
    console.error(`[SMS] Refusing to send business SMS without a businessOwnerId (shared platform number is not allowed as sender)`);
    return {
      success: false,
      notConfigured: true,
      error: 'No business phone number configured. Purchase a dedicated number to send SMS.',
    };
  }
  try {
    const settings = await storage.getBusinessSettings(businessOwnerId);
    if (settings?.dedicatedPhoneNumber) {
      fromNumber = settings.dedicatedPhoneNumber;
      console.log(`[SMS] Using dedicated number ${fromNumber} for business owner ${businessOwnerId}`);
    } else {
      console.warn(`[SMS] Business owner ${businessOwnerId} has no dedicated number - refusing to send from shared platform number`);
      return {
        success: false,
        notConfigured: true,
        error: 'No business phone number configured. Purchase a dedicated number to send SMS.',
      };
    }
  } catch (err) {
    console.error(`[SMS] Error fetching business settings for ${businessOwnerId}:`, err);
    return {
      success: false,
      error: 'Could not verify business phone number. Please try again.',
    };
  }

  return sendSMS({
    to: formattedTo,
    message,
    mediaUrls: validMediaUrls.length > 0 ? validMediaUrls : undefined,
    fromNumber,
    alphanumericSenderId,
  });
}

/**
 * Send an SMS/MMS message to a client
 */
export async function sendSmsToClient(options: SendSmsOptions): Promise<SmsMessage> {
  const conversation = await getOrCreateConversation({
    businessOwnerId: options.businessOwnerId,
    clientId: options.clientId,
    clientPhone: options.clientPhone,
    clientName: options.clientName,
    jobId: options.jobId,
  });
  
  const validMediaUrls = options.mediaUrls?.slice(0, 10) || [];
  
  let brandedMessage = options.message;
  try {
    const settings = await storage.getBusinessSettings(options.businessOwnerId);
    const businessName = settings?.businessName;
    if (businessName) {
      const existingMessages = await storage.getSmsMessages(conversation.id);
      const hasOutboundMessage = existingMessages.some(m => m.direction === 'outbound');
      
      if (!hasOutboundMessage) {
        if (options.isQuickAction) {
          brandedMessage = `${businessName} via JobRunner: ${options.message}`;
        } else {
          brandedMessage = `${businessName} via JobRunner: ${options.message}`;
        }
      }
    }

    // Sender attribution: when a team member (non-owner) sends from the shared
    // business number, optionally prepend "From [Name]: " so the client knows
    // which person on the team they're chatting with. Owner-sent messages stay
    // as-is. Controlled by businessSettings.smsSenderAttribution.
    const attributionMode = (settings as any)?.smsSenderAttribution || 'off';
    if (
      attributionMode === 'name_prefix' &&
      options.senderUserId &&
      options.senderUserId !== options.businessOwnerId
    ) {
      const sender = await storage.getUser(options.senderUserId);
      const displayName =
        (sender as any)?.firstName ||
        (sender as any)?.name ||
        (sender as any)?.username ||
        null;
      // Resolve the sender's role within this business (e.g. "Plumber",
      // "Manager") so the client knows who and in what capacity is texting.
      let roleName: string | null = null;
      try {
        const member = await storage.getTeamMemberByUserIdAndBusiness(
          options.senderUserId,
          options.businessOwnerId,
        );
        if (member?.roleId) {
          const role = await storage.getUserRole(member.roleId);
          roleName = (role as any)?.name || null;
        }
      } catch {}
      if (displayName) {
        const prefix = roleName
          ? `${displayName} (${roleName}): `
          : `${displayName}: `;
        if (!brandedMessage.toLowerCase().startsWith(prefix.toLowerCase())) {
          brandedMessage = `${prefix}${brandedMessage}`;
        }
      }
    }
  } catch {
  }
  
  const message = await storage.createSmsMessage({
    conversationId: conversation.id,
    direction: 'outbound',
    body: options.message,
    senderUserId: options.senderUserId,
    status: 'pending',
    isQuickAction: options.isQuickAction || false,
    quickActionType: options.quickActionType || null,
    mediaUrls: validMediaUrls,
    readAt: null,
    twilioSid: null,
    errorMessage: null,
  });
  
  const result = await sendSmsPlatform(
    conversation.clientPhone,
    brandedMessage,
    validMediaUrls.length > 0 ? validMediaUrls : undefined,
    options.businessOwnerId
  );
  
  const updateData: any = {
    status: result.success ? 'sent' : 'failed',
    twilioSid: result.messageId || null,
    errorMessage: result.error || null,
  };

  if (!result.success && !result.notConfigured) {
    const { scheduleRetry } = await import('../retryScheduler');
    updateData.retryCount = 0;
    updateData.nextRetryAt = scheduleRetry(0);
  }

  const updatedMessage = await storage.updateSmsMessage(message.id, updateData);
  
  await storage.updateSmsConversation(conversation.id, {
    lastMessageAt: new Date(),
  });
  
  return updatedMessage;
}

/**
 * Send a quick action SMS
 */
export async function sendQuickAction(options: QuickActionOptions): Promise<SmsMessage> {
  const conversation = await storage.getSmsConversation(options.conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  let message = '';
  const businessName = options.businessName || 'Your tradie';
  const jobTitle = options.jobTitle || 'your job';
  
  switch (options.actionType) {
    case 'on_my_way':
      message = `Hi! ${businessName} here. I'm on my way to ${jobTitle}. ${options.estimatedTime ? `ETA: ${options.estimatedTime}` : 'See you soon!'}`;
      if (options.includeTrackingLink && options.trackingLinkUrl) {
        message += ` Track my arrival: ${options.trackingLinkUrl}`;
      }
      message += ` (${timeString})`;
      break;
    case 'just_arrived':
      message = `Hi! ${businessName} has just arrived for ${jobTitle}. (${timeString})`;
      break;
    case 'job_finished':
      message = `Hi! ${businessName} has finished work on ${jobTitle}. Thanks for having us! (${timeString})`;
      break;
    case 'running_late':
      message = `Hi! ${businessName} here. Running a bit late for ${jobTitle}. ${options.estimatedTime ? `New ETA: ${options.estimatedTime}` : 'Apologies for the delay.'} (${timeString})`;
      break;
    case 'need_materials':
      message = `Hi! ${businessName} here. Need to pick up some materials for ${jobTitle}. Will be back shortly. (${timeString})`;
      break;
    default:
      throw new Error('Invalid quick action type');
  }
  
  const contactPhone = options.senderPhone || options.businessPhone;
  if (contactPhone) {
    message += `\nCall: ${contactPhone}`;
  }
  
  return sendSmsToClient({
    businessOwnerId: conversation.businessOwnerId,
    clientId: conversation.clientId || undefined,
    clientPhone: conversation.clientPhone,
    clientName: conversation.clientName || undefined,
    jobId: conversation.jobId || undefined,
    message,
    senderUserId: options.senderUserId,
    isQuickAction: true,
    quickActionType: options.actionType,
  });
}

/**
 * Check if incoming SMS is a quote acceptance and process it
 * Detects: YES, ACCEPT, APPROVED, OK, CONFIRM, GO AHEAD, etc.
 * Returns auto-acceptance result with confirmation sent
 */
async function checkAndProcessQuoteAcceptance(
  messageBody: string,
  clientPhone: string,
  conversation: SmsConversation
): Promise<{ processed: boolean; quoteId?: string; message?: string }> {
  // Normalize the message for matching (exact match only)
  const normalized = messageBody.trim().toUpperCase();
  
  // First check for rejection/negation keywords using word boundaries
  const rejectionPattern = /\b(NOT|CAN'?T|WON'?T|DON'?T|CANNOT|DECLINE|REJECT|NOPE|NAH)\b/i;
  if (rejectionPattern.test(normalized) || normalized === 'NO') {
    return { processed: false };
  }
  
  // Keywords that indicate acceptance - EXACT MATCH ONLY (no substring matching)
  const acceptKeywords = ['YES', 'YEP', 'YEAH', 'YUP', 'Y', 'ACCEPT', 'ACCEPTED', 
    'APPROVED', 'APPROVE', 'OK', 'OKAY', 'CONFIRM', 'CONFIRMED',
    'GO AHEAD', 'SOUNDS GOOD', 'LOOKS GOOD', 'PROCEED', 'AGREED', 'DEAL', 'DONE'];
  
  // Check for explicit quote number in message (e.g., "ACCEPT 1234", "YES Q-1234", "ACCEPT #1234")
  const quoteNumberMatch = normalized.match(/(?:ACCEPT|YES|APPROVE|CONFIRM)\s*#?([A-Z]*-?\d+)/);
  const specifiedQuoteNumber = quoteNumberMatch ? quoteNumberMatch[1] : null;
  
  // Check for EXACT acceptance match (with optional quote number or punctuation)
  const isExactAcceptance = acceptKeywords.some(keyword => 
    normalized === keyword || 
    normalized === keyword + '!' ||
    normalized === keyword + '.' ||
    // Support "YES 1234" or "ACCEPT Q-1234" format
    (specifiedQuoteNumber && normalized.startsWith(keyword))
  );
  
  if (!isExactAcceptance) {
    return { processed: false };
  }
  
  // Check if there's a recent quote SMS sent to this client
  if (!conversation.clientId) {
    console.log('[SMS Quote Accept] No client linked to conversation');
    return { processed: false };
  }
  
  try {
    // Check if we recently sent a quote SMS to this conversation (within 72 hours)
    const messages = await storage.getSmsMessages(conversation.id);
    const recentQuoteMessage = messages.find(m => {
      if (m.direction !== 'outbound') return false;
      const msgAge = Date.now() - new Date(m.createdAt ?? 0).getTime();
      const is72Hours = msgAge < 72 * 60 * 60 * 1000;
      const isQuoteMessage = m.body?.toLowerCase().includes('quote') && 
                             (m.body?.toLowerCase().includes('ready') || m.body?.toLowerCase().includes('reply yes'));
      return is72Hours && isQuoteMessage;
    });
    
    if (!recentQuoteMessage) {
      console.log('[SMS Quote Accept] No recent quote SMS found in conversation');
      return { processed: false };
    }
    
    // Get quotes for this client - ONLY 'sent' status (not drafts, accepted, or rejected)
    const quotes = await storage.getQuotesByClient(conversation.clientId);
    const sentQuotes = quotes.filter(q => q.status === 'sent');
    
    if (sentQuotes.length === 0) {
      console.log('[SMS Quote Accept] No sent quotes found for client');
      return { processed: false };
    }
    
    let targetQuote = null;
    const now = new Date();
    
    // If client specified a quote number, find that exact quote
    if (specifiedQuoteNumber) {
      targetQuote = sentQuotes.find(q => 
        q.number?.toUpperCase() === specifiedQuoteNumber ||
        q.number?.toUpperCase().endsWith(specifiedQuoteNumber)
      );
      
      if (!targetQuote) {
        console.log(`[SMS Quote Accept] Specified quote ${specifiedQuoteNumber} not found`);
        const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
        const businessName = businessSettings?.businessName || 'Your tradie';
        await sendCustomerReply(
          clientPhone,
          `Quote #${specifiedQuoteNumber} wasn't found. Available quotes: ${sentQuotes.map(q => q.number).join(', ')}. - ${businessName}`,
          conversation.businessOwnerId
        );
        return { processed: false };
      }
    } else if (sentQuotes.length > 1) {
      // Multiple quotes but no number specified - require clarification
      console.log('[SMS Quote Accept] Multiple quotes pending - asking for clarification');
      const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      const quoteList = sentQuotes.map(q => `#${q.number}`).join(', ');
      await sendCustomerReply(
        clientPhone,
        `Thanks! You have multiple pending quotes (${quoteList}). Please reply with "Accept" followed by the quote number, e.g., "Accept ${sentQuotes[0].number}". - ${businessName}`,
        conversation.businessOwnerId
      );
      return { processed: false };
    } else {
      // Only one quote - select it
      targetQuote = sentQuotes[0];
    }
    
    // Validate the target quote
    const latestQuote = targetQuote;
    
    // Check quote validity - must be within valid period
    if (latestQuote.validUntil && new Date(latestQuote.validUntil) < now) {
      console.log('[SMS Quote Accept] Quote has expired (validUntil passed)');
      const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      await sendCustomerReply(
        clientPhone,
        `Sorry, quote #${latestQuote.number} has expired. Please contact ${businessName} for an updated quote.`,
        conversation.businessOwnerId
      );
      return { processed: false };
    }
    
    // Check if quote was sent recently (within 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sentDate = latestQuote.sentAt ? new Date(latestQuote.sentAt) : new Date(latestQuote.createdAt ?? 0);
    
    if (sentDate < sevenDaysAgo) {
      console.log('[SMS Quote Accept] Quote was sent more than 7 days ago');
      return { processed: false };
    }
    
    // Get client name for acceptance record
    const client = await storage.getClient(conversation.clientId, conversation.businessOwnerId);
    const clientName = client?.name || 'Client';
    
    // Re-check quote status right before accepting (optimistic concurrency guard)
    const freshQuote = await storage.getQuote(latestQuote.id, conversation.businessOwnerId);
    if (!freshQuote || freshQuote.status !== 'sent') {
      console.log(`[SMS Quote Accept] Quote ${latestQuote.number} status changed since check (now: ${freshQuote?.status})`);
      const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      const statusMessage = freshQuote?.status === 'accepted' 
        ? `Quote #${latestQuote.number} has already been accepted.` 
        : `Quote #${latestQuote.number} is no longer available.`;
      await sendCustomerReply(clientPhone, `${statusMessage} - ${businessName}`, conversation.businessOwnerId);
      return { processed: false };
    }
    
    // Accept the quote (status verified as 'sent')
    await storage.updateQuote(latestQuote.id, conversation.businessOwnerId, {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedBy: `${clientName} (via SMS)`,
    });
    
    console.log(`[SMS Quote Accept] Quote ${latestQuote.number} accepted via SMS by ${clientName}`);
    
    // Send confirmation SMS
    const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
    const businessName = businessSettings?.businessName || 'Your tradie';
    const total = parseFloat(latestQuote.total || '0').toFixed(2);
    
    const confirmationMessage = `Thanks ${clientName}! Your quote #${latestQuote.number} for $${total} is now ACCEPTED. We'll be in touch soon to schedule the work. - ${businessName}`;
    
    // Send confirmation via platform (dedicated number or shared)
    await sendCustomerReply(clientPhone, confirmationMessage, conversation.businessOwnerId);
    
    // Create outbound confirmation message in conversation
    await storage.createSmsMessage({
      conversationId: conversation.id,
      direction: 'outbound',
      body: confirmationMessage,
      senderUserId: null, // System generated
      status: 'sent',
      twilioSid: null,
      isQuickAction: false,
      quickActionType: null,
      mediaUrls: [],
      isJobRequest: false,
      intentConfidence: null,
      intentType: null,
      suggestedJobTitle: null,
      suggestedDescription: null,
      jobCreatedFromSms: null,
      readAt: null,
      errorMessage: null,
    });
    
    // Broadcast notification to tradie about quote acceptance
    broadcastSmsNotification(conversation.businessOwnerId, {
      conversationId: conversation.id,
      senderPhone: clientPhone,
      senderName: clientName,
      messagePreview: `Quote #${latestQuote.number} ACCEPTED via SMS reply!`,
      jobId: conversation.jobId,
      unreadCount: (conversation.unreadCount || 0) + 1,
      isQuoteAcceptance: true,
      quoteId: latestQuote.id,
    });
    
    return { 
      processed: true, 
      quoteId: latestQuote.id,
      message: `Quote ${latestQuote.number} accepted via SMS` 
    };
    
  } catch (error: unknown) {
    console.error('[SMS Quote Accept] Error processing acceptance:', error);
    return { processed: false };
  }
}

/**
 * Check active jobs for a client in a business and optionally send job selection menu.
 * Returns the target conversation (possibly updated with jobId) and whether a menu was sent.
 */
async function checkAndRouteJobs(
  targetConversation: SmsConversation,
  clientId: string,
  businessOwnerId: string,
  formattedFromPhone: string
): Promise<{ conversation: SmsConversation; pendingJob: boolean }> {
  const activeJobs = await storage.getJobsByClientAndBusiness(clientId, businessOwnerId);
  const relevantJobs = activeJobs.filter(j => !['completed', 'cancelled', 'archived'].includes(j.status || ''));

  if (relevantJobs.length > 1) {
    const now = new Date();
    const lastPrompt = targetConversation.lastRoutingPromptAt ? new Date(targetConversation.lastRoutingPromptAt) : null;
    const rateLimited = lastPrompt && (now.getTime() - lastPrompt.getTime()) < 5 * 60 * 1000;

    if (!rateLimited) {
      const jobOptions = relevantJobs.map((j) => ({
        id: j.id,
        label: `${j.title}${j.address ? ' (' + j.address.substring(0, 30) + ')' : ''}`,
      }));
      const menuLines = jobOptions.map((opt, i) => `${i + 1}. ${opt.label}`);
      const menuText = `Which job is this about? Reply with a number:\n${menuLines.join('\n')}`;
      await sendCustomerReply(formattedFromPhone, menuText, businessOwnerId);
      await storage.updateSmsConversationRoutingState(targetConversation.id, 'pending_job', jobOptions);
      console.log(`[SMS Routing] Sent job selection menu to ${formattedFromPhone} (${relevantJobs.length} active jobs)`);
    }
    return { conversation: targetConversation, pendingJob: true };
  } else if (relevantJobs.length === 1) {
    const updated = await storage.updateSmsConversation(targetConversation.id, { jobId: relevantJobs[0].id });
    await storage.updateSmsConversationRoutingState(targetConversation.id, 'resolved');
    return { conversation: updated, pendingJob: false };
  }

  await storage.updateSmsConversationRoutingState(targetConversation.id, 'resolved');
  return { conversation: targetConversation, pendingJob: false };
}

/**
 * Get all recipients who should be notified about an SMS on a job
 * Includes: business owner, job manager (if exists), assigned workers
 */
async function getJobSmsRecipients(jobId: string, businessOwnerId: string): Promise<string[]> {
  const recipients = new Set<string>();
  recipients.add(businessOwnerId);

  try {
    const job = await storage.getJob(jobId, businessOwnerId);
    if (job) {
      if ((job as any).managerId) {
        recipients.add((job as any).managerId);
      }
    }

    const assignments = await storage.getJobAssignments(jobId);
    if (assignments) {
      for (const assignment of assignments) {
        if (assignment.userId) {
          recipients.add(assignment.userId);
        }
      }
    }
  } catch (err) {
    console.error('[SMS] Error getting job recipients:', err);
  }

  return Array.from(recipients);
}

/**
 * Handle incoming SMS/MMS from Twilio webhook
 * 
 * Smart routing with disambiguation for shared Twilio number across multiple businesses.
 * Uses a state machine approach (routingState) to handle multi-business and multi-job scenarios.
 * 
 * Routing priority:
 * 1. Check for pending disambiguation replies (pending_business / pending_job)
 * 2. Match phone to clients across all businesses
 * 3. For single match: auto-route; for multiple: disambiguate via SMS menu
 * 4. Unknown callers: single business = assign; multiple = inform
 * 
 * MMS support: Extracts media URLs from Twilio webhook (MediaUrl0, MediaUrl1, etc.)
 */
export async function handleIncomingSms(
  fromPhone: string,
  toPhone: string,
  body: string,
  twilioSid: string,
  mediaUrls?: string[]
): Promise<SmsMessage | null> {
  const formattedFromPhone = formatPhoneNumber(fromPhone);
  const formattedToPhone = formatPhoneNumber(toPhone);

  let isNewConversation = false;
  let isUnknownCaller = false;
  let targetConversation: SmsConversation | null = null;

  // ── Step 0: Check if this message arrived on a dedicated AI Receptionist number ──
  // If so, route directly to that business — no disambiguation needed
  let dedicatedBusinessOwnerId: string | null = null;
  try {
    const allBusinessSettings = await storage.getAllBusinessSettings();
    const dedicatedBusiness = allBusinessSettings.find(
      bs => bs.dedicatedPhoneNumber && formatPhoneNumber(bs.dedicatedPhoneNumber) === formattedToPhone
    );
    if (dedicatedBusiness) {
      dedicatedBusinessOwnerId = dedicatedBusiness.userId;
      console.log(`[SMS] Message received on dedicated number ${formattedToPhone} → routing to business ${dedicatedBusiness.businessName || dedicatedBusiness.userId}`);
    }
  } catch (err) {
    console.error('[SMS] Error checking dedicated numbers:', err);
  }

  const conversations = await storage.getSmsConversationsByClientPhone(formattedFromPhone);

  // ── Step 0b: Direct routing for dedicated numbers ──
  // When a message arrives on a dedicated number, route directly to that business
  if (dedicatedBusinessOwnerId && !targetConversation) {
    const businessConvs = conversations.filter(c => c.businessOwnerId === dedicatedBusinessOwnerId);

    if (businessConvs.length > 0) {
      targetConversation = businessConvs.sort((a, b) =>
        new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
      )[0];
    } else {
      const client = await storage.getClientByPhone(dedicatedBusinessOwnerId, formattedFromPhone);
      const businessSettings = await storage.getBusinessSettings(dedicatedBusinessOwnerId);
      targetConversation = await storage.createSmsConversation({
        businessOwnerId: dedicatedBusinessOwnerId,
        clientId: client?.id || null,
        clientPhone: formattedFromPhone,
        clientName: client?.name || `Unknown Caller (${formattedFromPhone})`,
        jobId: null,
        lastMessageAt: new Date(),
        unreadCount: 0,
        isArchived: false,
        deletedAt: null,
        routingState: 'resolved',
        pendingOptions: [],
        lastRoutingPromptAt: null,
      });
      isNewConversation = true;
      if (!client) isUnknownCaller = true;
      console.log(`[SMS] Created new conversation for dedicated number: business ${businessSettings?.businessName || dedicatedBusinessOwnerId}`);
    }
  }

  // ── Step 1: Check for pending disambiguation replies ──
  const pendingConversations = conversations.filter(c =>
    c.routingState === 'pending_business' || c.routingState === 'pending_job'
  );

  if (!targetConversation && pendingConversations.length > 0 && body) {
    const pending = pendingConversations[0];
    const selection = parseInt(body.trim());
    const options = (pending.pendingOptions as any[]) || [];

    if (selection >= 1 && selection <= options.length) {
      const selected = options[selection - 1];

      if (pending.routingState === 'pending_business') {
        const selectedBusinessOwnerId = selected.id as string;
        const selectedBusinessName = selected.label as string;

        let resolvedConv = conversations.find(
          c => c.businessOwnerId === selectedBusinessOwnerId && c.routingState !== 'pending_business'
        );
        if (!resolvedConv) {
          const client = await storage.getClientByPhone(selectedBusinessOwnerId, formattedFromPhone);
          resolvedConv = await storage.createSmsConversation({
            businessOwnerId: selectedBusinessOwnerId,
            clientId: client?.id || null,
            clientPhone: formattedFromPhone,
            clientName: client?.name || pending.clientName || null,
            jobId: null,
            lastMessageAt: new Date(),
            unreadCount: 0,
            isArchived: false,
            deletedAt: null,
            routingState: 'resolved',
            pendingOptions: [],
            lastRoutingPromptAt: null,
          });
          isNewConversation = true;
        }

        await storage.updateSmsConversationRoutingState(pending.id, 'resolved');

        if (resolvedConv.clientId) {
          const jobResult = await checkAndRouteJobs(resolvedConv, resolvedConv.clientId, selectedBusinessOwnerId, formattedFromPhone);
          targetConversation = jobResult.conversation;
        } else {
          await storage.updateSmsConversationRoutingState(resolvedConv.id, 'resolved');
          targetConversation = resolvedConv;
        }

        console.log(`[SMS Routing] Business disambiguation resolved: ${selectedBusinessName}`);
      } else if (pending.routingState === 'pending_job') {
        const selectedJobId = selected.id as string;
        const selectedJob = await storage.getJob(selectedJobId, pending.businessOwnerId);
        if (!selectedJob || selectedJob.userId !== pending.businessOwnerId) {
          const menuLines = options.map((opt: any, i: number) => `${i + 1}. ${opt.label}`);
          await sendCustomerReply(formattedFromPhone, `Invalid selection. Please reply with a number to select a job:\n${menuLines.join('\n')}`, pending.businessOwnerId);
          targetConversation = pending;
          console.log(`[SMS Routing] Job selection failed validation (job doesn't belong to business) for ${formattedFromPhone}`);
        } else {
          const updated = await storage.updateSmsConversation(pending.id, { jobId: selectedJobId });
          await storage.updateSmsConversationRoutingState(pending.id, 'resolved');
          targetConversation = updated;
          console.log(`[SMS Routing] Job disambiguation resolved: ${selected.label}`);
        }
      }
    } else {
      const now = new Date();
      const lastPrompt = pending.lastRoutingPromptAt ? new Date(pending.lastRoutingPromptAt) : null;
      const rateLimited = lastPrompt && (now.getTime() - lastPrompt.getTime()) < 5 * 60 * 1000;

      if (!rateLimited) {
        const menuLines = options.map((opt: any, i: number) => `${i + 1}. ${opt.label}`);
        const helpText = pending.routingState === 'pending_business'
          ? `Please reply with a number to select a business:\n${menuLines.join('\n')}`
          : `Please reply with a number to select a job:\n${menuLines.join('\n')}`;
        await sendCustomerReply(formattedFromPhone, helpText, pending.businessOwnerId);
        await storage.updateSmsConversationRoutingState(pending.id, pending.routingState ?? 'pending_job', options);
      }

      targetConversation = pending;
      console.log(`[SMS Routing] Invalid selection "${body.trim()}" from ${formattedFromPhone}, re-prompted`);
    }
  }

  // ── Step 2: Smart routing (no pending disambiguation) ──
  if (!targetConversation) {
    const resolvedConversations = conversations.filter(c =>
      !c.routingState || c.routingState === 'resolved'
    );

    if (resolvedConversations.length > 0) {
      let bestConv: SmsConversation | null = null;
      let bestOutboundTime = new Date(0);

      for (const conv of resolvedConversations) {
        const messages = await storage.getSmsMessages(conv.id);
        const lastOutbound = messages
          .filter(m => m.direction === 'outbound')
          .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];

        if (lastOutbound) {
          const outboundTime = new Date(lastOutbound.createdAt ?? 0);
          if (outboundTime > bestOutboundTime) {
            bestOutboundTime = outboundTime;
            bestConv = conv;
          }
        }
      }

      if (!bestConv) {
        bestConv = resolvedConversations.sort((a, b) =>
          new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
        )[0];
      }

      targetConversation = bestConv;
    } else {
      const allBusinessSettings = await storage.getAllBusinessSettings();

      if (allBusinessSettings.length === 0) {
        console.log(`[SMS] No business settings found - cannot create conversation for ${formattedFromPhone}`);
        return null;
      }

      const matchedBusinesses: Array<{
        businessOwnerId: string;
        businessName: string;
        clientId: string;
        clientName: string;
      }> = [];

      for (const business of allBusinessSettings) {
        const client = await storage.getClientByPhone(business.userId, formattedFromPhone);
        if (client) {
          matchedBusinesses.push({
            businessOwnerId: business.userId,
            businessName: business.businessName || 'Unknown Business',
            clientId: client.id,
            clientName: client.name,
          });
        }
      }

      if (matchedBusinesses.length === 0) {
        // ── 0 matches: Unknown caller ──
        isUnknownCaller = true;
        isNewConversation = true;

        if (allBusinessSettings.length === 1) {
          const defaultBusiness = allBusinessSettings[0];
          const newConversation = await storage.createSmsConversation({
            businessOwnerId: defaultBusiness.userId,
            clientId: null,
            clientPhone: formattedFromPhone,
            clientName: `Unknown Caller (${formattedFromPhone})`,
            jobId: null,
            lastMessageAt: new Date(),
            unreadCount: 0,
            isArchived: false,
            deletedAt: null,
            routingState: 'resolved',
            pendingOptions: [],
            lastRoutingPromptAt: null,
          });
          targetConversation = newConversation;
          console.log(`[SMS Routing] Unknown caller ${formattedFromPhone} assigned to sole business "${defaultBusiness.businessName}"`);
        } else {
          await sendSMS({
            to: formattedFromPhone,
            message: "Hi! This is JobRunner. We couldn't match your number to a business. Please contact your tradie directly or text us the business name you're trying to reach.",
          });
          console.log(`[SMS Routing] Unknown caller ${formattedFromPhone} - multi-tenant, no conversation created (${allBusinessSettings.length} businesses on platform)`);
          return null;
        }
      } else if (matchedBusinesses.length === 1) {
        // ── 1 match: Single business ──
        const match = matchedBusinesses[0];
        isNewConversation = true;

        const newConversation = await storage.createSmsConversation({
          businessOwnerId: match.businessOwnerId,
          clientId: match.clientId,
          clientPhone: formattedFromPhone,
          clientName: match.clientName,
          jobId: null,
          lastMessageAt: new Date(),
          unreadCount: 0,
          isArchived: false,
          deletedAt: null,
          routingState: 'resolved',
          pendingOptions: [],
          lastRoutingPromptAt: null,
        });

        const jobResult = await checkAndRouteJobs(newConversation, match.clientId, match.businessOwnerId, formattedFromPhone);
        targetConversation = jobResult.conversation;
        console.log(`[SMS Routing] Single match: client "${match.clientName}" routed to "${match.businessName}"`);
      } else {
        // ── Multiple matches: Check for recent outbound within 24 hours ──
        let recentConv: SmsConversation | null = null;
        let recentOutboundTime = new Date(0);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        for (const match of matchedBusinesses) {
          const existingConv = await storage.getSmsConversationByPhone(match.businessOwnerId, formattedFromPhone);
          if (existingConv) {
            const messages = await storage.getSmsMessages(existingConv.id);
            const lastOutbound = messages
              .filter(m => m.direction === 'outbound')
              .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];

            if (lastOutbound) {
              const outboundTime = new Date(lastOutbound.createdAt ?? 0);
              if (outboundTime > twentyFourHoursAgo && outboundTime > recentOutboundTime) {
                recentOutboundTime = outboundTime;
                recentConv = existingConv;
              }
            }
          }
        }

        if (recentConv) {
          targetConversation = recentConv;
          console.log(`[SMS Routing] Multiple matches but recent outbound found - auto-routing to conversation ${recentConv.id}`);
        } else {
          isNewConversation = true;
          const routingConv = await storage.createSmsConversation({
            businessOwnerId: matchedBusinesses[0].businessOwnerId,
            clientId: matchedBusinesses[0].clientId,
            clientPhone: formattedFromPhone,
            clientName: matchedBusinesses[0].clientName,
            jobId: null,
            lastMessageAt: new Date(),
            unreadCount: 0,
            isArchived: false,
            deletedAt: null,
            routingState: 'pending_business',
            pendingOptions: matchedBusinesses.map(b => ({ id: b.businessOwnerId, label: b.businessName })),
            lastRoutingPromptAt: new Date(),
          });

          const menuLines = matchedBusinesses.map((b, i) => `${i + 1}. ${b.businessName}`);
          const menuText = `You're a client of multiple businesses. Reply with a number:\n${menuLines.join('\n')}`;
          await sendSMS({ to: formattedFromPhone, message: menuText });

          targetConversation = routingConv;
          console.log(`[SMS Routing] Multiple matches (${matchedBusinesses.length}) - sent business disambiguation menu to ${formattedFromPhone}`);
        }
      }
    }
  }

  // ── Fallback safety: should never happen but guard against null ──
  if (!targetConversation) {
    console.error(`[SMS] Critical: No target conversation resolved for ${formattedFromPhone}`);
    return null;
  }

  const isMMS = mediaUrls && mediaUrls.length > 0;
  const messageBody = body || (isMMS ? '[Media message]' : '');

  // Check for quote acceptance via SMS reply (YES, ACCEPT, APPROVED, etc.)
  const quoteAcceptanceResult = await checkAndProcessQuoteAcceptance(
    messageBody,
    formattedFromPhone,
    targetConversation
  );

  if (quoteAcceptanceResult.processed) {
    console.log(`[SMS] Quote acceptance processed: ${quoteAcceptanceResult.message}`);
  }

  // AI Intent Detection - only run for businesses with AI Receptionist mode
  let intentData: {
    isJobRequest: boolean;
    intentConfidence?: string;
    intentType?: string;
    suggestedJobTitle?: string;
    suggestedDescription?: string;
  } = { isJobRequest: false };

  try {
    const businessSettings = await storage.getBusinessSettings(targetConversation.businessOwnerId);
    const smsMode = businessSettings?.smsMode || 'standard';

    if (smsMode === 'ai_receptionist' && messageBody && messageBody !== '[Media message]') {
      const intentResult = await detectSmsJobIntent(
        messageBody,
        targetConversation.clientName || undefined,
        isMMS
      );

      intentData = {
        isJobRequest: intentResult.isJobRequest,
        intentConfidence: intentResult.confidence,
        intentType: intentResult.intentType,
        suggestedJobTitle: intentResult.suggestedJobTitle,
        suggestedDescription: intentResult.suggestedDescription,
      };

      if (intentResult.isJobRequest) {
        console.log(`[SMS AI] Detected job request (${intentResult.confidence} confidence): "${intentResult.suggestedJobTitle}"`);
      }
    } else if (smsMode !== 'ai_receptionist') {
      console.log(`[SMS] Skipping AI intent detection for business ${targetConversation.businessOwnerId} (smsMode: ${smsMode})`);
    }
  } catch (aiError) {
    console.error('[SMS AI] Intent detection failed (non-blocking):', aiError);
  }

  // Create inbound message (with MMS media URLs and AI intent data)
  const message = await storage.createSmsMessage({
    conversationId: targetConversation.id,
    direction: 'inbound',
    body: messageBody,
    senderUserId: null,
    status: 'received',
    twilioSid,
    isQuickAction: false,
    quickActionType: null,
    mediaUrls: mediaUrls || [],
    isJobRequest: intentData.isJobRequest,
    intentConfidence: intentData.intentConfidence || null,
    intentType: intentData.intentType || null,
    suggestedJobTitle: intentData.suggestedJobTitle || null,
    suggestedDescription: intentData.suggestedDescription || null,
    jobCreatedFromSms: null,
    readAt: null,
    errorMessage: null,
  });

  // Update conversation
  const newUnreadCount = (targetConversation.unreadCount || 0) + 1;
  await storage.updateSmsConversation(targetConversation.id, {
    lastMessageAt: new Date(),
    unreadCount: newUnreadCount,
  });

  console.log(`[${isMMS ? 'MMS' : 'SMS'}] Inbound message routed to conversation ${targetConversation.id} (business: ${targetConversation.businessOwnerId})${isMMS ? ` with ${mediaUrls!.length} media attachment(s)` : ''}${intentData.isJobRequest ? ' [JOB REQUEST DETECTED]' : ''}`);

  const recipients = targetConversation.jobId
    ? await getJobSmsRecipients(targetConversation.jobId, targetConversation.businessOwnerId)
    : [targetConversation.businessOwnerId];

  const notificationData = {
    conversationId: targetConversation.id,
    senderPhone: formattedFromPhone,
    senderName: targetConversation.clientName,
    messagePreview: messageBody.slice(0, 100),
    jobId: targetConversation.jobId,
    unreadCount: newUnreadCount,
    isJobRequest: intentData.isJobRequest,
    suggestedJobTitle: intentData.suggestedJobTitle,
    isNewConversation,
    isUnknownCaller,
  };

  for (const recipientId of recipients) {
    try {
      broadcastSmsNotification(recipientId, notificationData);
    } catch (wsError) {
      console.error('[SMS] Error broadcasting to recipient:', wsError);
    }
  }

  for (const recipientId of recipients) {
    try {
      await notifySmsReceived(
        storage,
        recipientId,
        targetConversation.clientName || formattedFromPhone,
        messageBody.slice(0, 100),
        targetConversation.id
      );
      await notifySmsReceivedPush(
        recipientId,
        targetConversation.clientName || formattedFromPhone,
        messageBody,
        targetConversation.id
      );
    } catch (notifErr) {
      console.error('[SMS] Failed to send notification to:', recipientId, notifErr);
    }
  }

  return message;
}

/**
 * Get SMS conversations for a user with role-based filtering
 */
export async function getSmsConversationsForUser(
  userId: string,
  businessOwnerId: string,
  userRole: string,
  // Permission-based override: custom roles granted read_communications /
  // view_all get the full business-wide view, not just their assigned-job
  // conversations. Additive — never removes access from anyone. The caller
  // resolves this from the user's permission set so visibility is driven by
  // granted permissions, not hard-coded role names.
  hasFullAccess: boolean = false
): Promise<SmsConversation[]> {
  let conversations: SmsConversation[];
  if (hasFullAccess || ['owner', 'admin', 'manager'].includes(userRole.toLowerCase())) {
    conversations = await storage.getSmsConversationsByBusiness(businessOwnerId);
  } else {
    const assignedJobs = await storage.getJobsByAssignee(userId);
    const jobIds = assignedJobs.map(j => j.id);
    conversations = await storage.getSmsConversationsByJobIds(jobIds);
  }

  // Auto-link unlinked conversations to existing clients by phone number match
  const unlinked = conversations.filter(c => !c.clientId && c.clientPhone);
  if (unlinked.length > 0) {
    for (const conv of unlinked) {
      try {
        const client = await storage.getClientByPhone(businessOwnerId, conv.clientPhone);
        if (client) {
          await storage.updateSmsConversation(conv.id, {
            clientId: client.id,
            clientName: client.name,
          });
          conv.clientId = client.id;
          conv.clientName = client.name;
        }
      } catch (e) {
        // Non-critical: conversation->client linking is display metadata. Log but don't fail the SMS flow.
        logger.warn('sms', 'Failed to link SMS conversation to client', { error: e });
      }
    }
  }

  return conversations;
}

/**
 * Mark conversation messages as read
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  await storage.markSmsMessagesAsRead(conversationId);
  await storage.updateSmsConversation(conversationId, {
    unreadCount: 0,
  });
}

/**
 * Soft delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await storage.updateSmsConversation(conversationId, {
    deletedAt: new Date(),
  });
}

/**
 * Get Twilio status
 */
export function getTwilioStatus(): { enabled: boolean; phoneNumber: string | null } {
  return {
    enabled: isTwilioInitialized(),
    phoneNumber: getTwilioPhoneNumber(),
  };
}

/**
 * Merge field context for SMS template parsing
 */
export interface MergeContext {
  client_name?: string;
  client_first_name?: string;
  job_title?: string;
  job_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  business_name?: string;
  quote_amount?: string;
  invoice_amount?: string;
  invoice_due_date?: string;
  booking_link?: string;
  tracking_link?: string;
}

/**
 * Available merge fields for SMS templates
 */
export const AVAILABLE_MERGE_FIELDS = [
  { field: '{client_name}', description: 'Full client name' },
  { field: '{client_first_name}', description: 'Client first name' },
  { field: '{job_title}', description: 'Job title' },
  { field: '{job_address}', description: 'Job address' },
  { field: '{scheduled_date}', description: 'Scheduled date (e.g., Mon 15 Jan)' },
  { field: '{scheduled_time}', description: 'Scheduled time (e.g., 9:00 AM)' },
  { field: '{business_name}', description: 'Your business name' },
  { field: '{quote_amount}', description: 'Quote total amount' },
  { field: '{invoice_amount}', description: 'Invoice total amount' },
  { field: '{invoice_due_date}', description: 'Invoice due date' },
  { field: '{booking_link}', description: 'Booking confirmation link' },
  { field: '{tracking_link}', description: 'Job tracking link' },
] as const;

/**
 * Parse an SMS template by replacing merge fields with actual values
 * 
 * @param template - The template string with merge fields like {client_name}
 * @param context - The context object containing values for merge fields
 * @returns The parsed template with merge fields replaced
 */
export function parseSmsTemplate(template: string, context: MergeContext): string {
  let parsed = template;
  
  // Replace each merge field with its value or empty string if not provided
  const replacements: Record<string, string | undefined> = {
    '{client_name}': context.client_name,
    '{client_first_name}': context.client_first_name,
    '{job_title}': context.job_title,
    '{job_address}': context.job_address,
    '{scheduled_date}': context.scheduled_date,
    '{scheduled_time}': context.scheduled_time,
    '{business_name}': context.business_name,
    '{quote_amount}': context.quote_amount,
    '{invoice_amount}': context.invoice_amount,
    '{invoice_due_date}': context.invoice_due_date,
    '{booking_link}': context.booking_link,
    '{tracking_link}': context.tracking_link,
  };
  
  for (const [field, value] of Object.entries(replacements)) {
    // Replace field with value, or remove it if value is undefined/empty
    parsed = parsed.replace(new RegExp(field.replace(/[{}]/g, '\\$&'), 'g'), value || '');
  }
  
  // Clean up any double spaces that might result from removed fields
  parsed = parsed.replace(/\s{2,}/g, ' ').trim();
  
  return parsed;
}

/**
 * Default SMS templates to seed for new users
 */
export const DEFAULT_SMS_TEMPLATES = [
  {
    name: 'Booking Confirmation',
    category: 'booking',
    body: 'Hi {client_name}, your booking with {business_name} is confirmed for {scheduled_date} at {scheduled_time}. Address: {job_address}. Reply YES to confirm or call us to reschedule.',
    isDefault: true,
  },
  {
    name: 'On My Way',
    category: 'arrival',
    body: 'Hi {client_first_name}, {business_name} here. I\'m on my way for {job_title}. ETA approximately 15 minutes. See you soon!',
    isDefault: true,
  },
  {
    name: 'Quote Follow-up',
    category: 'quote',
    body: 'Hi {client_name}, just following up on the quote for {job_title} ({quote_amount}). Let me know if you have any questions or are ready to proceed. - {business_name}',
    isDefault: true,
  },
  {
    name: 'Invoice Reminder',
    category: 'invoice',
    body: 'Hi {client_name}, friendly reminder that invoice for {job_title} ({invoice_amount}) is due on {invoice_due_date}. Please let us know if you have any questions. - {business_name}',
    isDefault: true,
  },
  {
    name: 'Job Completion',
    category: 'general',
    body: 'Hi {client_name}, {business_name} has completed work on {job_title}. Thanks for having us! An invoice will follow shortly. Please let us know if you need anything else.',
    isDefault: true,
  },
] as const;

/**
 * Seed default SMS templates for a new user
 */
export async function seedDefaultSmsTemplates(userId: string): Promise<void> {
  for (const template of DEFAULT_SMS_TEMPLATES) {
    await storage.createSmsTemplate({
      userId,
      name: template.name,
      category: template.category,
      body: template.body,
      isDefault: template.isDefault,
    });
  }
}

/**
 * Generate a tracking link for a job
 * Used when sending "On My Way" SMS to include live location tracking
 */
export async function generateTrackingLink(
  jobId: string,
  teamMemberId: string,
  businessOwnerId: string
): Promise<{ url: string; token: string } | null> {
  try {
    const { randomBytes } = await import('crypto');
    
    // Check if there's already an active tracking link
    const { getProductionBaseUrl } = await import('../urlHelper');
    
    const existingLink = await storage.getSmsTrackingLinkByJobId(jobId);
    if (existingLink && existingLink.isActive && new Date(existingLink.expiresAt) > new Date()) {
      const baseUrl = getProductionBaseUrl();
      return {
        url: `${baseUrl}/track/${existingLink.token}`,
        token: existingLink.token,
      };
    }
    
    // Deactivate any existing links
    if (existingLink) {
      await storage.deactivateSmsTrackingLink(existingLink.id);
    }
    
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
    
    await storage.createSmsTrackingLink({
      jobId,
      teamMemberId,
      businessOwnerId,
      token,
      expiresAt,
      estimatedArrival: null,
    });
    
    const baseUrl = getProductionBaseUrl();
    
    return {
      url: `${baseUrl}/track/${token}`,
      token,
    };
  } catch (error) {
    console.error('Error generating tracking link:', error);
    return null;
  }
}

export { smsTemplates, sendSMS };
