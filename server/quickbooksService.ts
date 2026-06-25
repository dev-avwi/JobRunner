import { storage } from "./storage";
import type { QuickbooksConnection } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";
import crypto from "crypto";
import { qboAccountsCache, qboTaxRatesCache, qboItemsCache } from "./cache";
import { getErrorMessage } from "./lib/errors";
import { logger } from "./logger";

const QUICKBOOKS_SCOPES = "com.intuit.quickbooks.accounting openid profile email";

const QUICKBOOKS_AUTHORIZATION_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

/**
 * Task #91: build a PDF buffer for an invoice using the same generator the
 * email/send-invoice flow uses. Returns null on any failure so callers can
 * silently skip the auto-attach step (best-effort).
 */
async function buildInvoicePdfBuffer(userId: string, invoiceId: string): Promise<Buffer | null> {
  try {
    const invoice = await storage.getInvoiceWithLineItems(invoiceId, userId);
    if (!invoice) return null;
    const client = await storage.getClientById(invoice.clientId);
    if (!client) return null;
    const business = await storage.getBusinessSettings(userId);
    if (!business) return null;
    const { generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
    const businessForPdf = await resolveBusinessLogoForPdf(business as any);
    const html = generateInvoicePDF({
      invoice: invoice as any,
      lineItems: (invoice as any).lineItems || [],
      client: client as any,
      business: businessForPdf as any,
    } as any);
    return await generatePDFBuffer(html);
  } catch (err) {
    console.warn('[QuickBooks] buildInvoicePdfBuffer failed:', err);
    return null;
  }
}

export function isQuickbooksConfigured(): boolean {
  return !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

function getRedirectUri(): string {
  const appUrl = process.env.VITE_APP_URL;
  let baseUrl: string;
  
  if (appUrl) {
    baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.REPLIT_DOMAINS) {
    baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  } else {
    baseUrl = "http://localhost:5000";
  }
  
  const redirectUri = `${baseUrl}/api/integrations/quickbooks/callback`;
  console.log('[QuickBooks] Using redirect URI:', redirectUri);
  return redirectUri;
}

export async function getAuthUrl(state: string): Promise<string> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("QUICKBOOKS_CLIENT_ID environment variable is required");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: QUICKBOOKS_SCOPES,
    state: state,
  });

  return `${QUICKBOOKS_AUTHORIZATION_URL}?${params.toString()}`;
}

export async function handleCallback(code: string, realmId: string, userId: string): Promise<QuickbooksConnection> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables are required");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[QuickBooks] Token exchange failed:', error);
    throw new Error(`Failed to exchange authorization code: ${error}`);
  }

  const tokenData = await response.json();

  const companyInfo = await getCompanyInfo(tokenData.access_token, realmId);
  
  const existingConnection = await storage.getQuickbooksConnection(userId);
  
  const connectionData = {
    userId,
    realmId,
    companyName: companyInfo?.CompanyName || null,
    accessToken: encrypt(tokenData.access_token),
    refreshToken: encrypt(tokenData.refresh_token),
    tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    refreshTokenExpiresAt: tokenData.x_refresh_token_expires_in 
      ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000)
      : null,
    scope: QUICKBOOKS_SCOPES,
    status: "active",
  };

  if (existingConnection) {
    const updated = await storage.updateQuickbooksConnection(existingConnection.id, connectionData);
    return updated!;
  } else {
    return await storage.createQuickbooksConnection(connectionData);
  }
}

