import axios from "axios";
import { storage } from "./storage";
import type { MyobConnection } from "@workspace/db";
import { encrypt, decrypt } from "./encryption";
import { myobAccountsCache, myobTaxCodesCache, myobItemsCache } from "./cache";
import { getErrorMessage } from "./lib/errors";

// ─── Pull-and-cache helpers (Task #91) ─────────────────────────────────────
async function myobGet(userId: string, path: string): Promise<any[]> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== 'active') throw new Error('No active MYOB connection');
  const refreshed = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshed);
  const cfToken = getCfToken(refreshed);
  if (!cfToken) throw new Error('Company file credentials not configured');
  const r = await axios.get(`${MYOB_API_BASE}/${refreshed.businessId}/${path}`, { headers: getApiHeaders(tokens.accessToken, cfToken) });
  return r.data?.Items || [];
}
export async function getCachedAccounts(userId: string) {
  return myobAccountsCache.getOrLoad(userId, async () => {
    const accs = await myobGet(userId, 'GeneralLedger/Account');
    return accs.map((a: any) => ({ id: a.UID, displayId: a.DisplayID, name: a.Name, type: a.Type, classification: a.Classification }));
  });
}
export async function getCachedTaxCodes(userId: string) {
  return myobTaxCodesCache.getOrLoad(userId, async () => {
    const codes = await myobGet(userId, 'GeneralLedger/TaxCode');
    return codes.map((t: any) => ({ id: t.UID, code: t.Code, description: t.Description, rate: t.Rate }));
  });
}
export async function getCachedItems(userId: string) {
  return myobItemsCache.getOrLoad(userId, async () => {
    const items = await myobGet(userId, 'Inventory/Item');
    return items.map((i: any) => ({ id: i.UID, number: i.Number, name: i.Name, sellingPrice: i.SellingDetails?.BaseSellingPrice }));
  });
}
export function invalidateMyobMappingCache(userId: string) {
  myobAccountsCache.invalidate(userId);
  myobTaxCodesCache.invalidate(userId);
  myobItemsCache.invalidate(userId);
}

const MYOB_SCOPES = "sme-company-file sme-customer sme-invoice sme-sales";
const MYOB_AUTH_URL = "https://secure.myob.com/oauth2/account/authorize";
const MYOB_TOKEN_URL = "https://secure.myob.com/oauth2/v1/authorize";
const MYOB_API_BASE = "https://api.myob.com/accountright";

function getRedirectUri(): string {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG && process.env.REPL_OWNER 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : "http://localhost:5000";
  return `${baseUrl}/api/integrations/myob/callback`;
}

export function isMyobConfigured(): boolean {
  return !!(process.env.MYOB_CLIENT_ID && process.env.MYOB_CLIENT_SECRET);
}

