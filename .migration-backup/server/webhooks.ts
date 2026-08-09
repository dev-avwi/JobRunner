import { getErrorMessage } from "./lib/errors";
import { Express } from 'express';
import { createNotification } from './notifications';
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from './emailService';

export function setupStripeWebhooks(app: Express, stripe: any, storage: any) {
  if (!stripe) {
    console.log('⚠️ Stripe webhooks not available - Stripe not initialized');
    return;
  }

  // Legacy Stripe webhook endpoint (webhook signature verification)
  app.post('/api/webhooks/stripe', async (req: any, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set - rejecting webhook');
      return res.status(400).send('Webhook secret not configured');
    }

    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: unknown) {
      console.error('⚠️ Webhook signature verification failed:', getErrorMessage(err));
      return res.status(400).send(`Webhook Error: ${getErrorMessage(err)}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          console.log('✅ Checkout session completed:', session.id);

          // Get metadata from the checkout session
          const userId = session.metadata?.userId;
          const businessId = session.metadata?.businessId;
          const plan = session.metadata?.plan;

          if (!userId || !businessId) {
            console.warn('Missing userId or businessId in checkout session metadata');
            break;
          }

          // Update business settings with subscription info
          const businessSettings = await storage.getBusinessSettings(userId);
          if (businessSettings) {
            const updateData: any = {
              subscriptionTier: plan || 'pro',
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              subscriptionCanceledAt: null,
              dataRetentionExpiresAt: null,
              subscriptionPausedAt: null,
            };
            if ((plan === 'team' || plan === 'business') && (!businessSettings.teamSize || businessSettings.teamSize === 'solo')) {
              updateData.teamSize = 'small';
            }
            await storage.updateBusinessSettings(userId, updateData);

            // Create notification
            await createNotification(storage, {
              userId,
              type: 'payment_success',
              title: 'Payment Successful',
              message: `Your ${plan || 'Pro'} plan subscription is now active. Thank you!`,
              relatedType: 'subscription',
              relatedId: session.subscription as string,
            });

            // Send email
            try {
              const user = await storage.getUserById(userId);
              if (user && businessSettings.email) {
                await sendPaymentSuccessEmail(user, businessSettings, plan || 'Pro');
              }
            } catch (emailError) {
              console.error('Failed to send payment success email:', emailError);
            }
          }

          // Handle AI Receptionist add-on checkout
          const checkoutType = session.metadata?.type;
          if (checkoutType === 'ai_receptionist' && userId) {
            console.log(`[AI Receptionist] Checkout completed for user ${userId}, triggering provisioning...`);
            try {
              const existingConfig = await storage.getAiReceptionistConfig(userId);
              if (existingConfig) {
                await storage.updateAiReceptionistConfig(userId, {
                  stripeSubscriptionItemId: session.subscription as string,
                });
              }
            } catch (e) {
              console.warn('[AI Receptionist] Failed to store subscription item ID:', e);
            }

            try {
              const userSettings = await storage.getBusinessSettings(userId);
              const userDedicatedNumber = userSettings?.dedicatedPhoneNumber;
              if (!userDedicatedNumber) {
                console.error('[AI Receptionist] No dedicated number found for user — cannot provision');
                const existingCfg = await storage.getAiReceptionistConfig(userId);
                if (existingCfg) {
                  await storage.updateAiReceptionistConfig(userId, {
                    approvalStatus: 'failed',
                    provisioningError: 'No dedicated phone number found. Please purchase a dedicated number and try again.',
                  });
                }
                await createNotification(storage, {
                  userId,
                  type: 'ai_receptionist_error',
                  title: 'AI Receptionist Setup Issue',
                  message: 'You need a dedicated phone number before AI Receptionist can be set up. Please purchase one from the Phone Numbers screen.',
                  relatedType: 'ai_receptionist',
                });
              } else {
                const { provisionAiReceptionist } = await import('./aiReceptionistProvisioning');
                provisionAiReceptionist(userId, userDedicatedNumber).catch(err => {
                  console.error('[AI Receptionist] Async provisioning failed:', err);
                });
              }
            } catch (provisionError) {
              console.error('[AI Receptionist] Failed to start provisioning:', provisionError);
            }
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          console.log('✅ Invoice payment succeeded:', invoice.id);

          // Find the business by Stripe customer ID
          const customerId = invoice.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            // Create notification
            await createNotification(storage, {
              userId: businessSettings.userId,
              type: 'payment_received',
              title: 'Payment Received',
              message: `Subscription payment of $${(invoice.amount_paid / 100).toFixed(2)} received successfully.`,
              relatedType: 'subscription',
              relatedId: invoice.subscription,
            });

            // Send receipt email
            try {
              const user = await storage.getUserById(businessSettings.userId);
              if (user && businessSettings.email) {
                await sendPaymentSuccessEmail(user, businessSettings, businessSettings.subscriptionTier || 'Pro');
              }
            } catch (emailError) {
              console.error('Failed to send payment receipt email:', emailError);
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.log('⚠️ Invoice payment failed:', invoice.id);

          // Find the business by Stripe customer ID
          const customerId = invoice.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            // IMPORTANT: Do NOT suspend team members on payment_failed
            // Payment retries are transient - Stripe will retry automatically
            // Only suspend when subscription is definitively 'canceled' (handled in subscription.deleted)
            // Log the failure for monitoring but rely on subscription status webhooks for actual state changes
            console.log(`⚠️ Payment failed for user ${businessSettings.userId} - awaiting Stripe retry (no suspension)`);

            // Create notification to prompt user action
            await createNotification(storage, {
              userId: businessSettings.userId,
              type: 'payment_failed',
              title: 'Payment Failed',
              message: 'Your subscription payment failed. Please update your payment method to avoid service interruption.',
              relatedType: 'subscription',
              relatedId: invoice.subscription,
            });

            // Send email
            try {
              const user = await storage.getUserById(businessSettings.userId);
              if (user && businessSettings.email) {
                await sendPaymentFailedEmail(user, businessSettings);
              }
            } catch (emailError) {
              console.error('Failed to send payment failed email:', emailError);
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          console.log('📝 Subscription updated:', subscription.id);

          const customerId = subscription.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            const previousStatus = businessSettings.subscriptionStatus;
            const isPaused = subscription.pause_collection != null;
            const effectiveStatus = isPaused ? 'paused' : subscription.status;
            
            const updateData: any = {
              subscriptionStatus: effectiveStatus,
            };

            // Sync plan tier from the subscription (covers plan changes made in the Stripe dashboard/portal)
            try {
              if (subscription.status === 'active' || subscription.status === 'trialing') {
                let newTier: string | null = subscription.metadata?.tier || null;
                if (!newTier) {
                  const lookupKey: string = subscription.items?.data?.[0]?.price?.lookup_key || '';
                  if (lookupKey.includes('business')) newTier = 'business';
                  else if (lookupKey.includes('team')) newTier = 'team';
                  else if (lookupKey.includes('pro')) newTier = 'pro';
                }
                if (newTier && ['pro', 'team', 'business'].includes(newTier)) {
                  const user = await storage.getUser(businessSettings.userId);
                  if (user && user.subscriptionTier !== newTier) {
                    await storage.updateUser(businessSettings.userId, { subscriptionTier: newTier } as any);
                    console.log(`[Webhook] Tier synced for ${businessSettings.userId}: ${user.subscriptionTier} -> ${newTier}`);
                  }
                }
              }
            } catch (tierErr) {
              console.error('[Webhook] Failed to sync tier from subscription:', tierErr);
            }

            if (isPaused) {
              if (!businessSettings.subscriptionPausedAt) {
                updateData.subscriptionPausedAt = new Date();
              }
            } else if (subscription.status === 'active') {
              updateData.subscriptionPausedAt = null;
              updateData.subscriptionCanceledAt = null;
              updateData.dataRetentionExpiresAt = null;
            }
            
            await storage.updateBusinessSettings(businessSettings.userId, updateData);

            if (subscription.status === 'past_due') {
              console.log(`⚠️ Subscription ${subscription.id} is past_due for user ${businessSettings.userId} - grace period active`);
            } else if (effectiveStatus === 'active' && (previousStatus === 'past_due' || previousStatus === 'paused')) {
              const reactivatedCount = await storage.reactivateTeamMembersByOwner(businessSettings.userId);
              console.log(`✅ Reactivated ${reactivatedCount} team members for user ${businessSettings.userId}`);
              
              await createNotification(storage, {
                userId: businessSettings.userId,
                type: 'subscription_changed',
                title: 'Subscription Restored',
                message: 'Your subscription is now active and team member access has been restored.',
                relatedType: 'subscription',
                relatedId: subscription.id,
              });
            }

            if (effectiveStatus === 'canceled' || effectiveStatus === 'paused') {
              await createNotification(storage, {
                userId: businessSettings.userId,
                type: 'subscription_changed',
                title: 'Subscription Updated',
                message: `Your subscription has been ${effectiveStatus}.`,
                relatedType: 'subscription',
                relatedId: subscription.id,
              });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          console.log('🗑️ Subscription deleted:', subscription.id);

          const customerId = subscription.customer;
          const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
          
          if (businessSettings) {
            // Suspend all team members for this owner
            const suspendedCount = await storage.suspendTeamMembersByOwner(businessSettings.userId);
            console.log(`🔒 Suspended ${suspendedCount} team members for user ${businessSettings.userId}`);

            const canceledAt = new Date();
            const dataRetentionExpiresAt = new Date(canceledAt);
            dataRetentionExpiresAt.setMonth(dataRetentionExpiresAt.getMonth() + 12);
            await storage.updateBusinessSettings(businessSettings.userId, {
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled',
              subscriptionCanceledAt: canceledAt,
              dataRetentionExpiresAt: dataRetentionExpiresAt,
            });

            // Create notification
            await createNotification(storage, {
              userId: businessSettings.userId,
              type: 'subscription_canceled',
              title: 'Subscription Canceled',
              message: suspendedCount > 0 
                ? `Your subscription has been canceled and ${suspendedCount} team member(s) have been deactivated. You can reactivate anytime from Settings.`
                : 'Your subscription has been canceled. You can reactivate anytime from Settings.',
              relatedType: 'subscription',
              relatedId: subscription.id,
            });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  console.log('✅ Stripe webhooks configured at /api/webhooks/stripe');
}