async function getCompanyInfo(accessToken: string, realmId: string): Promise<any> {
  try {
    if (!/^\d+$/.test(realmId)) {
      throw new Error('Invalid QuickBooks realmId');
    }
    const safeRealmId = encodeURIComponent(realmId);
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${safeRealmId}/companyinfo/${safeRealmId}?minorversion=65`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[QuickBooks] Failed to fetch company info');
      return null;
    }

    const data = await response.json();
    return data.CompanyInfo;
  } catch (error) {
    console.error('[QuickBooks] Error fetching company info:', error);
    return null;
  }
}

/**
 * Live test of the user's QBO connection — refreshes token if needed, then
 * pulls CompanyInfo. Returns the company name on success.
 */
export async function testQuickbooksConnection(userId: string): Promise<{
  success: boolean;
  companyName?: string;
  realmId?: string;
  error?: string;
}> {
  try {
    const connection = await storage.getQuickbooksConnection(userId);
    if (!connection || connection.status !== 'active') {
      return { success: false, error: 'No active QuickBooks connection' };
    }
    const refreshed = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshed);
    const info = await getCompanyInfo(tokens.accessToken, refreshed.realmId);
    if (!info) {
      return { success: false, error: 'QuickBooks API returned no company info' };
    }
    return { success: true, companyName: info.CompanyName, realmId: refreshed.realmId };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) || 'QuickBooks connection test failed' };
  }
}

function decryptTokens(connection: QuickbooksConnection): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decrypt(connection.accessToken),
    refreshToken: decrypt(connection.refreshToken),
  };
}

export async function refreshTokenIfNeeded(connection: QuickbooksConnection): Promise<QuickbooksConnection> {
  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);
  const bufferMs = 5 * 60 * 1000;
  
  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return connection;
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables are required");
  }

  const tokens = decryptTokens(connection);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[QuickBooks] Token refresh failed:', error);
    await storage.updateQuickbooksConnection(connection.id, { status: 'expired' });
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const tokenData = await response.json();

  const updated = await storage.updateQuickbooksConnection(connection.id, {
    accessToken: encrypt(tokenData.access_token),
    refreshToken: encrypt(tokenData.refresh_token),
    tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    refreshTokenExpiresAt: tokenData.x_refresh_token_expires_in 
      ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000)
      : null,
  });

  return updated!;
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  configured: boolean;
  companyName?: string;
  lastSyncAt?: Date;
}> {
  const configured = isQuickbooksConfigured();
  
  if (!configured) {
    return { connected: false, configured: false };
  }

  const connection = await storage.getQuickbooksConnection(userId);
  
  if (!connection || connection.status !== 'active') {
    return { connected: false, configured: true };
  }

  return {
    connected: true,
    configured: true,
    companyName: connection.companyName || undefined,
    lastSyncAt: connection.lastSyncAt || undefined,
  };
}

export async function isQuickbooksConnected(userId: string): Promise<boolean> {
  const connection = await storage.getQuickbooksConnection(userId);
  return !!(connection && connection.status === 'active');
}

export async function disconnect(userId: string): Promise<boolean> {
  return await storage.deleteQuickbooksConnection(userId);
}

export async function syncContactsToQuickbooks(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let synced = 0;
  const errors: string[] = [];

  try {
    const clients = await storage.getClients(userId);
    
    for (const client of clients) {
      try {
        if (!client.name) continue;
        
        const existingCustomer = await findCustomerByEmail(
          tokens.accessToken, 
          refreshedConnection.realmId, 
          client.email
        );

        if (!existingCustomer) {
          await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
            DisplayName: client.name,
            PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
            PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
            BillAddr: client.address ? { Line1: client.address } : undefined,
          });
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync client ${client.name}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to sync contacts to QuickBooks: ${err}`);
  }
}

async function findCustomerByEmail(accessToken: string, realmId: string, email: string | null): Promise<any> {
  if (!email) return null;
  
  try {
    const query = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`);
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${realmId}/query?query=${query}&minorversion=65`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return null;
    
    const data = await response.json();
    return data.QueryResponse?.Customer?.[0] || null;
  } catch {
    return null;
  }
}

async function createCustomer(accessToken: string, realmId: string, customerData: any): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/customer?minorversion=65`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(customerData),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create customer: ${error}`);
  }

  const data = await response.json();
  return data.Customer;
}

/**
 * Resolve the QuickBooks ItemRef the tenant should use when pushing line items.
 * Reads businessSettings.quickbooksDefaultItemRef. Falls back to the legacy
 * {value:"1", name:"Services"} (most QBO companies have item id 1) and emits a
 * one-line warning so the issue is greppable in production logs.
 */
async function resolveQbItemRef(userId: string): Promise<{ value: string; name: string }> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    // Task #91: prefer the new mapping field qboDefaultItemId.
    const newId = settings?.qboDefaultItemId;
    if (newId && typeof newId === 'string') {
      return { value: newId, name: 'Services' };
    }
    const ref = (settings as any)?.quickbooksDefaultItemRef;
    if (ref && typeof ref === 'object' && typeof ref.value === 'string' && ref.value) {
      return { value: ref.value, name: typeof ref.name === 'string' ? ref.name : 'Services' };
    }
  } catch (err) {
    console.warn('[QuickBooks] Failed to read business settings for ItemRef:', err);
  }
  console.warn(`[QuickBooks] No qboDefaultItemId / quickbooksDefaultItemRef configured for user ${userId} — falling back to legacy ItemRef {value:"1", name:"Services"}.`);
  return { value: '1', name: 'Services' };
}

/**
 * Task #91: optional refs for Income account + Tax code, sourced from
 * businessSettings.qboSalesAccountId / qboTaxRateId. Returned as undefined
 * when not set so the spread-then-undefined pattern below leaves the QBO
 * payload exactly as it was before the user configured mapping.
 */