export function getAuthUrl(state: string): string {
  const clientId = process.env.MYOB_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("MYOB_CLIENT_ID environment variable is required");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: MYOB_SCOPES,
    state: state,
    prompt: "consent",
  });

  return `${MYOB_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(
  code: string,
  businessId: string,
  userId: string
): Promise<MyobConnection> {
  const clientId = process.env.MYOB_CLIENT_ID;
  const clientSecret = process.env.MYOB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("MYOB_CLIENT_ID and MYOB_CLIENT_SECRET environment variables are required");
  }

  const tokenResponse = await axios.post(
    MYOB_TOKEN_URL,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: getRedirectUri(),
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token, expires_in } = tokenResponse.data;
  
  let companyName: string | null = null;
  try {
    const companyFilesResponse = await axios.get(MYOB_API_BASE, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "x-myobapi-key": clientId,
        "x-myobapi-version": "v2",
      },
    });
    
    const companyFiles = companyFilesResponse.data;
    const matchingFile = companyFiles.find((cf: any) => cf.Id === businessId);
    if (matchingFile) {
      companyName = matchingFile.Name || null;
    }
  } catch (err) {
    console.warn("Failed to fetch company name from MYOB:", err);
  }

  const existingConnection = await storage.getMyobConnection(userId);
  
  const connectionData = {
    userId,
    businessId,
    companyName,
    accessToken: encrypt(access_token),
    refreshToken: encrypt(refresh_token),
    tokenExpiresAt: new Date(Date.now() + (expires_in || 1200) * 1000),
    scope: MYOB_SCOPES,
    status: "active",
  };

  if (existingConnection) {
    const updated = await storage.updateMyobConnection(existingConnection.id, connectionData);
    return updated!;
  } else {
    return await storage.createMyobConnection(connectionData);
  }
}

function decryptTokens(connection: MyobConnection): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decrypt(connection.accessToken),
    refreshToken: decrypt(connection.refreshToken),
  };
}

function getCfToken(connection: MyobConnection): string | null {
  if (!connection.cfUsername || !connection.cfPassword) {
    return null;
  }
  const username = decrypt(connection.cfUsername);
  const password = decrypt(connection.cfPassword);
  return Buffer.from(`${username}:${password}`).toString('base64');
}

function getApiHeaders(accessToken: string, cfToken: string | null): Record<string, string> {
  const clientId = process.env.MYOB_CLIENT_ID!;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "x-myobapi-key": clientId,
    "x-myobapi-version": "v2",
  };
  if (cfToken) {
    headers["x-myobapi-cftoken"] = cfToken;
  }
  return headers;
}

export async function refreshTokenIfNeeded(connection: MyobConnection): Promise<MyobConnection> {
  const now = new Date();
  const expiresAt = new Date(connection.tokenExpiresAt);
  const bufferMs = 2 * 60 * 1000;
  
  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return connection;
  }

  const clientId = process.env.MYOB_CLIENT_ID;
  const clientSecret = process.env.MYOB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("MYOB_CLIENT_ID and MYOB_CLIENT_SECRET environment variables are required");
  }

  const tokens = decryptTokens(connection);
  
  const tokenResponse = await axios.post(
    MYOB_TOKEN_URL,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token, expires_in } = tokenResponse.data;

  const updated = await storage.updateMyobConnection(connection.id, {
    accessToken: encrypt(access_token),
    refreshToken: encrypt(refresh_token),
    tokenExpiresAt: new Date(Date.now() + (expires_in || 1200) * 1000),
  });

  return updated!;
}

export async function syncContactsFromMyob(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active MYOB connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  const clientId = process.env.MYOB_CLIENT_ID!;
  
  let synced = 0;
  const errors: string[] = [];

  const cfToken = getCfToken(refreshedConnection);
  if (!cfToken) {
    throw new Error("Company file credentials not configured. Please set your MYOB company file username and password.");
  }

  try {
    const customersResponse = await axios.get(
      `${MYOB_API_BASE}/${refreshedConnection.businessId}/Contact/Customer`,
      {
        headers: getApiHeaders(tokens.accessToken, cfToken),
      }
    );

    const myobCustomers = customersResponse.data.Items || [];
    
    for (const customer of myobCustomers) {
      try {
        if (!customer.CompanyName && !customer.FirstName) continue;
        
        const name = customer.CompanyName || `${customer.FirstName || ''} ${customer.LastName || ''}`.trim();
        const existingClients = await storage.getClients(userId);
        const matchingClient = existingClients.find(
          c => c.email?.toLowerCase() === customer.Email?.toLowerCase() ||
               c.name.toLowerCase() === name.toLowerCase()
        );

        if (!matchingClient && name) {
          await storage.createClient({
            userId,
            name,
            email: customer.Email || null,
            phone: customer.Phone1 || null,
            address: customer.Addresses?.[0]?.Street || null,
          });
          synced++;
        }
      } catch (err) {
        errors.push(`Failed to sync customer ${customer.CompanyName || customer.FirstName}: ${err}`);
      }
    }

    await storage.updateMyobConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to fetch customers from MYOB: ${err}`);
  }
}

