import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { createNotification } from './notifications';
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, sendReceiptEmailWithPdf } from './emailService';
import { processPaymentReceivedAutomation } from './automationService';
import { markInvoicePaidInXero } from './xeroService';
import { broadcastPaymentReceived } from './websocket';
import { sendSMS } from './twilioClient';
import { logger } from './logger';
import { logSystemEvent } from './systemEventService';
import { getErrorMessage } from "./lib/errors";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string, storage: any): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    if (!sync) {
      throw new Error('Stripe sync not initialized');
    }

    await sync.processWebhook(payload, signature, uuid);

    const stripe = await getUncachableStripeClient();
    if (!stripe) return;

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      await getWebhookSecretFromUuid(uuid)
    );

    await handleStripeEvent(event, storage);
  }

  static async processWebhookDirect(event: any, storage: any): Promise<void> {
    await handleStripeEvent(event, storage);
  }
}

async function getWebhookSecretFromUuid(uuid: string): Promise<string> {
  const sync = await getStripeSync();
  if (!sync) throw new Error('Stripe sync not initialized');
  
  const webhooks = await sync.listManagedWebhooks();
  const webhook = webhooks.find((w: any) => w.metadata?.uuid === uuid);
  if (!webhook || !webhook.secret) throw new Error('Webhook not found for UUID');
  
  return webhook.secret as string;
}