async function resolveQbExtraRefs(userId: string): Promise<{ tax?: { value: string } }> {
  // Task #91 (review fix): QBO `SalesItemLineDetail` does NOT accept
  // `IncomeAccountRef` — income accounts are configured on the Item itself,
  // not per line. So the user's selected sales account is intentionally NOT
  // injected into invoice/quote line payloads (would either be silently
  // ignored or rejected by the API). The mapping is still surfaced in the UI
  // and persisted because future flows (e.g. creating items via API) will
  // need it. Tax stays as `TaxCodeRef` / `TxnTaxCodeRef` which DO take a
  // TaxCode id (see getCachedTaxRates which now reads from TaxCode).
  try {
    const settings = await storage.getBusinessSettings(userId);
    const out: { tax?: { value: string } } = {};
    if (settings?.qboTaxRateId) out.tax = { value: String(settings.qboTaxRateId) };
    return out;
  } catch {
    return {};
  }
}

export async function syncInvoicesToQuickbooks(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  const itemRef = await resolveQbItemRef(userId);
  const extraRefs = await resolveQbExtraRefs(userId);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    
    for (const invoice of invoices) {
      try {
        if (invoice.status === 'draft') continue;
        // Task #115: never sync sample/demo records to upstream accounting systems.
        if (invoice.isSample) { skipped++; continue; }

        if ((invoice as any).quickbooksInvoiceId) {
          skipped++;
          continue;
        }
        
        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;
        if (client.isSample) { skipped++; continue; }

        let customer = await findCustomerByEmail(tokens.accessToken, refreshedConnection.realmId, client.email);
        
        if (!customer) {
          customer = await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
            DisplayName: client.name,
            PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
            PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
          });
        }

        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        const qbInvoice: any = {
          CustomerRef: { value: customer.Id },
          Line: lineItems.map(item => ({
            DetailType: "SalesItemLineDetail",
            Amount: parseFloat(item.unitPrice || "0") * parseFloat(item.quantity || "1"),
            SalesItemLineDetail: {
              ItemRef: itemRef,
              Qty: parseFloat(item.quantity || "1"),
              UnitPrice: parseFloat(item.unitPrice || "0"),
              
              ...(extraRefs.tax ? { TaxCodeRef: extraRefs.tax } : {}),
            },
            Description: item.description,
          })),
          DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
          DocNumber: invoice.number || (invoice as any).invoiceNumber || undefined,
          ...(extraRefs.tax ? { TxnTaxDetail: { TxnTaxCodeRef: extraRefs.tax } } : {}),
        };

        const createdInvoice = await createQuickbooksInvoice(
          tokens.accessToken, 
          refreshedConnection.realmId, 
          qbInvoice
        );
        
        if (createdInvoice?.Id) {
          await storage.updateInvoice(invoice.id, userId, {
            quickbooksInvoiceId: createdInvoice.Id,
            quickbooksSyncedAt: new Date(),
          });
          // Task #91 (review fix): bulk push parity — best-effort PDF attach.
          const _invId = invoice.id;
          buildInvoicePdfBuffer(userId, _invId)
            .then(buf => buf && attachInvoicePdfToQuickbooks(userId, _invId, buf, `Invoice-${invoice.number || _invId}.pdf`))
            .then(r => r && !r.success && console.warn('[QuickBooks] PDF attach warn:', r.error))
            .catch(err => console.warn('[QuickBooks] PDF attach error:', err));
        }
        
        synced++;
      } catch (err) {
        errors.push(`Failed to sync invoice ${invoice.number || (invoice as any).invoiceNumber}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, skipped, errors };
  } catch (err) {
    throw new Error(`Failed to sync invoices to QuickBooks: ${err}`);
  }
}

async function createQuickbooksInvoice(accessToken: string, realmId: string, invoiceData: any): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/invoice?minorversion=65`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(invoiceData),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create invoice: ${error}`);
  }

  const data = await response.json();
  return data.Invoice;
}

async function findVendorByName(accessToken: string, realmId: string, name: string): Promise<any> {
  try {
    const safe = name.replace(/'/g, "\\'");
    const query = encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${safe}'`);
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${realmId}/query?query=${query}&minorversion=65`,
      { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.QueryResponse?.Vendor?.[0] || null;
  } catch {
    return null;
  }
}

async function createVendor(accessToken: string, realmId: string, vendorData: any): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/vendor?minorversion=65`,
    {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(vendorData),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create vendor: ${error}`);
  }
  const data = await response.json();
  return data.Vendor;
}

async function createQuickbooksBill(accessToken: string, realmId: string, billData: any): Promise<any> {
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${realmId}/bill?minorversion=65`,
    {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(billData),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create bill: ${error}`);
  }
  const data = await response.json();
  return data.Bill;
}

// Task #271: push an approved subcontractor invoice to QuickBooks as a Bill (AP).
export async function pushSubcontractorBillToQuickbooks(
  userId: string,
  subInvoiceId: string,
): Promise<{ success: boolean; billId?: string; error?: string }> {
  try {
    const connection = await storage.getQuickbooksConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: false, error: "QuickBooks is not connected" };
    }

    const invoice = await storage.getSubcontractorInvoiceWithItems(subInvoiceId);
    if (!invoice) {
      return { success: false, error: "Subcontractor invoice not found" };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshedConnection);

    const subcontractor = await storage.getUser(invoice.subcontractorUserId);
    const full = subcontractor ? [subcontractor.firstName, subcontractor.lastName].filter(Boolean).join(" ").trim() : "";
    const vendorName = full || subcontractor?.email || "Subcontractor";

    let vendor = await findVendorByName(tokens.accessToken, refreshedConnection.realmId, vendorName);
    if (!vendor) {
      vendor = await createVendor(tokens.accessToken, refreshedConnection.realmId, {
        DisplayName: vendorName,
        PrimaryEmailAddr: subcontractor?.email ? { Address: subcontractor.email } : undefined,
      });
    }

    const settings: any = await storage.getBusinessSettings(userId);
    const expenseAccountId = settings?.qboExpenseAccountId || settings?.qboSalesAccountId;
    if (!expenseAccountId) {
      return { success: false, error: "No QuickBooks expense account configured. Set one in accounting mapping." };
    }

    const qbBill: any = {
      VendorRef: { value: vendor.Id },
      Line: invoice.items.map(item => {
        const qty = item.quantity != null ? parseFloat(item.quantity) : (item.hours != null ? parseFloat(item.hours) : 1);
        const priceVal = item.unitPrice != null ? item.unitPrice : item.rate;
        const unit = priceVal != null && priceVal !== '' ? parseFloat(priceVal) : parseFloat(item.amount || "0");
        const amount = parseFloat(item.amount || "0") || (qty * unit);
        return {
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: amount,
          Description: item.description,
          AccountBasedExpenseLineDetail: { AccountRef: { value: expenseAccountId } },
        };
      }),
      DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
      DocNumber: invoice.invoiceNumber || undefined,
    };

    const createdBill = await createQuickbooksBill(tokens.accessToken, refreshedConnection.realmId, qbBill);
    if (createdBill?.Id) {
      return { success: true, billId: createdBill.Id };
    }
    return { success: false, error: "QuickBooks did not return a bill id" };
  } catch (error: unknown) {
    console.error('[QuickBooks] Failed to push subcontractor bill:', error);
    return { success: false, error: getErrorMessage(error) || "Failed to push bill" };
  }
}

export async function syncPaymentsFromQuickbooks(userId: string): Promise<{ updated: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let updated = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    
    for (const invoice of invoices) {
      try {
        const qbInvoiceId = (invoice as any).quickbooksInvoiceId;
        if (!qbInvoiceId || invoice.status === 'paid') continue;
        
        const qbInvoice = await getQuickbooksInvoice(tokens.accessToken, refreshedConnection.realmId, qbInvoiceId);
        
        if (qbInvoice && qbInvoice.Balance === 0 && invoice.status !== 'paid') {
          await storage.updateInvoice(invoice.id, userId, {
            status: 'paid',
            paidAt: new Date(),
          });
          updated++;
        }
      } catch (err) {
        errors.push(`Failed to check payment for invoice ${invoice.number}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { updated, errors };
  } catch (err) {
    throw new Error(`Failed to sync payments from QuickBooks: ${err}`);
  }
}

async function getQuickbooksInvoice(accessToken: string, realmId: string, invoiceId: string): Promise<any> {
  if (!/^\d+$/.test(realmId) || !/^\d+$/.test(invoiceId)) {
    throw new Error('Invalid QuickBooks realmId or invoiceId');
  }
  const safeRealmId = encodeURIComponent(realmId);
  const safeInvoiceId = encodeURIComponent(invoiceId);
  const response = await fetch(
    `${QUICKBOOKS_API_BASE_URL}/${safeRealmId}/invoice/${safeInvoiceId}?minorversion=65`,
    {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return null;
  
  const data = await response.json();
  return data.Invoice;
}

export async function syncSingleInvoiceToQuickbooks(userId: string, invoiceId: string): Promise<{ success: boolean; quickbooksInvoiceId?: string; error?: string }> {
  try {
    const connection = await storage.getQuickbooksConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: true };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Task #115: never sync sample/demo records to upstream accounting systems.
    if (invoice.isSample) {
      return { success: true };
    }

    if ((invoice as any).quickbooksInvoiceId) {
      return { success: true, quickbooksInvoiceId: (invoice as any).quickbooksInvoiceId };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshedConnection);
    const itemRef = await resolveQbItemRef(userId);
    const extraRefs = await resolveQbExtraRefs(userId);

    const clients = await storage.getClients(userId);
    const client = clients.find(c => c.id === invoice.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    let customer = await findCustomerByEmail(tokens.accessToken, refreshedConnection.realmId, client.email);
    
    if (!customer) {
      customer = await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
        DisplayName: client.name,
        PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
        PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
      });
    }

    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    
    const qbInvoice: any = {
      CustomerRef: { value: customer.Id },
      Line: lineItems.map(item => ({
        DetailType: "SalesItemLineDetail",
        Amount: parseFloat(item.unitPrice || "0") * parseFloat(item.quantity || "1"),
        SalesItemLineDetail: {
          ItemRef: itemRef,
          Qty: parseFloat(item.quantity || "1"),
          UnitPrice: parseFloat(item.unitPrice || "0"),
          
          ...(extraRefs.tax ? { TaxCodeRef: extraRefs.tax } : {}),
        },
        Description: item.description,
      })),
      DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
      DocNumber: invoice.number || (invoice as any).invoiceNumber || undefined,
      ...(extraRefs.tax ? { TxnTaxDetail: { TxnTaxCodeRef: extraRefs.tax } } : {}),
    };

    const createdInvoice = await createQuickbooksInvoice(
      tokens.accessToken, 
      refreshedConnection.realmId, 
      qbInvoice
    );
    
    if (createdInvoice?.Id) {
      await storage.updateInvoice(invoice.id, userId, {
        quickbooksInvoiceId: createdInvoice.Id,
        quickbooksSyncedAt: new Date(),
      });
      // Task #91: best-effort PDF auto-attach (non-blocking).
      buildInvoicePdfBuffer(userId, invoiceId)
        .then(buf => {
          if (!buf) return;
          return attachInvoicePdfToQuickbooks(userId, invoiceId, buf, `Invoice-${invoice.number || invoice.id}.pdf`);
        })
        .then(r => r && !r.success && console.warn('[QuickBooks] PDF attach warn:', r.error))
        .catch(err => console.warn('[QuickBooks] PDF attach error:', err));
    }

    return { success: true, quickbooksInvoiceId: createdInvoice?.Id };
  } catch (error: unknown) {
    console.error('[QuickBooks] Failed to sync single invoice:', error);
    return { success: false, error: getErrorMessage(error) || "Failed to sync invoice" };
  }
}

export async function syncQuotesToQuickbooks(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  const itemRef = await resolveQbItemRef(userId);
  const extraRefs = await resolveQbExtraRefs(userId);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const quotes = await storage.getQuotes(userId);
    const clients = await storage.getClients(userId);

    for (const quote of quotes) {
      try {
        if (quote.status === 'draft') { skipped++; continue; }
        // Task #115: never sync sample/demo records to upstream accounting systems.
        if (quote.isSample) { skipped++; continue; }

        const client = clients.find(c => c.id === quote.clientId);
        if (!client) { skipped++; continue; }
        if (client.isSample) { skipped++; continue; }

        let customer = await findCustomerByEmail(tokens.accessToken, refreshedConnection.realmId, client.email);
        if (!customer) {
          customer = await createCustomer(tokens.accessToken, refreshedConnection.realmId, {
            DisplayName: client.name,
            PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
            PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
          });
        }

        const lineItems = await storage.getQuoteLineItems(quote.id);

        const estimate: any = {
          CustomerRef: { value: customer.Id },
          Line: lineItems.map(item => ({
            DetailType: "SalesItemLineDetail",
            Amount: parseFloat(item.unitPrice || "0") * parseFloat(item.quantity || "1"),
            SalesItemLineDetail: {
              ItemRef: itemRef,
              Qty: parseFloat(item.quantity || "1"),
              UnitPrice: parseFloat(item.unitPrice || "0"),
              
              ...(extraRefs.tax ? { TaxCodeRef: extraRefs.tax } : {}),
            },
            Description: item.description,
          })),
          DocNumber: quote.number || undefined,
          TxnDate: quote.createdAt ? new Date(quote.createdAt).toISOString().split('T')[0] : undefined,
          ExpirationDate: quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : undefined,
          ...(extraRefs.tax ? { TxnTaxDetail: { TxnTaxCodeRef: extraRefs.tax } } : {}),
        };

        const response = await fetch(
          `${QUICKBOOKS_API_BASE_URL}/${refreshedConnection.realmId}/estimate?minorversion=65`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.accessToken}`,
            },
            body: JSON.stringify(estimate),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to create estimate: ${error}`);
        }

        synced++;
      } catch (err) {
        errors.push(`Failed to sync quote ${quote.number}: ${err}`);
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { synced, skipped, errors };
  } catch (err) {
    throw new Error(`Failed to sync quotes to QuickBooks: ${err}`);
  }
}