export async function syncInvoicesToMyob(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active MYOB connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  
  const cfToken = getCfToken(refreshedConnection);
  if (!cfToken) {
    throw new Error("Company file credentials not configured. Please set your MYOB company file username and password.");
  }
  
  let synced = 0;
  const errors: string[] = [];

  try {
    const invoices = await storage.getInvoices(userId);
    const clients = await storage.getClients(userId);
    // Task #91: enrich line payload with the user's configured income
    // account, tax code and default item if mapping has been completed.
    // Falls back to the original minimal MYOB Invoice/Service shape when
    // mapping is unset, so this is purely additive.
    const settings: any = await storage.getBusinessSettings(userId);
    const incomeAcct = settings?.myobIncomeAccountId;
    const taxCode = settings?.myobTaxCodeId;
    const defaultItem = settings?.myobDefaultItemId;
    
    for (const invoice of invoices) {
      try {
        if (invoice.status === 'draft') continue;
        // Task #115: never sync sample/demo records to upstream accounting systems.
        if (invoice.isSample) continue;

        const client = clients.find(c => c.id === invoice.clientId);
        if (!client) continue;
        if (client.isSample) continue;

        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        const myobInvoice = {
          Number: invoice.number,
          Customer: {
            Name: client.name,
          },
          Lines: lineItems.map(item => ({
            Description: item.description,
            Total: parseFloat(item.total || "0"),
            ...(incomeAcct ? { Account: { UID: incomeAcct } } : {}),
            ...(taxCode ? { TaxCode: { UID: taxCode } } : {}),
            ...(defaultItem ? { Item: { UID: defaultItem } } : {}),
          })),
          Date: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        };

        const invoiceHeaders = getApiHeaders(tokens.accessToken, cfToken);
        invoiceHeaders["Content-Type"] = "application/json";
        await axios.post(
          `${MYOB_API_BASE}/${refreshedConnection.businessId}/Sale/Invoice/Service`,
          myobInvoice,
          {
            headers: invoiceHeaders,
          }
        );
        
        synced++;
      } catch (err) {
        errors.push(`Failed to sync invoice ${invoice.number}: ${err}`);
      }
    }

    await storage.updateMyobConnection(refreshedConnection.id, {
      lastSyncAt: new Date(),
    });

    return { synced, errors };
  } catch (err) {
    throw new Error(`Failed to sync invoices to MYOB: ${err}`);
  }
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  companyName?: string;
  businessId?: string;
  lastSyncAt?: Date;
  status?: string;
  cfCredentialsSet?: boolean;
}> {
  const connection = await storage.getMyobConnection(userId);
  
  if (!connection) {
    return { connected: false };
  }

  return {
    connected: connection.status === "active",
    companyName: connection.companyName || undefined,
    businessId: connection.businessId,
    lastSyncAt: connection.lastSyncAt || undefined,
    status: connection.status || "unknown",
    cfCredentialsSet: !!(connection.cfUsername && connection.cfPassword),
  };
}

/**
 * Live MYOB upstream probe — actually hits the MYOB AccountRight API
 * (lists company files) to verify the stored token is still valid right now.
 * Refreshes the token if it's about to expire. Distinguishes between "not
 * connected", "token expired/revoked", and "MYOB API unreachable".
 */
