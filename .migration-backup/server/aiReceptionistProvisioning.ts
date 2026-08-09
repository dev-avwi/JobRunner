import { storage } from './storage';
import { createAssistant, importPhoneNumber, getWebhookUrl } from './vapiService';
import { createNotification } from './notifications';
import { logTeamActivity } from './activityService';
import { isSharedPlatformNumber } from './phoneNumberUtils';
import { getErrorMessage } from "./lib/errors";

interface ProvisioningResult {
  success: boolean;
  phoneNumber?: string;
  assistantId?: string;
  error?: string;
}

export async function provisionAiReceptionist(userId: string, phoneNumber?: string): Promise<ProvisioningResult> {
  const stepErrors: string[] = [];

  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      await storage.createAiReceptionistConfig({
        userId,
        enabled: false,
        mode: 'always_on_message',
        voiceName: 'Jess',
        approvalStatus: 'provisioning',
      });
    } else {
      await storage.updateAiReceptionistConfig(userId, {
        approvalStatus: 'provisioning',
        provisioningError: null,
      });
    }

    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      throw new Error('Business settings not found. Please complete your business profile first.');
    }
    if (!settings.businessName) {
      throw new Error('Business name is required to provision the AI Receptionist.');
    }

    const dedicatedNumber = phoneNumber || settings.dedicatedPhoneNumber;
    if (!dedicatedNumber) {
      throw new Error('A dedicated phone number is required before setting up AI Receptionist. Please purchase a dedicated number first.');
    }

    if (isSharedPlatformNumber(dedicatedNumber)) {
      throw new Error('AI Receptionist requires a dedicated number. The shared platform number cannot be used.');
    }

    console.log(`[AI Provisioning] Starting provisioning for user ${userId} (${settings.businessName})`);
    console.log(`[AI Provisioning] Using existing dedicated number: ${dedicatedNumber}`);

    const purchasedNumber = dedicatedNumber;

    console.log(`[AI Provisioning] Step 1: Creating Vapi assistant...`);
    const webhookUrl = getWebhookUrl();
    const updatedConfig = await storage.getAiReceptionistConfig(userId);
    const transferNumbers = (updatedConfig?.transferNumbers || []) as Array<{ name: string; phone: string; priority: number }>;
    const businessHours = (updatedConfig?.businessHours || null) as { start: string; end: string; timezone: string; days: number[] } | null;

    const teamMembers = await storage.getTeamMembers(userId);
    const teamInfo = teamMembers
      .filter(m => m.isActive)
      .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: 'team member' }));

    const clients = await storage.getClients(userId);
    const catalogItems = await storage.getLineItemCatalog(userId);
    const services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);

    const assistant = await createAssistant({
      businessName: settings.businessName,
      businessPhone: settings.phone || undefined,
      tradeType: (await storage.getUser(userId))?.tradeType || undefined,
      greeting: updatedConfig?.greeting || undefined,
      voice: updatedConfig?.voiceName || 'Jess',
      transferNumbers,
      businessHours: businessHours || undefined,
      webhookUrl,
      services,
      teamInfo,
      knownClientCount: clients.length,
    });

    console.log(`[AI Provisioning] Created assistant: ${assistant.id}`);

    console.log(`[AI Provisioning] Step 2: Importing number to Vapi...`);
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';

    let vapiPhoneNumberId: string | undefined;
    try {
      const vapiPhone = await importPhoneNumber(purchasedNumber, twilioAccountSid, twilioAuthToken, assistant.id);
      vapiPhoneNumberId = vapiPhone.id;
      console.log(`[AI Provisioning] Imported to Vapi: ${vapiPhoneNumberId}`);
    } catch (vapiImportError: unknown) {
      console.warn(`[AI Provisioning] Vapi import warning: ${getErrorMessage(vapiImportError)} - assistant created without phone import`);
      stepErrors.push(`Phone import to Vapi: ${getErrorMessage(vapiImportError)}`);
    }

    console.log(`[AI Provisioning] Step 3: Saving to database...`);
    await storage.updateAiReceptionistConfig(userId, {
      vapiAssistantId: assistant.id,
      vapiPhoneNumberId: vapiPhoneNumberId || null,
      dedicatedPhoneNumber: purchasedNumber,
      twilioNumberSid: null,
      approvalStatus: 'pending_approval',
      provisioningError: stepErrors.length > 0 ? stepErrors.join('; ') : null,
      enabled: false,
      mode: updatedConfig?.mode === 'off' ? 'always_on_message' : (updatedConfig?.mode || 'always_on_message'),
      provisionedAt: new Date(),
    });

    await createNotification(storage, {
      userId,
      type: 'ai_receptionist_provisioned',
      title: 'AI Receptionist Set Up',
      message: 'Your AI Receptionist has been set up! Our team will review and activate it within 24 hours.',
      relatedType: 'ai_receptionist',
    });

    await logTeamActivity({
      businessOwnerId: userId,
      actorUserId: userId,
      activityType: 'milestone',
      description: `AI Receptionist provisioned (pending approval) for ${settings.businessName}`,
      metadata: {
        type: 'ai_receptionist_provisioned',
        phoneNumber: purchasedNumber,
        assistantId: assistant.id,
      },
      isImportant: true,
    });

    console.log(`[AI Provisioning] Complete for user ${userId} - pending admin approval`);

    return {
      success: true,
      phoneNumber: purchasedNumber,
      assistantId: assistant.id,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Unknown provisioning error';
    console.error(`[AI Provisioning] Failed for user ${userId}:`, errorMessage);

    try {
      const config = await storage.getAiReceptionistConfig(userId);
      if (config) {
        await storage.updateAiReceptionistConfig(userId, {
          approvalStatus: 'failed',
          provisioningError: errorMessage,
        });
      }
    } catch (updateErr) {
      console.error('[AI Provisioning] Failed to update config with error:', updateErr);
    }

    try {
      const { db } = await import('./storage');
      const { errorLogs } = await import('@shared/schema');
      await (db as any).insert(errorLogs).values({
        id: crypto.randomUUID(),
        level: 'error',
        category: 'ai_receptionist_provisioning',
        message: errorMessage,
        userId,
        metadata: { stepErrors },
      });
    } catch (logErr) {
      console.error('[AI Provisioning] Failed to log error:', logErr);
    }

    try {
      await createNotification(storage, {
        userId,
        type: 'ai_receptionist_error',
        title: 'AI Receptionist Setup Issue',
        message: 'There was an issue setting up your AI Receptionist. Our team has been notified and will resolve it shortly.',
        relatedType: 'ai_receptionist',
      });
    } catch (notifErr) {
      console.error('[AI Provisioning] Failed to send failure notification:', notifErr);
    }

    try {
      const settings = await storage.getBusinessSettings(userId);
      await logTeamActivity({
        businessOwnerId: userId,
        actorUserId: userId,
        activityType: 'milestone',
        description: `AI Receptionist provisioning failed for ${settings?.businessName || 'business'}: ${errorMessage}`,
        metadata: {
          type: 'ai_receptionist_provisioning_failed',
          error: errorMessage,
        },
        isImportant: true,
      });
    } catch (activityErr) {
      console.error('[AI Provisioning] Failed to log activity:', activityErr);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