async function handleStripeEvent(event: any, storage: any) {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('✅ Checkout session completed:', session.id);

        const invoiceId = session.metadata?.invoiceId;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (invoiceId && userId) {
          const invoice = await storage.getInvoice(invoiceId, userId);
          if (invoice) {
            // Issue 2: Idempotency check - if invoice is already paid, return early to prevent duplicate receipt
            if (invoice.status === 'paid') {
              console.log(`⚠️ Invoice ${invoiceId} already marked as paid. Skipping duplicate processing.`);
              break;
            }

            await storage.updateInvoice(invoiceId, userId, {
              status: 'paid',
              paidAt: new Date().toISOString(),
              paymentMethod: 'stripe',
              stripePaymentIntentId: session.payment_intent,
              lockedAt: new Date().toISOString(),
              lockedReason: 'payment_received',
            });

            // Create payment receipt record using Stripe-confirmed amount
            try {
              // Use Stripe's amount_total as authoritative source, fallback to invoice total
              const confirmedAmount = session.amount_total || invoice.total || 0;
              if (confirmedAmount > 0) {
                const receiptNumber = await storage.generateReceiptNumber(userId);
                await storage.createReceipt({
                  userId,
                  receiptNumber,
                  amount: confirmedAmount,
                  paymentMethod: 'stripe',
                  invoiceId,
                  clientId: invoice.clientId,
                  paidAt: new Date(),
                  paymentReference: session.payment_intent as string,
                });
                console.log(`✅ Receipt ${receiptNumber} created for invoice ${invoice.number || invoiceId.substring(0, 8).toUpperCase()} - Amount: $${(confirmedAmount / 100).toFixed(2)}`);
              } else {
                console.warn(`⚠️ Skipping receipt creation for invoice ${invoiceId} - zero amount`);
              }
            } catch (receiptError) {
              console.error('Failed to create receipt record:', receiptError);
            }

            // Update linked job status if applicable (best effort, don't fail if this errors)
            if (invoice.jobId) {
              try {
                const job = await storage.getJob(invoice.jobId, userId);
                if (job && job.status !== 'invoiced') {
                  await storage.updateJob(invoice.jobId, userId, { status: 'invoiced' });
                }
              } catch (jobError) {
                console.log("Job status update skipped:", jobError);
              }
            }

            // Trigger automation rules for payment received (async, non-blocking)
            processPaymentReceivedAutomation(userId, invoiceId)
              .catch(err => console.error('[Automations] Error processing payment received:', err));

            // Sync payment status to Xero (async, non-blocking)
            markInvoicePaidInXero(userId, invoiceId)
              .catch(err => console.warn('[Xero] Error syncing payment to Xero:', err));

            await createNotification(storage, {
              userId,
              type: 'invoice_paid',
              title: 'Invoice Paid',
              message: `Invoice #${invoice.number || invoiceId.substring(0, 8).toUpperCase()} has been paid via Stripe.`,
              relatedType: 'invoice',
              relatedId: invoiceId,
            });

            // 💰 Broadcast celebratory payment notification via WebSocket
            const paymentClient = invoice.clientId ? await storage.getClient(invoice.clientId, userId) : null;
            broadcastPaymentReceived(userId, {
              amount: session.amount_total || parseFloat(invoice.total || '0') * 100,
              invoiceNumber: invoice.number || invoiceId.substring(0, 8).toUpperCase(),
              clientName: paymentClient?.name || paymentClient?.firstName || 'Customer',
              paymentMethod: 'stripe',
            });

            // Send automatic payment receipt to the client
            // Only send if invoice hasn't already had a receipt sent (prevent duplicates)
            if (!invoice.receiptSentAt) {
              try {
                const client = invoice.clientId ? await storage.getClient(invoice.clientId, userId) : null;
                const businessSettings = await storage.getBusinessSettings(userId);
                
                if (client && client.email) {
                  // Update invoice with payment info for the receipt
                  const paidInvoice = {
                    ...invoice,
                    status: 'paid',
                    paidAt: new Date().toISOString(),
                    paymentMethod: 'stripe',
                  };
                  
                  try {
                    // Use unified receipt email function that handles PDF generation internally
                    await sendReceiptEmailWithPdf(
                      storage,
                      paidInvoice,
                      client,
                      businessSettings || {},
                      undefined, // Let it look up or create receipt internally
                      userId
                    );
                    // Mark receipt as sent to prevent duplicates
                    await storage.updateInvoice(invoiceId, userId, {
                      receiptSentAt: new Date().toISOString(),
                    });
                  } catch (sendGridError: unknown) {
                    // If SendGrid is not configured, log but don't fail
                    if (getErrorMessage(sendGridError)?.includes('SendGrid') || getErrorMessage(sendGridError)?.includes('not configured')) {
                      console.log('⚠️ SendGrid not configured - skipping payment receipt email');
                    } else {
                      throw sendGridError; // Re-throw other errors
                    }
                  }
                } else if (!client) {
                  console.log('⚠️ Client not found for invoice - skipping payment receipt email');
                } else {
                  console.log('⚠️ Client has no email address - skipping payment receipt email');
                }
              } catch (emailError) {
                // Log but don't throw - payment was still successful
                console.error('Failed to send payment receipt email:', emailError);
              }
            } else {
              console.log(`ℹ️ Receipt already sent for invoice ${invoice.number || invoiceId.substring(0, 8).toUpperCase()}`);
            }
          }
        }

        if (plan && userId) {
          const businessSettings = await storage.getBusinessSettings(userId);
          if (businessSettings) {
            const subUpdateData: any = {
              subscriptionTier: plan,
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
            };
            if ((plan === 'team' || plan === 'business') && (!businessSettings.teamSize || businessSettings.teamSize === 'solo')) {
              subUpdateData.teamSize = 'small';
            }
            await storage.updateBusinessSettings(userId, subUpdateData);

            await createNotification(storage, {
              userId,
              type: 'payment_success',
              title: 'Payment Successful',
              message: `Your ${plan} plan subscription is now active. Thank you!`,
              relatedType: 'subscription',
              relatedId: session.subscription as string,
            });

            try {
              const user = await storage.getUserById(userId);
              if (user && businessSettings.email) {
                await sendPaymentSuccessEmail(user, businessSettings, plan);
              }
            } catch (emailError) {
              console.error('Failed to send payment success email:', emailError);
            }
          }
        }

        // Handle AI Receptionist add-on checkout
        const checkoutType = session.metadata?.type;
        if (checkoutType === 'ai_receptionist' && userId) {
          console.log(`[AI Receptionist] Checkout completed for user ${userId}, triggering provisioning...`);

          // Store the subscription item ID for tracking
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

        const customerId = invoice.customer;
        const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
        
        if (businessSettings) {
          await createNotification(storage, {
            userId: businessSettings.userId,
            type: 'payment_received',
            title: 'Payment Received',
            message: `Subscription payment of $${(invoice.amount_paid / 100).toFixed(2)} received successfully.`,
            relatedType: 'subscription',
            relatedId: invoice.subscription,
          });

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
        logSystemEvent('stripe', 'error', 'invoice_payment_failed', `Invoice payment failed: ${invoice.id}`, { invoiceId: invoice.id, customerId: invoice.customer });

        const customerId = invoice.customer;
        const businessSettings = await storage.getBusinessSettingsByStripeCustomer(customerId);
        
        if (businessSettings) {
          await storage.updateBusinessSettings(businessSettings.userId, {
            subscriptionStatus: 'past_due',
          });

          await createNotification(storage, {
            userId: businessSettings.userId,
            type: 'payment_failed',
            title: 'Payment Failed',
            message: 'Your subscription payment failed. Please update your payment method to continue using Pro features.',
            relatedType: 'subscription',
            relatedId: invoice.subscription,
          });

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
          const isPaused = subscription.pause_collection != null;
          const effectiveStatus = isPaused ? 'paused' : subscription.status;
          
          const updateData: any = {
            subscriptionStatus: effectiveStatus,
          };
          
          if (isPaused) {
            updateData.subscriptionPausedAt = updateData.subscriptionPausedAt || new Date();
          } else if (subscription.status === 'active') {
            updateData.subscriptionPausedAt = null;
            updateData.subscriptionCanceledAt = null;
            updateData.dataRetentionExpiresAt = null;
          }
          
          await storage.updateBusinessSettings(businessSettings.userId, updateData);

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
          const canceledAt = new Date();
          const dataRetentionExpiresAt = new Date(canceledAt);
          dataRetentionExpiresAt.setMonth(dataRetentionExpiresAt.getMonth() + 12);
          await storage.updateBusinessSettings(businessSettings.userId, {
            subscriptionTier: 'free',
            subscriptionStatus: 'canceled',
            subscriptionCanceledAt: canceledAt,
            dataRetentionExpiresAt: dataRetentionExpiresAt,
          });

          await createNotification(storage, {
            userId: businessSettings.userId,
            type: 'subscription_canceled',
            title: 'Subscription Canceled',
            message: 'Your subscription has been canceled. You can reactivate anytime from Settings.',
            relatedType: 'subscription',
            relatedId: subscription.id,
          });

          if (businessSettings.phone) {
            const endDate = subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'the end of your billing period';
            try {
              await sendSMS({
                to: businessSettings.phone,
                message: `JobRunner: Your subscription has been cancelled. You have access until ${endDate}. Your data is kept for 12 months. Reactivate anytime at jobrunner.com.au`,
                alphanumericSenderId: 'JobRunner',
              });
            } catch (e) {
              console.error('[Webhook] Failed to send cancellation SMS:', e);
            }
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('✅ Payment intent succeeded:', paymentIntent.id);
        
        // Check if this is a quote deposit payment
        const quoteId = paymentIntent.metadata?.quoteId;
        const paymentType = paymentIntent.metadata?.paymentType;
        
        if (quoteId && paymentType === 'quote_deposit') {
          const tradieUserId = paymentIntent.metadata?.tradieUserId;
          const quoteNumber = paymentIntent.metadata?.quoteNumber;
          const clientName = paymentIntent.metadata?.clientName || 'Client';
          
          try {
            // Get the quote and update deposit status
            const quote = await storage.getQuote(quoteId, tradieUserId);
            if (quote && !(quote as any).depositPaid) {
              // Mark deposit as paid
              await storage.updateQuote(quoteId, tradieUserId, {
                depositPaid: true,
                depositPaidAt: new Date(),
              } as any);
              
              // Create deposit receipt record using Stripe-confirmed amount
              try {
                // Use paymentIntent.amount_received as authoritative source
                const confirmedAmount = paymentIntent.amount_received || paymentIntent.amount || 0;
                if (confirmedAmount > 0) {
                  const receiptNumber = await storage.generateReceiptNumber(tradieUserId);
                  await storage.createReceipt({
                    userId: tradieUserId,
                    receiptNumber,
                    amount: confirmedAmount,
                    paymentMethod: 'stripe_connect',
                    quoteId,
                    clientId: quote.clientId,
                    paidAt: new Date(),
                    paymentReference: paymentIntent.id,
                  });
                  console.log(`✅ Receipt ${receiptNumber} created for quote deposit ${quoteNumber} - Amount: $${(confirmedAmount / 100).toFixed(2)}`);
                } else {
                  console.warn(`⚠️ Skipping receipt creation for quote ${quoteId} deposit - zero amount`);
                }
              } catch (receiptError) {
                console.error('Failed to create deposit receipt record:', receiptError);
              }
              
              // Notify the tradie
              await createNotification(storage, {
                userId: tradieUserId,
                type: 'quote_deposit_paid',
                title: 'Quote Deposit Received',
                message: `${clientName} has paid the deposit for Quote #${quoteNumber}.`,
                relatedType: 'quote',
                relatedId: quoteId,
              });
              
              console.log(`✅ Quote ${quoteNumber} deposit marked as paid via Stripe Connect`);
            }
          } catch (error) {
            console.error('Error processing quote deposit payment:', error);
          }
          break;
        }
        
        // Handle Connect payments (customer paying tradie invoice)
        const invoiceId = paymentIntent.metadata?.invoiceId;
        const tradieUserId = paymentIntent.metadata?.tradieUserId;
        
        if (invoiceId && tradieUserId) {
          try {
            const invoice = await storage.getInvoice(invoiceId, tradieUserId);
            if (invoice && invoice.status !== 'paid') {
              const invoicePaymentType = paymentIntent.metadata?.paymentType || 'full';
              const confirmedAmount = paymentIntent.amount_received || paymentIntent.amount || 0;
              const totalCents = Math.round(parseFloat(invoice.total || '0') * 100);
              const previousAmountPaid = parseFloat(String(invoice.amountPaid || '0'));
              const newAmountPaid = previousAmountPaid + (confirmedAmount / 100);
              const isFullyPaid = Math.round(newAmountPaid * 100) >= totalCents;
              const isDepositPayment = invoicePaymentType === 'deposit' && !isFullyPaid;
              
              if (isFullyPaid) {
                await storage.updateInvoice(invoiceId, tradieUserId, {
                  status: 'paid',
                  paidAt: new Date(),
                  paymentMethod: 'stripe_connect',
                  stripePaymentIntentId: paymentIntent.id,
                  amountPaid: newAmountPaid.toFixed(2),
                  lockedAt: new Date(),
                  lockedReason: 'payment_received',
                });
              } else if (isDepositPayment) {
                await storage.updateInvoice(invoiceId, tradieUserId, {
                  status: 'deposit_paid',
                  depositPaid: true,
                  depositPaidAt: new Date(),
                  amountPaid: newAmountPaid.toFixed(2),
                  paymentMethod: 'stripe_connect',
                  stripePaymentIntentId: paymentIntent.id,
                });
              } else {
                await storage.updateInvoice(invoiceId, tradieUserId, {
                  amountPaid: newAmountPaid.toFixed(2),
                  paymentMethod: 'stripe_connect',
                  stripePaymentIntentId: paymentIntent.id,
                });
              }
              
              try {
                if (confirmedAmount > 0) {
                  const receiptNumber = await storage.generateReceiptNumber(tradieUserId);
                  const amountDollars = (confirmedAmount / 100).toFixed(2);
                  await storage.createReceipt({
                    userId: tradieUserId,
                    receiptNumber,
                    amount: amountDollars,
                    paymentMethod: 'stripe_connect',
                    invoiceId,
                    clientId: invoice.clientId,
                    paidAt: new Date(),
                    paymentReference: paymentIntent.id,
                    description: isDepositPayment ? `Deposit Payment - Invoice #${invoice.number}` : undefined,
                  });
                  console.log(`✅ Receipt ${receiptNumber} created for invoice ${invoice.number} (${isDepositPayment ? 'deposit' : 'payment'}) - Amount: $${amountDollars}`);
                }
              } catch (receiptError) {
                console.error('Failed to create receipt record:', receiptError);
              }
              
              const connectClient = await storage.getClientById(invoice.clientId);
              const clientDisplayName = connectClient?.name || connectClient?.firstName || 'Customer';
              
              if (isDepositPayment && !isFullyPaid) {
                await createNotification(storage, {
                  userId: tradieUserId,
                  type: 'invoice_deposit_paid',
                  title: 'Deposit Received',
                  message: `Deposit received — $${(confirmedAmount / 100).toFixed(2)} of $${parseFloat(invoice.total || '0').toFixed(2)} total for Invoice #${invoice.number} from ${clientDisplayName}.`,
                  relatedType: 'invoice',
                  relatedId: invoiceId,
                });
              } else {
                await createNotification(storage, {
                  userId: tradieUserId,
                  type: 'invoice_paid',
                  title: isFullyPaid ? 'Invoice Paid' : 'Payment Received',
                  message: isFullyPaid 
                    ? `Invoice #${invoice.number} has been paid in full via card payment.`
                    : `Payment of $${(confirmedAmount / 100).toFixed(2)} received for Invoice #${invoice.number} from ${clientDisplayName}.`,
                  relatedType: 'invoice',
                  relatedId: invoiceId,
                });
              }

              broadcastPaymentReceived(tradieUserId, {
                amount: confirmedAmount || parseFloat(invoice.total || '0') * 100,
                invoiceNumber: invoice.number,
                clientName: clientDisplayName,
                paymentMethod: 'stripe_connect',
              });
              
              console.log(`✅ Invoice ${invoice.number} ${isDepositPayment ? 'deposit' : 'payment'} processed via Stripe Connect`);
              
              if (isFullyPaid) {
                try {
                  const client = await storage.getClientById(invoice.clientId);
                  const settings = await storage.getBusinessSettingsByUserId(tradieUserId);
                  
                  if (client?.email && settings) {
                    await sendReceiptEmailWithPdf(
                      storage,
                      invoice,
                      client,
                      settings,
                      undefined,
                      tradieUserId
                    );
                  }
                } catch (emailError) {
                  console.error('Failed to send receipt email:', emailError);
                }
              }
            }
          } catch (error) {
            console.error('Error processing Connect payment:', error);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('⚠️ Payment intent failed:', paymentIntent.id);
        logSystemEvent('stripe', 'error', 'payment_intent_failed', `Payment intent failed: ${paymentIntent.id}`, { paymentIntentId: paymentIntent.id });
        
        // Notify tradie if this was a Connect payment attempt
        const invoiceId = paymentIntent.metadata?.invoiceId;
        const tradieUserId = paymentIntent.metadata?.tradieUserId;
        
        if (invoiceId && tradieUserId) {
          const invoice = await storage.getInvoice(invoiceId, tradieUserId);
          if (invoice) {
            await createNotification(storage, {
              userId: tradieUserId,
              type: 'payment_failed',
              title: 'Payment Attempt Failed',
              message: `A payment attempt for Invoice #${invoice.number} failed. The customer may need to try again.`,
              relatedType: 'invoice',
              relatedId: invoiceId,
            });
          }
        }
        break;
      }

      // Stripe Connect account events
      case 'account.updated': {
        const account = event.data.object;
        console.log('📝 Connect account updated:', account.id);
        
        // Find the tradie by their Connect account ID and update their status
        try {
          const businessSettings = await storage.getBusinessSettingsByConnectAccountId(account.id);
          if (businessSettings) {
            await storage.updateBusinessSettings(businessSettings.userId, {
              connectChargesEnabled: account.charges_enabled,
              connectPayoutsEnabled: account.payouts_enabled,
            });
            
            // Notify tradie when they complete onboarding
            if (account.charges_enabled && !businessSettings.connectChargesEnabled) {
              await createNotification(storage, {
                userId: businessSettings.userId,
                type: 'connect_ready',
                title: 'Online Payments Ready',
                message: 'Your Stripe account is now set up! You can accept online card payments from customers.',
                relatedType: 'integration',
                relatedId: 'stripe_connect',
              });
              console.log(`✅ Connect account ${account.id} is now ready to accept payments`);
            }
          }
        } catch (error) {
          logger.error('webhook', 'Error updating Connect account status', { error });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    logger.error('webhook', 'Error handling Stripe event', { error, metadata: { eventType: event.type } });
    logSystemEvent('stripe', 'error', 'webhook_handler_error', `Stripe webhook handler error for ${event.type}: ${(error as any)?.message || 'Unknown'}`, { eventType: event.type });
    throw error;
  }
}