export async function testMyobConnection(userId: string): Promise<{
  success: boolean;
  message: string;
  detail?: any;
  error?: string;
}> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection) {
    return { success: false, message: 'Not connected to MYOB' };
  }
  if (connection.status !== 'active') {
    return { success: false, message: `MYOB connection status: ${connection.status}` };
  }

  const clientId = process.env.MYOB_CLIENT_ID;
  if (!clientId) {
    return { success: false, message: 'MYOB_CLIENT_ID not configured on server' };
  }

  try {
    const refreshed = await refreshTokenIfNeeded(connection);
    const { accessToken } = decryptTokens(refreshed);
    const response = await axios.get(MYOB_API_BASE, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-myobapi-key': clientId,
        'x-myobapi-version': 'v2',
      },
      timeout: 10000,
    });
    const companyFiles = Array.isArray(response.data) ? response.data : [];
    const matching = companyFiles.find((cf: any) => cf.Id === refreshed.businessId);
    const companyName = matching?.Name || refreshed.companyName || null;
    return {
      success: true,
      message: companyName
        ? `Connected to "${companyName}" (${companyFiles.length} company file${companyFiles.length === 1 ? '' : 's'} visible)`
        : `Connected to MYOB (${companyFiles.length} company file${companyFiles.length === 1 ? '' : 's'} visible)`,
      detail: {
        companyName,
        businessId: refreshed.businessId,
        companyFileCount: companyFiles.length,
        cfCredentialsSet: !!(refreshed.cfUsername && refreshed.cfPassword),
        lastSyncAt: refreshed.lastSyncAt,
      },
    };
  } catch (err: any) {
    const upstream = err?.response?.data || getErrorMessage(err) || 'Unknown error';
    const status = err?.response?.status;
    const msg = status === 401
      ? 'MYOB token rejected (401) — please reconnect'
      : status === 403
        ? 'MYOB returned 403 — check API permissions / company file access'
        : `MYOB API call failed${status ? ` (HTTP ${status})` : ''}: ${typeof upstream === 'string' ? upstream : JSON.stringify(upstream).slice(0, 200)}`;
    return { success: false, message: msg, error: getErrorMessage(err) };
  }
}

export async function setCompanyFileCredentials(
  userId: string,
  cfUsername: string,
  cfPassword: string
): Promise<{ success: boolean }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection) {
    throw new Error("No MYOB connection found. Please connect to MYOB first.");
  }

  await storage.updateMyobConnection(connection.id, {
    cfUsername: encrypt(cfUsername),
    cfPassword: encrypt(cfPassword),
  });

  return { success: true };
}

export async function disconnect(userId: string): Promise<boolean> {
  return await storage.deleteMyobConnection(userId);
}

export async function syncSingleInvoiceToMyob(userId: string, invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = await storage.getMyobConnection(userId);
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

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshedConnection);
    const cfToken = getCfToken(refreshedConnection);
    if (!cfToken) {
      return { success: false, error: "Company file credentials not configured" };
    }

    const client = await storage.getClientById(invoice.clientId);
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    // Task #91: enrich with mapping refs (income account / tax code / item).
    const settingsForLines: any = await storage.getBusinessSettings(userId);
    const incomeAcct = settingsForLines?.myobIncomeAccountId;
    const taxCode = settingsForLines?.myobTaxCodeId;
    const defaultItem = settingsForLines?.myobDefaultItemId;
    
    const myobInvoice = {
      Number: invoice.number || (invoice as any).invoiceNumber,
      Customer: { Name: client.name },
      Lines: lineItems.map(item => ({
        Description: item.description,
        Total: parseFloat(item.total || "0"),
        ...(incomeAcct ? { Account: { UID: incomeAcct } } : {}),
        ...(taxCode ? { TaxCode: { UID: taxCode } } : {}),
        ...(defaultItem ? { Item: { UID: defaultItem } } : {}),
      })),
      Date: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    };

    const headers = getApiHeaders(tokens.accessToken, cfToken);
    headers["Content-Type"] = "application/json";
    await axios.post(
      `${MYOB_API_BASE}/${refreshedConnection.businessId}/Sale/Invoice/Service`,
      myobInvoice,
      { headers }
    );

    return { success: true };
  } catch (error: unknown) {
    console.error('[MYOB] Failed to sync single invoice:', error);
    return { success: false, error: getErrorMessage(error) || "Failed to sync invoice" };
  }
}