/**
 * Void an invoice in QuickBooks Online.
 *
 * QBO supports a real `?operation=void` POST that flips the invoice total to 0
 * and stamps it VOIDED in the company's books. We use that here and report
 * voidMethod: 'void' on success so the caller can distinguish a true void from
 * a credit-note workaround (see voidInvoiceInMyob for contrast).
 */
export async function voidInvoiceInQuickbooks(userId: string, invoiceId: string): Promise<{
  success: boolean;
  voidMethod: 'void' | 'credit_note' | 'unsupported';
  message: string;
  error?: string;
}> {
  try {
    const connection = await storage.getQuickbooksConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: false, voidMethod: 'unsupported', message: "No active QuickBooks connection", error: "No active QuickBooks connection" };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, voidMethod: 'unsupported', message: "Invoice not found", error: "Invoice not found" };
    }

    const qbInvoiceId = (invoice as any).quickbooksInvoiceId;
    if (!qbInvoiceId) {
      return { success: false, voidMethod: 'unsupported', message: "Invoice not synced to QuickBooks", error: "Invoice not synced to QuickBooks" };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshedConnection);

    const qbInvoice = await getQuickbooksInvoice(tokens.accessToken, refreshedConnection.realmId, qbInvoiceId);
    if (!qbInvoice) {
      return { success: false, voidMethod: 'unsupported', message: "Invoice not found in QuickBooks", error: "Invoice not found in QuickBooks" };
    }

    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${refreshedConnection.realmId}/invoice?operation=void&minorversion=65`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          Id: qbInvoice.Id,
          SyncToken: qbInvoice.SyncToken,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, voidMethod: 'void', message: `Failed to void invoice in QuickBooks: ${errText}`, error: errText };
    }

    return { success: true, voidMethod: 'void', message: `Invoice ${qbInvoiceId} voided in QuickBooks` };
  } catch (error: unknown) {
    return { success: false, voidMethod: 'void', message: getErrorMessage(error), error: getErrorMessage(error) };
  }
}

export async function syncCreditNotesFromQuickbooks(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let synced = 0;
  const errors: string[] = [];

  try {
    const query = encodeURIComponent("SELECT * FROM CreditMemo MAXRESULTS 100");
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${refreshedConnection.realmId}/query?query=${query}&minorversion=65`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const creditMemos = data.QueryResponse?.CreditMemo || [];
      synced = creditMemos.length;
      console.log(`[QuickBooks] Found ${synced} credit memos`);
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to sync credit notes from QuickBooks: ${err}`);
  }
}

export async function syncInventoryFromQuickbooks(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active QuickBooks connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);

  let synced = 0;
  const errors: string[] = [];

  try {
    const query = encodeURIComponent("SELECT * FROM Item WHERE Type = 'Inventory' MAXRESULTS 200");
    const response = await fetch(
      `${QUICKBOOKS_API_BASE_URL}/${refreshedConnection.realmId}/query?query=${query}&minorversion=65`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const items = data.QueryResponse?.Item || [];
      
      for (const item of items) {
        try {
          const existingItems = await storage.getLineItemCatalog(userId);
          const matchingItem = existingItems.find(
            (ci: any) => ci.name?.toLowerCase() === item.Name?.toLowerCase()
          );

          if (!matchingItem && item.Name) {
            await storage.createLineItemCatalogItem({
              userId,
              name: item.Name,
              description: item.Description || null,
              unitPrice: item.UnitPrice ? String(item.UnitPrice) : null,
              category: 'inventory',
            } as any);
            synced++;
          }
        } catch (err) {
          errors.push(`Failed to sync inventory item ${item.Name}: ${err}`);
        }
      }
    }

    await storage.updateQuickbooksConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to sync inventory from QuickBooks: ${err}`);
  }
}

export async function runFullQuickbooksSync(userId: string): Promise<{
  contacts: { synced: number; errors: string[] };
  invoices: { synced: number; skipped: number; errors: string[] };
  payments: { updated: number; errors: string[] };
  quotes: { synced: number; skipped: number; errors: string[] };
  creditNotes: { synced: number; errors: string[] };
  inventory: { synced: number; errors: string[] };
}> {
  const contacts = await syncContactsToQuickbooks(userId);
  const invoices = await syncInvoicesToQuickbooks(userId);
  const payments = await syncPaymentsFromQuickbooks(userId);
  const quotes = await syncQuotesToQuickbooks(userId);
  const creditNotes = await syncCreditNotesFromQuickbooks(userId);
  const inventory = await syncInventoryFromQuickbooks(userId);

  return { contacts, invoices, payments, quotes, creditNotes, inventory };
}

export async function getSyncSummary(userId: string): Promise<{
  connected: boolean;
  lastSyncAt?: Date;
  companyName?: string;
}> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== "active") {
    return { connected: false };
  }

  return {
    connected: true,
    lastSyncAt: connection.lastSyncAt || undefined,
    companyName: connection.companyName || undefined,
  };
}

// ─── Pull-and-cache helpers (Task #91) ─────────────────────────────────────
async function qboQuery<T = any>(userId: string, query: string): Promise<T[]> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection || connection.status !== 'active') throw new Error('No active QuickBooks connection');
  const refreshed = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshed);
  const url = `${QUICKBOOKS_API_BASE_URL}/${refreshed.realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  const r = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${tokens.accessToken}` } });
  if (!r.ok) throw new Error(`QBO query failed: ${await r.text()}`);
  const data = await r.json();
  const key = Object.keys(data.QueryResponse || {}).find(k => k !== 'startPosition' && k !== 'maxResults' && k !== 'totalCount');
  return (key ? data.QueryResponse[key] : []) || [];
}