// Task #271: push an approved subcontractor invoice to MYOB as a supplier bill
// (Purchase / accounts-payable entry).
export async function pushSubcontractorBillToMyob(
  userId: string,
  subInvoiceId: string,
): Promise<{ success: boolean; billId?: string; error?: string }> {
  try {
    const connection = await storage.getMyobConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: false, error: "MYOB is not connected" };
    }

    const invoice = await storage.getSubcontractorInvoiceWithItems(subInvoiceId);
    if (!invoice) {
      return { success: false, error: "Subcontractor invoice not found" };
    }

    const refreshedConnection = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshedConnection);
    const cfToken = getCfToken(refreshedConnection);
    if (!cfToken) {
      return { success: false, error: "Company file credentials not configured" };
    }

    const subcontractor = await storage.getUser(invoice.subcontractorUserId);
    const full = subcontractor ? [subcontractor.firstName, subcontractor.lastName].filter(Boolean).join(" ").trim() : "";
    const supplierName = full || subcontractor?.email || "Subcontractor";

    const settings: any = await storage.getBusinessSettings(userId);
    const expenseAcct = settings?.myobExpenseAccountId || settings?.myobIncomeAccountId;
    const taxCode = settings?.myobTaxCodeId;

    const myobBill = {
      Number: invoice.invoiceNumber || undefined,
      Supplier: { Name: supplierName },
      Lines: invoice.items.map(item => ({
        Description: item.description,
        Total: parseFloat(item.amount || "0"),
        ...(expenseAcct ? { Account: { UID: expenseAcct } } : {}),
        ...(taxCode ? { TaxCode: { UID: taxCode } } : {}),
      })),
      Date: (invoice.createdAt ? new Date(invoice.createdAt) : new Date()).toISOString().split('T')[0],
    };

    const headers = getApiHeaders(tokens.accessToken, cfToken);
    headers["Content-Type"] = "application/json";
    const response = await axios.post(
      `${MYOB_API_BASE}/${refreshedConnection.businessId}/Purchase/Bill/Service`,
      myobBill,
      { headers }
    );

    const location = response.headers?.location || response.headers?.Location;
    const billId = typeof location === 'string' ? location.split('/').pop() : undefined;
    return { success: true, billId };
  } catch (error: unknown) {
    console.error('[MYOB] Failed to push subcontractor bill:', error);
    return { success: false, error: getErrorMessage(error) || "Failed to push bill" };
  }
}

export async function syncQuotesToMyob(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active MYOB connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  const cfToken = getCfToken(refreshedConnection);
  if (!cfToken) {
    throw new Error("Company file credentials not configured");
  }

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const quotes = await storage.getQuotes(userId);
    const clients = await storage.getClients(userId);
    // Task #91: enrich quote lines with mapping refs as well.
    const settingsForQuotes: any = await storage.getBusinessSettings(userId);
    const qIncomeAcct = settingsForQuotes?.myobIncomeAccountId;
    const qTaxCode = settingsForQuotes?.myobTaxCodeId;
    const qDefaultItem = settingsForQuotes?.myobDefaultItemId;

    for (const quote of quotes) {
      try {
        if (quote.status === 'draft') { skipped++; continue; }
        // Task #115: never sync sample/demo records to upstream accounting systems.
        if (quote.isSample) { skipped++; continue; }

        const client = clients.find(c => c.id === quote.clientId);
        if (!client) { skipped++; continue; }
        if (client.isSample) { skipped++; continue; }

        const lineItems = await storage.getQuoteLineItems(quote.id);

        const myobInvoice = {
          Number: `Q-${quote.number || quote.id}`,
          Customer: { Name: client.name },
          Lines: lineItems.map(item => ({
            Description: item.description,
            Total: parseFloat(item.total || "0"),
            ...(qIncomeAcct ? { Account: { UID: qIncomeAcct } } : {}),
            ...(qTaxCode ? { TaxCode: { UID: qTaxCode } } : {}),
            ...(qDefaultItem ? { Item: { UID: qDefaultItem } } : {}),
          })),
          Date: quote.createdAt ? new Date(quote.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          Comment: `Quote ${quote.number || ''} - ${quote.title || ''}`.trim(),
        };

        const headers = getApiHeaders(tokens.accessToken, cfToken);
        headers["Content-Type"] = "application/json";
        await axios.post(
          `${MYOB_API_BASE}/${refreshedConnection.businessId}/Sale/Invoice/Service`,
          myobInvoice,
          { headers }
        );

        synced++;
      } catch (err) {
        errors.push(`Failed to sync quote ${quote.number}: ${err}`);
      }
    }

    await storage.updateMyobConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { synced, skipped, errors };
  } catch (err) {
    throw new Error(`Failed to sync quotes to MYOB: ${err}`);
  }
}