export async function getCachedAccounts(userId: string) {
  return qboAccountsCache.getOrLoad(userId, async () => {
    const accounts = await qboQuery(userId, "SELECT Id, Name, AccountType, AccountSubType, Active FROM Account WHERE Active = true MAXRESULTS 500");
    return accounts.map((a: any) => ({ id: a.Id, name: a.Name, type: a.AccountType, subType: a.AccountSubType }));
  });
}
export async function getCachedTaxRates(userId: string) {
  // Task #91 (review fix): QBO line items take TaxCodeRef / TxnTaxCodeRef which
  // expect TaxCode IDs, NOT TaxRate IDs — the two entities have separate ID
  // namespaces. Loading from TaxCode here keeps the mapping ID we persist
  // (businessSettings.qboTaxCodeId) compatible with what
  // resolveQbExtraRefs writes into invoice/quote payloads. Active TaxCodes
  // with their first SalesTaxRate effective rate are surfaced for UX.
  return qboTaxRatesCache.getOrLoad(userId, async () => {
    const codes = await qboQuery(userId, "SELECT Id, Name, Description, Active, SalesTaxRateList FROM TaxCode WHERE Active = true MAXRESULTS 200");
    return codes.map((c: any) => {
      const firstRate = c?.SalesTaxRateList?.TaxRateDetail?.[0]?.RateValue;
      return { id: c.Id, name: c.Name, rate: firstRate ?? null };
    });
  });
}
export async function getCachedItems(userId: string) {
  return qboItemsCache.getOrLoad(userId, async () => {
    const items = await qboQuery(userId, "SELECT Id, Name, Type, UnitPrice, Active FROM Item WHERE Active = true MAXRESULTS 500");
    return items.map((i: any) => ({ id: i.Id, name: i.Name, type: i.Type, unitPrice: i.UnitPrice }));
  });
}
export function invalidateQboMappingCache(userId: string) {
  qboAccountsCache.invalidate(userId);
  qboTaxRatesCache.invalidate(userId);
  qboItemsCache.invalidate(userId);
}