export async function syncPaymentsFromMyob(userId: string): Promise<{ updated: number; errors: string[] }> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    throw new Error("No active MYOB connection found");
  }

  const refreshedConnection = await refreshTokenIfNeeded(connection);
  const tokens = decryptTokens(refreshedConnection);
  const cfToken = getCfToken(refreshedConnection);
  if (!cfToken) {
    throw new Error("Company file credentials not configured");
  }

  let updated = 0;
  const errors: string[] = [];

  try {
    const paymentsResponse = await axios.get(
      `${MYOB_API_BASE}/${refreshedConnection.businessId}/Sale/CustomerPayment`,
      { headers: getApiHeaders(tokens.accessToken, cfToken) }
    );

    const payments = paymentsResponse.data.Items || [];
    const invoices = await storage.getInvoices(userId);

    for (const payment of payments) {
      try {
        const invoiceRef = payment.Invoices?.[0]?.Number;
        if (!invoiceRef) continue;

        const matchingInvoice = invoices.find(inv => 
          inv.number === invoiceRef || (inv as any).invoiceNumber === invoiceRef
        );

        if (matchingInvoice && matchingInvoice.status !== 'paid') {
          await storage.updateInvoice(matchingInvoice.id, userId, {
            status: 'paid',
            paidAt: payment.Date ? new Date(payment.Date) : new Date(),
          });
          updated++;
        }
      } catch (err) {
        errors.push(`Failed to process MYOB payment: ${err}`);
      }
    }

    await storage.updateMyobConnection(refreshedConnection.id, { lastSyncAt: new Date() });
    return { updated, errors };
  } catch (err) {
    throw new Error(`Failed to sync payments from MYOB: ${err}`);
  }
}

/**
 * Void semantics for MYOB.
 *
 * MYOB AccountRight does NOT support a true "void" on a posted Sale.Invoice
 * via the public REST API — the supported workflow is to raise a Credit Note
 * (negative-amount Sale) that offsets the original invoice. This function
 * therefore does NOT mutate anything in MYOB; it returns a structured result
 * so the caller can surface the limitation honestly to the user instead of
 * pretending the void succeeded.
 *
 * Returns:
 *   - voidMethod: 'unsupported' — caller should issue a credit note manually,
 *                 or call a future raiseCreditNoteInMyob() helper.
 */
export async function voidInvoiceInMyob(userId: string, invoiceId: string): Promise<{
  success: boolean;
  voidMethod: 'void' | 'credit_note' | 'unsupported';
  message: string;
  error?: string;
}> {
  try {
    const connection = await storage.getMyobConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: false, voidMethod: 'unsupported', message: 'No active MYOB connection', error: "No active MYOB connection" };
    }

    const message = `MYOB does not support voiding posted invoices via API. Raise a Credit Note in MYOB (or via the MYOB UI) to offset invoice ${invoiceId}.`;
    console.warn(`[MYOB] ${message}`);
    return {
      success: false,
      voidMethod: 'unsupported',
      message,
    };
  } catch (error: unknown) {
    return { success: false, voidMethod: 'unsupported', message: getErrorMessage(error), error: getErrorMessage(error) };
  }
}

/**
 * Raise a Credit Note in MYOB to offset a posted invoice.
 *
 * MYOB AccountRight has no API "void" — the supported workflow is to post
 * a negative-amount Sale.Invoice.Service that mirrors the original lines.
 * This is the credit-note workaround surfaced to tradies after a void
 * attempt returns voidMethod === 'unsupported'. (Task #89)
 */