// ─── Webhook (Task #91) ────────────────────────────────────────────────────
// QBO webhooks: HMAC-SHA256(rawBody, QBO_WEBHOOK_VERIFIER_TOKEN), base64,
// compared against `intuit-signature` header. Verify BEFORE any side effect.
export function verifyQboWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const token = process.env.QBO_WEBHOOK_VERIFIER_TOKEN || process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
  if (!token || !signature) return false;
  try {
    const expected = crypto.createHmac('sha256', token).update(rawBody).digest('base64');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Task #91 (review fix): in-memory dedupe for QBO webhook events. QBO retries
// failed deliveries with the same event payload, and bursty updates can also
// arrive duplicated. Key by realmId+entityName+entityId+lastUpdated so we
// don't double-apply the same change. Bounded LRU-ish; entries auto-expire
// after 10 minutes which comfortably covers Intuit's retry window.
const QBO_WEBHOOK_DEDUPE_TTL_MS = 10 * 60 * 1000;
const QBO_WEBHOOK_DEDUPE_MAX = 5000;
const qboWebhookSeen = new Map<string, number>();
function qboDedupeKey(realmId: string, ent: any): string {
  return `${realmId}|${ent?.name}|${ent?.id}|${ent?.lastUpdated || ''}|${ent?.operation || ''}`;
}
function qboShouldProcess(key: string): boolean {
  const now = Date.now();
  const prev = qboWebhookSeen.get(key);
  if (prev && now - prev < QBO_WEBHOOK_DEDUPE_TTL_MS) return false;
  if (qboWebhookSeen.size > QBO_WEBHOOK_DEDUPE_MAX) {
    // Drop the oldest ~10% to keep memory bounded.
    const cutoff = now - QBO_WEBHOOK_DEDUPE_TTL_MS;
    for (const [k, t] of Array.from(qboWebhookSeen)) {
      if (t < cutoff) qboWebhookSeen.delete(k);
    }
  }
  qboWebhookSeen.set(key, now);
  return true;
}

export async function processQboWebhookPayload(payload: any): Promise<void> {
  const notifications = payload?.eventNotifications || [];
  for (const note of notifications) {
    const realmId = note.realmId;
    const entities = (note.dataChangeEvent?.entities || []).filter((ent: any) =>
      qboShouldProcess(qboDedupeKey(realmId, ent))
    );
    const conns = await (storage.getAllQuickbooksConnections?.() || Promise.resolve([] as QuickbooksConnection[]));
    const matching = (conns as QuickbooksConnection[]).filter(c => c.realmId === realmId);
    if (matching.length === 0) continue;

    for (const conn of matching) {
      try {
        for (const ent of entities) {
          const { name, id, operation } = ent;
          if (name === 'Invoice') {
            const invoices = await storage.getInvoices(conn.userId);
            const local = invoices.find((inv: any) => inv.quickbooksInvoiceId === id);
            if (!local) continue;
            if (operation === 'Delete' || operation === 'Void') {
              if (local.status !== 'cancelled') {
                await storage.updateInvoice(local.id, conn.userId, { status: 'cancelled', quickbooksSyncedAt: new Date() } as any);
              }
            } else if (operation === 'Update' || operation === 'Create') {
              const refreshed = await refreshTokenIfNeeded(conn);
              const tokens = decryptTokens(refreshed);
              const qbInv = await getQuickbooksInvoice(tokens.accessToken, refreshed.realmId, id);
              if (qbInv && qbInv.Balance === 0 && local.status !== 'paid') {
                await storage.updateInvoice(local.id, conn.userId, { status: 'paid', paidAt: new Date(), quickbooksSyncedAt: new Date() } as any);
              }
            }
          }
        }
        // stamp lastWebhookAt
        try { await storage.updateBusinessSettings(conn.userId, { qboLastWebhookAt: new Date() } as any); } catch (e) {
          logger.warn('webhook', 'QBO webhook: failed to stamp qboLastWebhookAt', { userId: conn.userId, error: e });
        }
      } catch (err) {
        console.error('[QBO Webhook] processing error:', err);
      }
    }
  }
}

/**
 * Attach a generated invoice PDF to the matching QBO invoice using the
 * Attachable upload endpoint (multipart/form-data). Best-effort.
 */
export async function attachInvoicePdfToQuickbooks(userId: string, invoiceId: string, pdfBuffer: Buffer, fileName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const invoice = await storage.getInvoice(invoiceId, userId);
    const qbInvoiceId = (invoice as any)?.quickbooksInvoiceId;
    if (!qbInvoiceId) return { success: false, error: 'Invoice not synced to QuickBooks' };
    const connection = await storage.getQuickbooksConnection(userId);
    if (!connection || connection.status !== 'active') return { success: false, error: 'No active QuickBooks connection' };
    const refreshed = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshed);

    const boundary = `----JobRunnerQBO${Date.now()}`;
    const meta = {
      AttachableRef: [{ EntityRef: { type: 'Invoice', value: qbInvoiceId } }],
      FileName: fileName,
      ContentType: 'application/pdf',
    };
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file_metadata_0"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n`));
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file_content_0"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`));
    parts.push(pdfBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const r = await fetch(`${QUICKBOOKS_API_BASE_URL}/${refreshed.realmId}/upload?minorversion=65`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body as any,
    });
    if (!r.ok) {
      const t = await r.text();
      return { success: false, error: `QBO attach failed: ${t}` };
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) || String(err) };
  }
}

export async function getDetailedSyncStatus(userId: string): Promise<{
  connected: boolean;
  companyName?: string;
  lastSyncAt?: Date;
  status?: string;
  capabilities: string[];
}> {
  const connection = await storage.getQuickbooksConnection(userId);
  if (!connection) {
    return { connected: false, capabilities: [] };
  }

  return {
    connected: connection.status === "active",
    companyName: connection.companyName || undefined,
    lastSyncAt: connection.lastSyncAt || undefined,
    status: connection.status || "unknown",
    capabilities: [
      'contacts_sync',
      'invoices_sync',
      'quotes_sync',
      'payments_sync',
      'credit_notes_sync',
      'inventory_sync',
      'single_invoice_sync',
      'void_invoice',
      'full_sync',
    ],
  };
}