export async function createCreditNoteInMyob(
  userId: string,
  invoiceId: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const connection = await storage.getMyobConnection(userId);
    if (!connection || connection.status !== "active") {
      return { success: false, message: "No active MYOB connection", error: "No active MYOB connection" };
    }

    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { success: false, message: "Invoice not found", error: "Invoice not found" };
    }

    const refreshed = await refreshTokenIfNeeded(connection);
    const tokens = decryptTokens(refreshed);
    const cfToken = getCfToken(refreshed);
    if (!cfToken) {
      return {
        success: false,
        message: "Company file credentials not configured. Set your MYOB company file username and password first.",
        error: "cf_credentials_missing",
      };
    }

    const client = await storage.getClientById(invoice.clientId);
    if (!client) {
      return { success: false, message: "Client not found", error: "Client not found" };
    }

    const lineItems = await storage.getInvoiceLineItems(invoice.id);
    const settings: any = await storage.getBusinessSettings(userId);
    const incomeAcct = settings?.myobIncomeAccountId;
    const taxCode = settings?.myobTaxCodeId;
    const defaultItem = settings?.myobDefaultItemId;

    const originalNumber = (invoice as any).number || (invoice as any).invoiceNumber || invoiceId;
    const creditNote = {
      Number: `CN-${originalNumber}`.slice(0, 13),
      Customer: { Name: client.name },
      Lines: lineItems.map((item) => ({
        Description: `Credit note for ${originalNumber}: ${item.description}`,
        Total: -Math.abs(parseFloat(item.total || "0")),
        ...(incomeAcct ? { Account: { UID: incomeAcct } } : {}),
        ...(taxCode ? { TaxCode: { UID: taxCode } } : {}),
        ...(defaultItem ? { Item: { UID: defaultItem } } : {}),
      })),
      Date: new Date().toISOString().split("T")[0],
      Comment: `Credit note offsetting invoice ${originalNumber}`,
    };

    const headers = getApiHeaders(tokens.accessToken, cfToken);
    headers["Content-Type"] = "application/json";
    await axios.post(
      `${MYOB_API_BASE}/${refreshed.businessId}/Sale/Invoice/Service`,
      creditNote,
      { headers }
    );

    return {
      success: true,
      message: `Credit note CN-${originalNumber} raised in MYOB to offset invoice ${originalNumber}.`,
    };
  } catch (error: any) {
    const upstream = error?.response?.data;
    const detail = upstream
      ? typeof upstream === "string"
        ? upstream
        : JSON.stringify(upstream).slice(0, 300)
      : getErrorMessage(error) || "Unknown error";
    console.error("[MYOB] Failed to raise credit note:", detail);
    return {
      success: false,
      message: `Failed to raise credit note in MYOB: ${detail}`,
      error: getErrorMessage(error) || "credit_note_failed",
    };
  }
}

export async function runFullMyobSync(userId: string): Promise<{
  contacts: { synced: number; errors: string[] };
  invoices: { synced: number; errors: string[] };
  payments: { updated: number; errors: string[] };
  quotes: { synced: number; skipped: number; errors: string[] };
}> {
  const contacts = await syncContactsFromMyob(userId);
  const invoices = await syncInvoicesToMyob(userId);
  const payments = await syncPaymentsFromMyob(userId);
  const quotes = await syncQuotesToMyob(userId);

  return { contacts, invoices, payments, quotes };
}

export async function getSyncSummary(userId: string): Promise<{
  connected: boolean;
  lastSyncAt?: Date;
  companyName?: string;
}> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection || connection.status !== "active") {
    return { connected: false };
  }

  return {
    connected: true,
    lastSyncAt: connection.lastSyncAt || undefined,
    companyName: connection.companyName || undefined,
  };
}

export async function getDetailedSyncStatus(userId: string): Promise<{
  connected: boolean;
  companyName?: string;
  lastSyncAt?: Date;
  status?: string;
  cfCredentialsSet?: boolean;
  capabilities: string[];
}> {
  const connection = await storage.getMyobConnection(userId);
  if (!connection) {
    return { connected: false, capabilities: [] };
  }

  return {
    connected: connection.status === "active",
    companyName: connection.companyName || undefined,
    lastSyncAt: connection.lastSyncAt || undefined,
    status: connection.status || "unknown",
    cfCredentialsSet: !!(connection.cfUsername && connection.cfPassword),
    capabilities: [
      'contacts_sync',
      'invoices_sync', 
      'quotes_sync',
      'payments_sync',
      'single_invoice_sync',
      'full_sync',
    ],
  };
}
