import { getErrorMessage } from "./lib/errors";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, ne, desc, asc, sql, and, or, lt, gt, gte, lte, isNull, isNotNull, inArray } from "drizzle-orm";
import crypto from "crypto";
import {
  type User,
  type UpsertUser,
  type InsertUser,
  type BusinessSettings,
  type InsertBusinessSettings,
  type Client,
  type InsertClient,
  type Job,
  type InsertJob,
  type Quote,
  type InsertQuote,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type DocumentTemplate,
  type InsertDocumentTemplate,
  type LineItemCatalog,
  type InsertLineItemCatalog,
  type RateCard,
  type InsertRateCard,
  type QuoteTemplate,
  type InsertQuoteTemplate,
  type StylePreset,
  type InsertStylePreset,
  type IntegrationSettings,
  type InsertIntegrationSettings,
  type LoginCode,
  type InsertLoginCode,
  termsAcceptances,
  type InsertTermsAcceptance,
  type TermsAcceptance,
  type ChecklistItem,
  type InsertChecklistItem,
  type PaymentRequest,
  type InsertPaymentRequest,
  type Receipt,
  type InsertReceipt,
  receipts,
  // Advanced features types
  type TimeEntry,
  type InsertTimeEntry,
  type Timesheet,
  type InsertTimesheet,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Expense,
  type InsertExpense,
  type InventoryCategory,
  type InsertInventoryCategory,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  type UserRole,
  type InsertUserRole,
  type TeamMember,
  type InsertTeamMember,
  type StaffSchedule,
  type InsertStaffSchedule,
  type LocationTracking,
  type InsertLocationTracking,
  type TradieStatus,
  type InsertTradieStatus,
  type GeofenceAlert,
  type InsertGeofenceAlert,
  type GpsSignalLog,
  type InsertGpsSignalLog,
  type Route,
  type InsertRoute,
  type Notification,
  type InsertNotification,
  type PushToken,
  type InsertPushToken,
  type JobPhoto,
  type InsertJobPhoto,
  type VoiceNote,
  type InsertVoiceNote,
  type InvoiceReminderLog,
  type InsertInvoiceReminderLog,
  type DigitalSignature,
  type InsertDigitalSignature,
  type JobCheckin,
  type InsertJobCheckin,
  type JobDocument,
  type InsertJobDocument,
  users,
  digitalSignatures,
  businessSettings,
  clients,
  jobs,
  quotes,
  quoteLineItems,
  quoteVersions,
  invoices,
  invoiceLineItems,
  documentTemplates,
  lineItemCatalog,
  rateCards,
  quoteTemplates,
  stylePresets,
  integrationSettings,
  notifications,
  pushTokens,
  loginCodes,
  checklistItems,
  jobCheckins,
  paymentRequests,
  timeEntries,
  timesheets,
  expenseCategories,
  expenses,
  inventoryCategories,
  inventoryItems,
  inventoryTransactions,
  userRoles,
  teamMembers,
  staffSchedules,
  locationTracking,
  tradieStatus,
  geofenceAlerts,
  gpsSignalLogs,
  routes,
  jobPhotos,
  voiceNotes,
  jobDocuments,
  invoiceReminderLogs,
  jobChat,
  teamChat,
  directMessages,
  automations,
  automationLogs,
  type JobChat,
  type InsertJobChat,
  type TeamChat,
  type InsertTeamChat,
  type DirectMessage,
  type InsertDirectMessage,
  type Automation,
  type InsertAutomation,
  type AutomationLog,
  type CustomForm,
  type InsertCustomForm,
  type FormSubmission,
  type InsertFormSubmission,
  type FormSubmissionVersion,
  type InsertFormSubmissionVersion,
  customForms,
  formSubmissions,
  formSubmissionVersions,
  tasks,
  type Task,
  type InsertTask,
  smsConversations,
  smsMessages,
  smsTemplates,
  smsAutomationRules,
  smsAutomationLogs,
  smsBookingLinks,
  smsTrackingLinks,
  type SmsConversation,
  type InsertSmsConversation,
  type SmsMessage,
  type InsertSmsMessage,
  type SmsTemplate,
  type InsertSmsTemplate,
  type SmsAutomationRule,
  type InsertSmsAutomationRule,
  type SmsAutomationLog,
  type InsertSmsAutomationLog,
  type SmsBookingLink,
  type InsertSmsBookingLink,
  type SmsTrackingLink,
  type InsertSmsTrackingLink,
  xeroConnections,
  xeroSyncState,
  externalAccountingIds,
  type XeroConnection,
  type InsertXeroConnection,
  type XeroSyncState,
  type InsertXeroSyncState,
  type ExternalAccountingId,
  type InsertExternalAccountingId,
  myobConnections,
  type MyobConnection,
  type InsertMyobConnection,
  quickbooksConnections,
  type QuickbooksConnection,
  type InsertQuickbooksConnection,
  activityLogs,
  type ActivityLog,
  type InsertActivityLog,
  templateAnalysisJobs,
  type TemplateAnalysisJob,
  type InsertTemplateAnalysisJob,
  messageTemplates,
  type MessageTemplate,
  type InsertMessageTemplate,
  businessTemplates,
  type BusinessTemplate,
  type InsertBusinessTemplate,
  teamPresence,
  type TeamPresence,
  type InsertTeamPresence,
  activityFeed,
  type ActivityFeed,
  type InsertActivityFeed,
  jobReminders,
  type JobReminder,
  type InsertJobReminder,
  jobPhotoRequirements,
  type JobPhotoRequirement,
  type InsertJobPhotoRequirement,
  defects,
  type Defect,
  type InsertDefect,
  timesheetApprovals,
  type TimesheetApproval,
  type InsertTimesheetApproval,
  automationSettings,
  type AutomationSettings,
  type InsertAutomationSettings,
  terminalLocations,
  type TerminalLocation,
  type InsertTerminalLocation,
  terminalPayments,
  type TerminalPayment,
  type InsertTerminalPayment,
  tapToPayTermsAcceptance,
  type TapToPayTermsAcceptance,
  type InsertTapToPayTermsAcceptance,
  recurringContracts,
  leads,
  type Lead,
  type InsertLead,
  paymentSchedules,
  paymentInstallments,
  type PaymentSchedule,
  type InsertPaymentSchedule,
  type PaymentInstallment,
  type InsertPaymentInstallment,
  permissionRequests,
  type PermissionRequest,
  type InsertPermissionRequest,
  type RecurringContract,
  type InsertRecurringContract,
  recurringSchedules,
  type RecurringSchedule,
  type InsertRecurringSchedule,
  jobNotes,
  type JobNote,
  type InsertJobNote,
  jobVariations,
  type JobVariation,
  type InsertJobVariation,
  serviceReminders,
  type ServiceReminder,
  type InsertServiceReminder,
  rebates,
  type Rebate,
  type InsertRebate,
  teamGroups,
  teamGroupMembers,
  type TeamGroup,
  type InsertTeamGroup,
  type TeamGroupMember,
  type InsertTeamGroupMember,
  jobInvites,
  type JobInvite,
  type InsertJobInvite,
  portalVerificationCodes,
  type PortalVerificationCode,
  type InsertPortalVerificationCode,
  portalSessions,
  type PortalSession,
  type InsertPortalSession,
  jobMaterials,
  type JobMaterial,
  type InsertJobMaterial,
  timeEntryEdits,
  type InsertTimeEntryEdit,
  type TimeEntryEdit,
  invoiceEdits,
  type InsertInvoiceEdit,
  type InvoiceEdit,
  jobPortalTokens,
  type JobPortalToken,
  type InsertJobPortalToken,
  jobAssignments,
  type JobAssignment,
  type InsertJobAssignment,
  smsNotificationLog,
  assignmentEvents,
  type SmsNotificationLog,
  type InsertSmsNotificationLog,
  type AssignmentEvent,
  type InsertAssignmentEvent,
  locationPings,
  type LocationPing,
  type InsertLocationPing,
  subcontractorTokens,
  type SubcontractorToken,
  type InsertSubcontractorToken,
  subcontractorSessions,
  type SubcontractorSession,
  type InsertSubcontractorSession,
  subcontractorEvents,
  type SubcontractorEvent,
  type InsertSubcontractorEvent,
  subcontractorLocationPings,
  type SubcontractorLocationPing,
  type InsertSubcontractorLocationPing,
  equipment,
  equipmentCategories,
  equipmentMaintenance,
  type Equipment,
  type InsertEquipment,
  type EquipmentCategory,
  type InsertEquipmentCategory,
  type EquipmentMaintenance,
  type InsertEquipmentMaintenance,
  jobEquipment,
  type JobEquipment,
  type InsertJobEquipment,
  workerRequests,
  type WorkerRequest,
  type InsertWorkerRequest,
  complianceDocuments,
  type ComplianceDocument,
  type InsertComplianceDocument,
  jobRequests,
  type JobRequest,
  type InsertJobRequest,
  savedFilters,
  type SavedFilter,
  type InsertSavedFilter,
  paymentRecords,
  type PaymentRecord,
  type InsertPaymentRecord,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  type Supplier,
  type InsertSupplier,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  incidentReports,
  type IncidentReport,
  type InsertIncidentReport,
  siteEmergencyInfo,
  type SiteEmergencyInfo,
  type InsertSiteEmergencyInfo,
  jsaDocuments,
  type JsaDocument,
  type InsertJsaDocument,
  jsaSteps,
  type JsaStep,
  type InsertJsaStep,
  siteHazardousEnvironments,
  type SiteHazardousEnvironment,
  type InsertSiteHazardousEnvironment,
  siteSafetySignage,
  type SiteSafetySignage,
  type InsertSiteSafetySignage,
  hazardReports,
  type HazardReport,
  type InsertHazardReport,
  ppeChecklists,
  type PpeChecklist,
  type InsertPpeChecklist,
  trainingRecords,
  type TrainingRecord,
  type InsertTrainingRecord,
  aiReceptionistConfig,
  aiReceptionistCalls,
  type AiReceptionistConfig,
  type InsertAiReceptionistConfig,
  addonSubscriptions,
  type AddonSubscription,
  type InsertAddonSubscription,
  type AiReceptionistCall,
  type InsertAiReceptionistCall,
  websiteAddons,
  websiteChangeRequests,
  type WebsiteAddon,
  type InsertWebsiteAddon,
  type WebsiteChangeRequest,
  type InsertWebsiteChangeRequest,
  voiceChangeRequests,
  type VoiceChangeRequest,
  type InsertVoiceChangeRequest,
  subcontractorInvoices,
  subcontractorInvoiceItems,
  type SubcontractorInvoice,
  type InsertSubcontractorInvoice,
  type SubcontractorInvoiceItem,
  type InsertSubcontractorInvoiceItem,
  workerPaymentDetails,
  type WorkerPaymentDetails,
  type InsertWorkerPaymentDetails,
  payrollPayments,
  type PayrollPayment,
  type InsertPayrollPayment,
  workerStates,
  type WorkerState,
  type InsertWorkerState,
  numberPortRequests,
  type NumberPortRequest,
  type InsertNumberPortRequest,
  quickReplies,
  type QuickReply,
  type InsertQuickReply,
  DEFAULT_QUICK_REPLIES,
  clientAssets,
  clientAssetServices,
  type ClientAsset,
  type InsertClientAsset,
  type ClientAssetService,
  type InsertClientAssetService,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { tradieQuoteTemplates } from "./tradieTemplates";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Replit Auth required methods
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  getUserByAppleOriginalTransactionId(originalTransactionId: string): Promise<User | undefined>;
  getUserByXeroId(xeroId: string): Promise<User | undefined>;
  getUserByPhoneNormalized(phoneNormalized: string): Promise<User | undefined>;
  setSubcontractorTokenRecipient(tokenId: string, recipientUserId: string, alsoMarkNameConfirmed?: boolean): Promise<void>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserJobCount(id: string, count: number): Promise<User | undefined>;
  resetUserJobCount(id: string, nextResetDate: Date): Promise<User | undefined>;
  linkGoogleAccount(userId: string, googleId: string, profileImageUrl?: string | null): Promise<void>;
  linkAppleAccount(userId: string, appleId: string): Promise<void>;
  linkXeroAccount(userId: string, xeroId: string): Promise<void>;

  // Login Codes (Passwordless Email Auth)
  createTermsAcceptance(data: InsertTermsAcceptance): Promise<TermsAcceptance>;
  createLoginCode(email: string, code: string): Promise<void>;
  getLoginCode(email: string, code: string): Promise<{ id: string; email: string; verified: boolean; expiresAt: Date } | undefined>;
  getLatestLoginCodeForEmail(email: string): Promise<{ id: string; email: string; code: string; verified: boolean; expiresAt: Date; createdAt: Date } | undefined>;
  verifyLoginCodeAndCreateUser(email: string, code: string): Promise<User | null>;
  cleanupExpiredCodes(): Promise<void>;

  // Business Settings
  getBusinessSettings(userId: string): Promise<BusinessSettings | undefined>;
  getAllBusinessSettings(): Promise<BusinessSettings[]>;
  getBusinessSettingsByBookingSlug(slug: string): Promise<BusinessSettings | undefined>;
  createBusinessSettings(settings: InsertBusinessSettings): Promise<BusinessSettings>;
  updateBusinessSettings(userId: string, settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings | undefined>;

  // Integration Settings
  getIntegrationSettings(userId: string): Promise<IntegrationSettings | undefined>;
  createIntegrationSettings(settings: InsertIntegrationSettings & { userId: string }): Promise<IntegrationSettings>;
  updateIntegrationSettings(userId: string, settings: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification, createdAt?: Date): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<number>;
  dismissNotification(id: string, userId: string): Promise<Notification | undefined>;
  deleteNotification(id: string, userId: string): Promise<boolean>;

  // Push Tokens (Mobile App)
  getPushTokens(userId: string): Promise<PushToken[]>;
  registerPushToken(token: InsertPushToken): Promise<PushToken>;
  deactivatePushToken(tokenId: string, userId: string): Promise<boolean>;
  deactivatePushTokenByValue(token: string, userId: string): Promise<boolean>;

  // Activity Logs (Dashboard Activity Feed)
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  deleteActivityLogs(userId: string): Promise<number>;

  // Job Notes (Timestamped notes tied to moments)
  getJobNotes(jobId: string, userId: string): Promise<JobNote[]>;
  createJobNote(note: InsertJobNote): Promise<JobNote>;
  updateJobNote(id: string, userId: string, updates: Partial<InsertJobNote>): Promise<JobNote | undefined>;
  deleteJobNote(id: string, userId: string): Promise<boolean>;

  // Job Variations / Change Orders
  getJobVariations(jobId: string, userId: string): Promise<JobVariation[]>;
  getJobVariation(id: string, userId: string): Promise<JobVariation | undefined>;
  createJobVariation(variation: InsertJobVariation): Promise<JobVariation>;
  updateJobVariation(id: string, userId: string, updates: Partial<InsertJobVariation>): Promise<JobVariation | undefined>;
  deleteJobVariation(id: string, userId: string): Promise<boolean>;
  getNextVariationNumber(jobId: string, userId: string): Promise<string>;

  // Job Materials
  getJobMaterials(jobId: string, userId: string): Promise<JobMaterial[]>;
  getJobMaterial(id: string, userId: string): Promise<JobMaterial | undefined>;
  createJobMaterial(material: InsertJobMaterial): Promise<JobMaterial>;
  updateJobMaterial(id: string, userId: string, updates: Partial<InsertJobMaterial>): Promise<JobMaterial | undefined>;
  deleteJobMaterial(id: string, userId: string): Promise<boolean>;

  // Job Equipment Assignments
  getJobEquipment(jobId: string): Promise<JobEquipment[]>;
  addJobEquipment(data: InsertJobEquipment): Promise<JobEquipment>;
  removeJobEquipment(id: string, userId: string): Promise<void>;

  // Service Reminders
  getServiceReminders(userId: string): Promise<ServiceReminder[]>;
  getServiceReminderById(id: string, userId: string): Promise<ServiceReminder | undefined>;
  getUpcomingServiceReminders(userId: string, days: number): Promise<ServiceReminder[]>;
  createServiceReminder(reminder: InsertServiceReminder): Promise<ServiceReminder>;
  updateServiceReminder(id: string, userId: string, updates: Partial<InsertServiceReminder>): Promise<ServiceReminder | undefined>;
  deleteServiceReminder(id: string, userId: string): Promise<boolean>;

  // Rebates / Credits
  getRebates(userId: string): Promise<Rebate[]>;
  getRebateById(id: string, userId: string): Promise<Rebate | undefined>;
  createRebate(rebate: InsertRebate): Promise<Rebate>;
  updateRebate(id: string, userId: string, updates: Partial<InsertRebate>): Promise<Rebate | undefined>;
  deleteRebate(id: string, userId: string): Promise<boolean>;
  getRebatesSummary(userId: string): Promise<{ pending: number; submitted: number; approved: number; received: number; rejected: number }>;

  // Platform Stats (for trust signals)
  getPlatformStats(): Promise<{ userCount: number; quotesCount: number; paidInvoicesCount: number }>;

  // Clients
  getClients(userId: string): Promise<Client[]>;
  getClient(id: string, userId: string): Promise<Client | undefined>;
  getClientById(id: string): Promise<Client | undefined>;
  getClientByPhone(userId: string, phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, userId: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string, userId: string): Promise<boolean>;
  getClientSignature(id: string, userId: string): Promise<{ signatureData: string | null; signatureDate: Date | null } | undefined>;
  deleteClientSignature(id: string, userId: string): Promise<boolean>;

  // Jobs
  getJobs(userId: string, includeArchived?: boolean): Promise<Job[]>;
  getJob(id: string, userId: string): Promise<Job | undefined>;
  getJobPublic(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, userId: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string, userId: string): Promise<boolean>;
  getJobsForClient(clientId: string, userId: string): Promise<Job[]>;
  getJobsByAssignee(assigneeId: string): Promise<Job[]>;
  archiveJob(id: string, userId: string): Promise<Job | undefined>;
  unarchiveJob(id: string, userId: string): Promise<Job | undefined>;

  // Checklist Items
  getChecklistItems(jobId: string, userId: string): Promise<ChecklistItem[]>;
  createChecklistItem(item: InsertChecklistItem, userId: string): Promise<ChecklistItem>;
  updateChecklistItem(id: string, userId: string, item: Partial<Omit<InsertChecklistItem, 'jobId'>>): Promise<ChecklistItem | undefined>;
  deleteChecklistItem(id: string, userId: string): Promise<boolean>;

  // Job Check-ins (Location Tracking)
  getJobCheckins(jobId: string, userId: string): Promise<JobCheckin[]>;
  createJobCheckin(checkin: InsertJobCheckin): Promise<JobCheckin>;
  getLatestCheckin(jobId: string, userId: string): Promise<JobCheckin | undefined>;

  // Quotes
  getQuotes(userId: string, includeArchived?: boolean): Promise<Quote[]>;
  getQuote(id: string, userId: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  claimQuoteForEdit(id: string, userId: string): Promise<{ ok: boolean; found: boolean }>;
  updateQuote(id: string, userId: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string, userId: string): Promise<boolean>;
  getQuoteWithLineItems(id: string, userId: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined>;
  archiveQuote(id: string, userId: string): Promise<Quote | undefined>;
  unarchiveQuote(id: string, userId: string): Promise<Quote | undefined>;
  // Public quote access (for client acceptance flow)
  getQuoteByToken(token: string): Promise<Quote | undefined>;
  getQuoteWithLineItemsByToken(token: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined>;
  acceptQuoteByToken(token: string, acceptedBy: string, acceptanceIp: string): Promise<Quote | undefined>;
  declineQuoteByToken(token: string, declineReason?: string): Promise<Quote | undefined>;
  generateQuoteAcceptanceToken(id: string, userId: string): Promise<string | null>;
  updateQuoteByToken(token: string, updates: Partial<Quote>): Promise<Quote | undefined>;

  // Quote Line Items
  getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]>;
  createQuoteLineItem(lineItem: InsertQuoteLineItem, userId?: string): Promise<QuoteLineItem>;
  updateQuoteLineItem(id: string, lineItem: Partial<InsertQuoteLineItem>, userId?: string): Promise<QuoteLineItem | undefined>;
  deleteQuoteLineItem(id: string, userId?: string): Promise<boolean>;

  // Quote Versions
  getQuoteVersions(quoteId: string): Promise<any[]>;
  createQuoteVersion(data: { quoteId: string; versionNumber: number; editedBy?: string; changeNote?: string; snapshot: any }): Promise<any>;

  // Invoices
  getInvoices(userId: string, includeArchived?: boolean): Promise<Invoice[]>;
  getInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, userId: string, invoice: Partial<InsertInvoice>, editSource?: 'manual' | 'system'): Promise<Invoice | undefined>;
  deleteInvoice(id: string, userId: string): Promise<boolean>;
  getInvoiceWithLineItems(id: string, userId: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined>;
  archiveInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  unarchiveInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  // Public invoice access (for payment page)
  getInvoiceByPaymentToken(token: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined>;
  updateInvoiceByToken(token: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getBusinessSettingsByUserId(userId: string): Promise<BusinessSettings | undefined>;
  getBusinessSettingsByConnectAccountId(accountId: string): Promise<BusinessSettings | undefined>;

  // Invoice Line Items
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(lineItem: InsertInvoiceLineItem, userId?: string): Promise<InvoiceLineItem>;
  updateInvoiceLineItem(id: string, lineItem: Partial<InsertInvoiceLineItem>, userId?: string): Promise<InvoiceLineItem | undefined>;
  deleteInvoiceLineItem(id: string, userId?: string): Promise<boolean>;

  // Payment Records (progress/partial payments against invoices)
  getPaymentRecords(invoiceId: string): Promise<PaymentRecord[]>;
  createPaymentRecord(record: InsertPaymentRecord): Promise<PaymentRecord>;
  deletePaymentRecord(id: string): Promise<boolean>;

  // Payment Requests (phone-to-phone payments)
  getPaymentRequests(userId: string): Promise<PaymentRequest[]>;
  getPaymentRequest(id: string, userId: string): Promise<PaymentRequest | undefined>;
  getPaymentRequestByToken(token: string): Promise<PaymentRequest | undefined>;
  createPaymentRequest(request: InsertPaymentRequest & { userId: string; token: string }): Promise<PaymentRequest>;
  updatePaymentRequest(id: string, userId: string, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined>;
  updatePaymentRequestByToken(token: string, updates: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined>;
  deletePaymentRequest(id: string, userId: string): Promise<boolean>;

  // Terminal Payments (Tap to Pay)
  getTerminalPayments(userId: string): Promise<TerminalPayment[]>;
  getTerminalPayment(id: string, userId: string): Promise<TerminalPayment | undefined>;
  getTerminalPaymentByIntent(paymentIntentId: string): Promise<TerminalPayment | undefined>;
  createTerminalPayment(payment: InsertTerminalPayment & { userId: string }): Promise<TerminalPayment>;
  updateTerminalPayment(id: string, userId: string, updates: Partial<InsertTerminalPayment>): Promise<TerminalPayment | undefined>;
  updateTerminalPaymentByIntent(paymentIntentId: string, updates: Partial<InsertTerminalPayment>): Promise<TerminalPayment | undefined>;

  // Receipts (professional payment receipts linked to jobs)
  getReceipts(userId: string): Promise<Receipt[]>;
  getReceipt(id: string, userId: string): Promise<Receipt | undefined>;
  getReceiptsForJob(jobId: string, userId: string): Promise<Receipt[]>;
  getReceiptByNumber(receiptNumber: string, userId: string): Promise<Receipt | undefined>;
  getReceiptByInvoiceId(invoiceId: string, userId: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt & { userId: string }): Promise<Receipt>;
  updateReceipt(id: string, userId: string, receipt: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string, userId: string): Promise<boolean>;
  generateReceiptNumber(userId: string): Promise<string>;
  getReceiptByViewToken(token: string): Promise<Receipt | undefined>;
  getReceiptById(id: string): Promise<Receipt | undefined>;

  // Document Templates
  getDocumentTemplates(userId: string, type?: string, tradeType?: string): Promise<DocumentTemplate[]>;
  getDocumentTemplate(id: string): Promise<DocumentTemplate | null>;
  createDocumentTemplate(data: InsertDocumentTemplate & { userId: string }): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: string, data: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate>;
  deleteDocumentTemplate(id: string): Promise<void>;
  seedDefaultDocumentTemplates(userId: string): Promise<DocumentTemplate[]>;

  // Line Item Catalog
  getLineItemCatalog(userId: string, tradeType?: string): Promise<LineItemCatalog[]>;
  getLineItemCatalogItem(id: string): Promise<LineItemCatalog | null>;
  createLineItemCatalogItem(data: InsertLineItemCatalog & { userId: string }): Promise<LineItemCatalog>;
  updateLineItemCatalogItem(id: string, data: Partial<InsertLineItemCatalog>): Promise<LineItemCatalog>;
  deleteLineItemCatalogItem(id: string): Promise<void>;

  // Rate Cards
  getRateCards(userId: string, tradeType?: string): Promise<RateCard[]>;
  getRateCard(id: string): Promise<RateCard | null>;
  createRateCard(data: InsertRateCard & { userId: string }): Promise<RateCard>;
  updateRateCard(id: string, data: Partial<InsertRateCard>): Promise<RateCard>;
  deleteRateCard(id: string): Promise<void>;

  // Quote Templates
  getQuoteTemplates(userId: string, tradeType?: string): Promise<QuoteTemplate[]>;
  getQuoteTemplate(id: string): Promise<QuoteTemplate | null>;
  createQuoteTemplate(data: InsertQuoteTemplate & { userId: string }): Promise<QuoteTemplate>;
  updateQuoteTemplate(id: string, data: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate>;
  deleteQuoteTemplate(id: string): Promise<void>;

  // Template Analysis Jobs
  createTemplateAnalysisJob(data: InsertTemplateAnalysisJob): Promise<TemplateAnalysisJob>;
  getTemplateAnalysisJob(id: string, userId: string): Promise<TemplateAnalysisJob | undefined>;
  updateTemplateAnalysisJob(id: string, updates: Partial<TemplateAnalysisJob>): Promise<TemplateAnalysisJob | undefined>;

  // Utility methods
  generateQuoteNumber(userId: string): Promise<string>;
  generateInvoiceNumber(userId: string): Promise<string>;

  // ===== ADVANCED FEATURES METHODS =====
  
  // Time Tracking
  getTimeEntries(userId: string, jobId?: string): Promise<TimeEntry[]>;
  getTimeEntriesForJob(jobId: string): Promise<TimeEntry[]>;
  getTimeEntriesInRange(userId: string, start: Date, end: Date): Promise<TimeEntry[]>;
  getTeamTimeEntriesInRange(businessOwnerId: string, start: Date, end: Date): Promise<TimeEntry[]>;
  getTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined>;
  getTimeEntryAny(id: string): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry & { userId: string }): Promise<TimeEntry>;
  updateTimeEntry(id: string, userId: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string, userId: string): Promise<boolean>;
  stopTimeEntry(id: string, userId: string, locationData?: { clockOutLatitude?: string; clockOutLongitude?: string; clockOutAddress?: string }): Promise<TimeEntry | undefined>;
  getActiveTimeEntry(userId: string): Promise<TimeEntry | undefined>;
  
  // Time Entry Edit Audit Trail
  createTimeEntryEdit(edit: InsertTimeEntryEdit): Promise<TimeEntryEdit>;
  getTimeEntryEdits(timeEntryId: string): Promise<TimeEntryEdit[]>;
  getTimeEntryEditLog(userId: string, limit?: number, offset?: number): Promise<TimeEntryEdit[]>;

  // Invoice Edit Audit Trail
  createInvoiceEdit(edit: InsertInvoiceEdit): Promise<InvoiceEdit>;
  getInvoiceEdits(invoiceId: string): Promise<InvoiceEdit[]>;

  // Job Assignments
  getJobAssignments(jobId: string): Promise<JobAssignment[]>;
  getJobAssignment(assignmentId: string): Promise<JobAssignment | undefined>;
  getJobAssignmentForUser(jobId: string, userId: string): Promise<JobAssignment | undefined>;
  getEnRouteAssignmentsForUser(userId: string): Promise<JobAssignment[]>;
  getAssignedJobIdsForUser(userId: string, teamMemberId?: string | null): Promise<string[]>;
  createJobAssignment(assignment: InsertJobAssignment): Promise<JobAssignment>;
  updateJobAssignment(assignmentId: string, data: Partial<InsertJobAssignment & { lastSmsSentAt: Date; travelStartedAt: Date; arrivedAt: Date; etaMinutes: number; etaUpdatedAt: Date; assignmentStatus: string; completedAt: Date | null; isPrimary: boolean }>): Promise<JobAssignment | undefined>;
  getTeamMemberByOwnerAndMemberId(businessOwnerId: string, memberId: string): Promise<TeamMember | undefined>;

  // Assignment Events & SMS Log
  getAssignmentEvents(assignmentId: string): Promise<any[]>;
  createAssignmentEvent(event: { assignmentId: string; jobId: string; actorUserId: string; eventType: string; eventData?: any }): Promise<any>;
  createSmsNotificationLog(log: { jobId: string; assignmentId?: string; userId: string; clientPhone: string; notificationType: string; smsMessageId?: string; portalTokenId?: string; etaMinutes?: number }): Promise<any>;
  getLastSmsNotification(assignmentId: string, notificationType: string): Promise<any>;
  getActivePortalTokenForAssignment(assignmentId: string): Promise<JobPortalToken | null>;

  // Location pings
  createLocationPing(ping: InsertLocationPing): Promise<LocationPing>;
  getLatestLocationPing(assignmentId: string): Promise<LocationPing | null>;
  getLocationPings(assignmentId: string, limit?: number): Promise<LocationPing[]>;
  
  // Timesheets
  getTimesheets(userId: string): Promise<Timesheet[]>;
  getTimesheet(id: string, userId: string): Promise<Timesheet | undefined>;
  createTimesheet(timesheet: InsertTimesheet & { userId: string }): Promise<Timesheet>;
  updateTimesheet(id: string, userId: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;
  
  // Expense Tracking
  getExpenseCategories(userId: string): Promise<ExpenseCategory[]>;
  createExpenseCategory(category: InsertExpenseCategory & { userId: string }): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, userId: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string, userId: string): Promise<boolean>;
  
  getExpenses(userId: string, filters?: { jobId?: string; categoryId?: string; startDate?: string; endDate?: string; }): Promise<any[]>;
  getExpense(id: string, userId: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense & { userId: string }): Promise<Expense>;
  updateExpense(id: string, userId: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string, userId: string): Promise<boolean>;

  // Client Asset Register
  getClientAssets(userId: string, clientId?: string): Promise<ClientAsset[]>;
  getClientAsset(id: string, userId: string): Promise<ClientAsset | undefined>;
  createClientAsset(asset: InsertClientAsset & { userId: string }): Promise<ClientAsset>;
  updateClientAsset(id: string, userId: string, asset: Partial<InsertClientAsset>): Promise<ClientAsset | undefined>;
  deleteClientAsset(id: string, userId: string): Promise<boolean>;
  getClientAssetServices(assetId: string, userId: string): Promise<ClientAssetService[]>;
  createClientAssetService(service: InsertClientAssetService & { userId: string }): Promise<ClientAssetService>;
  
  // Inventory Management
  getInventoryCategories(userId: string): Promise<InventoryCategory[]>;
  createInventoryCategory(category: InsertInventoryCategory & { userId: string }): Promise<InventoryCategory>;
  updateInventoryCategory(id: string, userId: string, category: Partial<InsertInventoryCategory>): Promise<InventoryCategory | undefined>;
  deleteInventoryCategory(id: string, userId: string): Promise<boolean>;
  
  getInventoryItems(userId: string, categoryId?: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string, userId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem & { userId: string }): Promise<InventoryItem>;
  updateInventoryItem(id: string, userId: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string, userId: string): Promise<boolean>;
  
  getInventoryTransactions(userId: string, itemId?: string): Promise<InventoryTransaction[]>;
  createInventoryTransaction(transaction: InsertInventoryTransaction & { userId: string }): Promise<InventoryTransaction>;
  
  getSuppliers(userId: string): Promise<Supplier[]>;
  getSupplier(id: string, userId: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier & { userId: string }): Promise<Supplier>;
  updateSupplier(id: string, userId: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string, userId: string): Promise<boolean>;
  
  getPurchaseOrders(userId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string, userId: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(po: InsertPurchaseOrder & { userId: string }): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, userId: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string, userId: string): Promise<boolean>;
  
  getPurchaseOrderItems(poId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  
  // Team Management
  getUserRoles(): Promise<UserRole[]>;
  createUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(id: string, role: Partial<InsertUserRole>): Promise<UserRole | undefined>;
  deleteUserRole(id: string): Promise<boolean>;
  
  getTeamMembers(businessOwnerId: string): Promise<TeamMember[]>;
  getTeamMember(id: string, businessOwnerId: string): Promise<TeamMember | undefined>;
  getTeamMembershipByMemberId(memberId: string): Promise<TeamMember | undefined>;
  getAllTeamMembershipsByMemberId(memberId: string): Promise<TeamMember[]>;
  getTeamMemberByUserIdAndBusiness(userId: string, businessOwnerId: string): Promise<TeamMember | undefined>;
  getTeamMemberByInviteToken(token: string): Promise<TeamMember | undefined>;
  getPendingTeamMembersByEmail(email: string): Promise<TeamMember[]>;
  getUserRole(id: string): Promise<UserRole | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, businessOwnerId: string, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  updateTeamMemberPermissions(id: string, permissions: { customPermissions: string[], useCustomPermissions: boolean }): Promise<TeamMember | undefined>;
  updateTeamMemberLocationSettings(id: string, settings: { locationEnabledByOwner: boolean }): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string, businessOwnerId: string): Promise<boolean>;
  suspendTeamMembersByOwner(ownerId: string): Promise<number>;
  reactivateTeamMembersByOwner(ownerId: string): Promise<number>;
  
  // Team Groups
  getTeamGroups(userId: string): Promise<TeamGroup[]>;
  getTeamGroupById(id: string, userId: string): Promise<TeamGroup | undefined>;
  createTeamGroup(group: InsertTeamGroup): Promise<TeamGroup>;
  updateTeamGroup(id: string, userId: string, data: Partial<InsertTeamGroup>): Promise<TeamGroup | undefined>;
  deleteTeamGroup(id: string, userId: string): Promise<boolean>;
  addMemberToGroup(groupId: string, teamMemberId: string, role?: string): Promise<TeamGroupMember>;
  removeMemberFromGroup(groupId: string, teamMemberId: string): Promise<boolean>;
  getGroupMembers(groupId: string): Promise<TeamGroupMember[]>;
  
  // Permission Requests
  getPermissionRequests(businessOwnerId: string): Promise<PermissionRequest[]>;
  getPermissionRequestsByMember(teamMemberId: string): Promise<PermissionRequest[]>;
  createPermissionRequest(request: InsertPermissionRequest): Promise<PermissionRequest>;
  updatePermissionRequest(id: string, businessOwnerId: string, data: Partial<InsertPermissionRequest>): Promise<PermissionRequest | undefined>;
  
  getStaffSchedules(userId: string, filters?: { jobId?: string; startDate?: Date; endDate?: Date; teamMemberId?: string }): Promise<StaffSchedule[]>;
  createStaffSchedule(schedule: InsertStaffSchedule): Promise<StaffSchedule>;
  updateStaffSchedule(id: string, userId: string, schedule: Partial<InsertStaffSchedule>): Promise<StaffSchedule | undefined>;
  deleteStaffSchedule(id: string, userId: string): Promise<boolean>;
  
  // GPS Tracking
  getLocationTracking(userId: string, jobId?: string): Promise<LocationTracking[]>;
  createLocationTracking(location: InsertLocationTracking & { userId: string }): Promise<LocationTracking>;
  
  getRoutes(userId: string): Promise<Route[]>;
  getRoute(id: string, userId: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, userId: string, route: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: string, userId: string): Promise<boolean>;

  // GPS Signal Loss Logging
  createGpsSignalLog(log: InsertGpsSignalLog): Promise<GpsSignalLog>;
  getGpsSignalLogs(businessOwnerId: string, options?: { userId?: string; limit?: number }): Promise<GpsSignalLog[]>;

  // Geofence Alerts
  createGeofenceAlert(alert: InsertGeofenceAlert): Promise<GeofenceAlert>;
  getGeofenceAlertsForBusiness(businessOwnerId: string, limit?: number): Promise<GeofenceAlert[]>;
  getUnreadGeofenceAlertsCount(businessOwnerId: string): Promise<number>;
  markGeofenceAlertAsRead(alertId: string): Promise<void>;
  getRecentGeofenceAlerts(userId: string, jobId: string, alertType: string, withinSeconds: number): Promise<any[]>;
  getLastArrivalAlert(userId: string, jobId: string, beforeTs: Date): Promise<any | undefined>;
  updateGeofenceAlertDwell(alertId: string, dwellSeconds: number): Promise<void>;

  // Team-level time tracking methods
  getActiveTimeEntryForJob(jobId: string): Promise<TimeEntry | undefined>;
  getActiveTimeEntriesForJob(jobId: string): Promise<TimeEntry[]>;
  getAllActiveTimeEntries(): Promise<TimeEntry[]>;

  // Digital Signatures
  createDigitalSignature(signature: Omit<InsertDigitalSignature, 'id' | 'createdAt'>): Promise<DigitalSignature>;
  getDigitalSignatureByQuoteId(quoteId: string): Promise<DigitalSignature | undefined>;
  getDigitalSignaturesByJobId(jobId: string): Promise<any[]>;
  getClientMostRecentSignature(clientId: string): Promise<DigitalSignature | undefined>;

  // Job Chat
  getJobChatMessages(jobId: string): Promise<JobChat[]>;
  getLatestJobChatMessages(businessOwnerId: string): Promise<{ jobId: string; message: string; userId: string; createdAt: Date | null; isSystemMessage: boolean | null }[]>;
  createJobChatMessage(message: InsertJobChat): Promise<JobChat>;
  markJobChatAsRead(jobId: string, userId: string): Promise<void>;
  getUnreadJobChatCount(jobId: string, userId: string): Promise<number>;
  deleteJobChatMessage(id: string, userId: string): Promise<boolean>;
  forceDeleteJobChatMessage(id: string, jobId: string, businessOwnerId: string): Promise<boolean>;

  // Team Chat
  getTeamChatMessages(businessOwnerId: string): Promise<TeamChat[]>;
  createTeamChatMessage(message: InsertTeamChat): Promise<TeamChat>;
  markTeamChatAsRead(businessOwnerId: string, userId: string): Promise<void>;
  getUnreadTeamChatCount(businessOwnerId: string, userId: string): Promise<number>;
  pinTeamChatMessage(id: string, businessOwnerId: string, pinned: boolean): Promise<TeamChat | undefined>;
  deleteTeamChatMessage(id: string, senderId: string): Promise<boolean>;
  forceDeleteTeamChatMessage(id: string, businessOwnerId: string): Promise<boolean>;

  // Automations
  getAutomations(userId: string): Promise<Automation[]>;
  getAutomation(id: string, userId: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation & { userId: string }): Promise<Automation>;
  updateAutomation(id: string, userId: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined>;
  deleteAutomation(id: string, userId: string): Promise<boolean>;
  getAllUsersWithAutomations(): Promise<string[]>;
  
  // Automation Logs
  hasAutomationProcessed(automationId: string, entityType: string, entityId: string): Promise<boolean>;
  logAutomationProcessed(automationId: string, entityType: string, entityId: string, result: string, errorMessage?: string): Promise<void>;
  getAutomationLogs(userId: string, limit?: number): Promise<AutomationLog[]>;

  // Custom Forms
  getCustomForms(userId: string, tradeType?: string): Promise<CustomForm[]>;
  getCustomFormsVisibleTo(ownerId: string, memberId: string, tradeType?: string): Promise<CustomForm[]>;
  getCustomForm(id: string, userId: string): Promise<CustomForm | undefined>;
  createCustomForm(form: InsertCustomForm & { userId: string }): Promise<CustomForm>;
  updateCustomForm(id: string, userId: string, form: Partial<InsertCustomForm>): Promise<CustomForm | undefined>;
  deleteCustomForm(id: string, userId: string): Promise<boolean>;
  seedDefaultSafetyForms(userId: string): Promise<CustomForm[]>;

  // Form Submissions
  getFormSubmissions(formId: string, userId: string): Promise<FormSubmission[]>;
  getFormSubmissionsByJob(jobId: string, userId: string): Promise<FormSubmission[]>;
  getJobSafetyFormSubmissionCount(jobId: string, userId: string): Promise<number>;
  getFormSubmission(id: string, userId: string): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  updateFormSubmission(id: string, userId: string, submission: Partial<InsertFormSubmission>): Promise<FormSubmission | undefined>;
  deleteFormSubmission(id: string, userId: string): Promise<boolean>;
  getFormSubmissionVersions(submissionId: string): Promise<FormSubmissionVersion[]>;
  createFormSubmissionVersion(version: InsertFormSubmissionVersion): Promise<FormSubmissionVersion>;
  getFormSubmissionsForExport(ownerUserId: string, opts?: { formId?: string; from?: Date; to?: Date }): Promise<Array<{
    submission: FormSubmission;
    formId: string;
    formName: string;
    formFields: any;
    jobTitle: string | null;
    clientName: string | null;
    submitterName: string | null;
    submitterEmail: string | null;
  }>>;
  createTask(task: InsertTask): Promise<Task>;
  getTasks(userId: string, jobId?: string): Promise<Task[]>;
  getTask(id: string, userId: string): Promise<Task | undefined>;
  updateTask(id: string, userId: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: string, userId: string, completedBy: string): Promise<Task | undefined>;
  deleteTask(id: string, userId: string): Promise<boolean>;

  // SMS Conversations
  getSmsConversation(id: string): Promise<SmsConversation | undefined>;
  getSmsConversationByPhone(businessOwnerId: string, clientPhone: string): Promise<SmsConversation | undefined>;
  getSmsConversationsByBusiness(businessOwnerId: string): Promise<SmsConversation[]>;
  getSmsConversationsByClientPhone(clientPhone: string): Promise<SmsConversation[]>;
  getSmsConversationsByJobIds(jobIds: string[]): Promise<SmsConversation[]>;
  createSmsConversation(conversation: InsertSmsConversation): Promise<SmsConversation>;
  updateSmsConversation(id: string, updates: Partial<InsertSmsConversation>): Promise<SmsConversation>;
  updateSmsConversationRoutingState(conversationId: string, state: string, options?: any[]): Promise<void>;
  getJobsByClientAndBusiness(clientId: string, businessOwnerId: string): Promise<Job[]>;

  // SMS Messages  
  getSmsMessage(id: string): Promise<SmsMessage | undefined>;
  getSmsMessages(conversationId: string): Promise<SmsMessage[]>;
  getSmsJobRequests(businessOwnerId: string): Promise<SmsMessage[]>;
  createSmsMessage(message: InsertSmsMessage): Promise<SmsMessage>;
  updateSmsMessage(id: string, updates: Partial<InsertSmsMessage>): Promise<SmsMessage>;
  getSmsMessageByTwilioSid(twilioSid: string): Promise<SmsMessage | undefined>;
  markSmsMessagesAsRead(conversationId: string): Promise<void>;

  // SMS Templates
  getSmsTemplates(userId: string): Promise<SmsTemplate[]>;
  getSmsTemplate(id: string, userId: string): Promise<SmsTemplate | undefined>;
  createSmsTemplate(data: InsertSmsTemplate): Promise<SmsTemplate>;
  updateSmsTemplate(id: string, userId: string, data: Partial<InsertSmsTemplate>): Promise<SmsTemplate>;
  deleteSmsTemplate(id: string, userId: string): Promise<boolean>;
  incrementSmsTemplateUsage(id: string): Promise<void>;

  // SMS Automation Rules
  getSmsAutomationRules(userId: string): Promise<SmsAutomationRule[]>;
  getSmsAutomationRule(id: string, userId: string): Promise<SmsAutomationRule | undefined>;
  createSmsAutomationRule(data: InsertSmsAutomationRule): Promise<SmsAutomationRule>;
  updateSmsAutomationRule(id: string, userId: string, data: Partial<InsertSmsAutomationRule> & Partial<Pick<SmsAutomationRule, 'lastTriggeredAt' | 'triggerCount'>>): Promise<SmsAutomationRule>;
  deleteSmsAutomationRule(id: string, userId: string): Promise<boolean>;
  getSmsAutomationRulesByTrigger(userId: string, triggerType: string): Promise<SmsAutomationRule[]>;

  // SMS Automation Logs
  createSmsAutomationLog(data: InsertSmsAutomationLog): Promise<SmsAutomationLog>;
  getSmsAutomationLog(ruleId: string, entityType: string, entityId: string): Promise<SmsAutomationLog | undefined>;

  // SMS Booking Links
  createSmsBookingLink(data: InsertSmsBookingLink): Promise<SmsBookingLink>;
  getSmsBookingLinkByToken(token: string): Promise<SmsBookingLink | undefined>;
  updateSmsBookingLink(id: string, data: Partial<SmsBookingLink>): Promise<SmsBookingLink>;

  // SMS Tracking Links (Live Arrival Tracking)
  createSmsTrackingLink(data: InsertSmsTrackingLink): Promise<SmsTrackingLink>;
  getSmsTrackingLinkByToken(token: string): Promise<SmsTrackingLink | undefined>;
  getSmsTrackingLinkByJobId(jobId: string): Promise<SmsTrackingLink | undefined>;
  updateSmsTrackingLink(id: string, data: Partial<SmsTrackingLink>): Promise<SmsTrackingLink>;
  incrementTrackingLinkViews(id: string): Promise<void>;
  deactivateSmsTrackingLink(id: string): Promise<void>;

  // Xero Integration
  getXeroConnection(userId: string): Promise<XeroConnection | undefined>;
  createXeroConnection(data: InsertXeroConnection): Promise<XeroConnection>;
  updateXeroConnection(id: string, data: Partial<XeroConnection>): Promise<XeroConnection | undefined>;
  deleteXeroConnection(userId: string): Promise<boolean>;
  recordXeroSyncRun(data: InsertXeroSyncState): Promise<XeroSyncState>;
  getXeroSyncHistory(userId: string, limit?: number): Promise<XeroSyncState[]>;
  getAllXeroConnections(): Promise<XeroConnection[]>;

  // MYOB Integration
  getMyobConnection(userId: string): Promise<MyobConnection | undefined>;
  createMyobConnection(data: InsertMyobConnection): Promise<MyobConnection>;
  updateMyobConnection(id: string, data: Partial<MyobConnection>): Promise<MyobConnection | undefined>;
  deleteMyobConnection(userId: string): Promise<boolean>;

  // QuickBooks Integration
  getQuickbooksConnection(userId: string): Promise<QuickbooksConnection | undefined>;
  createQuickbooksConnection(data: InsertQuickbooksConnection): Promise<QuickbooksConnection>;
  updateQuickbooksConnection(id: string, data: Partial<QuickbooksConnection>): Promise<QuickbooksConnection | undefined>;
  deleteQuickbooksConnection(userId: string): Promise<boolean>;
  getAllQuickbooksConnections(): Promise<QuickbooksConnection[]>;

  // Job Documents (uploaded PDFs, external quotes/invoices)
  getJobDocuments(jobId: string, userId: string): Promise<JobDocument[]>;
  getJobDocument(id: string, userId: string): Promise<JobDocument | undefined>;
  createJobDocument(document: InsertJobDocument): Promise<JobDocument>;
  deleteJobDocument(id: string, userId: string): Promise<boolean>;

  // Message Templates (unified email/SMS templates)
  getMessageTemplates(userId: string, channel?: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string, userId: string): Promise<MessageTemplate | null>;
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, userId: string, updates: Partial<InsertMessageTemplate>): Promise<MessageTemplate | null>;
  deleteMessageTemplate(id: string, userId: string): Promise<boolean>;
  ensureDefaultTemplates(userId: string): Promise<void>;

  // Quick Replies (Chat Hub canned responses)
  getQuickReplies(userId: string): Promise<QuickReply[]>;
  createQuickReply(reply: InsertQuickReply): Promise<QuickReply>;
  updateQuickReply(id: string, userId: string, updates: Partial<InsertQuickReply>): Promise<QuickReply | null>;
  deleteQuickReply(id: string, userId: string): Promise<boolean>;
  reorderQuickReplies(userId: string, orderedIds: string[]): Promise<QuickReply[]>;
  ensureDefaultQuickReplies(userId: string): Promise<void>;

  // Business Templates (unified Templates Hub)
  getBusinessTemplates(userId: string, family?: string, tradeType?: string): Promise<BusinessTemplate[]>;
  getBusinessTemplatesWithFallback(userId: string, tradeType: string, family?: string): Promise<BusinessTemplate[]>;
  getBusinessTemplate(id: string, userId: string): Promise<BusinessTemplate | undefined>;
  getActiveBusinessTemplate(userId: string, family: string, tradeType?: string): Promise<BusinessTemplate | undefined>;
  getActiveBusinessTemplateByPurpose(userId: string, family: string, purpose: string, tradeType?: string): Promise<BusinessTemplate | null>;
  createBusinessTemplate(data: InsertBusinessTemplate): Promise<BusinessTemplate>;
  updateBusinessTemplate(id: string, userId: string, data: Partial<InsertBusinessTemplate>): Promise<BusinessTemplate | undefined>;
  deleteBusinessTemplate(id: string, userId: string): Promise<boolean>;
  setActiveBusinessTemplate(id: string, userId: string): Promise<void>;
  seedDefaultBusinessTemplates(userId: string): Promise<BusinessTemplate[]>;
  seedBusinessTemplatesForUser(userId: string, tradeType: string): Promise<DocumentTemplate[]>;
  getBusinessTemplateFamilies(userId: string): Promise<{ family: string; name: string; description: string; count: number; hasActive: boolean }[]>;

  // Account Deletion (Apple App Store Compliance)
  deleteUserAccount(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }>;

  // Team Presence
  getTeamPresence(businessOwnerId: string): Promise<TeamPresence[]>;
  getPresenceByUserId(userId: string): Promise<TeamPresence | undefined>;
  updatePresence(userId: string, businessOwnerId: string, data: Partial<InsertTeamPresence>): Promise<TeamPresence>;
  markOffline(userId: string): Promise<void>;

  // Activity Feed
  getActivityFeed(businessOwnerId: string, limit?: number, before?: Date): Promise<ActivityFeed[]>;
  createActivity(activity: InsertActivityFeed): Promise<ActivityFeed>;
  markActivityRead(id: string, businessOwnerId: string): Promise<ActivityFeed | undefined>;
  markAllActivitiesRead(businessOwnerId: string): Promise<number>;

  // Recurring Contracts
  getRecurringContracts(userId: string): Promise<RecurringContract[]>;
  getRecurringContract(id: string, userId: string): Promise<RecurringContract | undefined>;
  createRecurringContract(contract: InsertRecurringContract & { userId: string }): Promise<RecurringContract>;
  updateRecurringContract(id: string, userId: string, updates: Partial<InsertRecurringContract>): Promise<RecurringContract | undefined>;
  deleteRecurringContract(id: string, userId: string): Promise<boolean>;
  getRecurringSchedules(contractId: string): Promise<RecurringSchedule[]>;
  createRecurringSchedule(schedule: InsertRecurringSchedule): Promise<RecurringSchedule>;

  // Leads / CRM Pipeline
  getLeads(userId: string): Promise<Lead[]>;
  getLead(id: string, userId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead & { userId: string }): Promise<Lead>;
  updateLead(id: string, userId: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string, userId: string): Promise<boolean>;
  getLeadsByUserAndPhone(userId: string, phone: string): Promise<Lead[]>;

  // AI Receptionist Config
  getAiReceptionistConfig(userId: string): Promise<AiReceptionistConfig | undefined>;
  getAiReceptionistConfigById(configId: string): Promise<AiReceptionistConfig | undefined>;
  getAiReceptionistConfigsByUser(userId: string): Promise<AiReceptionistConfig[]>;
  getAiReceptionistConfigByPhone(phoneNumber: string): Promise<AiReceptionistConfig | undefined>;
  getAllAiReceptionistConfigs(): Promise<AiReceptionistConfig[]>;
  createAiReceptionistConfig(config: InsertAiReceptionistConfig): Promise<AiReceptionistConfig>;
  updateAiReceptionistConfig(userId: string, updates: Partial<InsertAiReceptionistConfig>): Promise<AiReceptionistConfig | undefined>;
  updateAiReceptionistConfigById(configId: string, updates: Partial<InsertAiReceptionistConfig>): Promise<AiReceptionistConfig | undefined>;

  // AI Receptionist Calls
  getAiReceptionistCalls(userId: string, limit?: number, phoneNumberId?: string): Promise<AiReceptionistCall[]>;
  getAiReceptionistCall(id: string, userId: string): Promise<AiReceptionistCall | undefined>;
  getAiReceptionistCallByVapiId(vapiCallId: string): Promise<AiReceptionistCall | undefined>;
  createAiReceptionistCall(call: InsertAiReceptionistCall): Promise<AiReceptionistCall>;
  updateAiReceptionistCall(id: string, userId: string, updates: Partial<InsertAiReceptionistCall>): Promise<AiReceptionistCall | undefined>;

  // Voice Change Requests
  getVoiceChangeRequests(userId: string): Promise<VoiceChangeRequest[]>;
  getAllVoiceChangeRequests(): Promise<VoiceChangeRequest[]>;
  createVoiceChangeRequest(request: InsertVoiceChangeRequest): Promise<VoiceChangeRequest>;
  updateVoiceChangeRequest(id: string, updates: Partial<InsertVoiceChangeRequest>): Promise<VoiceChangeRequest | undefined>;

  // Payment Schedules (Installment Plans)
  getPaymentSchedules(userId: string): Promise<PaymentSchedule[]>;
  getPaymentSchedule(id: string, userId: string): Promise<PaymentSchedule | undefined>;
  getPaymentScheduleByInvoice(invoiceId: string, userId: string): Promise<PaymentSchedule | undefined>;
  createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule>;
  updatePaymentSchedule(id: string, userId: string, updates: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined>;
  deletePaymentSchedule(id: string, userId: string): Promise<boolean>;
  
  // Payment Installments
  getPaymentInstallments(scheduleId: string): Promise<PaymentInstallment[]>;
  getPaymentInstallment(id: string): Promise<PaymentInstallment | undefined>;
  getDueInstallments(): Promise<PaymentInstallment[]>;
  getOverdueInstallments(): Promise<PaymentInstallment[]>;
  createPaymentInstallment(installment: InsertPaymentInstallment): Promise<PaymentInstallment>;
  updatePaymentInstallment(id: string, updates: Partial<InsertPaymentInstallment>): Promise<PaymentInstallment | undefined>;
  markInstallmentPaid(id: string, paidAmount: string, paymentMethod: string): Promise<PaymentInstallment | undefined>;

  // Tap to Pay Terms & Conditions (Apple Requirement)
  getTapToPayTermsAcceptance(userId: string): Promise<TapToPayTermsAcceptance | undefined>;
  createOrUpdateTapToPayTermsAcceptance(data: Partial<InsertTapToPayTermsAcceptance> & { userId: string; acceptedByUserId: string }): Promise<TapToPayTermsAcceptance>;
  updateTapToPayTermsAcceptance(userId: string, updates: Partial<TapToPayTermsAcceptance>): Promise<TapToPayTermsAcceptance | undefined>;
  deleteTapToPayTermsAcceptance(userId: string): Promise<void>;
  markTapToPaySplashShown(userId: string): Promise<void>;
  getTeamMemberByUserId(userId: string): Promise<TeamMember | undefined>;

  // Job Invites (Shareable magic links for subcontractors)
  getJobInvites(jobId: string, userId: string): Promise<JobInvite[]>;
  getJobInviteByCode(code: string): Promise<JobInvite | undefined>;
  createJobInvite(invite: InsertJobInvite): Promise<JobInvite>;
  revokeJobInvite(id: string, userId: string): Promise<JobInvite | undefined>;
  acceptJobInvite(code: string, acceptingUserId: string): Promise<JobInvite | undefined>;

  // Client Portal Verification (OTP-based access)
  createPortalVerificationCode(phone: string, code: string, expiresAt: Date): Promise<PortalVerificationCode>;
  getPortalVerificationCode(phone: string, code: string): Promise<PortalVerificationCode | undefined>;
  incrementVerificationAttempts(id: string): Promise<void>;
  markVerificationCodeUsed(id: string): Promise<void>;
  cleanupExpiredVerificationCodes(): Promise<void>;
  countRecentVerificationCodes(phone: string, windowMs: number): Promise<number>;
  
  // Client Portal Sessions
  createPortalSession(phone: string, sessionToken: string, expiresAt: Date): Promise<PortalSession>;
  getPortalSessionByToken(token: string): Promise<PortalSession | undefined>;
  deletePortalSession(token: string): Promise<void>;
  cleanupExpiredPortalSessions(): Promise<void>;
  
  // Client Portal Data Access (find all clients by phone)
  getClientsByPhone(phone: string): Promise<Client[]>;
  getQuotesForClientIds(clientIds: string[]): Promise<Quote[]>;
  getQuotesByClient(clientId: string): Promise<Quote[]>;
  getInvoicesForClientIds(clientIds: string[]): Promise<any[]>;
  getReceiptsForClientIds(clientIds: string[]): Promise<any[]>;
  getJobsForClientIds(clientIds: string[]): Promise<Job[]>;

  // Job Portal Token methods
  createJobPortalToken(data: InsertJobPortalToken): Promise<JobPortalToken>;
  getJobPortalTokenByToken(token: string): Promise<JobPortalToken | null>;
  getJobPortalTokensByJobId(jobId: string): Promise<JobPortalToken[]>;
  revokeJobPortalToken(tokenId: string): Promise<void>;
  updateJobPortalTokenAccess(tokenId: string): Promise<void>;
  updateJobPortalTokenExpiry(tokenId: string, expiresAt: Date): Promise<void>;
  updateJobPortalTokenSettings(tokenId: string, settings: { showTimeline?: boolean; showPhotos?: boolean; showChecklist?: boolean; showActivityFeed?: boolean; clientMessage?: string | null }): Promise<JobPortalToken | null>;
  getActiveJobPortalToken(jobId: string): Promise<JobPortalToken | null>;

  // Subcontractor Web View
  createSubcontractorToken(data: InsertSubcontractorToken): Promise<SubcontractorToken>;
  getSubcontractorTokenByToken(token: string): Promise<SubcontractorToken | null>;
  getSubcontractorTokensByJobId(jobId: string): Promise<SubcontractorToken[]>;
  updateSubcontractorTokenStatus(id: string, status: string, acceptedAt?: Date): Promise<SubcontractorToken | null>;
  revokeSubcontractorToken(id: string): Promise<void>;
  updateSubcontractorTokenAccess(id: string): Promise<void>;
  updateSubcontractorTokenContact(id: string, phone: string): Promise<void>;
  updateSubcontractorToken(id: string, updates: Partial<{ etaMinutes: number | null }>): Promise<void>;

  createSubcontractorSession(tokenId: string, sessionToken: string, phone: string, expiresAt: Date): Promise<SubcontractorSession>;
  getSubcontractorSessionByToken(sessionToken: string): Promise<SubcontractorSession | null>;
  deleteSubcontractorSession(sessionToken: string): Promise<void>;

  createSubcontractorEvent(data: InsertSubcontractorEvent): Promise<SubcontractorEvent>;
  getSubcontractorEventsByJob(jobId: string): Promise<SubcontractorEvent[]>;

  createSubcontractorLocationPing(data: InsertSubcontractorLocationPing): Promise<SubcontractorLocationPing>;
  getLatestSubcontractorLocationPing(tokenId: string): Promise<SubcontractorLocationPing | null>;
  getSubcontractorLocationPingsByJob(jobId: string): Promise<SubcontractorLocationPing[]>;

  // Equipment Management
  getEquipment(userId: string): Promise<Equipment[]>;
  getEquipmentById(id: string, userId: string): Promise<Equipment | undefined>;
  createEquipment(data: InsertEquipment & { userId: string }): Promise<Equipment>;
  updateEquipment(id: string, userId: string, updates: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string, userId: string): Promise<boolean>;

  // Equipment Categories
  getEquipmentCategories(userId: string): Promise<EquipmentCategory[]>;
  createEquipmentCategory(data: InsertEquipmentCategory & { userId: string }): Promise<EquipmentCategory>;

  // Equipment Maintenance
  getEquipmentMaintenance(equipmentId: string, userId: string): Promise<EquipmentMaintenance[]>;
  createEquipmentMaintenance(data: InsertEquipmentMaintenance & { userId: string }): Promise<EquipmentMaintenance>;

  // Worker Requests
  createWorkerRequest(data: InsertWorkerRequest): Promise<WorkerRequest>;
  getWorkerRequests(businessOwnerId: string): Promise<WorkerRequest[]>;
  getWorkerRequestsByClient(clientId: string): Promise<WorkerRequest[]>;
  updateWorkerRequestStatus(id: string, status: string): Promise<WorkerRequest | undefined>;

  // Compliance Documents
  getComplianceDocuments(businessOwnerId: string): Promise<ComplianceDocument[]>;
  getComplianceDocument(id: string, businessOwnerId: string): Promise<ComplianceDocument | undefined>;
  getComplianceDocumentsByHolder(holderUserId: string, businessOwnerId?: string): Promise<ComplianceDocument[]>;
  createComplianceDocument(doc: InsertComplianceDocument): Promise<ComplianceDocument>;
  updateComplianceDocument(id: string, businessOwnerId: string, updates: Partial<InsertComplianceDocument>): Promise<ComplianceDocument | undefined>;
  deleteComplianceDocument(id: string, businessOwnerId: string): Promise<boolean>;
  getExpiringComplianceDocuments(businessOwnerId: string, withinDays: number): Promise<ComplianceDocument[]>;

  // Job Requests (Client Portal)
  createJobRequest(data: InsertJobRequest): Promise<JobRequest>;
  getJobRequests(userId: string, status?: string): Promise<JobRequest[]>;
  getJobRequest(id: string, userId: string): Promise<JobRequest | undefined>;
  updateJobRequest(id: string, userId: string, updates: Partial<JobRequest>): Promise<JobRequest | undefined>;
  updateJobRequestByClient(id: string, clientId: string, updates: Partial<JobRequest>): Promise<JobRequest | undefined>;
  deleteJobRequest(id: string, clientId: string): Promise<boolean>;
  getJobRequestsByClient(clientId: string): Promise<JobRequest[]>;
  getJobRequestsByClientForUser(userId: string, clientId: string): Promise<any[]>;

  // Saved Filters
  getSavedFilters(userId: string, entityType?: string): Promise<SavedFilter[]>;
  createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter>;
  deleteSavedFilter(id: string, userId: string): Promise<boolean>;

  // WHS - Incident Reports
  getIncidentReports(userId: string, jobId?: string): Promise<IncidentReport[]>;
  getIncidentReport(id: string, userId: string): Promise<IncidentReport | undefined>;
  createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport>;
  updateIncidentReport(id: string, userId: string, updates: Partial<InsertIncidentReport>): Promise<IncidentReport | undefined>;
  deleteIncidentReport(id: string, userId: string): Promise<boolean>;

  // WHS - Site Emergency Info
  getSiteEmergencyInfo(userId: string, jobId?: string): Promise<SiteEmergencyInfo[]>;
  getSiteEmergencyInfoById(id: string, userId: string): Promise<SiteEmergencyInfo | undefined>;
  createSiteEmergencyInfo(info: InsertSiteEmergencyInfo): Promise<SiteEmergencyInfo>;
  updateSiteEmergencyInfo(id: string, userId: string, updates: Partial<InsertSiteEmergencyInfo>): Promise<SiteEmergencyInfo | undefined>;
  deleteSiteEmergencyInfo(id: string, userId: string): Promise<boolean>;

  // WHS - JSA Documents
  getJsaDocuments(userId: string, jobId?: string): Promise<JsaDocument[]>;
  getJsaDocument(id: string, userId: string): Promise<JsaDocument | undefined>;
  createJsaDocument(doc: InsertJsaDocument): Promise<JsaDocument>;
  updateJsaDocument(id: string, userId: string, updates: Partial<InsertJsaDocument>): Promise<JsaDocument | undefined>;
  deleteJsaDocument(id: string, userId: string): Promise<boolean>;
  getJsaSteps(jsaId: string): Promise<JsaStep[]>;
  getJsaStep(id: string): Promise<JsaStep | undefined>;
  createJsaStep(step: InsertJsaStep): Promise<JsaStep>;
  updateJsaStep(id: string, updates: Partial<InsertJsaStep>): Promise<JsaStep | undefined>;
  deleteJsaStep(id: string): Promise<boolean>;

  // WHS - Site Hazardous Environments
  getSiteHazardousEnvironments(userId: string, jobId?: string): Promise<SiteHazardousEnvironment[]>;
  createSiteHazardousEnvironment(env: InsertSiteHazardousEnvironment): Promise<SiteHazardousEnvironment>;
  updateSiteHazardousEnvironment(id: string, userId: string, updates: Partial<InsertSiteHazardousEnvironment>): Promise<SiteHazardousEnvironment | undefined>;
  deleteSiteHazardousEnvironment(id: string, userId: string): Promise<boolean>;

  // WHS - Site Safety Signage
  getSiteSafetySignage(userId: string, jobId?: string): Promise<SiteSafetySignage[]>;
  createSiteSafetySignage(sign: InsertSiteSafetySignage): Promise<SiteSafetySignage>;
  updateSiteSafetySignage(id: string, userId: string, updates: Partial<InsertSiteSafetySignage>): Promise<SiteSafetySignage | undefined>;
  deleteSiteSafetySignage(id: string, userId: string): Promise<boolean>;

  getHazardReports(userId: string, jobId?: string): Promise<HazardReport[]>;
  createHazardReport(report: InsertHazardReport): Promise<HazardReport>;
  updateHazardReport(id: string, userId: string, updates: Partial<InsertHazardReport>): Promise<HazardReport | undefined>;
  deleteHazardReport(id: string, userId: string): Promise<boolean>;

  getPpeChecklists(userId: string, jobId?: string): Promise<PpeChecklist[]>;
  createPpeChecklist(checklist: InsertPpeChecklist): Promise<PpeChecklist>;
  deletePpeChecklist(id: string, userId: string): Promise<boolean>;

  getTrainingRecords(userId: string): Promise<TrainingRecord[]>;
  createTrainingRecord(record: InsertTrainingRecord): Promise<TrainingRecord>;
  updateTrainingRecord(id: string, userId: string, updates: Partial<InsertTrainingRecord>): Promise<TrainingRecord | undefined>;
  deleteTrainingRecord(id: string, userId: string): Promise<boolean>;

  // Website Addons
  getWebsiteAddon(businessId: string): Promise<WebsiteAddon | undefined>;
  createWebsiteAddon(data: InsertWebsiteAddon): Promise<WebsiteAddon>;
  updateWebsiteAddon(businessId: string, updates: Partial<InsertWebsiteAddon>): Promise<WebsiteAddon | undefined>;

  // Website Change Requests
  getWebsiteChangeRequests(businessId: string): Promise<WebsiteChangeRequest[]>;
  getAllWebsiteChangeRequests(): Promise<WebsiteChangeRequest[]>;
  createWebsiteChangeRequest(data: InsertWebsiteChangeRequest): Promise<WebsiteChangeRequest>;
  updateWebsiteChangeRequestStatus(id: string, status: string): Promise<WebsiteChangeRequest | undefined>;

  // Subcontractor Invoices
  getSubcontractorInvoices(subcontractorUserId: string, businessOwnerId?: string): Promise<SubcontractorInvoice[]>;
  getSubcontractorInvoice(id: string): Promise<SubcontractorInvoice | undefined>;
  getSubcontractorInvoiceWithItems(id: string): Promise<(SubcontractorInvoice & { items: SubcontractorInvoiceItem[] }) | undefined>;
  createSubcontractorInvoice(invoice: InsertSubcontractorInvoice): Promise<SubcontractorInvoice>;
  updateSubcontractorInvoice(id: string, updates: Partial<InsertSubcontractorInvoice>): Promise<SubcontractorInvoice | undefined>;
  getSubcontractorInvoicesByBusiness(businessOwnerId: string): Promise<SubcontractorInvoice[]>;
  getNextSubcontractorInvoiceNumber(subcontractorUserId: string): Promise<string>;

  // Subcontractor Invoice Items
  getSubcontractorInvoiceItems(invoiceId: string): Promise<SubcontractorInvoiceItem[]>;
  createSubcontractorInvoiceItem(item: InsertSubcontractorInvoiceItem): Promise<SubcontractorInvoiceItem>;
  deleteSubcontractorInvoiceItems(invoiceId: string): Promise<boolean>;
  deleteSubcontractorInvoice(id: string): Promise<boolean>;

  // Worker payment details (Task #271)
  getWorkerPaymentDetails(userId: string): Promise<WorkerPaymentDetails | undefined>;
  upsertWorkerPaymentDetails(userId: string, data: Partial<InsertWorkerPaymentDetails>): Promise<WorkerPaymentDetails>;

  // Payroll pay runs (Task #271)
  getPayrollPayments(businessOwnerId: string, filters?: { start?: Date; end?: Date; workerUserId?: string }): Promise<PayrollPayment[]>;
  getPayrollPayment(id: string): Promise<PayrollPayment | undefined>;
  createPayrollPayment(payment: InsertPayrollPayment): Promise<PayrollPayment>;
  updatePayrollPayment(id: string, updates: Partial<InsertPayrollPayment>): Promise<PayrollPayment | undefined>;

  // Worker States
  getWorkerState(userId: string, businessOwnerId?: string): Promise<WorkerState | undefined>;
  getWorkerStatesByBusiness(businessOwnerId: string): Promise<WorkerState[]>;
  upsertWorkerState(userId: string, businessOwnerId: string, state: string, jobId?: string | null, note?: string | null): Promise<WorkerState>;

  // Number Port Requests
  getNumberPortRequests(userId: string): Promise<NumberPortRequest[]>;
  getNumberPortRequest(id: string): Promise<NumberPortRequest | undefined>;
  getAllNumberPortRequests(): Promise<NumberPortRequest[]>;
  createNumberPortRequest(request: InsertNumberPortRequest): Promise<NumberPortRequest>;
  updateNumberPortRequest(id: string, updates: Partial<NumberPortRequest>): Promise<NumberPortRequest | undefined>;
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 15,
  min: 2,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('[Pool] Unexpected pool error on idle client:', err.message);
});

pool.on('connect', (client) => {
  client.query('SET statement_timeout = 30000').catch(() => {});
});

export { pool };
export const db = drizzle(pool);

// Ensure the terms_acceptance audit table exists. We intentionally do NOT use
// drizzle-kit push on this database (it proposes destructive drops), so new
// tables are created idempotently with raw SQL at startup. Fire-and-forget.
pool
  .query(`
    CREATE TABLE IF NOT EXISTS terms_acceptance (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL,
      terms_version varchar NOT NULL,
      platform varchar NOT NULL,
      ip_address varchar,
      accepted_at timestamp NOT NULL DEFAULT now()
    )
  `)
  .catch((err) => {
    console.error('[Schema] Failed to ensure terms_acceptance table:', err.message);
  });

// Job card edit history: form_submission_versions. Created idempotently with
// raw SQL at startup (we do NOT use drizzle-kit push on this database).
pool
  .query(`
    CREATE TABLE IF NOT EXISTS form_submission_versions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id varchar NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
      version_number integer NOT NULL DEFAULT 1,
      submission_data json DEFAULT '{}',
      edited_by varchar REFERENCES users(id),
      edited_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_form_submission_versions_submission_id ON form_submission_versions (submission_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_form_submission_versions_sub_ver ON form_submission_versions (submission_id, version_number);
  `)
  .catch((err) => {
    console.error('[Schema] Failed to ensure form_submission_versions table:', err.message);
  });

// Task #271 (Subcontractor & payroll payments): new money-side tables + columns.
// Created idempotently with raw SQL at startup (we do NOT use drizzle-kit push).
pool
  .query(`
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS paid_reference text;
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS paid_notes text;
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS remittance_sent_at timestamp;
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_provider text;
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_bill_id text;
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_synced_at timestamp;
    ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_sync_error text;
    CREATE TABLE IF NOT EXISTS worker_payment_details (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bank_bsb text,
      bank_account_number text,
      bank_account_name text,
      abn text,
      pay_id text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_worker_payment_details_user ON worker_payment_details (user_id);
    CREATE TABLE IF NOT EXISTS payroll_payments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      business_owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      worker_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_member_id varchar REFERENCES team_members(id) ON DELETE SET NULL,
      period_start timestamp NOT NULL,
      period_end timestamp NOT NULL,
      regular_hours decimal(10,2) NOT NULL DEFAULT '0',
      overtime_hours decimal(10,2) NOT NULL DEFAULT '0',
      total_hours decimal(10,2) NOT NULL DEFAULT '0',
      gross_pay decimal(10,2) NOT NULL DEFAULT '0',
      method text NOT NULL DEFAULT 'bank_transfer',
      reference text,
      notes text,
      paid_at timestamp NOT NULL DEFAULT now(),
      remittance_sent_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_payments_business ON payroll_payments (business_owner_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_payments_worker ON payroll_payments (worker_user_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_payments_period ON payroll_payments (period_start, period_end);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_payments_worker_period ON payroll_payments (business_owner_id, worker_user_id, period_start, period_end);
  `)
  .catch((err) => {
    console.error('[Schema] Failed to ensure subcontractor/payroll payment tables:', err.message);
  });

export class PostgresStorage implements IStorage {
  // Replit Auth required methods
  async upsertUser(userData: UpsertUser): Promise<User> {
    const normalizedEmail = userData.email
      ? userData.email.toLowerCase().trim()
      : userData.email;
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        email: normalizedEmail,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: normalizedEmail,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    const { invalidateUser } = await import('./cache');
    invalidateUser(user.id);
    return user;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const { userCache } = await import('./cache');
    return await userCache.getOrLoad(id, async () => {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    });
  }

  async getUserById(id: string): Promise<User | undefined> {
    const { userCache } = await import('./cache');
    return await userCache.getOrLoad(id, async () => {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-INSENSITIVE match. The DB unique index on users.email is
    // case-sensitive and some legacy rows were stored with mixed case, so a
    // plain eq() against a lowercased input would MISS those rows — which both
    // breaks their login AND lets a "Sign in with Google" (which lowercases the
    // email) create a SECOND account for an email that already exists. Matching
    // on lower(email) closes that duplicate-account hole.
    const result = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase().trim()}`)
      .orderBy(asc(users.createdAt))
      .limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Normalize email to lowercase on write so we never store mixed-case rows.
    // Combined with the case-insensitive getUserByEmail, this keeps emails
    // unique in practice even though the DB index is case-sensitive — and stops
    // a second account being created for the same address under a different case.
    const normalizedUser = insertUser.email
      ? { ...insertUser, email: insertUser.email.toLowerCase().trim() }
      : insertUser;
    const result = await db.insert(users).values(normalizedUser).returning();
    const created = result[0];
    // Seed day-0 activity (signup day) so retention cohorts are populated even
    // before the user takes a tracked action. Best-effort, never blocks signup.
    db.execute(sql`
      INSERT INTO user_activity (user_id, activity_date)
      VALUES (${created.id}, (NOW() AT TIME ZONE 'Australia/Sydney')::date)
      ON CONFLICT (user_id, activity_date) DO NOTHING
    `).catch(() => {});
    return created;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    // Normalize email on any update so a profile edit can't reintroduce a
    // mixed-case row (which would re-open the duplicate-account hole).
    const normalizedUpdates = updates.email
      ? { ...updates, email: updates.email.toLowerCase().trim() }
      : updates;
    const result = await db
      .update(users)
      .set({ ...normalizedUpdates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    const { invalidateUser } = await import('./cache');
    invalidateUser(id);
    return result[0];
  }

  async updateUserJobCount(id: string, count: number): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ jobsCreatedThisMonth: count, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    const { invalidateUser } = await import('./cache');
    invalidateUser(id);
    return result[0];
  }

  async resetUserJobCount(id: string, nextResetDate: Date): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        jobsCreatedThisMonth: 0,
        subscriptionResetDate: nextResetDate,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    const { invalidateUser } = await import('./cache');
    invalidateUser(id);
    return result[0];
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token))
      .limit(1);
    return result[0];
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token))
      .limit(1);
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return result[0];
  }

  async linkGoogleAccount(userId: string, googleId: string, profileImageUrl?: string | null): Promise<void> {
    // Only adopt the Google picture when the user has none yet, so we never
    // clobber a photo the user uploaded themselves.
    let setPicture = false;
    if (profileImageUrl) {
      const existing = await db
        .select({ profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      setPicture = !existing[0]?.profileImageUrl;
    }
    await db
      .update(users)
      .set({
        googleId: googleId,
        ...(setPicture ? { profileImageUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    const { invalidateUser } = await import('./cache');
    invalidateUser(userId);
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.appleId, appleId))
      .limit(1);
    return result[0];
  }

  async getUserByAppleOriginalTransactionId(originalTransactionId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.appleOriginalTransactionId, originalTransactionId))
      .limit(1);
    return result[0];
  }

  async getUserByXeroId(xeroId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.xeroId, xeroId))
      .limit(1);
    return result[0];
  }

  async getUserByPhoneNormalized(phoneNormalized: string): Promise<User | undefined> {
    if (!phoneNormalized) return undefined;
    const result = await db
      .select()
      .from(users)
      .where(eq(users.phoneNormalized, phoneNormalized))
      .limit(1);
    return result[0];
  }

  async setSubcontractorTokenRecipient(tokenId: string, recipientUserId: string, alsoMarkNameConfirmed = false): Promise<void> {
    const updates: any = { recipientUserId };
    if (alsoMarkNameConfirmed) updates.nameConfirmedAt = new Date();
    await db
      .update(subcontractorTokens)
      .set(updates)
      .where(eq(subcontractorTokens.id, tokenId));
  }

  async linkXeroAccount(userId: string, xeroId: string): Promise<void> {
    await db
      .update(users)
      .set({ xeroId: xeroId, updatedAt: new Date() })
      .where(eq(users.id, userId));
    const { invalidateUser } = await import('./cache');
    invalidateUser(userId);
  }

  async linkAppleAccount(userId: string, appleId: string): Promise<void> {
    await db
      .update(users)
      .set({ appleId: appleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
    const { invalidateUser } = await import('./cache');
    invalidateUser(userId);
  }

  // Login Codes (Passwordless Email Auth)
  async createTermsAcceptance(data: InsertTermsAcceptance): Promise<TermsAcceptance> {
    const result = await db.insert(termsAcceptances).values(data).returning();
    return result[0];
  }

  async createLoginCode(email: string, code: string): Promise<void> {
    // Invalidate any existing codes for this email
    await db
      .delete(loginCodes)
      .where(eq(loginCodes.email, email.toLowerCase().trim()));

    // Create new code with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await db.insert(loginCodes).values({
      email: email.toLowerCase().trim(),
      code,
      expiresAt,
      verified: false,
    });
  }

  async getLoginCode(email: string, code: string): Promise<{ id: string; email: string; verified: boolean; expiresAt: Date } | undefined> {
    const result = await db
      .select()
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.email, email.toLowerCase().trim()),
          eq(loginCodes.code, code)
        )
      )
      .limit(1);
    
    if (!result[0]) return undefined;
    
    return {
      id: result[0].id,
      email: result[0].email,
      verified: result[0].verified ?? false,
      expiresAt: result[0].expiresAt,
    };
  }

  async getLatestLoginCodeForEmail(email: string): Promise<{ id: string; email: string; code: string; verified: boolean; expiresAt: Date; createdAt: Date } | undefined> {
    const result = await db
      .select()
      .from(loginCodes)
      .where(eq(loginCodes.email, email.toLowerCase().trim()))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    return {
      id: result[0].id,
      email: result[0].email,
      code: result[0].code,
      verified: result[0].verified ?? false,
      expiresAt: result[0].expiresAt,
      createdAt: result[0].createdAt ?? new Date(),
    };
  }

  async verifyLoginCodeAndCreateUser(email: string, code: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Wrap entire verification flow in a transaction for atomicity
    return await db.transaction(async (tx) => {
      // Atomically mark code as verified ONLY if it's not already used and not expired
      // This provides row-level locking and prevents concurrent use
      const updatedCodeResult = await tx
        .update(loginCodes)
        .set({ verified: true })
        .where(and(
          eq(loginCodes.email, normalizedEmail),
          eq(loginCodes.code, code),
          eq(loginCodes.verified, false)
        ))
        .returning();
      
      // If no rows updated, code is invalid, already used, or doesn't exist
      if (updatedCodeResult.length === 0) return null;
      
      const loginCode = updatedCodeResult[0];
      
      // Check expiry after securing the row
      if (new Date() > loginCode.expiresAt) {
        // Clean up expired code
        await tx.delete(loginCodes).where(eq(loginCodes.id, loginCode.id));
        return null;
      }
      
      // Find existing user or create new one. Case-insensitive so a legacy
      // mixed-case row isn't missed (which would create a duplicate account).
      const existingUserResult = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .orderBy(asc(users.createdAt))
        .limit(1);
      
      let user = existingUserResult[0];
      
      if (!user) {
        // Create new user for email-based auth
        const username = normalizedEmail.split('@')[0] + '_' + Math.random().toString(36).substring(2, 7);
        const newUserResult = await tx.insert(users).values({
          email: normalizedEmail,
          username: username,
          emailVerified: true,
          password: null,
        }).returning();
        user = newUserResult[0];
      } else {
        // Update existing user to mark email as verified
        const updatedUserResult = await tx
          .update(users)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUserResult[0];
      }
      
      // Delete used code (cleanup)
      await tx.delete(loginCodes).where(eq(loginCodes.id, loginCode.id));
      
      const { invalidateUser } = await import('./cache');
      invalidateUser(user.id);
      return user;
    });
  }

  async cleanupExpiredCodes(): Promise<void> {
    await db
      .delete(loginCodes)
      .where(lt(loginCodes.expiresAt, new Date()));
  }

  // Business Settings
  async getBusinessSettings(userId: string): Promise<BusinessSettings | undefined> {
    // Hot-read cache (60s TTL). Invalidated on update/delete in this class.
    const { businessSettingsCache } = await import('./cache');
    return await businessSettingsCache.getOrLoad(userId, async () => {
      // A user can have duplicate business_settings rows (legacy onboarding
      // created extras, some with an empty name). Pick deterministically: prefer
      // a row with a real business name (not empty, not the "Worker Profile"
      // placeholder), then the most recently updated/created. This keeps owner
      // detection and displayed business data stable instead of returning an
      // arbitrary (possibly empty) row.
      const result = await db
        .select()
        .from(businessSettings)
        .where(eq(businessSettings.userId, userId))
        .orderBy(
          sql`CASE WHEN ${businessSettings.businessName} IS NOT NULL AND ${businessSettings.businessName} <> '' AND ${businessSettings.businessName} <> 'Worker Profile' THEN 0 ELSE 1 END`,
          desc(businessSettings.updatedAt),
          desc(businessSettings.createdAt),
        )
        .limit(1);
      return result[0];
    });
  }

  async getAllBusinessSettings(): Promise<BusinessSettings[]> {
    const result = await db.select().from(businessSettings);
    return result;
  }

  async getBusinessSettingsByBookingSlug(slug: string): Promise<BusinessSettings | undefined> {
    const result = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.bookingSlug, slug))
      .orderBy(desc(businessSettings.updatedAt))
      .limit(1);
    return result[0];
  }

  async createBusinessSettings(settings: InsertBusinessSettings & { userId: string }): Promise<BusinessSettings> {
    const result = await db.insert(businessSettings).values(settings).returning();
    return result[0];
  }

  async updateBusinessSettings(userId: string, settings: Partial<InsertBusinessSettings>): Promise<BusinessSettings | undefined> {
    const { invalidateBusinessSettings } = await import('./cache');
    invalidateBusinessSettings(userId);
    const result = await db
      .update(businessSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(businessSettings.userId, userId))
      .returning();
    return result[0];
  }

  // Integration Settings
  async getIntegrationSettings(userId: string): Promise<IntegrationSettings | undefined> {
    const result = await db.select().from(integrationSettings).where(eq(integrationSettings.userId, userId)).limit(1);
    return result[0];
  }

  async createIntegrationSettings(settings: InsertIntegrationSettings & { userId: string }): Promise<IntegrationSettings> {
    const result = await db.insert(integrationSettings).values(settings).returning();
    return result[0];
  }

  async updateIntegrationSettings(userId: string, settings: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined> {
    const result = await db
      .update(integrationSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(integrationSettings.userId, userId))
      .returning();
    return result[0];
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.dismissed, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification, createdAt?: Date): Promise<Notification> {
    const values = createdAt ? { ...notification, createdAt } : notification;
    const result = await db.insert(notifications).values(values).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result.rowCount || 0;
  }

  async dismissNotification(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ dismissed: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Push Tokens (Mobile App)
  async getPushTokens(userId: string): Promise<PushToken[]> {
    return await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));
  }

  async registerPushToken(token: InsertPushToken): Promise<PushToken> {
    // First, check if this token already exists
    const existing = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, token.token))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing token to be active and update lastUsedAt
      const updated = await db
        .update(pushTokens)
        .set({ 
          isActive: true, 
          lastUsedAt: new Date(),
          userId: token.userId // In case user changed
        })
        .where(eq(pushTokens.token, token.token))
        .returning();
      return updated[0];
    }
    
    // Create new token
    const result = await db.insert(pushTokens).values(token).returning();
    return result[0];
  }

  async deactivatePushToken(tokenId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(pushTokens)
      .set({ isActive: false })
      .where(and(eq(pushTokens.id, tokenId), eq(pushTokens.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deactivatePushTokenByValue(token: string, userId: string): Promise<boolean> {
    const result = await db
      .update(pushTokens)
      .set({ isActive: false })
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Activity Logs (Dashboard Activity Feed)
  async getActivityLogs(userId: string, limit: number = 20): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(log).returning();
    return result[0];
  }

  async deleteActivityLogs(userId: string): Promise<number> {
    const result = await db.delete(activityLogs).where(eq(activityLogs.userId, userId)).returning();
    return result.length;
  }

  // Job Notes (Timestamped notes tied to moments)
  async getJobNotes(jobId: string, userId: string): Promise<JobNote[]> {
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db
      .select()
      .from(jobNotes)
      .where(eq(jobNotes.jobId, jobId))
      .orderBy(desc(jobNotes.createdAt));
  }

  async createJobNote(note: InsertJobNote): Promise<JobNote> {
    const result = await db.insert(jobNotes).values({
      ...note,
      id: randomUUID(),
    }).returning();
    return result[0];
  }

  async updateJobNote(id: string, userId: string, updates: Partial<InsertJobNote>): Promise<JobNote | undefined> {
    const existingNote = await db.select().from(jobNotes).where(eq(jobNotes.id, id)).limit(1);
    if (!existingNote[0]) return undefined;
    
    const job = await this.getJob(existingNote[0].jobId, userId);
    if (!job) return undefined;
    
    const result = await db
      .update(jobNotes)
      .set(updates)
      .where(eq(jobNotes.id, id))
      .returning();
    return result[0];
  }

  async deleteJobNote(id: string, userId: string): Promise<boolean> {
    const existingNote = await db.select().from(jobNotes).where(eq(jobNotes.id, id)).limit(1);
    if (!existingNote[0]) return false;
    
    const job = await this.getJob(existingNote[0].jobId, userId);
    if (!job) return false;
    
    const result = await db.delete(jobNotes).where(eq(jobNotes.id, id)).returning();
    return result.length > 0;
  }

  // Job Variations / Change Orders
  async getJobVariations(jobId: string, userId: string): Promise<JobVariation[]> {
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db
      .select()
      .from(jobVariations)
      .where(eq(jobVariations.jobId, jobId))
      .orderBy(desc(jobVariations.createdAt));
  }

  async getJobVariation(id: string, userId: string): Promise<JobVariation | undefined> {
    const result = await db.select().from(jobVariations).where(eq(jobVariations.id, id)).limit(1);
    if (!result[0]) return undefined;
    
    const job = await this.getJob(result[0].jobId, userId);
    if (!job) return undefined;
    
    return result[0];
  }

  async createJobVariation(variation: InsertJobVariation): Promise<JobVariation> {
    const result = await db.insert(jobVariations).values({
      ...variation,
      id: randomUUID(),
    }).returning();
    return result[0];
  }

  async updateJobVariation(id: string, userId: string, updates: Partial<InsertJobVariation>): Promise<JobVariation | undefined> {
    const existing = await this.getJobVariation(id, userId);
    if (!existing) return undefined;
    
    const result = await db
      .update(jobVariations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobVariations.id, id))
      .returning();
    return result[0];
  }

  async deleteJobVariation(id: string, userId: string): Promise<boolean> {
    const existing = await this.getJobVariation(id, userId);
    if (!existing) return false;
    
    const result = await db.delete(jobVariations).where(eq(jobVariations.id, id)).returning();
    return result.length > 0;
  }

  async getNextVariationNumber(jobId: string, userId: string): Promise<string> {
    const variations = await this.getJobVariations(jobId, userId);
    const nextNum = variations.length + 1;
    return `V${String(nextNum).padStart(3, '0')}`;
  }

  // Job Materials
  async getJobMaterials(jobId: string, userId: string): Promise<JobMaterial[]> {
    return await db
      .select()
      .from(jobMaterials)
      .where(and(eq(jobMaterials.jobId, jobId), eq(jobMaterials.userId, userId)))
      .orderBy(desc(jobMaterials.createdAt));
  }

  async getJobMaterial(id: string, userId: string): Promise<JobMaterial | undefined> {
    const result = await db
      .select()
      .from(jobMaterials)
      .where(and(eq(jobMaterials.id, id), eq(jobMaterials.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createJobMaterial(material: InsertJobMaterial): Promise<JobMaterial> {
    const result = await db.insert(jobMaterials).values({
      ...material,
      id: randomUUID(),
    }).returning();
    return result[0];
  }

  async updateJobMaterial(id: string, userId: string, updates: Partial<InsertJobMaterial>): Promise<JobMaterial | undefined> {
    const existing = await this.getJobMaterial(id, userId);
    if (!existing) return undefined;

    const result = await db
      .update(jobMaterials)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(jobMaterials.id, id), eq(jobMaterials.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteJobMaterial(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(jobMaterials)
      .where(and(eq(jobMaterials.id, id), eq(jobMaterials.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Job Equipment Assignments
  async getJobEquipment(jobId: string): Promise<JobEquipment[]> {
    return await db.select().from(jobEquipment).where(eq(jobEquipment.jobId, jobId)).orderBy(desc(jobEquipment.assignedAt));
  }

  async addJobEquipment(data: InsertJobEquipment): Promise<JobEquipment> {
    const result = await db.insert(jobEquipment).values(data).returning();
    return result[0];
  }

  async removeJobEquipment(id: string, userId: string): Promise<void> {
    await db.delete(jobEquipment).where(and(eq(jobEquipment.id, id), eq(jobEquipment.userId, userId)));
  }

  // Service Reminders
  async getServiceReminders(userId: string): Promise<ServiceReminder[]> {
    return await db.select().from(serviceReminders).where(eq(serviceReminders.userId, userId)).orderBy(asc(serviceReminders.nextDueDate));
  }

  async getServiceReminderById(id: string, userId: string): Promise<ServiceReminder | undefined> {
    const result = await db
      .select()
      .from(serviceReminders)
      .where(and(eq(serviceReminders.id, id), eq(serviceReminders.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getUpcomingServiceReminders(userId: string, days: number): Promise<ServiceReminder[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db
      .select()
      .from(serviceReminders)
      .where(
        and(
          eq(serviceReminders.userId, userId),
          gte(serviceReminders.nextDueDate, now),
          lte(serviceReminders.nextDueDate, futureDate),
          or(eq(serviceReminders.status, 'pending'), eq(serviceReminders.status, 'sent'))
        )
      )
      .orderBy(asc(serviceReminders.nextDueDate));
  }

  async createServiceReminder(reminder: InsertServiceReminder): Promise<ServiceReminder> {
    const result = await db.insert(serviceReminders).values(reminder).returning();
    return result[0];
  }

  async updateServiceReminder(id: string, userId: string, updates: Partial<InsertServiceReminder>): Promise<ServiceReminder | undefined> {
    const existing = await this.getServiceReminderById(id, userId);
    if (!existing) return undefined;
    
    const result = await db
      .update(serviceReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(serviceReminders.id, id))
      .returning();
    return result[0];
  }

  async deleteServiceReminder(id: string, userId: string): Promise<boolean> {
    const existing = await this.getServiceReminderById(id, userId);
    if (!existing) return false;
    
    const result = await db.delete(serviceReminders).where(eq(serviceReminders.id, id)).returning();
    return result.length > 0;
  }

  // Rebates / Credits
  async getRebates(userId: string): Promise<Rebate[]> {
    return await db.select().from(rebates).where(eq(rebates.userId, userId)).orderBy(desc(rebates.createdAt));
  }

  async getRebateById(id: string, userId: string): Promise<Rebate | undefined> {
    const result = await db
      .select()
      .from(rebates)
      .where(and(eq(rebates.id, id), eq(rebates.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createRebate(rebate: InsertRebate): Promise<Rebate> {
    const result = await db.insert(rebates).values(rebate).returning();
    return result[0];
  }

  async updateRebate(id: string, userId: string, updates: Partial<InsertRebate>): Promise<Rebate | undefined> {
    const existing = await this.getRebateById(id, userId);
    if (!existing) return undefined;
    
    const result = await db
      .update(rebates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rebates.id, id))
      .returning();
    return result[0];
  }

  async deleteRebate(id: string, userId: string): Promise<boolean> {
    const existing = await this.getRebateById(id, userId);
    if (!existing) return false;
    
    const result = await db.delete(rebates).where(eq(rebates.id, id)).returning();
    return result.length > 0;
  }

  async getRebatesSummary(userId: string): Promise<{ pending: number; submitted: number; approved: number; received: number; rejected: number }> {
    const allRebates = await this.getRebates(userId);
    const summary = { pending: 0, submitted: 0, approved: 0, received: 0, rejected: 0 };
    
    for (const rebate of allRebates) {
      const amount = parseFloat(rebate.amount || '0');
      const status = rebate.status as keyof typeof summary;
      if (status in summary) {
        summary[status] += amount;
      }
    }
    
    return summary;
  }

  // Platform Stats (for trust signals)
  async getPlatformStats(): Promise<{ userCount: number; quotesCount: number; paidInvoicesCount: number }> {
    try {
      const [userResult, quotesResult, invoicesResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(quotes),
        db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.status, 'paid')),
      ]);
      
      return {
        userCount: Number(userResult[0]?.count || 0),
        quotesCount: Number(quotesResult[0]?.count || 0),
        paidInvoicesCount: Number(invoicesResult[0]?.count || 0),
      };
    } catch (error) {
      console.error('Error getting platform stats:', error);
      return { userCount: 0, quotesCount: 0, paidInvoicesCount: 0 };
    }
  }

  // Clients
  async getClients(userId: string): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string, userId: string): Promise<Client | undefined> {
    const result = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .limit(1);
    return result[0];
  }

  // Get client by ID only (for public access like quote acceptance)
  async getClientById(id: string): Promise<Client | undefined> {
    const result = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return result[0];
  }

  // Get client by phone number for a specific business owner
  // Normalizes phone numbers to +61 format for Australian numbers
  async getClientByPhone(userId: string, phone: string): Promise<Client | undefined> {
    // Normalize the search phone
    let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+61' + normalizedPhone.slice(1);
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+61' + normalizedPhone.replace(/^61/, '');
    }
    
    // Get all clients for this user and check phone matches
    const allClients = await db.select().from(clients).where(eq(clients.userId, userId));
    
    for (const client of allClients) {
      if (!client.phone) continue;
      
      // Normalize client phone for comparison
      let clientPhone = client.phone.replace(/[\s\-\(\)]/g, '');
      if (clientPhone.startsWith('0')) {
        clientPhone = '+61' + clientPhone.slice(1);
      } else if (!clientPhone.startsWith('+')) {
        clientPhone = '+61' + clientPhone.replace(/^61/, '');
      }
      
      if (clientPhone === normalizedPhone) {
        return client;
      }
    }
    
    return undefined;
  }

  async createClient(client: InsertClient & { userId: string }): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: string, userId: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteClient(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Cascade delete methods for client-associated data
  async deleteReceiptsByClientId(clientId: string, userId: string): Promise<void> {
    await db.delete(receipts).where(and(eq(receipts.clientId, clientId), eq(receipts.userId, userId)));
  }

  async deleteInvoicesByClientId(clientId: string, userId: string): Promise<void> {
    // Get all invoices for this client
    const clientInvoices = await db.select({ id: invoices.id }).from(invoices)
      .where(and(eq(invoices.clientId, clientId), eq(invoices.userId, userId)));
    
    // Delete line items for each invoice
    for (const invoice of clientInvoices) {
      await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoice.id));
    }
    
    // Delete the invoices
    await db.delete(invoices).where(and(eq(invoices.clientId, clientId), eq(invoices.userId, userId)));
  }

  async deleteQuotesByClientId(clientId: string, userId: string): Promise<void> {
    // Get all quotes for this client
    const clientQuotes = await db.select({ id: quotes.id }).from(quotes)
      .where(and(eq(quotes.clientId, clientId), eq(quotes.userId, userId)));
    
    // Delete line items for each quote
    for (const quote of clientQuotes) {
      await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quote.id));
    }
    
    // Delete the quotes
    await db.delete(quotes).where(and(eq(quotes.clientId, clientId), eq(quotes.userId, userId)));
  }

  async deleteJobsByClientId(clientId: string, userId: string): Promise<void> {
    // Get all jobs for this client
    const clientJobs = await db.select({ id: jobs.id }).from(jobs)
      .where(and(eq(jobs.clientId, clientId), eq(jobs.userId, userId)));
    
    // Delete photos for each job
    for (const job of clientJobs) {
      await db.delete(jobPhotos).where(eq(jobPhotos.jobId, job.id));
    }
    
    // Delete the jobs
    await db.delete(jobs).where(and(eq(jobs.clientId, clientId), eq(jobs.userId, userId)));
  }

  async getClientSignature(id: string, userId: string): Promise<{ signatureData: string | null; signatureDate: Date | null } | undefined> {
    const result = await db
      .select({
        signatureData: clients.savedSignatureData,
        signatureDate: clients.savedSignatureDate,
      })
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .limit(1);
    return result[0];
  }

  async deleteClientSignature(id: string, userId: string): Promise<boolean> {
    const result = await db
      .update(clients)
      .set({
        savedSignatureData: null,
        savedSignatureDate: null,
        updatedAt: new Date(),
      })
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Jobs
  async getJobs(userId: string, includeArchived?: boolean): Promise<Job[]> {
    if (includeArchived) {
      return await db.select().from(jobs).where(and(eq(jobs.userId, userId), isNotNull(jobs.archivedAt))).orderBy(desc(jobs.createdAt));
    }
    return await db.select().from(jobs).where(and(eq(jobs.userId, userId), isNull(jobs.archivedAt))).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string, userId: string): Promise<Job | undefined> {
    const result = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getJobPublic(id: string): Promise<Job | undefined> {
    const result = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    return result[0];
  }

  async createJob(job: InsertJob & { userId: string }): Promise<Job> {
    const result = await db.insert(jobs).values(job).returning();
    const { invalidateAggregateDashboard } = await import('./cache');
    invalidateAggregateDashboard(job.userId);
    return result[0];
  }

  async updateJob(id: string, userId: string, job: Partial<InsertJob>): Promise<Job | undefined> {
    const updateData: any = { ...job, updatedAt: new Date() };
    if (job.photos && Array.isArray(job.photos)) {
      updateData.photos = job.photos;
    }
    
    const result = await db
      .update(jobs)
      .set(updateData)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    if (result[0]) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return result[0];
  }

  async deleteJob(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if ((result.rowCount ?? 0) > 0) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return (result.rowCount ?? 0) > 0;
  }

  async getJobsForClient(clientId: string, userId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.clientId, clientId), eq(jobs.userId, userId)))
      .orderBy(desc(jobs.createdAt));
  }

  async getJobsByAssignee(assigneeId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(eq(jobs.assignedTo, assigneeId))
      .orderBy(desc(jobs.createdAt));
  }

  async archiveJob(id: string, userId: string): Promise<Job | undefined> {
    const result = await db
      .update(jobs)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    return result[0];
  }

  async unarchiveJob(id: string, userId: string): Promise<Job | undefined> {
    const result = await db
      .update(jobs)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();
    return result[0];
  }

  // Checklist Items
  async getChecklistItems(jobId: string, userId: string): Promise<ChecklistItem[]> {
    // First verify the job belongs to the user
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.jobId, jobId))
      .orderBy(asc(checklistItems.sortOrder), asc(checklistItems.createdAt));
  }

  async createChecklistItem(item: InsertChecklistItem, userId: string): Promise<ChecklistItem> {
    // Verify the job belongs to the user before creating checklist item
    const job = await this.getJob(item.jobId, userId);
    if (!job) {
      throw new Error("Job not found or access denied");
    }
    
    // Auto-calculate sortOrder server-side to prevent ordering manipulation
    const existingItems = await db
      .select({ sortOrder: checklistItems.sortOrder })
      .from(checklistItems)
      .where(eq(checklistItems.jobId, item.jobId))
      .orderBy(desc(checklistItems.sortOrder))
      .limit(1);
    
    const maxSortOrder = existingItems[0]?.sortOrder ?? -1;
    const serverSortOrder = maxSortOrder + 1;
    
    // Ignore client-provided sortOrder and use server-calculated value
    const safeItem = {
      jobId: item.jobId,
      text: item.text,
      isCompleted: item.isCompleted ?? false,
      sortOrder: serverSortOrder,
    };
    
    const result = await db.insert(checklistItems).values(safeItem).returning();
    return result[0];
  }

  async updateChecklistItem(id: string, userId: string, item: Partial<Omit<InsertChecklistItem, 'jobId'>>): Promise<ChecklistItem | undefined> {
    // First get the checklist item to find its job
    const existingItem = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .limit(1);
    
    if (!existingItem[0]) return undefined;
    
    // Verify the job belongs to the user
    const job = await this.getJob(existingItem[0].jobId, userId);
    if (!job) return undefined;
    
    // Strict whitelist: only allow specific fields to prevent privilege escalation
    const safeUpdates: Partial<{
      text: string;
      isCompleted: boolean;
      sortOrder: number;
    }> = {};
    
    if (item.text !== undefined) safeUpdates.text = item.text;
    if (item.isCompleted !== undefined && item.isCompleted !== null) {
      safeUpdates.isCompleted = item.isCompleted;
    }
    if (item.sortOrder !== undefined && item.sortOrder !== null) {
      // Validate sortOrder: must be non-negative and within reasonable bounds
      if (item.sortOrder < 0 || item.sortOrder > 9999) {
        throw new Error("Invalid sortOrder: must be between 0 and 9999");
      }
      safeUpdates.sortOrder = item.sortOrder;
    }
    
    const result = await db
      .update(checklistItems)
      .set({ ...safeUpdates, updatedAt: new Date() })
      .where(eq(checklistItems.id, id))
      .returning();
    return result[0];
  }

  async deleteChecklistItem(id: string, userId: string): Promise<boolean> {
    // First get the checklist item to find its job
    const existingItem = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .limit(1);
    
    if (!existingItem[0]) return false;
    
    // Verify the job belongs to the user
    const job = await this.getJob(existingItem[0].jobId, userId);
    if (!job) return false;
    
    const result = await db.delete(checklistItems).where(eq(checklistItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Job Check-ins (Location Tracking)
  async getJobCheckins(jobId: string, userId: string): Promise<JobCheckin[]> {
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db
      .select()
      .from(jobCheckins)
      .where(eq(jobCheckins.jobId, jobId))
      .orderBy(desc(jobCheckins.createdAt));
  }

  async createJobCheckin(checkin: InsertJobCheckin): Promise<JobCheckin> {
    const [newCheckin] = await db.insert(jobCheckins).values(checkin).returning();
    return newCheckin;
  }

  async getLatestCheckin(jobId: string, userId: string): Promise<JobCheckin | undefined> {
    const checkins = await db
      .select()
      .from(jobCheckins)
      .where(and(eq(jobCheckins.jobId, jobId), eq(jobCheckins.userId, userId)))
      .orderBy(desc(jobCheckins.createdAt))
      .limit(1);
    return checkins[0];
  }

  // Quotes
  async getQuotes(userId: string, includeArchived?: boolean): Promise<Quote[]> {
    if (includeArchived) {
      return await db.select().from(quotes).where(and(eq(quotes.userId, userId), isNotNull(quotes.archivedAt))).orderBy(desc(quotes.createdAt));
    }
    return await db.select().from(quotes).where(and(eq(quotes.userId, userId), isNull(quotes.archivedAt))).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string, userId: string): Promise<Quote | undefined> {
    const result = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createQuote(quote: InsertQuote & { userId: string }): Promise<Quote> {
    // Ensure number is provided
    const quoteData = {
      ...quote,
      number: quote.number || await this.generateQuoteNumber(quote.userId)
    };
    const result = await db.insert(quotes).values(quoteData).returning();
    const { invalidateAggregateDashboard } = await import('./cache');
    invalidateAggregateDashboard(quote.userId);
    return result[0];
  }

  async claimQuoteForEdit(id: string, userId: string): Promise<{ ok: boolean; found: boolean }> {
    const result = await db
      .update(quotes)
      .set({ updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId), ne(quotes.status, 'accepted'), isNull(quotes.acceptedAt)))
      .returning({ id: quotes.id });
    if (result[0]) return { ok: true, found: true };
    const existing = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .limit(1);
    return { ok: false, found: existing.length > 0 };
  }

  async updateQuote(id: string, userId: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ ...quote, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    if (result[0]) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return result[0];
  }

  async deleteQuote(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
    if ((result.rowCount ?? 0) > 0) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return (result.rowCount ?? 0) > 0;
  }

  async getQuoteWithLineItems(id: string, userId: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined> {
    const quote = await this.getQuote(id, userId);
    if (!quote) return undefined;
    
    const lineItems = await this.getQuoteLineItems(id);
    return { ...quote, lineItems };
  }

  async archiveQuote(id: string, userId: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    return result[0];
  }

  async unarchiveQuote(id: string, userId: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    return result[0];
  }

  // Public quote access by token (no auth required)
  async getQuoteByToken(token: string): Promise<Quote | undefined> {
    const result = await db
      .select()
      .from(quotes)
      .where(eq(quotes.acceptanceToken, token))
      .limit(1);
    return result[0];
  }

  async getQuoteWithLineItemsByToken(token: string): Promise<(Quote & { lineItems: QuoteLineItem[] }) | undefined> {
    const quote = await this.getQuoteByToken(token);
    if (!quote) return undefined;
    
    const lineItems = await this.getQuoteLineItems(quote.id);
    return { ...quote, lineItems };
  }

  async acceptQuoteByToken(token: string, acceptedBy: string, acceptanceIp: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ 
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy,
        acceptanceIp,
        updatedAt: new Date()
      })
      .where(eq(quotes.acceptanceToken, token))
      .returning();
    return result[0];
  }

  async declineQuoteByToken(token: string, declineReason?: string): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ 
        status: 'declined',
        rejectedAt: new Date(),
        declineReason: declineReason || null,
        updatedAt: new Date()
      })
      .where(eq(quotes.acceptanceToken, token))
      .returning();
    return result[0];
  }

  async generateQuoteAcceptanceToken(id: string, userId: string): Promise<string | null> {
    // Generate a shorter but still secure token (12 chars alphanumeric)
    // 54^12 = ~2.3e20 possibilities - still very secure
    // Excludes ambiguous chars: 0/O, 1/I/l to avoid confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars[crypto.randomInt(chars.length)];
    }
    
    const result = await db
      .update(quotes)
      .set({ acceptanceToken: token, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
      .returning();
    
    return result[0] ? token : null;
  }

  async updateQuoteByToken(token: string, updates: Partial<Quote>): Promise<Quote | undefined> {
    const result = await db
      .update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.acceptanceToken, token))
      .returning();
    return result[0];
  }

  // Quote Line Items
  async getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
    return await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId))
      .orderBy(quoteLineItems.sortOrder);
  }

  async createQuoteLineItem(lineItem: InsertQuoteLineItem, userId?: string): Promise<QuoteLineItem> {
    // Validate ownership if userId provided
    if (userId) {
      const quote = await this.getQuote(lineItem.quoteId, userId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }
    }
    const result = await db.insert(quoteLineItems).values(lineItem).returning();
    return result[0];
  }

  async updateQuoteLineItem(id: string, lineItem: Partial<InsertQuoteLineItem>, userId?: string): Promise<QuoteLineItem | undefined> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(quoteLineItems).where(eq(quoteLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Quote line item not found');
      }
      const quote = await this.getQuote(existing[0].quoteId, userId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }
    }
    const result = await db
      .update(quoteLineItems)
      .set(lineItem)
      .where(eq(quoteLineItems.id, id))
      .returning();
    return result[0];
  }

  async deleteQuoteLineItem(id: string, userId?: string): Promise<boolean> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(quoteLineItems).where(eq(quoteLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Quote line item not found');
      }
      const quote = await this.getQuote(existing[0].quoteId, userId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }
    }
    const result = await db.delete(quoteLineItems).where(eq(quoteLineItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Quote Versions
  async getQuoteVersions(quoteId: string): Promise<any[]> {
    return await db.select().from(quoteVersions).where(eq(quoteVersions.quoteId, quoteId)).orderBy(desc(quoteVersions.versionNumber));
  }

  async createQuoteVersion(data: { quoteId: string; versionNumber: number; editedBy?: string; changeNote?: string; snapshot: any }): Promise<any> {
    const result = await db.insert(quoteVersions).values(data).returning();
    return result[0];
  }

  // Invoices
  async getInvoices(userId: string, includeArchived?: boolean): Promise<Invoice[]> {
    if (includeArchived) {
      return await db.select().from(invoices).where(and(eq(invoices.userId, userId), isNotNull(invoices.archivedAt))).orderBy(desc(invoices.createdAt));
    }
    return await db.select().from(invoices).where(and(eq(invoices.userId, userId), isNull(invoices.archivedAt))).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const result = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createInvoice(invoice: InsertInvoice & { userId: string }): Promise<Invoice> {
    // Ensure number is provided
    const invoiceData = {
      ...invoice,
      number: invoice.number || await this.generateInvoiceNumber(invoice.userId)
    };
    const result = await db.insert(invoices).values(invoiceData).returning();
    const { invalidateAggregateDashboard } = await import('./cache');
    invalidateAggregateDashboard(invoice.userId);
    return result[0];
  }

  async updateInvoice(id: string, userId: string, invoice: Partial<InsertInvoice>, editSource: 'manual' | 'system' = 'system'): Promise<Invoice | undefined> {
    const existing = await this.getInvoice(id, userId);

    const result = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();

    if (existing && (existing.sentAt || existing.status !== 'draft')) {
      const fieldsToTrack = ['title', 'description', 'status', 'subtotal', 'gstAmount', 'total', 'dueDate', 'notes', 'paymentMethod', 'paymentReference'];
      for (const field of fieldsToTrack) {
        if (field in invoice) {
          const oldVal = String((existing as any)[field] ?? '');
          const newVal = String((invoice as any)[field] ?? '');
          if (oldVal !== newVal) {
            try {
              await db.insert(invoiceEdits).values({
                invoiceId: id,
                editedBy: userId,
                fieldChanged: field,
                oldValue: oldVal,
                newValue: newVal,
                editSource,
              });
            } catch (auditErr) {
              console.error('Failed to log invoice edit audit:', auditErr);
            }
          }
        }
      }
    }

    if (result[0]) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return result[0];
  }

  async deleteInvoice(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
    if ((result.rowCount ?? 0) > 0) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return (result.rowCount ?? 0) > 0;
  }

  async getInvoiceWithLineItems(id: string, userId: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined> {
    const invoice = await this.getInvoice(id, userId);
    if (!invoice) return undefined;
    
    const lineItems = await this.getInvoiceLineItems(id);
    return { ...invoice, lineItems };
  }

  async archiveInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();
    return result[0];
  }

  async unarchiveInvoice(id: string, userId: string): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();
    return result[0];
  }

  // Public invoice access by payment token
  async getInvoiceByPaymentToken(token: string): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined> {
    const result = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentToken, token))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    const lineItems = await this.getInvoiceLineItems(result[0].id);
    return { ...result[0], lineItems };
  }

  async updateInvoiceByToken(token: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const result = await db
      .update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoices.paymentToken, token))
      .returning();
    return result[0];
  }

  async getBusinessSettingsByUserId(userId: string): Promise<BusinessSettings | undefined> {
    // This is the same as getBusinessSettings but exposed for public routes
    return this.getBusinessSettings(userId);
  }

  async getBusinessSettingsByConnectAccountId(accountId: string): Promise<BusinessSettings | undefined> {
    const result = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.stripeConnectAccountId, accountId))
      .limit(1);
    return result[0];
  }

  // Invoice Line Items
  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.sortOrder);
  }

  async createInvoiceLineItem(lineItem: InsertInvoiceLineItem, userId?: string): Promise<InvoiceLineItem> {
    // Validate ownership if userId provided
    if (userId) {
      const invoice = await this.getInvoice(lineItem.invoiceId, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    }
    const result = await db.insert(invoiceLineItems).values(lineItem).returning();
    return result[0];
  }

  async updateInvoiceLineItem(id: string, lineItem: Partial<InsertInvoiceLineItem>, userId?: string): Promise<InvoiceLineItem | undefined> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Invoice line item not found');
      }
      const invoice = await this.getInvoice(existing[0].invoiceId, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    }
    const result = await db
      .update(invoiceLineItems)
      .set(lineItem)
      .where(eq(invoiceLineItems.id, id))
      .returning();
    return result[0];
  }

  async deleteInvoiceLineItem(id: string, userId?: string): Promise<boolean> {
    // Validate ownership if userId provided
    if (userId) {
      const existing = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error('Invoice line item not found');
      }
      const invoice = await this.getInvoice(existing[0].invoiceId, userId);
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }
    }
    const result = await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Payment Records (progress/partial payments)
  async getPaymentRecords(invoiceId: string): Promise<PaymentRecord[]> {
    return await db.select().from(paymentRecords).where(eq(paymentRecords.invoiceId, invoiceId)).orderBy(desc(paymentRecords.paidAt));
  }

  async createPaymentRecord(record: InsertPaymentRecord): Promise<PaymentRecord> {
    const [created] = await db.insert(paymentRecords).values(record).returning();
    return created;
  }

  async deletePaymentRecord(id: string): Promise<boolean> {
    const result = await db.delete(paymentRecords).where(eq(paymentRecords.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Payment Requests (phone-to-phone payments)
  async getPaymentRequests(userId: string): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequest(id: string, userId: string): Promise<PaymentRequest | undefined> {
    const result = await db
      .select()
      .from(paymentRequests)
      .where(and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getPaymentRequestByToken(token: string): Promise<PaymentRequest | undefined> {
    const result = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.token, token))
      .limit(1);
    return result[0];
  }

  async createPaymentRequest(request: InsertPaymentRequest & { userId: string; token: string }): Promise<PaymentRequest> {
    const result = await db.insert(paymentRequests).values(request).returning();
    return result[0];
  }

  async updatePaymentRequest(id: string, userId: string, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined> {
    const result = await db
      .update(paymentRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId)))
      .returning();
    return result[0];
  }

  async updatePaymentRequestByToken(token: string, updates: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined> {
    const result = await db
      .update(paymentRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentRequests.token, token))
      .returning();
    return result[0];
  }

  async deletePaymentRequest(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(paymentRequests).where(
      and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Terminal Payments (Tap to Pay)
  async getTerminalPayments(userId: string): Promise<TerminalPayment[]> {
    return await db.select().from(terminalPayments).where(eq(terminalPayments.userId, userId)).orderBy(desc(terminalPayments.createdAt));
  }

  async getTerminalPayment(id: string, userId: string): Promise<TerminalPayment | undefined> {
    const result = await db
      .select()
      .from(terminalPayments)
      .where(and(eq(terminalPayments.id, id), eq(terminalPayments.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getTerminalPaymentByIntent(paymentIntentId: string): Promise<TerminalPayment | undefined> {
    const result = await db
      .select()
      .from(terminalPayments)
      .where(eq(terminalPayments.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return result[0];
  }

  async createTerminalPayment(payment: InsertTerminalPayment & { userId: string }): Promise<TerminalPayment> {
    const result = await db.insert(terminalPayments).values(payment).returning();
    return result[0];
  }

  async updateTerminalPayment(id: string, userId: string, updates: Partial<InsertTerminalPayment>): Promise<TerminalPayment | undefined> {
    const result = await db
      .update(terminalPayments)
      .set(updates)
      .where(and(eq(terminalPayments.id, id), eq(terminalPayments.userId, userId)))
      .returning();
    return result[0];
  }

  async updateTerminalPaymentByIntent(paymentIntentId: string, updates: Partial<InsertTerminalPayment>): Promise<TerminalPayment | undefined> {
    const result = await db
      .update(terminalPayments)
      .set(updates)
      .where(eq(terminalPayments.stripePaymentIntentId, paymentIntentId))
      .returning();
    return result[0];
  }

  // Receipt Methods
  async getReceipts(userId: string): Promise<Receipt[]> {
    return await db.select().from(receipts).where(eq(receipts.userId, userId)).orderBy(desc(receipts.createdAt));
  }

  async getReceipt(id: string, userId: string): Promise<Receipt | undefined> {
    const result = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getReceiptsForJob(jobId: string, userId: string): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.jobId, jobId), eq(receipts.userId, userId)))
      .orderBy(desc(receipts.createdAt));
  }

  async getReceiptByNumber(receiptNumber: string, userId: string): Promise<Receipt | undefined> {
    const result = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.receiptNumber, receiptNumber), eq(receipts.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getReceiptByViewToken(token: string): Promise<Receipt | undefined> {
    const result = await db
      .select()
      .from(receipts)
      .where(eq(receipts.viewToken, token))
      .limit(1);
    return result[0];
  }

  async getReceiptById(id: string): Promise<Receipt | undefined> {
    const result = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, id))
      .limit(1);
    return result[0];
  }

  async getReceiptByInvoiceId(invoiceId: string, userId: string): Promise<Receipt | undefined> {
    const result = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.invoiceId, invoiceId), eq(receipts.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createReceipt(receipt: InsertReceipt & { userId: string }): Promise<Receipt> {
    const result = await db.insert(receipts).values(receipt).returning();
    return result[0];
  }

  async updateReceipt(id: string, userId: string, receipt: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const result = await db
      .update(receipts)
      .set(receipt)
      .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteReceipt(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(receipts).where(
      and(eq(receipts.id, id), eq(receipts.userId, userId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  async generateReceiptNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    
    const userReceipts = await db
      .select({ receiptNumber: receipts.receiptNumber })
      .from(receipts)
      .where(eq(receipts.userId, userId))
      .orderBy(desc(receipts.createdAt));
    
    let nextNumber = 1;
    if (userReceipts.length > 0) {
      for (const r of userReceipts) {
        const match = r.receiptNumber?.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }
    }
    
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `REC-${year}-${nextNumber.toString().padStart(4, '0')}-${randomSuffix}`;
  }

  // Utility methods
  async generateQuoteNumber(userId: string): Promise<string> {
    const settings = await this.getBusinessSettings(userId);
    const prefix = settings?.quotePrefix || 'QT-';

    // Simple sequential numbering mode: owner has set a "next quote number".
    if (settings?.quoteNextNumber && settings.quoteNextNumber > 0) {
      const { invalidateBusinessSettings } = await import('./cache');
      // Atomically reserve one counter value per attempt so concurrent creates
      // never receive the same number (single UPDATE ... RETURNING).
      for (let attempts = 0; attempts < 1000; attempts++) {
        const [row] = await db.update(businessSettings)
          .set({ quoteNextNumber: sql`${businessSettings.quoteNextNumber} + 1`, updatedAt: new Date() })
          .where(and(eq(businessSettings.id, settings.id), isNotNull(businessSettings.quoteNextNumber)))
          .returning({ next: businessSettings.quoteNextNumber });
        if (!row?.next) break; // numbering was turned off concurrently
        invalidateBusinessSettings(settings.userId);
        const reserved = row.next - 1;
        const candidate = `${prefix}${reserved.toString().padStart(4, '0')}`;
        const clash = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.number, candidate)).limit(1);
        if (clash.length === 0) return candidate;
        // collision with a pre-existing number: counter already advanced, try next
      }
      // fall through to classic format if we somehow can't find a free number
    }

    const year = new Date().getFullYear();
    
    // Get the highest quote number for this user this year
    const userQuotes = await db
      .select({ number: quotes.number })
      .from(quotes)
      .where(and(
        eq(quotes.userId, userId),
        sql`EXTRACT(YEAR FROM created_at) = ${year}`
      ))
      .orderBy(desc(quotes.createdAt));
    
    // Find the next sequential number for this user
    let nextNumber = 1;
    if (userQuotes.length > 0) {
      // Extract the highest number from existing quotes
      for (const q of userQuotes) {
        const match = q.number?.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }
    }
    
    // Add a random suffix to ensure global uniqueness across all users
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    return `${prefix}${year}-${nextNumber.toString().padStart(3, '0')}-${randomSuffix}`;
  }

  async generateInvoiceNumber(userId: string): Promise<string> {
    const settings = await this.getBusinessSettings(userId);
    const prefix = settings?.invoicePrefix || 'TT-';

    // Simple sequential numbering mode: owner has set a "next invoice number".
    if (settings?.invoiceNextNumber && settings.invoiceNextNumber > 0) {
      const { invalidateBusinessSettings } = await import('./cache');
      // Atomically reserve one counter value per attempt so concurrent creates
      // never receive the same number (single UPDATE ... RETURNING).
      for (let attempts = 0; attempts < 1000; attempts++) {
        const [row] = await db.update(businessSettings)
          .set({ invoiceNextNumber: sql`${businessSettings.invoiceNextNumber} + 1`, updatedAt: new Date() })
          .where(and(eq(businessSettings.id, settings.id), isNotNull(businessSettings.invoiceNextNumber)))
          .returning({ next: businessSettings.invoiceNextNumber });
        if (!row?.next) break; // numbering was turned off concurrently
        invalidateBusinessSettings(settings.userId);
        const reserved = row.next - 1;
        const candidate = `${prefix}${reserved.toString().padStart(4, '0')}`;
        const clash = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.number, candidate)).limit(1);
        if (clash.length === 0) return candidate;
        // collision with a pre-existing number: counter already advanced, try next
      }
      // fall through to classic format if we somehow can't find a free number
    }

    const year = new Date().getFullYear();
    
    // Get the highest invoice number for this user this year
    const userInvoices = await db
      .select({ number: invoices.number })
      .from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        sql`EXTRACT(YEAR FROM created_at) = ${year}`
      ))
      .orderBy(desc(invoices.createdAt));
    
    // Find the next sequential number for this user
    let nextNumber = 1;
    if (userInvoices.length > 0) {
      // Extract the highest number from existing invoices
      for (const inv of userInvoices) {
        const match = inv.number?.match(/-(\d+)(?:-[A-Z0-9]+)?$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }
    }
    
    // Add a random suffix to ensure global uniqueness across all users
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    return `${prefix}${year}-${nextNumber.toString().padStart(3, '0')}-${randomSuffix}`;
  }

  // Document Templates implementation
  async getDocumentTemplates(userId: string, type?: string, tradeType?: string): Promise<DocumentTemplate[]> {
    // Get owner ID if user is a team member (so they can access owner's templates)
    const teamMembership = await this.getTeamMembershipByMemberId(userId);
    const ownerId = teamMembership?.businessOwnerId;
    
    // Include user's own templates, shared templates, and owner's templates (for team members)
    const userConditions = [
      eq(documentTemplates.userId, userId),
      eq(documentTemplates.userId, 'shared')
    ];
    
    // If user is a team member, also include the business owner's templates
    if (ownerId && ownerId !== userId) {
      userConditions.push(eq(documentTemplates.userId, ownerId));
    }
    
    const baseCondition = or(...userConditions);
    
    // Trade type filtering with fallback to 'general' templates
    // If a specific trade is requested, return matching trade + general fallback
    // User-created templates (isDefault = false) are always included regardless of trade type
    if (type && tradeType) {
      // Include specific trade type, 'general' fallback, AND user-created templates (isDefault = false)
      const tradeCondition = or(
        eq(documentTemplates.tradeType, tradeType),
        eq(documentTemplates.tradeType, 'general'),
        eq(documentTemplates.isDefault, false) // User-created templates
      );
      const conditions = and(baseCondition, eq(documentTemplates.type, type), tradeCondition);
      return await db.select().from(documentTemplates).where(conditions).orderBy(desc(documentTemplates.createdAt));
    } else if (type) {
      const conditions = and(baseCondition, eq(documentTemplates.type, type));
      return await db.select().from(documentTemplates).where(conditions).orderBy(desc(documentTemplates.createdAt));
    } else if (tradeType) {
      // Include specific trade type, 'general' fallback, AND user-created templates
      const tradeCondition = or(
        eq(documentTemplates.tradeType, tradeType),
        eq(documentTemplates.tradeType, 'general'),
        eq(documentTemplates.isDefault, false) // User-created templates
      );
      const conditions = and(baseCondition, tradeCondition);
      return await db.select().from(documentTemplates).where(conditions).orderBy(desc(documentTemplates.createdAt));
    }
    
    return await db.select().from(documentTemplates).where(baseCondition).orderBy(desc(documentTemplates.createdAt));
  }

  async getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
    const result = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id)).limit(1);
    return result[0] || null;
  }

  async createDocumentTemplate(data: InsertDocumentTemplate & { userId: string }): Promise<DocumentTemplate> {
    const result = await db.insert(documentTemplates).values(data).returning();
    return result[0];
  }

  async updateDocumentTemplate(id: string, data: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate> {
    const result = await db
      .update(documentTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }

  async seedDefaultDocumentTemplates(userId: string): Promise<DocumentTemplate[]> {
    const existing = await this.getDocumentTemplates(userId);
    if (existing.some(t => t.isDefault)) {
      return existing.filter(t => t.isDefault);
    }

    // Get user's trade type from their profile
    const user = await this.getUser(userId);
    const userTradeType = user?.tradeType?.toLowerCase() || 'general';

    // Filter templates: keep general ones + trade-specific for user's trade
    const filteredTemplates = tradieQuoteTemplates.filter(template => {
      const templateTradeType = template.tradeType?.toLowerCase() || 'general';
      // Keep general templates (always)
      if (templateTradeType === 'general') return true;
      // Keep trade-specific templates only if they match the user's trade
      return templateTradeType === userTradeType;
    });

    const createdTemplates: DocumentTemplate[] = [];
    for (const template of filteredTemplates) {
      const created = await this.createDocumentTemplate({
        userId,
        type: template.type,
        familyKey: template.familyKey,
        name: template.name,
        tradeType: template.tradeType,
        styling: template.styling,
        sections: template.sections,
        defaults: template.defaults,
        defaultLineItems: template.defaultLineItems,
        isDefault: true,
      });
      createdTemplates.push(created);
    }

    return createdTemplates;
  }

  // Line Item Catalog implementation
  async getLineItemCatalog(userId: string, tradeType?: string): Promise<LineItemCatalog[]> {
    const { lineItemCatalogCache } = await import('./cache');
    const cacheKey = `${userId}:${tradeType || '_all'}`;
    return await lineItemCatalogCache.getOrLoad(cacheKey, async () => {
      // Look for both user-specific catalog items AND shared items (userId = 'shared')
      const baseCondition = or(eq(lineItemCatalog.userId, userId), eq(lineItemCatalog.userId, 'shared'));
      const condition = tradeType
        ? and(baseCondition, eq(lineItemCatalog.tradeType, tradeType))
        : baseCondition;
      return await db.select().from(lineItemCatalog).where(condition).orderBy(desc(lineItemCatalog.createdAt));
    });
  }

  async getLineItemCatalogItem(id: string): Promise<LineItemCatalog | null> {
    const result = await db.select().from(lineItemCatalog).where(eq(lineItemCatalog.id, id)).limit(1);
    return result[0] || null;
  }

  async createLineItemCatalogItem(data: InsertLineItemCatalog & { userId: string }): Promise<LineItemCatalog> {
    const result = await db.insert(lineItemCatalog).values(data).returning();
    const { invalidateCatalog } = await import('./cache');
    invalidateCatalog(data.userId);
    return result[0];
  }

  async updateLineItemCatalogItem(id: string, data: Partial<InsertLineItemCatalog>): Promise<LineItemCatalog> {
    const result = await db
      .update(lineItemCatalog)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lineItemCatalog.id, id))
      .returning();
    if (result[0]?.userId) {
      const { invalidateCatalog } = await import('./cache');
      invalidateCatalog(result[0].userId);
    }
    return result[0];
  }

  async deleteLineItemCatalogItem(id: string): Promise<void> {
    const existing = await db.select({ userId: lineItemCatalog.userId }).from(lineItemCatalog).where(eq(lineItemCatalog.id, id)).limit(1);
    await db.delete(lineItemCatalog).where(eq(lineItemCatalog.id, id));
    if (existing[0]?.userId) {
      const { invalidateCatalog } = await import('./cache');
      invalidateCatalog(existing[0].userId);
    }
  }

  // Rate Cards implementation
  async getRateCards(userId: string, tradeType?: string): Promise<RateCard[]> {
    const { rateCardCache } = await import('./cache');
    const cacheKey = `${userId}:${tradeType || '_all'}`;
    return await rateCardCache.getOrLoad(cacheKey, async () => {
      // Look for both user-specific rate cards AND shared cards (userId = 'shared')
      const baseCondition = or(eq(rateCards.userId, userId), eq(rateCards.userId, 'shared'));
      const condition = tradeType
        ? and(baseCondition, eq(rateCards.tradeType, tradeType))
        : baseCondition;
      return await db.select().from(rateCards).where(condition).orderBy(desc(rateCards.createdAt));
    });
  }

  async getRateCard(id: string): Promise<RateCard | null> {
    const result = await db.select().from(rateCards).where(eq(rateCards.id, id)).limit(1);
    return result[0] || null;
  }

  async createRateCard(data: InsertRateCard & { userId: string }): Promise<RateCard> {
    const result = await db.insert(rateCards).values(data).returning();
    const { invalidateRateCards } = await import('./cache');
    invalidateRateCards(data.userId);
    return result[0];
  }

  async updateRateCard(id: string, data: Partial<InsertRateCard>): Promise<RateCard> {
    const result = await db
      .update(rateCards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rateCards.id, id))
      .returning();
    if (result[0]?.userId) {
      const { invalidateRateCards } = await import('./cache');
      invalidateRateCards(result[0].userId);
    }
    return result[0];
  }

  async deleteRateCard(id: string): Promise<void> {
    const existing = await db.select({ userId: rateCards.userId }).from(rateCards).where(eq(rateCards.id, id)).limit(1);
    await db.delete(rateCards).where(eq(rateCards.id, id));
    if (existing[0]?.userId) {
      const { invalidateRateCards } = await import('./cache');
      invalidateRateCards(existing[0].userId);
    }
  }

  // Quote Templates implementation
  async getQuoteTemplates(userId: string, tradeType?: string): Promise<QuoteTemplate[]> {
    const baseCondition = or(eq(quoteTemplates.userId, userId), eq(quoteTemplates.userId, 'shared'));
    const condition = tradeType
      ? and(baseCondition, eq(quoteTemplates.tradeType, tradeType))
      : baseCondition;
    return await db.select().from(quoteTemplates).where(condition).orderBy(desc(quoteTemplates.createdAt));
  }

  async getQuoteTemplate(id: string): Promise<QuoteTemplate | null> {
    const result = await db.select().from(quoteTemplates).where(eq(quoteTemplates.id, id)).limit(1);
    return result[0] || null;
  }

  async createQuoteTemplate(data: InsertQuoteTemplate & { userId: string }): Promise<QuoteTemplate> {
    const result = await db.insert(quoteTemplates).values(data).returning();
    return result[0];
  }

  async updateQuoteTemplate(id: string, data: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate> {
    const result = await db
      .update(quoteTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quoteTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteQuoteTemplate(id: string): Promise<void> {
    await db.delete(quoteTemplates).where(eq(quoteTemplates.id, id));
  }

  // Style Presets implementation
  async getStylePresets(userId: string): Promise<StylePreset[]> {
    return await db.select().from(stylePresets)
      .where(eq(stylePresets.userId, userId))
      .orderBy(desc(stylePresets.createdAt));
  }

  async getStylePreset(id: string): Promise<StylePreset | null> {
    const result = await db.select().from(stylePresets).where(eq(stylePresets.id, id)).limit(1);
    return result[0] || null;
  }

  async getDefaultStylePreset(userId: string): Promise<StylePreset | null> {
    const result = await db.select().from(stylePresets)
      .where(and(eq(stylePresets.userId, userId), eq(stylePresets.isDefault, true)))
      .limit(1);
    return result[0] || null;
  }

  async createStylePreset(data: InsertStylePreset & { userId: string }): Promise<StylePreset> {
    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await db.update(stylePresets)
        .set({ isDefault: false })
        .where(eq(stylePresets.userId, data.userId));
    }
    const result = await db.insert(stylePresets).values(data).returning();
    return result[0];
  }

  async updateStylePreset(id: string, userId: string, data: Partial<InsertStylePreset>): Promise<StylePreset> {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await db.update(stylePresets)
        .set({ isDefault: false })
        .where(eq(stylePresets.userId, userId));
    }
    const result = await db
      .update(stylePresets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stylePresets.id, id))
      .returning();
    return result[0];
  }

  async deleteStylePreset(id: string): Promise<void> {
    await db.delete(stylePresets).where(eq(stylePresets.id, id));
  }

  async seedDefaultStylePreset(userId: string): Promise<StylePreset> {
    // Check if user already has a style preset
    const existing = await this.getStylePresets(userId);
    if (existing.length > 0) {
      return existing[0];
    }
    // Create default style preset
    return await this.createStylePreset({
      userId,
      name: 'Professional',
      isDefault: true,
      primaryColor: '#1e40af',
      accentColor: '#059669',
      fontFamily: 'Inter',
      headerFontSize: '24px',
      bodyFontSize: '14px',
      headerLayout: 'professional', // Maps to document template ID
      footerLayout: 'standard',
      showLogo: true,
      showBusinessDetails: true,
      showBankDetails: true,
      tableBorders: true,
      alternateRowColors: true,
      compactMode: false,
    });
  }

  // Template Analysis Jobs
  async createTemplateAnalysisJob(data: InsertTemplateAnalysisJob): Promise<TemplateAnalysisJob> {
    const result = await db.insert(templateAnalysisJobs).values(data).returning();
    return result[0];
  }

  async getTemplateAnalysisJob(id: string, userId: string): Promise<TemplateAnalysisJob | undefined> {
    const result = await db.select().from(templateAnalysisJobs)
      .where(and(eq(templateAnalysisJobs.id, id), eq(templateAnalysisJobs.userId, userId)))
      .limit(1);
    return result[0];
  }

  async updateTemplateAnalysisJob(id: string, updates: Partial<TemplateAnalysisJob>): Promise<TemplateAnalysisJob | undefined> {
    const result = await db.update(templateAnalysisJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(templateAnalysisJobs.id, id))
      .returning();
    return result[0];
  }

  // ===== ADVANCED FEATURES IMPLEMENTATIONS =====

  // Time Tracking
  async getTimeEntries(userId: string, jobId?: string): Promise<TimeEntry[]> {
    if (jobId) {
      return await db.select().from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), eq(timeEntries.jobId, jobId)))
        .orderBy(desc(timeEntries.startTime));
    }
    return await db.select().from(timeEntries)
      .where(eq(timeEntries.userId, userId))
      .orderBy(desc(timeEntries.startTime));
  }

  async getTimeEntriesForJob(jobId: string): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(and(eq(timeEntries.jobId, jobId), isNotNull(timeEntries.endTime)))
      .orderBy(timeEntries.startTime);
  }

  async getTimeEntriesInRange(userId: string, start: Date, end: Date): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.startTime, start),
        lte(timeEntries.startTime, end)
      ))
      .orderBy(desc(timeEntries.startTime));
  }

  async getTeamTimeEntriesInRange(businessOwnerId: string, start: Date, end: Date): Promise<TimeEntry[]> {
    const members = await this.getTeamMembers(businessOwnerId);
    const userIds = [businessOwnerId, ...members.map(m => m.memberId).filter(Boolean)] as string[];
    return await db.select().from(timeEntries)
      .where(and(
        inArray(timeEntries.userId, userIds),
        gte(timeEntries.startTime, start),
        lte(timeEntries.startTime, end)
      ))
      .orderBy(desc(timeEntries.startTime));
  }

  async getTimeEntry(id: string, userId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .limit(1);
    return result[0];
  }

  // Fetch a time entry by id WITHOUT user-scoping. Only callers that have
  // already verified the requester can manage the entry's owner (e.g. an
  // owner/manager editing a team member's entry) may use this.
  async getTimeEntryAny(id: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);
    return result[0];
  }

  async createTimeEntry(entry: InsertTimeEntry & { userId: string }): Promise<TimeEntry> {
    const result = await db.insert(timeEntries).values(entry as any).returning();
    const { invalidateAggregateDashboard } = await import('./cache');
    invalidateAggregateDashboard(entry.userId);
    return result[0];
  }

  async updateTimeEntry(id: string, userId: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const result = await db.update(timeEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .returning();
    if (result[0]) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return result[0];
  }

  async deleteTimeEntry(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
    if ((result.rowCount ?? 0) > 0) {
      const { invalidateAggregateDashboard } = await import('./cache');
      invalidateAggregateDashboard(userId);
    }
    return (result.rowCount ?? 0) > 0;
  }

  async stopTimeEntry(id: string, userId: string, locationData?: { clockOutLatitude?: string; clockOutLongitude?: string; clockOutAddress?: string }): Promise<TimeEntry | undefined> {
    const now = new Date();
    const entry = await this.getTimeEntry(id, userId);
    if (!entry || entry.endTime) return undefined;
    
    const startTime = new Date(entry.startTime);
    const duration = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60)); // duration in minutes
    
    return await this.updateTimeEntry(id, userId, {
      endTime: now,
      duration: duration,
      ...(locationData?.clockOutLatitude ? { clockOutLatitude: locationData.clockOutLatitude } : {}),
      ...(locationData?.clockOutLongitude ? { clockOutLongitude: locationData.clockOutLongitude } : {}),
      ...(locationData?.clockOutAddress ? { clockOutAddress: locationData.clockOutAddress } : {}),
    });
  }

  async getActiveTimeEntry(userId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.userId, userId),
        sql`${timeEntries.endTime} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getActiveTimeEntryForJob(jobId: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.jobId, jobId),
        sql`${timeEntries.endTime} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getActiveTimeEntriesForJob(jobId: string): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(and(
        eq(timeEntries.jobId, jobId),
        sql`${timeEntries.endTime} IS NULL`
      ))
      .orderBy(timeEntries.startTime);
  }

  async createTimeEntryEdit(edit: InsertTimeEntryEdit): Promise<TimeEntryEdit> {
    const [result] = await db.insert(timeEntryEdits).values(edit).returning();
    return result;
  }

  async createInvoiceEdit(edit: InsertInvoiceEdit): Promise<InvoiceEdit> {
    const [result] = await db.insert(invoiceEdits).values(edit).returning();
    return result;
  }

  async getInvoiceEdits(invoiceId: string): Promise<InvoiceEdit[]> {
    return await db.select().from(invoiceEdits).where(eq(invoiceEdits.invoiceId, invoiceId)).orderBy(desc(invoiceEdits.editedAt));
  }

  async getTimeEntryEdits(timeEntryId: string): Promise<TimeEntryEdit[]> {
    return await db.select().from(timeEntryEdits)
      .where(eq(timeEntryEdits.timeEntryId, timeEntryId))
      .orderBy(desc(timeEntryEdits.editedAt));
  }

  async getTimeEntryEditLog(userId: string, limit: number = 50, offset: number = 0): Promise<TimeEntryEdit[]> {
    const userEntries = await db.select({ id: timeEntries.id }).from(timeEntries)
      .where(eq(timeEntries.userId, userId));
    const entryIds = userEntries.map(e => e.id);
    
    if (entryIds.length === 0) return [];
    
    return await db.select().from(timeEntryEdits)
      .where(inArray(timeEntryEdits.timeEntryId, entryIds))
      .orderBy(desc(timeEntryEdits.editedAt))
      .limit(limit)
      .offset(offset);
  }

  async getAllActiveTimeEntries(): Promise<TimeEntry[]> {
    const result = await db.select().from(timeEntries)
      .where(sql`${timeEntries.endTime} IS NULL`)
      .orderBy(desc(timeEntries.startTime));
    return result;
  }

  // Timesheets
  async getTimesheets(userId: string): Promise<Timesheet[]> {
    return await db.select().from(timesheets)
      .where(eq(timesheets.userId, userId))
      .orderBy(desc(timesheets.weekStarting));
  }

  async getTimesheet(id: string, userId: string): Promise<Timesheet | undefined> {
    const result = await db.select().from(timesheets)
      .where(and(eq(timesheets.id, id), eq(timesheets.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createTimesheet(timesheet: InsertTimesheet & { userId: string }): Promise<Timesheet> {
    const result = await db.insert(timesheets).values(timesheet).returning();
    return result[0];
  }

  async updateTimesheet(id: string, userId: string, timesheet: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    const result = await db.update(timesheets)
      .set({ ...timesheet, updatedAt: new Date() })
      .where(and(eq(timesheets.id, id), eq(timesheets.userId, userId)))
      .returning();
    return result[0];
  }

  // Expense Tracking
  async getExpenseCategories(userId: string): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories)
      .where(eq(expenseCategories.userId, userId))
      .orderBy(expenseCategories.name);
  }

  async createExpenseCategory(category: InsertExpenseCategory & { userId: string }): Promise<ExpenseCategory> {
    const result = await db.insert(expenseCategories).values(category).returning();
    return result[0];
  }

  async updateExpenseCategory(id: string, userId: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const result = await db.update(expenseCategories)
      .set(category)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteExpenseCategory(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(expenseCategories)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getExpenses(userId: string, filters?: { jobId?: string; categoryId?: string; startDate?: string; endDate?: string; }): Promise<any[]> {
    let query = db.select({
      id: expenses.id,
      userId: expenses.userId,
      jobId: expenses.jobId,
      categoryId: expenses.categoryId,
      amount: expenses.amount,
      gstAmount: expenses.gstAmount,
      description: expenses.description,
      vendor: expenses.vendor,
      receiptUrl: expenses.receiptUrl,
      receiptNumber: expenses.receiptNumber,
      expenseDate: expenses.expenseDate,
      isBillable: expenses.isBillable,
      isRecurring: expenses.isRecurring,
      recurringFrequency: expenses.recurringFrequency,
      status: expenses.status,
      approvedBy: expenses.approvedBy,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
      categoryName: expenseCategories.name,
      jobTitle: jobs.title
    }).from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(jobs, eq(expenses.jobId, jobs.id));

    const conditions = [eq(expenses.userId, userId)];

    if (filters?.jobId) {
      conditions.push(eq(expenses.jobId, filters.jobId));
    }

    if (filters?.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }

    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        and(
          sql`${expenses.expenseDate} >= ${filters.startDate}`,
          sql`${expenses.expenseDate} <= ${filters.endDate}`
        ) as any
      );
    }

    return await query
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpense(id: string, userId: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createExpense(expense: InsertExpense & { userId: string }): Promise<Expense> {
    const result = await db.insert(expenses).values(expense).returning();
    return result[0];
  }

  async updateExpense(id: string, userId: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const result = await db.update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteExpense(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Client Asset Register (customer-owned assets / vessels / equipment)
  async getClientAssets(userId: string, clientId?: string): Promise<ClientAsset[]> {
    const where = clientId
      ? and(eq(clientAssets.userId, userId), eq(clientAssets.clientId, clientId))
      : eq(clientAssets.userId, userId);
    return await db.select().from(clientAssets).where(where).orderBy(desc(clientAssets.createdAt));
  }

  async getClientAsset(id: string, userId: string): Promise<ClientAsset | undefined> {
    const result = await db.select().from(clientAssets)
      .where(and(eq(clientAssets.id, id), eq(clientAssets.userId, userId)));
    return result[0];
  }

  async createClientAsset(asset: InsertClientAsset & { userId: string }): Promise<ClientAsset> {
    const result = await db.insert(clientAssets).values(asset).returning();
    return result[0];
  }

  async updateClientAsset(id: string, userId: string, asset: Partial<InsertClientAsset>): Promise<ClientAsset | undefined> {
    const result = await db.update(clientAssets)
      .set({ ...asset, updatedAt: new Date() })
      .where(and(eq(clientAssets.id, id), eq(clientAssets.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteClientAsset(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(clientAssets)
      .where(and(eq(clientAssets.id, id), eq(clientAssets.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getClientAssetServices(assetId: string, userId: string): Promise<ClientAssetService[]> {
    return await db.select().from(clientAssetServices)
      .where(and(eq(clientAssetServices.assetId, assetId), eq(clientAssetServices.userId, userId)))
      .orderBy(desc(clientAssetServices.serviceDate));
  }

  async createClientAssetService(service: InsertClientAssetService & { userId: string }): Promise<ClientAssetService> {
    const result = await db.insert(clientAssetServices).values(service).returning();
    return result[0];
  }

  // Inventory Management
  async getInventoryCategories(userId: string): Promise<InventoryCategory[]> {
    return await db.select().from(inventoryCategories)
      .where(eq(inventoryCategories.userId, userId))
      .orderBy(inventoryCategories.name);
  }

  async createInventoryCategory(category: InsertInventoryCategory & { userId: string }): Promise<InventoryCategory> {
    const result = await db.insert(inventoryCategories).values(category).returning();
    return result[0];
  }

  async updateInventoryCategory(id: string, userId: string, category: Partial<InsertInventoryCategory>): Promise<InventoryCategory | undefined> {
    const result = await db.update(inventoryCategories)
      .set(category)
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteInventoryCategory(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(inventoryCategories)
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getInventoryItems(userId: string, categoryId?: string): Promise<InventoryItem[]> {
    if (categoryId) {
      return await db.select().from(inventoryItems)
        .where(and(eq(inventoryItems.userId, userId), eq(inventoryItems.categoryId, categoryId)))
        .orderBy(inventoryItems.name);
    }
    return await db.select().from(inventoryItems)
      .where(eq(inventoryItems.userId, userId))
      .orderBy(inventoryItems.name);
  }

  async getInventoryItem(id: string, userId: string): Promise<InventoryItem | undefined> {
    const result = await db.select().from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createInventoryItem(item: InsertInventoryItem & { userId: string }): Promise<InventoryItem> {
    const result = await db.insert(inventoryItems).values(item).returning();
    return result[0];
  }

  async updateInventoryItem(id: string, userId: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const result = await db.update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteInventoryItem(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getInventoryTransactions(userId: string, itemId?: string): Promise<InventoryTransaction[]> {
    if (itemId) {
      return await db.select().from(inventoryTransactions)
        .where(and(eq(inventoryTransactions.userId, userId), eq(inventoryTransactions.itemId, itemId)))
        .orderBy(desc(inventoryTransactions.transactionDate));
    }
    return await db.select().from(inventoryTransactions)
      .where(eq(inventoryTransactions.userId, userId))
      .orderBy(desc(inventoryTransactions.transactionDate));
  }

  async createInventoryTransaction(transaction: InsertInventoryTransaction & { userId: string }): Promise<InventoryTransaction> {
    const result = await db.insert(inventoryTransactions).values(transaction).returning();
    return result[0];
  }

  async getSuppliers(userId: string): Promise<Supplier[]> {
    return await db.select().from(suppliers)
      .where(eq(suppliers.userId, userId))
      .orderBy(suppliers.name);
  }

  async getSupplier(id: string, userId: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createSupplier(supplier: InsertSupplier & { userId: string }): Promise<Supplier> {
    const result = await db.insert(suppliers).values(supplier).returning();
    return result[0];
  }

  async updateSupplier(id: string, userId: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const result = await db.update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(and(eq(suppliers.id, id), eq(suppliers.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteSupplier(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getPurchaseOrders(userId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.userId, userId))
      .orderBy(desc(purchaseOrders.orderDate));
  }

  async getPurchaseOrder(id: string, userId: string): Promise<PurchaseOrder | undefined> {
    const result = await db.select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createPurchaseOrder(po: InsertPurchaseOrder & { userId: string }): Promise<PurchaseOrder> {
    const result = await db.insert(purchaseOrders).values(po).returning();
    return result[0];
  }

  async updatePurchaseOrder(id: string, userId: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const result = await db.update(purchaseOrders)
      .set({ ...po, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.userId, userId)))
      .returning();
    return result[0];
  }

  async deletePurchaseOrder(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getPurchaseOrderItems(poId: string): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, poId))
      .orderBy(purchaseOrderItems.id);
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const result = await db.insert(purchaseOrderItems).values(item).returning();
    return result[0];
  }

  // Team Management
  async getUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles)
      .where(eq(userRoles.isActive, true))
      .orderBy(userRoles.name);
  }

  async createUserRole(role: InsertUserRole): Promise<UserRole> {
    const result = await db.insert(userRoles).values(role).returning();
    return result[0];
  }

  async updateUserRole(id: string, role: Partial<InsertUserRole>): Promise<UserRole | undefined> {
    const result = await db.update(userRoles)
      .set(role)
      .where(eq(userRoles.id, id))
      .returning();
    return result[0];
  }

  async deleteUserRole(id: string): Promise<boolean> {
    const result = await db.delete(userRoles).where(eq(userRoles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getTeamMembers(businessOwnerId: string): Promise<TeamMember[]> {
    // Include both active members AND pending invitations (which have isActive=false until accepted)
    // Using inArray for cleaner syntax and guaranteed multi-value support
    // Hot-read cache (30s TTL). Invalidated on roster mutations below.
    const { teamRosterCache } = await import('./cache');
    return await teamRosterCache.getOrLoad(businessOwnerId, async () => {
      return await db.select().from(teamMembers)
        .where(and(
          eq(teamMembers.businessOwnerId, businessOwnerId),
          or(
            eq(teamMembers.isActive, true),
            inArray(teamMembers.inviteStatus, ['pending', 'invited'])
          )
        ))
        .orderBy(teamMembers.createdAt);
    });
  }

  async getTeamMember(id: string, businessOwnerId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.businessOwnerId, businessOwnerId)))
      .limit(1);
    return result[0];
  }

  async getTeamMembershipByMemberId(memberId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.memberId, memberId), eq(teamMembers.isActive, true)))
      .limit(1);
    return result[0];
  }

  async getAllTeamMembershipsByMemberId(memberId: string): Promise<TeamMember[]> {
    return await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.memberId, memberId),
        eq(teamMembers.isActive, true),
        eq(teamMembers.inviteStatus, 'accepted')
      ))
      .orderBy(teamMembers.createdAt);
  }

  async getTeamMemberByUserIdAndBusiness(userId: string, businessOwnerId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.memberId, userId), 
        eq(teamMembers.businessOwnerId, businessOwnerId),
        eq(teamMembers.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async getPendingTeamMembersByEmail(email: string): Promise<TeamMember[]> {
    return await db.select().from(teamMembers)
      .where(and(
        sql`lower(${teamMembers.email}) = ${email.toLowerCase().trim()}`,
        inArray(teamMembers.inviteStatus, ['pending', 'invited'])
      ))
      .orderBy(teamMembers.createdAt);
  }

  async getTeamMemberByInviteToken(token: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.inviteToken, token),
        eq(teamMembers.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async getUserRole(id: string): Promise<UserRole | undefined> {
    const result = await db.select().from(userRoles)
      .where(eq(userRoles.id, id))
      .limit(1);
    return result[0];
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    // drizzle-zod array columns (workDays) infer a structural array type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const result = await db.insert(teamMembers).values(member as typeof teamMembers.$inferInsert).returning();
    const { invalidateTeamRoster } = await import('./cache');
    if (member.businessOwnerId) invalidateTeamRoster(member.businessOwnerId);
    return result[0];
  }

  async updateTeamMember(id: string, businessOwnerId: string, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const { invalidateTeamRoster } = await import('./cache');
    invalidateTeamRoster(businessOwnerId);
    const result = await db.update(teamMembers)
      // drizzle-zod array columns (workDays) infer a structural array type that isn't assignable to the drizzle-core column type; cast to the native insert type.
      .set({ ...member, updatedAt: new Date() } as Partial<typeof teamMembers.$inferInsert>)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.businessOwnerId, businessOwnerId)))
      .returning();
    return result[0];
  }
  
  async updateTeamMemberPermissions(id: string, permissions: { customPermissions: string[], useCustomPermissions: boolean }): Promise<TeamMember | undefined> {
    const result = await db.update(teamMembers)
      .set({ 
        customPermissions: permissions.customPermissions,
        useCustomPermissions: permissions.useCustomPermissions,
        updatedAt: new Date() 
      })
      .where(eq(teamMembers.id, id))
      .returning();
    if (result[0]?.businessOwnerId) {
      const { invalidateTeamRoster } = await import('./cache');
      invalidateTeamRoster(result[0].businessOwnerId);
    }
    return result[0];
  }

  async updateTeamMemberLocationSettings(id: string, settings: { locationEnabledByOwner: boolean }): Promise<TeamMember | undefined> {
    const result = await db.update(teamMembers)
      .set({ 
        locationEnabledByOwner: settings.locationEnabledByOwner,
        updatedAt: new Date() 
      })
      .where(eq(teamMembers.id, id))
      .returning();
    if (result[0]?.businessOwnerId) {
      const { invalidateTeamRoster } = await import('./cache');
      invalidateTeamRoster(result[0].businessOwnerId);
    }
    return result[0];
  }

  async deleteTeamMember(id: string, businessOwnerId: string): Promise<boolean> {
    const { invalidateTeamRoster } = await import('./cache');
    invalidateTeamRoster(businessOwnerId);
    const result = await db.delete(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.businessOwnerId, businessOwnerId)));
    return (result.rowCount ?? 0) > 0;
  }

  async suspendTeamMembersByOwner(ownerId: string): Promise<number> {
    const { invalidateTeamRoster } = await import('./cache');
    invalidateTeamRoster(ownerId);
    const result = await db.update(teamMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teamMembers.businessOwnerId, ownerId))
      .returning();
    return result.length;
  }

  async reactivateTeamMembersByOwner(ownerId: string): Promise<number> {
    const result = await db.update(teamMembers)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(teamMembers.businessOwnerId, ownerId))
      .returning();
    return result.length;
  }

  // Team Groups Methods
  async getTeamGroups(userId: string): Promise<TeamGroup[]> {
    return await db.select().from(teamGroups)
      .where(eq(teamGroups.userId, userId))
      .orderBy(desc(teamGroups.createdAt));
  }

  async getTeamGroupById(id: string, userId: string): Promise<TeamGroup | undefined> {
    const result = await db.select().from(teamGroups)
      .where(and(eq(teamGroups.id, id), eq(teamGroups.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createTeamGroup(group: InsertTeamGroup): Promise<TeamGroup> {
    const result = await db.insert(teamGroups).values(group).returning();
    return result[0];
  }

  async updateTeamGroup(id: string, userId: string, data: Partial<InsertTeamGroup>): Promise<TeamGroup | undefined> {
    const result = await db.update(teamGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(teamGroups.id, id), eq(teamGroups.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteTeamGroup(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(teamGroups)
      .where(and(eq(teamGroups.id, id), eq(teamGroups.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async addMemberToGroup(groupId: string, teamMemberId: string, role: string = 'member'): Promise<TeamGroupMember> {
    const result = await db.insert(teamGroupMembers)
      .values({ groupId, teamMemberId, role })
      .returning();
    return result[0];
  }

  async removeMemberFromGroup(groupId: string, teamMemberId: string): Promise<boolean> {
    const result = await db.delete(teamGroupMembers)
      .where(and(
        eq(teamGroupMembers.groupId, groupId),
        eq(teamGroupMembers.teamMemberId, teamMemberId)
      ))
      .returning();
    return result.length > 0;
  }

  async getGroupMembers(groupId: string): Promise<TeamGroupMember[]> {
    return await db.select().from(teamGroupMembers)
      .where(eq(teamGroupMembers.groupId, groupId))
      .orderBy(teamGroupMembers.joinedAt);
  }

  // Permission Request Methods
  async getPermissionRequests(businessOwnerId: string): Promise<PermissionRequest[]> {
    return await db.select().from(permissionRequests)
      .where(eq(permissionRequests.businessOwnerId, businessOwnerId))
      .orderBy(desc(permissionRequests.createdAt));
  }

  async getPermissionRequestsByMember(teamMemberId: string): Promise<PermissionRequest[]> {
    return await db.select().from(permissionRequests)
      .where(eq(permissionRequests.teamMemberId, teamMemberId))
      .orderBy(desc(permissionRequests.createdAt));
  }

  async createPermissionRequest(request: InsertPermissionRequest): Promise<PermissionRequest> {
    // drizzle-zod json array column (requestedPermissions) infers a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const result = await db.insert(permissionRequests).values(request as typeof permissionRequests.$inferInsert).returning();
    return result[0];
  }

  async updatePermissionRequest(id: string, businessOwnerId: string, data: Partial<InsertPermissionRequest>): Promise<PermissionRequest | undefined> {
    const result = await db.update(permissionRequests)
      // drizzle-zod json array column (requestedPermissions) infers a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
      .set({ ...data, updatedAt: new Date() } as Partial<typeof permissionRequests.$inferInsert>)
      .where(and(
        eq(permissionRequests.id, id),
        eq(permissionRequests.businessOwnerId, businessOwnerId)
      ))
      .returning();
    return result[0];
  }

  async getStaffSchedules(userId: string, filters?: {
    jobId?: string;
    startDate?: Date;
    endDate?: Date;
    teamMemberId?: string;
  }): Promise<StaffSchedule[]> {
    let conditions = [eq(staffSchedules.userId, userId)];
    
    if (filters?.jobId) {
      conditions.push(eq(staffSchedules.jobId, filters.jobId));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(staffSchedules.scheduledDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(staffSchedules.scheduledDate, filters.endDate));
    }
    
    return await db.select().from(staffSchedules)
      .where(and(...conditions))
      .orderBy(staffSchedules.scheduledDate);
  }

  async createStaffSchedule(schedule: InsertStaffSchedule): Promise<StaffSchedule> {
    const result = await db.insert(staffSchedules).values(schedule).returning();
    return result[0];
  }

  async updateStaffSchedule(id: string, userId: string, schedule: Partial<InsertStaffSchedule>): Promise<StaffSchedule | undefined> {
    const result = await db.update(staffSchedules)
      .set({ ...schedule, updatedAt: new Date() })
      .where(and(eq(staffSchedules.id, id), eq(staffSchedules.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteStaffSchedule(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(staffSchedules)
      .where(and(eq(staffSchedules.id, id), eq(staffSchedules.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // GPS Tracking
  async getLocationTracking(userId: string, jobId?: string): Promise<LocationTracking[]> {
    if (jobId) {
      return await db.select().from(locationTracking)
        .where(and(eq(locationTracking.userId, userId), eq(locationTracking.jobId, jobId)))
        .orderBy(desc(locationTracking.timestamp));
    }
    return await db.select().from(locationTracking)
      .where(eq(locationTracking.userId, userId))
      .orderBy(desc(locationTracking.timestamp));
  }

  async createLocationTracking(location: InsertLocationTracking): Promise<LocationTracking> {
    const result = await db.insert(locationTracking).values(location).returning();
    return result[0];
  }

  async getRoutes(userId: string): Promise<Route[]> {
    return await db.select().from(routes)
      .where(eq(routes.userId, userId))
      .orderBy(desc(routes.routeDate));
  }

  async getRoute(id: string, userId: string): Promise<Route | undefined> {
    const result = await db.select().from(routes)
      .where(and(eq(routes.id, id), eq(routes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const result = await db.insert(routes).values(route).returning();
    return result[0];
  }

  async updateRoute(id: string, userId: string, route: Partial<InsertRoute>): Promise<Route | undefined> {
    const result = await db.update(routes)
      .set({ ...route, updatedAt: new Date() })
      .where(and(eq(routes.id, id), eq(routes.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteRoute(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(routes)
      .where(and(eq(routes.id, id), eq(routes.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getBusinessSettingsByStripeCustomer(stripeCustomerId: string): Promise<BusinessSettings | undefined> {
    const result = await db.select().from(businessSettings)
      .where(eq(businessSettings.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return result[0];
  }

  // Job Photos
  async getJobPhotos(jobId: string, userId: string): Promise<JobPhoto[]> {
    return await db.select().from(jobPhotos)
      .where(and(eq(jobPhotos.jobId, jobId), eq(jobPhotos.userId, userId)))
      .orderBy(asc(jobPhotos.sortOrder), desc(jobPhotos.createdAt));
  }

  async getJobPhoto(id: string, userId: string): Promise<JobPhoto | undefined> {
    const result = await db.select().from(jobPhotos)
      .where(and(eq(jobPhotos.id, id), eq(jobPhotos.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createJobPhoto(photo: InsertJobPhoto): Promise<JobPhoto> {
    const result = await db.insert(jobPhotos).values(photo).returning();
    return result[0];
  }

  async updateJobPhoto(id: string, userId: string, updates: Partial<InsertJobPhoto>): Promise<JobPhoto | undefined> {
    const result = await db.update(jobPhotos)
      .set(updates)
      .where(and(eq(jobPhotos.id, id), eq(jobPhotos.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteJobPhoto(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(jobPhotos)
      .where(and(eq(jobPhotos.id, id), eq(jobPhotos.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Voice Notes
  async getJobVoiceNotes(jobId: string, userId: string): Promise<VoiceNote[]> {
    return await db.select().from(voiceNotes)
      .where(and(eq(voiceNotes.jobId, jobId), eq(voiceNotes.userId, userId)))
      .orderBy(desc(voiceNotes.createdAt));
  }

  async getVoiceNote(id: string, userId: string): Promise<VoiceNote | undefined> {
    const result = await db.select().from(voiceNotes)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createVoiceNote(note: InsertVoiceNote): Promise<VoiceNote> {
    const result = await db.insert(voiceNotes).values(note).returning();
    return result[0];
  }

  async updateVoiceNote(id: string, userId: string, updates: Partial<InsertVoiceNote>): Promise<VoiceNote | undefined> {
    const result = await db.update(voiceNotes)
      .set(updates)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteVoiceNote(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(voiceNotes)
      .where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Job Documents (uploaded PDFs, external quotes/invoices)
  async getJobDocuments(jobId: string, userId: string): Promise<JobDocument[]> {
    return await db.select().from(jobDocuments)
      .where(and(eq(jobDocuments.jobId, jobId), eq(jobDocuments.userId, userId)))
      .orderBy(desc(jobDocuments.createdAt));
  }

  async getJobDocument(id: string, userId: string): Promise<JobDocument | undefined> {
    const result = await db.select().from(jobDocuments)
      .where(and(eq(jobDocuments.id, id), eq(jobDocuments.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createJobDocument(document: InsertJobDocument): Promise<JobDocument> {
    const result = await db.insert(jobDocuments).values(document).returning();
    return result[0];
  }

  async deleteJobDocument(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(jobDocuments)
      .where(and(eq(jobDocuments.id, id), eq(jobDocuments.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Invoice Reminder Logs
  async getInvoiceReminderLogs(invoiceId: string, userId: string): Promise<InvoiceReminderLog[]> {
    return await db.select().from(invoiceReminderLogs)
      .where(and(eq(invoiceReminderLogs.invoiceId, invoiceId), eq(invoiceReminderLogs.userId, userId)))
      .orderBy(desc(invoiceReminderLogs.createdAt));
  }

  async hasReminderBeenSent(invoiceId: string, reminderType: string): Promise<boolean> {
    const result = await db.select().from(invoiceReminderLogs)
      .where(and(
        eq(invoiceReminderLogs.invoiceId, invoiceId),
        eq(invoiceReminderLogs.reminderType, reminderType)
      ))
      .limit(1);
    return result.length > 0;
  }

  async createInvoiceReminderLog(log: InsertInvoiceReminderLog): Promise<InvoiceReminderLog> {
    const result = await db.insert(invoiceReminderLogs).values(log).returning();
    return result[0];
  }

  // Helper methods for reminder service
  async getAllUsersWithSettings(): Promise<Array<{ id: string; businessSettings: any }>> {
    const usersWithSettings = await db.select({
      id: users.id,
      businessSettings: businessSettings,
    })
    .from(users)
    .leftJoin(businessSettings, eq(users.id, businessSettings.userId));
    
    return usersWithSettings.map(u => ({
      id: u.id,
      businessSettings: u.businessSettings,
    }));
  }

  async getOverdueInvoicesForReminders(userId: string): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        eq(invoices.status, 'unpaid'),
        lt(invoices.dueDate, now)
      ));
  }
  
  async getRecurringJobsDue(): Promise<Job[]> {
    const now = new Date();
    return await db.select().from(jobs)
      .where(and(
        eq(jobs.isRecurring, true),
        lte(jobs.nextRecurrenceDate, now)
      ));
  }
  
  async getRecurringInvoicesDue(): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        eq(invoices.isRecurring, true),
        lte(invoices.nextRecurrenceDate, now)
      ));
  }
  
  async getRecurringJobsDueForUser(userId: string): Promise<Job[]> {
    const now = new Date();
    return await db.select().from(jobs)
      .where(and(
        eq(jobs.userId, userId),
        eq(jobs.isRecurring, true),
        lte(jobs.nextRecurrenceDate, now)
      ));
  }
  
  async getRecurringInvoicesDueForUser(userId: string): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        eq(invoices.isRecurring, true),
        lte(invoices.nextRecurrenceDate, now)
      ));
  }
  
  // Subscription and usage tracking
  async incrementUserUsage(userId: string, type: 'jobs' | 'invoices' | 'quotes'): Promise<void> {
    if (type === 'jobs') {
      await db.update(users).set({ jobsCreatedThisMonth: sql`${users.jobsCreatedThisMonth} + 1` }).where(eq(users.id, userId));
    } else if (type === 'invoices') {
      await db.update(users).set({ invoicesCreatedThisMonth: sql`${users.invoicesCreatedThisMonth} + 1` }).where(eq(users.id, userId));
    } else {
      await db.update(users).set({ quotesCreatedThisMonth: sql`${users.quotesCreatedThisMonth} + 1` }).where(eq(users.id, userId));
    }
    const { invalidateUser } = await import('./cache');
    invalidateUser(userId);
  }
  
  async resetUserUsage(userId: string): Promise<void> {
    await db.update(users)
      .set({
        jobsCreatedThisMonth: 0,
        invoicesCreatedThisMonth: 0,
        quotesCreatedThisMonth: 0,
        usageResetDate: new Date(),
      })
      .where(eq(users.id, userId));
    const { invalidateUser } = await import('./cache');
    invalidateUser(userId);
  }
  
  async getUsersWithActiveTrial(): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.trialStatus, 'active'));
  }
  
  async getUsersWithAutoReminders(): Promise<Array<{ id: string; businessSettings: any }>> {
    const result = await db.select({
      id: users.id,
      businessSettings: businessSettings,
    })
    .from(users)
    .leftJoin(businessSettings, eq(users.id, businessSettings.userId))
    .where(eq(users.isActive, true));
    
    return result.map(u => ({
      id: u.id,
      businessSettings: u.businessSettings,
    })).filter(u => u.businessSettings?.autoRemindersEnabled);
  }
  
  async getUsersWithRecurringItems(): Promise<Array<{ id: string }>> {
    const usersWithRecurringJobs = await db.selectDistinct({ userId: jobs.userId })
      .from(jobs)
      .where(and(
        eq(jobs.isRecurring, true),
        isNotNull(jobs.nextRecurrenceDate)
      ));
    
    const usersWithRecurringInvoices = await db.selectDistinct({ userId: invoices.userId })
      .from(invoices)
      .where(and(
        eq(invoices.isRecurring, true),
        isNotNull(invoices.nextRecurrenceDate)
      ));
    
    const userIds = new Set<string>();
    for (const u of usersWithRecurringJobs) {
      userIds.add(u.userId);
    }
    for (const u of usersWithRecurringInvoices) {
      userIds.add(u.userId);
    }
    
    return Array.from(userIds).map(id => ({ id }));
  }

  // Digital Signatures
  async createDigitalSignature(signature: Omit<InsertDigitalSignature, 'id' | 'createdAt'>): Promise<DigitalSignature> {
    const [result] = await db.insert(digitalSignatures)
      .values({
        ...signature,
        id: randomUUID(),
      })
      .returning();
    return result;
  }

  async getDigitalSignatureByQuoteId(quoteId: string): Promise<DigitalSignature | undefined> {
    const result = await db.select().from(digitalSignatures)
      .where(eq(digitalSignatures.quoteId, quoteId))
      .orderBy(desc(digitalSignatures.signedAt))
      .limit(1);
    return result[0];
  }

  async getDigitalSignaturesByJobId(jobId: string): Promise<any[]> {
    return await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, jobId));
  }

  async getClientMostRecentSignature(clientId: string): Promise<DigitalSignature | undefined> {
    // Get the most recent signature from any quote accepted by this client
    const result = await db.select({
      id: digitalSignatures.id,
      formSubmissionId: digitalSignatures.formSubmissionId,
      quoteId: digitalSignatures.quoteId,
      invoiceId: digitalSignatures.invoiceId,
      jobId: digitalSignatures.jobId,
      signerName: digitalSignatures.signerName,
      signerEmail: digitalSignatures.signerEmail,
      signerRole: digitalSignatures.signerRole,
      signatureData: digitalSignatures.signatureData,
      signedAt: digitalSignatures.signedAt,
      ipAddress: digitalSignatures.ipAddress,
      userAgent: digitalSignatures.userAgent,
      documentType: digitalSignatures.documentType,
      isValid: digitalSignatures.isValid,
      createdAt: digitalSignatures.createdAt,
    })
    .from(digitalSignatures)
    .innerJoin(quotes, eq(digitalSignatures.quoteId, quotes.id))
    .where(eq(quotes.clientId, clientId))
    .orderBy(desc(digitalSignatures.signedAt))
    .limit(1);
    return result[0] as DigitalSignature | undefined;
  }

  // Job Chat
  async getJobChatMessages(jobId: string): Promise<JobChat[]> {
    return await db.select().from(jobChat)
      .where(eq(jobChat.jobId, jobId))
      .orderBy(asc(jobChat.createdAt));
  }

  async getLatestJobChatMessages(businessOwnerId: string): Promise<{ jobId: string; message: string; userId: string; createdAt: Date | null; isSystemMessage: boolean | null }[]> {
    const ownerJobs = await db.select({ id: jobs.id }).from(jobs)
      .where(eq(jobs.userId, businessOwnerId));
    const jobIds = ownerJobs.map(j => j.id);
    if (jobIds.length === 0) return [];
    
    const result = await db.execute(sql`
      SELECT DISTINCT ON (job_id) job_id as "jobId", message, user_id as "userId", created_at as "createdAt", is_system_message as "isSystemMessage"
      FROM job_chat
      WHERE job_id = ANY(${jobIds})
      ORDER BY job_id, created_at DESC
    `);
    return (result.rows || []) as any[];
  }

  async createJobChatMessage(message: InsertJobChat): Promise<JobChat> {
    const [result] = await db.insert(jobChat).values(message).returning();
    return result;
  }

  async markJobChatAsRead(jobId: string, userId: string): Promise<void> {
    const messages = await db.select().from(jobChat)
      .where(eq(jobChat.jobId, jobId));
    
    for (const msg of messages) {
      const readBy = (msg.readBy as string[]) || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.update(jobChat)
          .set({ readBy })
          .where(eq(jobChat.id, msg.id));
      }
    }
  }

  async getUnreadJobChatCount(jobId: string, userId: string): Promise<number> {
    const messages = await db.select().from(jobChat)
      .where(eq(jobChat.jobId, jobId));
    
    return messages.filter(msg => {
      const readBy = (msg.readBy as string[]) || [];
      return !readBy.includes(userId);
    }).length;
  }

  async deleteJobChatMessage(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(jobChat)
      .where(and(eq(jobChat.id, id), eq(jobChat.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async forceDeleteJobChatMessage(id: string, jobId: string, businessOwnerId: string): Promise<boolean> {
    // First verify the job belongs to the business owner
    const job = await db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, businessOwnerId)))
      .limit(1);
    
    if (job.length === 0) {
      return false;
    }
    
    const result = await db.delete(jobChat)
      .where(and(eq(jobChat.id, id), eq(jobChat.jobId, jobId)))
      .returning();
    return result.length > 0;
  }

  // Team Chat
  async getTeamChatMessages(businessOwnerId: string): Promise<TeamChat[]> {
    return await db.select().from(teamChat)
      .where(eq(teamChat.businessOwnerId, businessOwnerId))
      .orderBy(asc(teamChat.createdAt));
  }

  async createTeamChatMessage(message: InsertTeamChat): Promise<TeamChat> {
    const [result] = await db.insert(teamChat).values(message).returning();
    return result;
  }

  async markTeamChatAsRead(businessOwnerId: string, userId: string): Promise<void> {
    const messages = await db.select().from(teamChat)
      .where(eq(teamChat.businessOwnerId, businessOwnerId));
    
    for (const msg of messages) {
      const readBy = (msg.readBy as string[]) || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.update(teamChat)
          .set({ readBy })
          .where(eq(teamChat.id, msg.id));
      }
    }
  }

  async getUnreadTeamChatCount(businessOwnerId: string, userId: string): Promise<number> {
    const messages = await db.select().from(teamChat)
      .where(eq(teamChat.businessOwnerId, businessOwnerId));
    
    return messages.filter(msg => {
      const readBy = (msg.readBy as string[]) || [];
      return !readBy.includes(userId);
    }).length;
  }

  async pinTeamChatMessage(id: string, businessOwnerId: string, pinned: boolean): Promise<TeamChat | undefined> {
    const [result] = await db.update(teamChat)
      .set({ isPinned: pinned, updatedAt: new Date() })
      .where(and(eq(teamChat.id, id), eq(teamChat.businessOwnerId, businessOwnerId)))
      .returning();
    return result;
  }

  async deleteTeamChatMessage(id: string, senderId: string): Promise<boolean> {
    const result = await db.delete(teamChat)
      .where(and(eq(teamChat.id, id), eq(teamChat.senderId, senderId)))
      .returning();
    return result.length > 0;
  }

  async forceDeleteTeamChatMessage(id: string, businessOwnerId: string): Promise<boolean> {
    const result = await db.delete(teamChat)
      .where(and(eq(teamChat.id, id), eq(teamChat.businessOwnerId, businessOwnerId)))
      .returning();
    return result.length > 0;
  }

  // Location Tracking
  async getLatestLocationForUser(userId: string): Promise<LocationTracking | undefined> {
    const [result] = await db.select().from(locationTracking)
      .where(eq(locationTracking.userId, userId))
      .orderBy(desc(locationTracking.timestamp))
      .limit(1);
    return result;
  }

  async createLocationEntry(entry: InsertLocationTracking): Promise<LocationTracking> {
    const [result] = await db.insert(locationTracking).values(entry).returning();
    return result;
  }

  // Tradie Status (Life360-style tracking)
  async getTradieStatus(userId: string): Promise<TradieStatus | undefined> {
    const [result] = await db.select().from(tradieStatus)
      .where(eq(tradieStatus.userId, userId))
      .limit(1);
    return result;
  }

  async upsertTradieStatus(data: InsertTradieStatus): Promise<TradieStatus> {
    // Demo pin override: force certain demo users to a fixed location regardless
    // of incoming GPS pings. Used so demo videos can be recorded from anywhere
    // while the worker pin stays at the scripted job site.
    const DEMO_PINNED_LOCATIONS: Record<string, { lat: string; lng: string; address: string }> = {
      // Jake Morrison (demo worker) → 12 Collins Avenue, Edge Hill QLD 4870
      '9be6ed6c-c472-4e07-b1e5-f7d42291d4ae': {
        lat: '-16.8989487',
        lng: '145.7530458',
        address: '12 Collins Avenue, Edge Hill QLD 4870',
      },
    };
    const pin = DEMO_PINNED_LOCATIONS[data.userId];
    if (pin) {
      data = {
        ...data,
        currentLatitude: pin.lat,
        currentLongitude: pin.lng,
        currentAddress: pin.address,
      } as InsertTradieStatus;
    }

    const existing = await this.getTradieStatus(data.userId);
    if (existing) {
      const [result] = await db.update(tradieStatus)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tradieStatus.userId, data.userId))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(tradieStatus).values(data).returning();
      return result;
    }
  }

  async getAllTradieStatusesForBusiness(businessOwnerId: string): Promise<TradieStatus[]> {
    return await db.select().from(tradieStatus)
      .where(eq(tradieStatus.businessOwnerId, businessOwnerId));
  }

  // Geofence Alerts
  async createGeofenceAlert(alert: InsertGeofenceAlert): Promise<GeofenceAlert> {
    const [result] = await db.insert(geofenceAlerts).values(alert).returning();
    return result;
  }

  async getGeofenceAlertsForBusiness(businessOwnerId: string, limit: number = 50): Promise<GeofenceAlert[]> {
    return await db.select().from(geofenceAlerts)
      .where(eq(geofenceAlerts.businessOwnerId, businessOwnerId))
      .orderBy(desc(geofenceAlerts.createdAt))
      .limit(limit);
  }

  async getUnreadGeofenceAlertsCount(businessOwnerId: string): Promise<number> {
    const results = await db.select().from(geofenceAlerts)
      .where(and(
        eq(geofenceAlerts.businessOwnerId, businessOwnerId),
        eq(geofenceAlerts.isRead, false)
      ));
    return results.length;
  }

  async markGeofenceAlertAsRead(alertId: string): Promise<void> {
    await db.update(geofenceAlerts)
      .set({ isRead: true })
      .where(eq(geofenceAlerts.id, alertId));
  }

  async getRecentGeofenceAlerts(userId: string, jobId: string, alertType: string, withinSeconds: number): Promise<GeofenceAlert[]> {
    const since = new Date(Date.now() - withinSeconds * 1000);
    return await db.select().from(geofenceAlerts)
      .where(and(
        eq(geofenceAlerts.userId, userId),
        eq(geofenceAlerts.jobId, jobId),
        eq(geofenceAlerts.alertType, alertType === 'enter' ? 'arrival' : 'departure'),
        gte(geofenceAlerts.createdAt, since)
      ))
      .orderBy(desc(geofenceAlerts.createdAt));
  }

  async getLastArrivalAlert(userId: string, jobId: string, beforeTs: Date): Promise<GeofenceAlert | undefined> {
    const [row] = await db.select().from(geofenceAlerts)
      .where(and(
        eq(geofenceAlerts.userId, userId),
        eq(geofenceAlerts.jobId, jobId),
        eq(geofenceAlerts.alertType, 'arrival'),
        lte(geofenceAlerts.createdAt, beforeTs)
      ))
      .orderBy(desc(geofenceAlerts.createdAt))
      .limit(1);
    return row;
  }

  async updateGeofenceAlertDwell(alertId: string, dwellSeconds: number): Promise<void> {
    await db.update(geofenceAlerts)
      .set({ dwellSeconds })
      .where(eq(geofenceAlerts.id, alertId));
  }

  // GPS Signal Loss Logging
  async createGpsSignalLog(log: InsertGpsSignalLog): Promise<GpsSignalLog> {
    const [result] = await db.insert(gpsSignalLogs).values(log).returning();
    return result;
  }

  async getGpsSignalLogs(businessOwnerId: string, options?: { userId?: string; limit?: number }): Promise<GpsSignalLog[]> {
    const conditions = [eq(gpsSignalLogs.businessOwnerId, businessOwnerId)];
    if (options?.userId) {
      conditions.push(eq(gpsSignalLogs.userId, options.userId));
    }
    return await db.select().from(gpsSignalLogs)
      .where(and(...conditions))
      .orderBy(desc(gpsSignalLogs.createdAt))
      .limit(options?.limit || 100);
  }

  // Direct Messages
  async getDirectMessageConversations(userId: string): Promise<any[]> {
    const sent = await db.select().from(directMessages)
      .where(eq(directMessages.senderId, userId));
    const received = await db.select().from(directMessages)
      .where(eq(directMessages.recipientId, userId));
    
    const conversationMap = new Map<string, any>();
    
    for (const msg of [...sent, ...received]) {
      const partnerId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const existing = conversationMap.get(partnerId);
      if (!existing || new Date(msg.createdAt!) > new Date(existing.lastMessageAt)) {
        const partner = await this.getUser(partnerId);
        conversationMap.set(partnerId, {
          partnerId,
          partnerName: partner ? `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.email : 'Unknown',
          partnerAvatar: partner?.profileImageUrl,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: received.filter(m => m.senderId === partnerId && !m.isRead).length,
        });
      }
    }
    
    return Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  async getDirectMessages(userId: string, partnerId: string): Promise<DirectMessage[]> {
    return await db.select().from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, partnerId)),
          and(eq(directMessages.senderId, partnerId), eq(directMessages.recipientId, userId))
        )
      )
      .orderBy(asc(directMessages.createdAt));
  }

  async createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage> {
    const [result] = await db.insert(directMessages).values(message).returning();
    return result;
  }

  async markDirectMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db.update(directMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(directMessages.recipientId, userId),
          eq(directMessages.senderId, senderId),
          eq(directMessages.isRead, false)
        )
      );
  }

  async getUnreadDirectMessageCount(userId: string): Promise<number> {
    const result = await db.select().from(directMessages)
      .where(
        and(
          eq(directMessages.recipientId, userId),
          eq(directMessages.isRead, false)
        )
      );
    return result.length;
  }

  // Automations
  async getAutomations(userId: string): Promise<Automation[]> {
    return await db.select().from(automations)
      .where(eq(automations.userId, userId))
      .orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: string, userId: string): Promise<Automation | undefined> {
    const result = await db.select().from(automations)
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createAutomation(automation: InsertAutomation & { userId: string }): Promise<Automation> {
    const [result] = await db.insert(automations).values(automation).returning();
    return result;
  }

  async updateAutomation(id: string, userId: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const [result] = await db.update(automations)
      .set({ ...automation, updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .returning();
    return result;
  }

  async deleteAutomation(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(automations)
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getAllUsersWithAutomations(): Promise<string[]> {
    const result = await db.selectDistinct({ userId: automations.userId })
      .from(automations)
      .where(eq(automations.isActive, true));
    return result.map(r => r.userId);
  }

  async hasAutomationProcessed(automationId: string, entityType: string, entityId: string): Promise<boolean> {
    try {
      const result = await db.select()
        .from(automationLogs)
        .where(
          and(
            eq(automationLogs.automationId, automationId),
            eq(automationLogs.entityType, entityType),
            eq(automationLogs.entityId, entityId)
          )
        )
        .limit(1);
      return result.length > 0;
    } catch (error) {
      console.error(`[Storage] Error checking automation log:`, error);
      return false;
    }
  }

  async logAutomationProcessed(
    automationId: string, 
    entityType: string, 
    entityId: string, 
    result: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(automationLogs).values({
        automationId,
        entityType,
        entityId,
        result,
        errorMessage: errorMessage || null,
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`[Storage] Error logging automation:`, error);
    }
  }

  async getAutomationLogs(userId: string, limit: number = 50): Promise<AutomationLog[]> {
    try {
      const userAutomations = await this.getAutomations(userId);
      const automationIds = userAutomations.map(a => a.id);
      
      if (automationIds.length === 0) return [];
      
      const result = await db.select()
        .from(automationLogs)
        .where(inArray(automationLogs.automationId, automationIds))
        .orderBy(desc(automationLogs.processedAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error(`[Storage] Error getting automation logs:`, error);
      return [];
    }
  }

  // Custom Forms
  async getCustomForms(userId: string, tradeType?: string): Promise<CustomForm[]> {
    // Trade type filtering with fallback to 'general' forms
    // If a specific trade is requested, return matching trade + general fallback
    if (tradeType) {
      const tradeCondition = or(
        eq(customForms.tradeType, tradeType),
        eq(customForms.tradeType, 'general'),
        eq(customForms.isDefault, false) // User-created forms always included
      );
      return await db.select().from(customForms)
        .where(and(eq(customForms.userId, userId), tradeCondition))
        .orderBy(desc(customForms.createdAt));
    }
    return await db.select().from(customForms)
      .where(eq(customForms.userId, userId))
      .orderBy(desc(customForms.createdAt));
  }

  async getCustomForm(id: string, userId: string): Promise<CustomForm | undefined> {
    const result = await db.select().from(customForms)
      .where(and(eq(customForms.id, id), eq(customForms.userId, userId)))
      .limit(1);
    return result[0];
  }

  // Returns the templates a member can see: the shared business pool (stored
  // under the owner id) plus the member's own personal templates.
  async getCustomFormsVisibleTo(ownerId: string, memberId: string, tradeType?: string): Promise<CustomForm[]> {
    const ids = ownerId === memberId ? [ownerId] : [ownerId, memberId];
    const scope = inArray(customForms.userId, ids);
    if (tradeType) {
      const tradeCondition = or(
        eq(customForms.tradeType, tradeType),
        eq(customForms.tradeType, 'general'),
        eq(customForms.isDefault, false) // User-created forms always included
      );
      return await db.select().from(customForms)
        .where(and(scope, tradeCondition))
        .orderBy(desc(customForms.createdAt));
    }
    return await db.select().from(customForms)
      .where(scope)
      .orderBy(desc(customForms.createdAt));
  }

  async createCustomForm(form: InsertCustomForm & { userId: string }): Promise<CustomForm> {
    const [result] = await db.insert(customForms).values(form).returning();
    return result;
  }

  async updateCustomForm(id: string, userId: string, form: Partial<InsertCustomForm>): Promise<CustomForm | undefined> {
    const [result] = await db.update(customForms)
      .set({ ...form, updatedAt: new Date() })
      .where(and(eq(customForms.id, id), eq(customForms.userId, userId)))
      .returning();
    return result;
  }

  async deleteCustomForm(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(customForms)
      .where(and(eq(customForms.id, id), eq(customForms.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async seedDefaultSafetyForms(userId: string): Promise<CustomForm[]> {
    const { tradieSafetyForms } = await import('./tradieSafetyForms');
    
    const existing = await this.getCustomForms(userId);
    if (existing.filter(f => f.isDefault).length > 0) {
      return existing;
    }

    // Get user's trade type from their profile
    const user = await this.getUser(userId);
    const userTradeType = user?.tradeType?.toLowerCase() || 'general';

    // Filter safety forms: keep general ones + trade-specific for user's trade
    const filteredForms = tradieSafetyForms.filter(formDef => {
      const formTradeType = formDef.tradeType?.toLowerCase() || 'general';
      // Keep general forms (always)
      if (formTradeType === 'general') return true;
      // Keep trade-specific forms only if they match the user's trade
      return formTradeType === userTradeType;
    });

    const created: CustomForm[] = [];
    for (const formDef of filteredForms) {
      try {
        const form = await this.createCustomForm({
          userId,
          name: formDef.name,
          description: formDef.description,
          formType: formDef.formType,
          tradeType: formDef.tradeType,
          fields: formDef.fields,
          settings: formDef.settings,
          requiresSignature: formDef.requiresSignature,
          isDefault: true,
          isActive: true,
        });
        created.push(form);
      } catch (error) {
        console.error(`Error creating safety form ${formDef.name}:`, error);
      }
    }
    return created;
  }

  // Form Submissions
  async getFormSubmissions(formId: string, userId: string): Promise<FormSubmission[]> {
    const form = await this.getCustomForm(formId, userId);
    if (!form) return [];
    
    return await db.select().from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.submittedAt));
  }

  async getFormSubmissionsByJob(jobId: string, userId: string): Promise<FormSubmission[]> {
    const job = await this.getJob(jobId, userId);
    if (!job) return [];
    
    return await db.select().from(formSubmissions)
      .where(eq(formSubmissions.jobId, jobId))
      .orderBy(desc(formSubmissions.submittedAt));
  }

  async getJobSafetyFormSubmissionCount(jobId: string, userId: string): Promise<number> {
    const job = await this.getJob(jobId, userId);
    if (!job) return 0;

    const rows = await db.select({ id: formSubmissions.id })
      .from(formSubmissions)
      .innerJoin(customForms, eq(formSubmissions.formId, customForms.id))
      .where(and(
        eq(formSubmissions.jobId, jobId),
        inArray(customForms.formType, ['safety', 'inspection'])
      ));

    return rows.length;
  }

  async getFormSubmission(id: string, userId: string): Promise<FormSubmission | undefined> {
    const result = await db.select().from(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .limit(1);
    
    if (!result[0]) return undefined;
    
    const form = await this.getCustomForm(result[0].formId, userId);
    if (!form) return undefined;
    
    return result[0];
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const [result] = await db.insert(formSubmissions).values(submission).returning();
    return result;
  }

  async updateFormSubmission(id: string, userId: string, submission: Partial<InsertFormSubmission>): Promise<FormSubmission | undefined> {
    const existing = await this.getFormSubmission(id, userId);
    if (!existing) return undefined;
    
    const [result] = await db.update(formSubmissions)
      .set(submission)
      .where(eq(formSubmissions.id, id))
      .returning();
    return result;
  }

  async getFormSubmissionVersions(submissionId: string): Promise<FormSubmissionVersion[]> {
    return await db.select().from(formSubmissionVersions)
      .where(eq(formSubmissionVersions.submissionId, submissionId))
      .orderBy(desc(formSubmissionVersions.versionNumber));
  }

  async createFormSubmissionVersion(version: InsertFormSubmissionVersion): Promise<FormSubmissionVersion> {
    // Version number is assigned atomically in SQL (max+1) with a unique index
    // on (submission_id, version_number); retry once on a concurrent conflict.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await pool.query(
          `INSERT INTO form_submission_versions (submission_id, version_number, submission_data, edited_by)
           VALUES ($1::varchar, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM form_submission_versions WHERE submission_id = $1::varchar), $2::json, $3::varchar)
           RETURNING id, submission_id AS "submissionId", version_number AS "versionNumber", submission_data AS "submissionData", edited_by AS "editedBy", edited_at AS "editedAt"`,
          [version.submissionId, JSON.stringify(version.submissionData || {}), version.editedBy || null]
        );
        return result.rows[0] as FormSubmissionVersion;
      } catch (err: any) {
        if (err?.code === '23505' && attempt < 2) continue; // unique conflict, retry
        throw err;
      }
    }
    throw new Error('Failed to create form submission version after retries');
  }

  async deleteFormSubmission(id: string, userId: string): Promise<boolean> {
    const existing = await this.getFormSubmission(id, userId);
    if (!existing) return false;
    
    const result = await db.delete(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .returning();
    return result.length > 0;
  }

  async getFormSubmissionsForExport(ownerUserId: string, opts?: { formId?: string; from?: Date; to?: Date }): Promise<Array<{
    submission: FormSubmission;
    formId: string;
    formName: string;
    formFields: any;
    jobTitle: string | null;
    clientName: string | null;
    submitterName: string | null;
    submitterEmail: string | null;
  }>> {
    const conds = [eq(customForms.userId, ownerUserId)];
    if (opts?.formId) {
      conds.push(eq(customForms.id, opts.formId));
    } else {
      // "All job cards" export — restrict to forms flagged as job cards
      conds.push(eq(customForms.isJobCard, true));
    }
    if (opts?.from) conds.push(gte(formSubmissions.submittedAt, opts.from));
    if (opts?.to) conds.push(lte(formSubmissions.submittedAt, opts.to));

    const rows = await db.select({
      submission: formSubmissions,
      formId: customForms.id,
      formName: customForms.name,
      formFields: customForms.fields,
      jobTitle: jobs.title,
      clientName: clients.name,
      submitterFirstName: users.firstName,
      submitterLastName: users.lastName,
      submitterEmail: users.email,
    })
      .from(formSubmissions)
      .innerJoin(customForms, eq(formSubmissions.formId, customForms.id))
      .leftJoin(jobs, eq(formSubmissions.jobId, jobs.id))
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .leftJoin(users, eq(formSubmissions.submittedBy, users.id))
      .where(and(...conds))
      .orderBy(asc(customForms.name), desc(formSubmissions.submittedAt));

    return rows.map(r => ({
      submission: r.submission,
      formId: r.formId,
      formName: r.formName,
      formFields: r.formFields,
      jobTitle: r.jobTitle,
      clientName: r.clientName,
      submitterName: [r.submitterFirstName, r.submitterLastName].filter(Boolean).join(' ') || null,
      submitterEmail: r.submitterEmail,
    }));
  }

  // Follow-up Tasks
  async createTask(task: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async getTasks(userId: string, jobId?: string): Promise<Task[]> {
    const conds = [eq(tasks.userId, userId)];
    if (jobId) conds.push(eq(tasks.jobId, jobId));
    return await db.select().from(tasks)
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string, userId: string): Promise<Task | undefined> {
    const [result] = await db.select().from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return result;
  }

  async updateTask(id: string, userId: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const existing = await this.getTask(id, userId);
    if (!existing) return undefined;
    const [result] = await db.update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result;
  }

  async completeTask(id: string, userId: string, completedBy: string): Promise<Task | undefined> {
    const existing = await this.getTask(id, userId);
    if (!existing) return undefined;
    const [result] = await db.update(tasks)
      .set({ status: 'done', completedAt: new Date(), completedBy, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const existing = await this.getTask(id, userId);
    if (!existing) return false;
    const result = await db.delete(tasks)
      .where(eq(tasks.id, id))
      .returning();
    return result.length > 0;
  }

  // SMS Conversations
  async getSmsConversation(id: string): Promise<SmsConversation | undefined> {
    const result = await db.select().from(smsConversations)
      .where(and(eq(smsConversations.id, id), isNull(smsConversations.deletedAt)))
      .limit(1);
    return result[0];
  }

  async getSmsConversationByPhone(businessOwnerId: string, clientPhone: string): Promise<SmsConversation | undefined> {
    const result = await db.select().from(smsConversations)
      .where(and(
        eq(smsConversations.businessOwnerId, businessOwnerId),
        eq(smsConversations.clientPhone, clientPhone),
        isNull(smsConversations.deletedAt)
      ))
      .limit(1);
    return result[0];
  }

  async getSmsConversationsByBusiness(businessOwnerId: string): Promise<SmsConversation[]> {
    return await db.select().from(smsConversations)
      .where(and(
        eq(smsConversations.businessOwnerId, businessOwnerId),
        isNull(smsConversations.deletedAt)
      ))
      .orderBy(desc(smsConversations.lastMessageAt));
  }

  async getSmsConversationsByClientPhone(clientPhone: string): Promise<SmsConversation[]> {
    return await db.select().from(smsConversations)
      .where(and(
        eq(smsConversations.clientPhone, clientPhone),
        isNull(smsConversations.deletedAt)
      ))
      .orderBy(desc(smsConversations.lastMessageAt));
  }

  async getSmsConversationsByJobIds(jobIds: string[]): Promise<SmsConversation[]> {
    if (jobIds.length === 0) return [];
    return await db.select().from(smsConversations)
      .where(and(
        inArray(smsConversations.jobId, jobIds),
        isNull(smsConversations.deletedAt)
      ))
      .orderBy(desc(smsConversations.lastMessageAt));
  }

  async createSmsConversation(conversation: InsertSmsConversation): Promise<SmsConversation> {
    const [result] = await db.insert(smsConversations).values(conversation).returning();
    return result;
  }

  async updateSmsConversation(id: string, updates: Partial<InsertSmsConversation>): Promise<SmsConversation> {
    const [result] = await db.update(smsConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(smsConversations.id, id))
      .returning();
    return result;
  }

  async updateSmsConversationRoutingState(conversationId: string, state: string, options?: any[]): Promise<void> {
    await db.update(smsConversations)
      .set({
        routingState: state,
        pendingOptions: options ?? [],
        lastRoutingPromptAt: state !== 'resolved' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(smsConversations.id, conversationId));
  }

  async getJobsByClientAndBusiness(clientId: string, businessOwnerId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.clientId, clientId), eq(jobs.userId, businessOwnerId)))
      .orderBy(desc(jobs.createdAt));
  }

  // SMS Messages
  async getSmsMessage(id: string): Promise<SmsMessage | undefined> {
    const result = await db.select().from(smsMessages)
      .where(eq(smsMessages.id, id))
      .limit(1);
    return result[0];
  }

  async getSmsMessages(conversationId: string): Promise<SmsMessage[]> {
    return await db.select().from(smsMessages)
      .where(eq(smsMessages.conversationId, conversationId))
      .orderBy(asc(smsMessages.createdAt));
  }

  async getSmsJobRequests(businessOwnerId: string): Promise<SmsMessage[]> {
    // Get all SMS messages that are job requests and haven't been converted to jobs yet
    // Join with conversations to filter by business owner
    return await db
      .select({
        id: smsMessages.id,
        conversationId: smsMessages.conversationId,
        direction: smsMessages.direction,
        body: smsMessages.body,
        senderUserId: smsMessages.senderUserId,
        status: smsMessages.status,
        twilioSid: smsMessages.twilioSid,
        errorMessage: smsMessages.errorMessage,
        isQuickAction: smsMessages.isQuickAction,
        quickActionType: smsMessages.quickActionType,
        mediaUrls: smsMessages.mediaUrls,
        isJobRequest: smsMessages.isJobRequest,
        intentConfidence: smsMessages.intentConfidence,
        intentType: smsMessages.intentType,
        suggestedJobTitle: smsMessages.suggestedJobTitle,
        suggestedDescription: smsMessages.suggestedDescription,
        jobCreatedFromSms: smsMessages.jobCreatedFromSms,
        readAt: smsMessages.readAt,
        retryCount: smsMessages.retryCount,
        nextRetryAt: smsMessages.nextRetryAt,
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .innerJoin(smsConversations, eq(smsMessages.conversationId, smsConversations.id))
      .where(and(
        eq(smsConversations.businessOwnerId, businessOwnerId),
        eq(smsMessages.isJobRequest, true),
        isNull(smsMessages.jobCreatedFromSms)
      ))
      .orderBy(desc(smsMessages.createdAt));
  }

  async createSmsMessage(message: InsertSmsMessage): Promise<SmsMessage> {
    const [result] = await db.insert(smsMessages).values(message).returning();
    return result;
  }

  async updateSmsMessage(id: string, updates: Partial<InsertSmsMessage>): Promise<SmsMessage> {
    const [result] = await db.update(smsMessages)
      .set(updates)
      .where(eq(smsMessages.id, id))
      .returning();
    return result;
  }

  async getSmsMessageByTwilioSid(twilioSid: string): Promise<SmsMessage | undefined> {
    const result = await db.select().from(smsMessages)
      .where(eq(smsMessages.twilioSid, twilioSid))
      .limit(1);
    return result[0];
  }

  async markSmsMessagesAsRead(conversationId: string): Promise<void> {
    await db.update(smsMessages)
      .set({ readAt: new Date() })
      .where(and(
        eq(smsMessages.conversationId, conversationId),
        isNull(smsMessages.readAt)
      ));
  }

  // SMS Templates
  async getSmsTemplates(userId: string): Promise<SmsTemplate[]> {
    return await db.select().from(smsTemplates)
      .where(eq(smsTemplates.userId, userId))
      .orderBy(desc(smsTemplates.usageCount), asc(smsTemplates.name));
  }

  async getSmsTemplate(id: string, userId: string): Promise<SmsTemplate | undefined> {
    const result = await db.select().from(smsTemplates)
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createSmsTemplate(data: InsertSmsTemplate): Promise<SmsTemplate> {
    const [result] = await db.insert(smsTemplates).values(data).returning();
    return result;
  }

  async updateSmsTemplate(id: string, userId: string, data: Partial<InsertSmsTemplate>): Promise<SmsTemplate> {
    const [result] = await db.update(smsTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.userId, userId)))
      .returning();
    return result;
  }

  async deleteSmsTemplate(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(smsTemplates)
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async incrementSmsTemplateUsage(id: string): Promise<void> {
    await db.update(smsTemplates)
      .set({ 
        usageCount: sql`${smsTemplates.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(smsTemplates.id, id));
  }

  // SMS Automation Rules
  async getSmsAutomationRules(userId: string): Promise<SmsAutomationRule[]> {
    return await db.select().from(smsAutomationRules)
      .where(eq(smsAutomationRules.userId, userId))
      .orderBy(desc(smsAutomationRules.createdAt));
  }

  async getSmsAutomationRule(id: string, userId: string): Promise<SmsAutomationRule | undefined> {
    const result = await db.select().from(smsAutomationRules)
      .where(and(eq(smsAutomationRules.id, id), eq(smsAutomationRules.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createSmsAutomationRule(data: InsertSmsAutomationRule): Promise<SmsAutomationRule> {
    const [result] = await db.insert(smsAutomationRules).values(data).returning();
    return result;
  }

  async updateSmsAutomationRule(id: string, userId: string, data: Partial<InsertSmsAutomationRule> & Partial<Pick<SmsAutomationRule, 'lastTriggeredAt' | 'triggerCount'>>): Promise<SmsAutomationRule> {
    const [result] = await db.update(smsAutomationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(smsAutomationRules.id, id), eq(smsAutomationRules.userId, userId)))
      .returning();
    return result;
  }

  async deleteSmsAutomationRule(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(smsAutomationRules)
      .where(and(eq(smsAutomationRules.id, id), eq(smsAutomationRules.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getSmsAutomationRulesByTrigger(userId: string, triggerType: string): Promise<SmsAutomationRule[]> {
    return await db.select().from(smsAutomationRules)
      .where(and(
        eq(smsAutomationRules.userId, userId),
        eq(smsAutomationRules.triggerType, triggerType),
        eq(smsAutomationRules.isActive, true)
      ))
      .orderBy(desc(smsAutomationRules.createdAt));
  }

  // SMS Automation Logs
  async createSmsAutomationLog(data: InsertSmsAutomationLog): Promise<SmsAutomationLog> {
    const [result] = await db.insert(smsAutomationLogs).values(data).returning();
    return result;
  }

  async getSmsAutomationLog(ruleId: string, entityType: string, entityId: string): Promise<SmsAutomationLog | undefined> {
    const result = await db.select().from(smsAutomationLogs)
      .where(and(
        eq(smsAutomationLogs.ruleId, ruleId),
        eq(smsAutomationLogs.entityType, entityType),
        eq(smsAutomationLogs.entityId, entityId)
      ))
      .limit(1);
    return result[0];
  }

  // SMS Booking Links
  async createSmsBookingLink(data: InsertSmsBookingLink): Promise<SmsBookingLink> {
    const [result] = await db.insert(smsBookingLinks).values(data).returning();
    return result;
  }

  async getSmsBookingLinkByToken(token: string): Promise<SmsBookingLink | undefined> {
    const result = await db.select().from(smsBookingLinks)
      .where(eq(smsBookingLinks.token, token))
      .limit(1);
    return result[0];
  }

  async updateSmsBookingLink(id: string, data: Partial<SmsBookingLink>): Promise<SmsBookingLink> {
    const [result] = await db.update(smsBookingLinks)
      .set(data)
      .where(eq(smsBookingLinks.id, id))
      .returning();
    return result;
  }

  // SMS Tracking Links (Live Arrival Tracking)
  async createSmsTrackingLink(data: InsertSmsTrackingLink): Promise<SmsTrackingLink> {
    const [result] = await db.insert(smsTrackingLinks).values(data).returning();
    return result;
  }

  async getSmsTrackingLinkByToken(token: string): Promise<SmsTrackingLink | undefined> {
    const result = await db.select().from(smsTrackingLinks)
      .where(eq(smsTrackingLinks.token, token))
      .limit(1);
    return result[0];
  }

  async getSmsTrackingLinkByJobId(jobId: string): Promise<SmsTrackingLink | undefined> {
    const result = await db.select().from(smsTrackingLinks)
      .where(and(
        eq(smsTrackingLinks.jobId, jobId),
        eq(smsTrackingLinks.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async updateSmsTrackingLink(id: string, data: Partial<SmsTrackingLink>): Promise<SmsTrackingLink> {
    const [result] = await db.update(smsTrackingLinks)
      .set(data)
      .where(eq(smsTrackingLinks.id, id))
      .returning();
    return result;
  }

  async incrementTrackingLinkViews(id: string): Promise<void> {
    await db.update(smsTrackingLinks)
      .set({ viewCount: sql`${smsTrackingLinks.viewCount} + 1` })
      .where(eq(smsTrackingLinks.id, id));
  }

  async deactivateSmsTrackingLink(id: string): Promise<void> {
    await db.update(smsTrackingLinks)
      .set({ isActive: false })
      .where(eq(smsTrackingLinks.id, id));
  }

  // Xero Integration
  async getXeroConnection(userId: string): Promise<XeroConnection | undefined> {
    const result = await db.select().from(xeroConnections)
      .where(eq(xeroConnections.userId, userId))
      .limit(1);
    return result[0];
  }

  async createXeroConnection(data: InsertXeroConnection): Promise<XeroConnection> {
    const [result] = await db.insert(xeroConnections).values(data).returning();
    return result;
  }

  async updateXeroConnection(id: string, data: Partial<XeroConnection>): Promise<XeroConnection | undefined> {
    const [result] = await db.update(xeroConnections)
      .set(data)
      .where(eq(xeroConnections.id, id))
      .returning();
    return result;
  }

  async deleteXeroConnection(userId: string): Promise<boolean> {
    const result = await db.delete(xeroConnections)
      .where(eq(xeroConnections.userId, userId))
      .returning();
    return result.length > 0;
  }

  async recordXeroSyncRun(data: InsertXeroSyncState): Promise<XeroSyncState> {
    const [result] = await db.insert(xeroSyncState).values(data).returning();
    return result;
  }

  async getXeroSyncHistory(userId: string, limit: number = 50): Promise<XeroSyncState[]> {
    return await db.select().from(xeroSyncState)
      .where(eq(xeroSyncState.userId, userId))
      .orderBy(desc(xeroSyncState.startedAt))
      .limit(limit);
  }

  async getAllXeroConnections(): Promise<XeroConnection[]> {
    return await db.select().from(xeroConnections);
  }

  async getAllQuickbooksConnections(): Promise<QuickbooksConnection[]> {
    return await db.select().from(quickbooksConnections);
  }

  // MYOB Integration
  async getMyobConnection(userId: string): Promise<MyobConnection | undefined> {
    const result = await db.select().from(myobConnections)
      .where(eq(myobConnections.userId, userId))
      .limit(1);
    return result[0];
  }

  async createMyobConnection(data: InsertMyobConnection): Promise<MyobConnection> {
    const [result] = await db.insert(myobConnections).values(data).returning();
    return result;
  }

  async updateMyobConnection(id: string, data: Partial<MyobConnection>): Promise<MyobConnection | undefined> {
    const [result] = await db.update(myobConnections)
      .set(data)
      .where(eq(myobConnections.id, id))
      .returning();
    return result;
  }

  async deleteMyobConnection(userId: string): Promise<boolean> {
    const result = await db.delete(myobConnections)
      .where(eq(myobConnections.userId, userId))
      .returning();
    return result.length > 0;
  }

  // QuickBooks Integration
  async getQuickbooksConnection(userId: string): Promise<QuickbooksConnection | undefined> {
    const result = await db.select().from(quickbooksConnections)
      .where(eq(quickbooksConnections.userId, userId))
      .limit(1);
    return result[0];
  }

  async createQuickbooksConnection(data: InsertQuickbooksConnection): Promise<QuickbooksConnection> {
    const [result] = await db.insert(quickbooksConnections).values(data).returning();
    return result;
  }

  async updateQuickbooksConnection(id: string, data: Partial<QuickbooksConnection>): Promise<QuickbooksConnection | undefined> {
    const [result] = await db.update(quickbooksConnections)
      .set(data)
      .where(eq(quickbooksConnections.id, id))
      .returning();
    return result;
  }

  async deleteQuickbooksConnection(userId: string): Promise<boolean> {
    const result = await db.delete(quickbooksConnections)
      .where(eq(quickbooksConnections.userId, userId))
      .returning();
    return result.length > 0;
  }

  // Message Templates (unified email/SMS templates)
  async getMessageTemplates(userId: string, channel?: string): Promise<MessageTemplate[]> {
    if (channel) {
      return db.select().from(messageTemplates)
        .where(and(
          eq(messageTemplates.userId, userId),
          eq(messageTemplates.channel, channel)
        ))
        .orderBy(asc(messageTemplates.name), asc(messageTemplates.createdAt));
    }
    return db.select().from(messageTemplates)
      .where(eq(messageTemplates.userId, userId))
      .orderBy(asc(messageTemplates.name), asc(messageTemplates.createdAt));
  }

  async getMessageTemplate(id: string, userId: string): Promise<MessageTemplate | null> {
    const result = await db.select().from(messageTemplates)
      .where(and(
        eq(messageTemplates.id, id),
        eq(messageTemplates.userId, userId)
      ))
      .limit(1);
    return result[0] || null;
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const [result] = await db.insert(messageTemplates).values(template).returning();
    return result;
  }

  async updateMessageTemplate(id: string, userId: string, updates: Partial<InsertMessageTemplate>): Promise<MessageTemplate | null> {
    const result = await db.update(messageTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(messageTemplates.id, id),
        eq(messageTemplates.userId, userId)
      ))
      .returning();
    return result[0] || null;
  }

  async deleteMessageTemplate(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(messageTemplates)
      .where(and(
        eq(messageTemplates.id, id),
        eq(messageTemplates.userId, userId),
        eq(messageTemplates.isDefault, false)
      ))
      .returning();
    return result.length > 0;
  }

  async ensureDefaultTemplates(userId: string): Promise<void> {
    // Advisory lock keyed to the user prevents concurrent first-load requests
    // from double-seeding the defaults (observed in prod: every default twice)
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'msg_tpl_seed:' + userId}))`);
      const existing = await tx.select().from(messageTemplates)
        .where(eq(messageTemplates.userId, userId))
        .limit(1);
      if (existing.length > 0) {
        return;
      }
      await this.seedDefaultTemplatesTx(tx, userId);
    });
  }

  private async seedDefaultTemplatesTx(tx: any, userId: string): Promise<void> {

    const defaultTemplates: InsertMessageTemplate[] = [
      // Email templates
      {
        userId,
        channel: 'email',
        category: 'quote_follow_up',
        name: 'Quote Follow-up',
        subject: 'Following up on your quote',
        body: "G'day {client_name},\n\nJust checking in to see if you had any questions about the quote I sent through for {job_title}.\n\nThe quote total was ${amount} and is valid for the next 30 days.\n\nGive us a bell if you'd like to go ahead or need any changes.\n\nCheers,\n{business_name}",
        isDefault: true,
        isActive: true,
      },
      {
        userId,
        channel: 'email',
        category: 'payment_reminder',
        name: 'Payment Reminder',
        subject: 'Friendly reminder - Invoice #{invoice_number}',
        body: "G'day {client_name},\n\nJust a friendly reminder that Invoice #{invoice_number} for ${amount} is due on {due_date}.\n\nIf you've already paid, please disregard this message.\n\nCheers,\n{business_name}",
        isDefault: true,
        isActive: true,
      },
      {
        userId,
        channel: 'email',
        category: 'job_completed',
        name: 'Job Completed',
        subject: 'Job completed - {job_title}',
        body: "G'day {client_name},\n\nJust letting you know we've completed the work on {job_title} at {site_address}.\n\nThanks for choosing {business_name}! If you're happy with the work, we'd really appreciate a review.\n\nCheers,\n{business_name}",
        isDefault: true,
        isActive: true,
      },
      // SMS templates
      {
        userId,
        channel: 'sms',
        category: 'on_my_way',
        name: 'On My Way',
        body: "G'day {client_name}, this is {business_name}. Just letting you know I'm on my way to {site_address}. Should be there in about 15 minutes.",
        isDefault: true,
        isActive: true,
      },
      {
        userId,
        channel: 'sms',
        category: 'running_late',
        name: 'Running Late',
        body: "G'day {client_name}, this is {business_name}. Running a bit behind today, sorry about that. Will be there as soon as I can.",
        isDefault: true,
        isActive: true,
      },
      {
        userId,
        channel: 'sms',
        category: 'quote_ready',
        name: 'Quote Ready',
        body: "G'day {client_name}, your quote for {job_title} is ready. Total: ${amount}. Check your email for full details. - {business_name}",
        isDefault: true,
        isActive: true,
      },
      {
        userId,
        channel: 'sms',
        category: 'invoice_reminder',
        name: 'Invoice Reminder',
        body: "G'day {client_name}, friendly reminder that Invoice #{invoice_number} for ${amount} is due {due_date}. - {business_name}",
        isDefault: true,
        isActive: true,
      },
    ];

    await tx.insert(messageTemplates).values(defaultTemplates);
  }

  // Quick Replies (Chat Hub canned responses)
  async getQuickReplies(userId: string): Promise<QuickReply[]> {
    return db.select().from(quickReplies)
      .where(eq(quickReplies.userId, userId))
      .orderBy(asc(quickReplies.sortOrder), asc(quickReplies.createdAt));
  }

  async createQuickReply(reply: InsertQuickReply): Promise<QuickReply> {
    const [existing] = await db.select({ max: sql<number>`COALESCE(MAX(${quickReplies.sortOrder}), -1)` })
      .from(quickReplies)
      .where(eq(quickReplies.userId, reply.userId));
    const nextOrder = (existing?.max ?? -1) + 1;
    const [result] = await db.insert(quickReplies).values({
      ...reply,
      sortOrder: reply.sortOrder ?? nextOrder,
    }).returning();
    return result;
  }

  async updateQuickReply(id: string, userId: string, updates: Partial<InsertQuickReply>): Promise<QuickReply | null> {
    const { userId: _ignoredUserId, ...safeUpdates } = updates;
    const [result] = await db.update(quickReplies)
      .set(safeUpdates)
      .where(and(eq(quickReplies.id, id), eq(quickReplies.userId, userId)))
      .returning();
    return result || null;
  }

  async deleteQuickReply(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(quickReplies)
      .where(and(eq(quickReplies.id, id), eq(quickReplies.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async reorderQuickReplies(userId: string, orderedIds: string[]): Promise<QuickReply[]> {
    const existing = await db.select().from(quickReplies).where(eq(quickReplies.userId, userId));
    const ownedIds = new Set(existing.map(r => r.id));
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!ownedIds.has(id)) continue;
      await db.update(quickReplies)
        .set({ sortOrder: i })
        .where(and(eq(quickReplies.id, id), eq(quickReplies.userId, userId)));
    }
    return this.getQuickReplies(userId);
  }

  async ensureDefaultQuickReplies(userId: string): Promise<void> {
    const existing = await db.select({ id: quickReplies.id }).from(quickReplies)
      .where(eq(quickReplies.userId, userId))
      .limit(1);
    if (existing.length > 0) return;
    const seeded = DEFAULT_QUICK_REPLIES.map((r, i) => ({
      userId,
      label: r.label,
      body: r.body,
      sortOrder: i,
    }));
    if (seeded.length > 0) {
      await db.insert(quickReplies).values(seeded).onConflictDoNothing();
    }
  }

  // Business Templates (unified Templates Hub)
  async getBusinessTemplates(userId: string, family?: string, tradeType?: string): Promise<BusinessTemplate[]> {
    const conditions = [eq(businessTemplates.userId, userId)];
    
    if (family) {
      conditions.push(eq(businessTemplates.family, family));
    }
    
    if (tradeType) {
      conditions.push(eq(businessTemplates.tradeType, tradeType));
    }
    
    return await db.select().from(businessTemplates)
      .where(and(...conditions))
      .orderBy(businessTemplates.family, desc(businessTemplates.isActive), asc(businessTemplates.name));
  }

  async getBusinessTemplatesWithFallback(userId: string, tradeType: string, family?: string): Promise<BusinessTemplate[]> {
    // First try to get templates for the specific trade type
    let templates = await this.getBusinessTemplates(userId, family, tradeType);
    
    // If no trade-specific templates found and tradeType is not 'general', fall back to 'general'
    if (templates.length === 0 && tradeType !== 'general') {
      templates = await this.getBusinessTemplates(userId, family, 'general');
    }
    
    // If still no templates, get all templates for this user (backward compatibility)
    if (templates.length === 0) {
      templates = await this.getBusinessTemplates(userId, family);
    }
    
    return templates;
  }

  async getBusinessTemplate(id: string, userId: string): Promise<BusinessTemplate | undefined> {
    const result = await db.select().from(businessTemplates)
      .where(and(
        eq(businessTemplates.id, id),
        eq(businessTemplates.userId, userId)
      ))
      .limit(1);
    return result[0];
  }

  async getActiveBusinessTemplate(userId: string, family: string, tradeType?: string): Promise<BusinessTemplate | undefined> {
    // If tradeType is provided, try to find a template for that trade type first
    if (tradeType) {
      const result = await db.select().from(businessTemplates)
        .where(and(
          eq(businessTemplates.userId, userId),
          eq(businessTemplates.family, family),
          eq(businessTemplates.tradeType, tradeType),
          eq(businessTemplates.isActive, true)
        ))
        .limit(1);
      
      if (result[0]) return result[0];
      
      // Fallback to 'general' trade type if no trade-specific template found
      if (tradeType !== 'general') {
        const fallbackResult = await db.select().from(businessTemplates)
          .where(and(
            eq(businessTemplates.userId, userId),
            eq(businessTemplates.family, family),
            eq(businessTemplates.tradeType, 'general'),
            eq(businessTemplates.isActive, true)
          ))
          .limit(1);
        
        if (fallbackResult[0]) return fallbackResult[0];
      }
    }
    
    // Fallback: get any active template for this family (backward compatibility)
    const result = await db.select().from(businessTemplates)
      .where(and(
        eq(businessTemplates.userId, userId),
        eq(businessTemplates.family, family),
        eq(businessTemplates.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async createBusinessTemplate(data: InsertBusinessTemplate): Promise<BusinessTemplate> {
    const [result] = await db.insert(businessTemplates).values(data).returning();
    return result;
  }

  async updateBusinessTemplate(id: string, userId: string, data: Partial<InsertBusinessTemplate>): Promise<BusinessTemplate | undefined> {
    const result = await db.update(businessTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(businessTemplates.id, id),
        eq(businessTemplates.userId, userId)
      ))
      .returning();
    return result[0];
  }

  async deleteBusinessTemplate(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(businessTemplates)
      .where(and(
        eq(businessTemplates.id, id),
        eq(businessTemplates.userId, userId),
        eq(businessTemplates.isDefault, false) // Can't delete system defaults
      ))
      .returning();
    return result.length > 0;
  }

  async setActiveBusinessTemplate(id: string, userId: string): Promise<void> {
    // First, get the template to find its family and purpose
    const template = await this.getBusinessTemplate(id, userId);
    if (!template) {
      throw new Error('Template not found');
    }

    const purpose = template.purpose || 'general';

    // Deactivate all templates in the same family AND purpose for this user
    // This allows multiple active templates per family, but only one per purpose
    await db.update(businessTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(businessTemplates.userId, userId),
        eq(businessTemplates.family, template.family),
        eq(businessTemplates.purpose, purpose)
      ));

    // Activate the selected template
    await db.update(businessTemplates)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(
        eq(businessTemplates.id, id),
        eq(businessTemplates.userId, userId)
      ));
  }

  async getActiveBusinessTemplateByPurpose(userId: string, family: string, purpose: string, tradeType?: string): Promise<BusinessTemplate | null> {
    // If tradeType is provided, try to find a template for that trade type first
    if (tradeType) {
      const [template] = await db.select()
        .from(businessTemplates)
        .where(and(
          eq(businessTemplates.userId, userId),
          eq(businessTemplates.family, family),
          eq(businessTemplates.purpose, purpose),
          eq(businessTemplates.tradeType, tradeType),
          eq(businessTemplates.isActive, true)
        ))
        .limit(1);
      
      if (template) return template;
      
      // Fallback to 'general' trade type if no trade-specific template found
      if (tradeType !== 'general') {
        const [fallbackTemplate] = await db.select()
          .from(businessTemplates)
          .where(and(
            eq(businessTemplates.userId, userId),
            eq(businessTemplates.family, family),
            eq(businessTemplates.purpose, purpose),
            eq(businessTemplates.tradeType, 'general'),
            eq(businessTemplates.isActive, true)
          ))
          .limit(1);
        
        if (fallbackTemplate) return fallbackTemplate;
      }
    }
    
    // Fallback: get any active template for this family+purpose (backward compatibility)
    const [template] = await db.select()
      .from(businessTemplates)
      .where(and(
        eq(businessTemplates.userId, userId),
        eq(businessTemplates.family, family),
        eq(businessTemplates.purpose, purpose),
        eq(businessTemplates.isActive, true)
      ))
      .limit(1);
    return template || null;
  }

  async seedDefaultBusinessTemplates(userId: string): Promise<BusinessTemplate[]> {
    // Check if user already has templates
    const existing = await this.getBusinessTemplates(userId);
    if (existing.length > 0) {
      return existing;
    }

    const defaultTemplates: InsertBusinessTemplate[] = [
      // Terms & Conditions - Australian standard
      {
        userId,
        family: 'terms_conditions',
        purpose: 'general',
        name: 'Standard Terms & Conditions',
        description: 'Australian-standard terms and conditions for quotes and invoices',
        isDefault: true,
        isActive: true,
        content: `1. ACCEPTANCE: This quote is valid for 30 days from the date of issue. Acceptance of this quote constitutes a binding agreement.

2. PAYMENT: A deposit of 50% may be required before work commences. Balance due on completion unless otherwise agreed.

3. VARIATIONS: Any variations to the quoted work must be agreed in writing and may result in additional charges.

4. MATERIALS: All materials remain the property of the contractor until full payment is received.

5. WARRANTY: All workmanship is guaranteed for 12 months from completion, unless otherwise specified.

6. ACCESS: The client must provide safe and reasonable access to the work site.

7. CANCELLATION: Cancellation after acceptance may incur costs for materials ordered or work commenced.`,
        mergeFields: ['business_name', 'quote_number', 'quote_date', 'validity_days', 'deposit_percent', 'warranty_months'],
        metadata: { validityDays: 30, depositPercent: 50, warrantyMonths: 12 },
      },
      // Warranty Template
      {
        userId,
        family: 'warranty',
        purpose: 'general',
        name: 'Standard Warranty',
        description: '12-month workmanship warranty statement',
        isDefault: true,
        isActive: true,
        content: `All work is guaranteed for 12 months from completion date.

This warranty covers defects in workmanship and materials supplied by us. Normal wear and tear, damage caused by misuse, or work carried out by others is not covered.

To make a warranty claim, please contact us with your original invoice number and a description of the issue.`,
        mergeFields: ['business_name', 'warranty_months', 'completion_date', 'invoice_number'],
        metadata: { warrantyMonths: 12 },
      },
      // Email Templates - Each with its specific purpose/trigger
      {
        userId,
        family: 'email',
        purpose: 'quote_sent',
        name: 'Quote Sent Email',
        description: 'Automatically used when sending quotes to clients',
        isDefault: true,
        isActive: true,
        subject: 'Quote #{quote_number} from {business_name}',
        content: `Hi {client_name},

Thank you for the opportunity to provide a quote for your project.

Please find attached your quote #{quote_number} for the requested work. The quote is valid for 30 days.

If you have any questions or would like to proceed, please reply to this email or call us.

Kind regards,
{business_name}`,
        mergeFields: ['client_name', 'business_name', 'quote_number', 'quote_total', 'job_title'],
        metadata: { category: 'quote' },
      },
      {
        userId,
        family: 'email',
        purpose: 'invoice_sent',
        name: 'Invoice Sent Email',
        description: 'Automatically used when sending invoices to clients',
        isDefault: true,
        isActive: true,
        subject: 'Invoice #{invoice_number} from {business_name}',
        content: `Hi {client_name},

Please find attached your invoice #{invoice_number} for the completed work.

Total Amount: ${'{invoice_total}'}
Due Date: {due_date}

Payment can be made via bank transfer or card. Details are included on the invoice.

Thank you for your business!

Kind regards,
{business_name}`,
        mergeFields: ['client_name', 'business_name', 'invoice_number', 'invoice_total', 'due_date', 'job_title'],
        metadata: { category: 'invoice' },
      },
      {
        userId,
        family: 'email',
        purpose: 'payment_reminder',
        name: 'Payment Reminder Email',
        description: 'Sent as a friendly reminder for overdue invoices',
        isDefault: true,
        isActive: true,
        subject: 'Payment Reminder - Invoice #{invoice_number}',
        content: `Hi {client_name},

This is a friendly reminder that invoice #{invoice_number} for ${'{invoice_total}'} is now overdue.

If you've already made payment, please disregard this message. Otherwise, we'd appreciate payment at your earliest convenience.

If you have any questions about the invoice, please don't hesitate to contact us.

Kind regards,
{business_name}`,
        mergeFields: ['client_name', 'business_name', 'invoice_number', 'invoice_total', 'due_date', 'days_overdue'],
        metadata: { category: 'payment' },
      },
      {
        userId,
        family: 'email',
        purpose: 'job_confirmation',
        name: 'Job Confirmation Email',
        description: 'Sent when a job is confirmed/scheduled',
        isDefault: true,
        isActive: true,
        subject: 'Job Confirmed - {job_title}',
        content: `Hi {client_name},

Great news! Your job has been confirmed and scheduled.

Job: {job_title}
Address: {job_address}
Date: {date}

We'll be in touch closer to the date to confirm the exact time.

Kind regards,
{business_name}`,
        mergeFields: ['client_name', 'business_name', 'job_title', 'job_address', 'date'],
        metadata: { category: 'job' },
      },
      {
        userId,
        family: 'email',
        purpose: 'job_completed',
        name: 'Job Completed Email',
        description: 'Sent when a job is marked as complete',
        isDefault: true,
        isActive: true,
        subject: 'Job Completed - {job_title}',
        content: `Hi {client_name},

Your job has been completed!

Job: {job_title}
Completed: {completion_date}

An invoice will be sent separately. Thank you for choosing {business_name}!

Kind regards,
{business_name}`,
        mergeFields: ['client_name', 'business_name', 'job_title', 'completion_date'],
        metadata: { category: 'job' },
      },
      // SMS Templates - Each with its specific purpose/trigger
      {
        userId,
        family: 'sms',
        purpose: 'sms_job_confirmation',
        name: 'On My Way SMS',
        description: 'Quick notification when heading to job site',
        isDefault: true,
        isActive: true,
        content: `Hi {client_name}, I'm on my way to your place now. Should be there in about 15-20 mins. - {business_name}`,
        mergeFields: ['client_name', 'business_name', 'job_address'],
        metadata: { category: 'job_update' },
      },
      {
        userId,
        family: 'sms',
        purpose: 'sms_quote_sent',
        name: 'Quote Sent SMS',
        description: 'SMS notification when a quote is sent',
        isDefault: true,
        isActive: true,
        content: `Hi {client_name}, your quote #{quote_number} for ${'{quote_total}'} has been emailed to you. Any questions, just reply! - {business_name}`,
        mergeFields: ['client_name', 'business_name', 'quote_number', 'quote_total'],
        metadata: { category: 'quote' },
      },
      {
        userId,
        family: 'sms',
        purpose: 'sms_invoice_sent',
        name: 'Invoice Sent SMS',
        description: 'SMS notification when an invoice is sent',
        isDefault: true,
        isActive: true,
        content: `Hi {client_name}, invoice #{invoice_number} for ${'{invoice_total}'} has been emailed. Due: {due_date}. Thanks! - {business_name}`,
        mergeFields: ['client_name', 'business_name', 'invoice_number', 'invoice_total', 'due_date'],
        metadata: { category: 'invoice' },
      },
      {
        userId,
        family: 'sms',
        purpose: 'sms_payment_reminder',
        name: 'Payment Reminder SMS',
        description: 'SMS reminder for overdue invoices',
        isDefault: true,
        isActive: true,
        content: `Hi {client_name}, friendly reminder that invoice #{invoice_number} for ${'{invoice_total}'} is now overdue. Please pay when you can. Thanks! - {business_name}`,
        mergeFields: ['client_name', 'business_name', 'invoice_number', 'invoice_total'],
        metadata: { category: 'payment' },
      },
      {
        userId,
        family: 'sms',
        purpose: 'sms_job_completed',
        name: 'Job Complete SMS',
        description: 'Notification when work is finished',
        isDefault: true,
        isActive: true,
        content: `Hi {client_name}, all done at your place! Invoice will be sent shortly. Thanks for choosing {business_name}!`,
        mergeFields: ['client_name', 'business_name', 'job_title'],
        metadata: { category: 'job_update' },
      },
      // Payment Notice Template
      {
        userId,
        family: 'payment_notice',
        purpose: 'general',
        name: 'Payment Due Notice',
        description: 'Notice for upcoming or overdue payments',
        isDefault: true,
        isActive: true,
        content: `PAYMENT NOTICE

Invoice: #{invoice_number}
Amount Due: {invoice_total}
Due Date: {due_date}

Please arrange payment at your earliest convenience. If you have any questions about this invoice, please contact us.

Bank Details:
{bank_details}

Thank you for your prompt attention to this matter.`,
        mergeFields: ['invoice_number', 'invoice_total', 'due_date', 'client_name', 'business_name', 'bank_details'],
        metadata: { category: 'payment' },
      },
      // Safety Form Template
      {
        userId,
        family: 'safety_form',
        purpose: 'general',
        name: 'Job Safety Analysis (JSA)',
        description: 'Standard workplace hazard assessment form',
        isDefault: true,
        isActive: true,
        content: 'Job Safety Analysis Form',
        sections: [
          { id: 'site_info', title: 'Site Information', type: 'text', fields: ['site_address', 'job_description', 'date', 'assessor'] },
          { id: 'hazards', title: 'Hazard Identification', type: 'checklist', items: ['Working at heights', 'Electrical hazards', 'Manual handling', 'Confined spaces', 'Hot work', 'Asbestos', 'Chemical exposure', 'Moving machinery'] },
          { id: 'controls', title: 'Control Measures', type: 'textarea', placeholder: 'Describe the control measures to be implemented...' },
          { id: 'ppe', title: 'PPE Required', type: 'checklist', items: ['Hard hat', 'Safety glasses', 'Hi-vis vest', 'Steel cap boots', 'Gloves', 'Hearing protection', 'Dust mask', 'Harness'] },
          { id: 'signature', title: 'Sign-off', type: 'signature', fields: ['worker_signature', 'supervisor_signature', 'date'] }
        ],
        mergeFields: ['job_title', 'job_address', 'client_name', 'worker_name', 'date'],
        metadata: { formType: 'jsa', requiresSignature: true },
      },
      // Checklist Templates - Multiple trade-specific job checklists
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Pre-Start Checklist',
        description: 'Daily equipment and site safety checklist',
        isDefault: true,
        isActive: true,
        content: 'Pre-Start Safety Checklist',
        sections: [
          { id: 'vehicle', title: 'Vehicle Check', items: ['Fuel level adequate', 'Tyres in good condition', 'Lights working', 'First aid kit present', 'Fire extinguisher checked'] },
          { id: 'tools', title: 'Tools & Equipment', items: ['Tools in good condition', 'Electrical leads tested', 'PPE available', 'Safety gear inspected'] },
          { id: 'site', title: 'Site Assessment', items: ['Access confirmed', 'Hazards identified', 'Client contacted', 'Work area safe'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'general' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Plumbing Job Checklist',
        description: 'Job completion checklist for plumbing work',
        isDefault: false,
        isActive: true,
        content: 'Plumbing Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Pre-Work', items: ['Water supply isolated', 'Drainage cleared', 'Area protected', 'Materials ready'] },
          { id: 'work', title: 'Work Completed', items: ['Pipework installed correctly', 'Joints sealed and tested', 'No leaks detected', 'Pressure test passed'] },
          { id: 'finish', title: 'Clean-up', items: ['Area cleaned', 'Debris removed', 'Client walkthrough completed', 'Photos taken'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'plumbing' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Plumbing Safety Checklist',
        description: 'WHS safety checklist for plumbing work',
        isDefault: false,
        isActive: true,
        content: 'Plumbing Safety Checklist',
        sections: [
          { id: 'ppe', title: 'PPE Requirements', items: ['Safety glasses worn', 'Gloves worn for chemicals', 'Steel cap boots worn', 'Hearing protection if using power tools'] },
          { id: 'hazards', title: 'Hazard Check', items: ['Hot water system isolated', 'Gas supply checked', 'Confined space assessed', 'Asbestos check completed'] },
          { id: 'tools', title: 'Tool Safety', items: ['Pipe cutter guards in place', 'Blowtorch area cleared', 'Electrical tools RCD tested', 'Lifting equipment rated'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'plumbing' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Electrical Job Checklist',
        description: 'Job completion checklist for electrical work',
        isDefault: false,
        isActive: true,
        content: 'Electrical Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Pre-Work', items: ['Power isolated and locked out', 'Circuits identified', 'Voltage tested', 'PPE worn'] },
          { id: 'work', title: 'Work Completed', items: ['Wiring installed to AS/NZS 3000', 'Connections secure', 'Insulation tested', 'Circuit breakers tested'] },
          { id: 'finish', title: 'Sign-off', items: ['Power restored safely', 'Certificate of compliance issued', 'Client briefed on work', 'Photos documented'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'electrical' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Electrical Safety Checklist',
        description: 'WHS safety checklist for electrical work',
        isDefault: false,
        isActive: true,
        content: 'Electrical Safety Checklist',
        sections: [
          { id: 'isolation', title: 'Isolation Procedures', items: ['Lockout/tagout applied', 'Voltage tested at point of work', 'Adjacent circuits identified', 'Rescue equipment nearby'] },
          { id: 'ppe', title: 'PPE Requirements', items: ['Insulated gloves worn', 'Safety glasses worn', 'Non-conductive footwear', 'Arc flash protection if required'] },
          { id: 'tools', title: 'Tool Safety', items: ['Insulated tools used', 'Test equipment calibrated', 'Leads in good condition', 'RCD protection on power tools'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'electrical' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Carpentry Job Checklist',
        description: 'Job completion checklist for carpentry work',
        isDefault: false,
        isActive: true,
        content: 'Carpentry Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Preparation', items: ['Measurements confirmed', 'Materials checked for quality', 'Work area cleared', 'Safety barriers in place'] },
          { id: 'work', title: 'Work Completed', items: ['Cuts accurate and clean', 'Joints secure and aligned', 'Fixings appropriate', 'Finish sanded smooth'] },
          { id: 'finish', title: 'Final Checks', items: ['All edges safe', 'Dust and debris removed', 'Client approved finish', 'Photos taken'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'carpentry' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Carpentry Safety Checklist',
        description: 'WHS safety checklist for carpentry work',
        isDefault: false,
        isActive: true,
        content: 'Carpentry Safety Checklist',
        sections: [
          { id: 'ppe', title: 'PPE Requirements', items: ['Safety glasses worn', 'Hearing protection worn', 'Dust mask worn', 'Steel cap boots worn'] },
          { id: 'tools', title: 'Tool Safety', items: ['Saw guards in place', 'Blades sharp and undamaged', 'Power leads in good condition', 'Dust extraction connected'] },
          { id: 'site', title: 'Site Safety', items: ['Work area barricaded', 'Trip hazards removed', 'Ventilation adequate', 'Fire extinguisher nearby'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'carpentry' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Roofing Job Checklist',
        description: 'Job completion checklist for roofing work',
        isDefault: false,
        isActive: true,
        content: 'Roofing Job Completion Checklist',
        sections: [
          { id: 'safety', title: 'Safety Setup', items: ['Edge protection installed', 'Harness and anchor points checked', 'Weather conditions safe', 'Area below secured'] },
          { id: 'work', title: 'Work Completed', items: ['Roof sheets/tiles secured', 'Flashings installed correctly', 'Gutters and downpipes connected', 'No visible gaps or damage'] },
          { id: 'finish', title: 'Final Inspection', items: ['Roof watertight', 'All debris cleared', 'Ground area cleaned', 'Client walkthrough done'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'roofing' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Roofing Safety Checklist',
        description: 'WHS safety checklist for roofing work',
        isDefault: false,
        isActive: true,
        content: 'Roofing Safety Checklist',
        sections: [
          { id: 'heights', title: 'Working at Heights', items: ['Edge protection installed', 'Harness fitted correctly', 'Anchor points rated and secure', 'Rescue plan in place'] },
          { id: 'ppe', title: 'PPE Requirements', items: ['Hard hat worn', 'Non-slip footwear worn', 'Hi-vis vest worn', 'Gloves worn for handling materials'] },
          { id: 'conditions', title: 'Conditions Check', items: ['Weather suitable for work', 'Roof surface not wet/slippery', 'Wind speed acceptable', 'No electrical hazards nearby'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'roofing' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Painting Job Checklist',
        description: 'Job completion checklist for painting work',
        isDefault: false,
        isActive: true,
        content: 'Painting Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Surface Prep', items: ['Surfaces cleaned', 'Cracks and holes filled', 'Sanding completed', 'Masking applied'] },
          { id: 'work', title: 'Painting Completed', items: ['Primer applied where needed', 'Coats applied evenly', 'No drips or runs', 'Colour matches specification'] },
          { id: 'finish', title: 'Clean-up', items: ['Masking removed', 'Touch-ups completed', 'Area cleaned', 'Client approved colours'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'painting' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Painting Safety Checklist',
        description: 'WHS safety checklist for painting work',
        isDefault: false,
        isActive: true,
        content: 'Painting Safety Checklist',
        sections: [
          { id: 'ventilation', title: 'Ventilation', items: ['Adequate ventilation provided', 'Windows/doors open', 'Extraction fan if required', 'Fresh air breaks scheduled'] },
          { id: 'ppe', title: 'PPE Requirements', items: ['Respirator/mask worn', 'Safety glasses worn', 'Protective clothing worn', 'Gloves worn'] },
          { id: 'heights', title: 'Working at Heights', items: ['Ladder in good condition', 'Scaffold properly assembled', 'Fall protection if over 2m', 'Area below clear'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'painting' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'HVAC Job Checklist',
        description: 'Job completion checklist for HVAC work',
        isDefault: false,
        isActive: true,
        content: 'HVAC Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Pre-Installation', items: ['Power isolated', 'Refrigerant lines prepared', 'Mounting locations confirmed', 'Condensate drain planned'] },
          { id: 'work', title: 'Installation Completed', items: ['Unit mounted securely', 'Piping connected and leak-tested', 'Electrical connections safe', 'Thermostat programmed'] },
          { id: 'test', title: 'Testing', items: ['Cooling mode tested', 'Heating mode tested', 'Airflow adequate', 'No unusual noises'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'hvac' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'HVAC Safety Checklist',
        description: 'WHS safety checklist for HVAC work',
        isDefault: false,
        isActive: true,
        content: 'HVAC Safety Checklist',
        sections: [
          { id: 'refrigerant', title: 'Refrigerant Handling', items: ['Refrigerant recovery equipment ready', 'Leak detector calibrated', 'Proper ventilation ensured', 'Refrigerant licence current'] },
          { id: 'electrical', title: 'Electrical Safety', items: ['Power isolated before work', 'Lockout/tagout applied', 'Voltage tested', 'Correct fuse ratings used'] },
          { id: 'ppe', title: 'PPE Requirements', items: ['Safety glasses worn', 'Gloves worn for refrigerant', 'Hearing protection if needed', 'Steel cap boots worn'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'hvac' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Tiling Job Checklist',
        description: 'Job completion checklist for tiling work',
        isDefault: false,
        isActive: true,
        content: 'Tiling Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Substrate Prep', items: ['Surface level and clean', 'Waterproofing applied if required', 'Layout planned', 'Tiles sorted for consistency'] },
          { id: 'work', title: 'Tiling Completed', items: ['Tiles level and aligned', 'Grout lines consistent', 'No lippage between tiles', 'Cuts neat and clean'] },
          { id: 'finish', title: 'Finishing', items: ['Grout applied and cleaned', 'Silicone applied to corners', 'Excess adhesive removed', 'Final clean completed'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'tiling' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Tiling Safety Checklist',
        description: 'WHS safety checklist for tiling work',
        isDefault: false,
        isActive: true,
        content: 'Tiling Safety Checklist',
        sections: [
          { id: 'ppe', title: 'PPE Requirements', items: ['Knee pads worn', 'Safety glasses worn', 'Dust mask worn when cutting', 'Gloves worn for adhesives/grout'] },
          { id: 'cutting', title: 'Tile Cutting Safety', items: ['Wet saw water supply adequate', 'Blade guard in place', 'Cutting area clear', 'Eye and ear protection'] },
          { id: 'chemicals', title: 'Chemical Safety', items: ['Adhesive SDS available', 'Grout handling precautions', 'Ventilation adequate', 'Clean water for washing'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'tiling' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Landscaping Job Checklist',
        description: 'Job completion checklist for landscaping work',
        isDefault: false,
        isActive: true,
        content: 'Landscaping Job Completion Checklist',
        sections: [
          { id: 'prep', title: 'Site Prep', items: ['Area cleared', 'Soil prepared', 'Drainage considered', 'Materials on site'] },
          { id: 'work', title: 'Work Completed', items: ['Plants installed correctly', 'Hardscaping level', 'Irrigation connected', 'Mulch applied'] },
          { id: 'finish', title: 'Clean-up', items: ['Debris removed', 'Watering completed', 'Care instructions provided', 'Photos taken'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'landscaping' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Landscaping Safety Checklist',
        description: 'WHS safety checklist for landscaping work',
        isDefault: false,
        isActive: true,
        content: 'Landscaping Safety Checklist',
        sections: [
          { id: 'equipment', title: 'Equipment Safety', items: ['Mower guards in place', 'Chainsaw chain tension correct', 'Fuel stored safely', 'Equipment serviced'] },
          { id: 'ppe', title: 'PPE Requirements', items: ['Safety glasses/face shield worn', 'Hearing protection worn', 'Steel cap boots worn', 'Gloves worn'] },
          { id: 'site', title: 'Site Safety', items: ['Underground services located', 'Work area barricaded', 'Sun protection used', 'Hydration available'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'landscaping' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'General Job Completion Checklist',
        description: 'Universal job completion checklist',
        isDefault: false,
        isActive: true,
        content: 'General Job Completion Checklist',
        sections: [
          { id: 'work', title: 'Work Completed', items: ['All tasks from quote completed', 'Work meets quality standards', 'Any variations documented', 'Materials used as specified'] },
          { id: 'safety', title: 'Safety & Clean-up', items: ['Work area left safe', 'All debris removed', 'Tools and equipment removed', 'Area cleaned'] },
          { id: 'client', title: 'Client Sign-off', items: ['Client walked through work', 'Client satisfied with result', 'Any issues addressed', 'Photos documented'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'general' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'End of Day Checklist',
        description: 'Daily wrap-up and site security checklist',
        isDefault: false,
        isActive: true,
        content: 'End of Day Checklist',
        sections: [
          { id: 'site', title: 'Site Security', items: ['Tools secured', 'Materials stored safely', 'Hazards marked', 'Site locked if required'] },
          { id: 'admin', title: 'Administration', items: ['Hours logged', 'Progress photos taken', 'Client updated if needed', 'Next day materials ordered'] },
          { id: 'vehicle', title: 'Vehicle', items: ['Tools loaded', 'Vehicle cleaned out', 'Fuel checked', 'Equipment accounted for'] }
        ],
        mergeFields: ['job_title', 'job_address', 'date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'general' },
      },
      {
        userId,
        family: 'checklist',
        purpose: 'general',
        name: 'Tool & Equipment Checklist',
        description: 'Inventory checklist for tools and equipment',
        isDefault: false,
        isActive: true,
        content: 'Tool & Equipment Checklist',
        sections: [
          { id: 'power', title: 'Power Tools', items: ['Drill/Driver', 'Circular saw', 'Angle grinder', 'Jigsaw', 'Multi-tool'] },
          { id: 'hand', title: 'Hand Tools', items: ['Hammer', 'Screwdrivers', 'Pliers', 'Tape measure', 'Level', 'Square'] },
          { id: 'safety', title: 'Safety Equipment', items: ['First aid kit', 'Fire extinguisher', 'Safety glasses', 'Gloves', 'Hard hat'] }
        ],
        mergeFields: ['date', 'worker_name'],
        metadata: { formType: 'checklist', tradeType: 'general' },
      },
    ];

    // Get user's trade type from their profile
    const user = await this.getUser(userId);
    const userTradeType = user?.tradeType?.toLowerCase() || 'general';
    
    // Filter checklists: keep general ones + trade-specific for user's trade
    const filteredTemplates = defaultTemplates.filter(template => {
      // Always include non-checklist templates (email, sms, terms, warranty, safety_form)
      if (template.family !== 'checklist') return true;
      
      // For checklists, check the tradeType in metadata
      const templateTradeType = (template.metadata as any)?.tradeType?.toLowerCase() || 'general';
      
      // Keep general checklists (Pre-Start, End of Day, Tool & Equipment, General Job Completion)
      if (templateTradeType === 'general') return true;
      
      // Keep trade-specific checklists only if they match the user's trade
      return templateTradeType === userTradeType;
    });

    const created: BusinessTemplate[] = [];
    for (const template of filteredTemplates) {
      const result = await this.createBusinessTemplate(template);
      created.push(result);
    }
    return created;
  }

  async seedBusinessTemplatesForUser(userId: string, tradeType: string): Promise<DocumentTemplate[]> {
    // This method seeds trade-specific document templates (quotes, invoices, jobs)
    // from tradieQuoteTemplates for the user's specific trade type
    const normalizedTradeType = tradeType.toLowerCase();
    
    // Get existing templates to avoid duplicates
    const existingTemplates = await this.getDocumentTemplates(userId);
    const existingFamilyKeys = new Set(existingTemplates.map(t => t.familyKey));
    
    // Filter tradieQuoteTemplates for this trade type and general templates
    const tradeTemplates = tradieQuoteTemplates.filter(template => {
      const templateTradeType = template.tradeType?.toLowerCase() || 'general';
      // Skip if already exists
      if (existingFamilyKeys.has(template.familyKey)) return false;
      // Include trade-specific templates for user's trade
      if (templateTradeType === normalizedTradeType) return true;
      // Include general templates only if no templates exist yet
      if (templateTradeType === 'general' && existingTemplates.length === 0) return true;
      return false;
    });

    const createdTemplates: DocumentTemplate[] = [];
    for (const template of tradeTemplates) {
      try {
        const created = await this.createDocumentTemplate({
          userId,
          type: template.type,
          familyKey: template.familyKey,
          name: template.name,
          tradeType: template.tradeType,
          styling: template.styling,
          sections: template.sections,
          defaults: template.defaults,
          defaultLineItems: template.defaultLineItems,
          isDefault: false,
        });
        createdTemplates.push(created);
      } catch (error) {
        console.error(`Error creating template ${template.familyKey}:`, error);
      }
    }

    console.log(`[Templates] Seeded ${createdTemplates.length} trade-specific templates for ${tradeType}`);
    return createdTemplates;
  }

  async getBusinessTemplateFamilies(userId: string): Promise<{ family: string; name: string; description: string; count: number; hasActive: boolean }[]> {
    const familyMeta: Record<string, { name: string; description: string; category: string }> = {
      terms_conditions: { name: 'Terms & Conditions', description: 'Quote and invoice terms', category: 'Financial' },
      warranty: { name: 'Warranty', description: 'Warranty statements', category: 'Financial' },
      email: { name: 'Email Templates', description: 'Email communication templates', category: 'Communications' },
      sms: { name: 'SMS Templates', description: 'Text message templates', category: 'Communications' },
      safety_form: { name: 'Safety Forms', description: 'WHS compliance forms', category: 'Jobs & Safety' },
      checklist: { name: 'Checklists', description: 'Job and safety checklists', category: 'Jobs & Safety' },
      payment_notice: { name: 'Payment Notices', description: 'Payment reminder templates', category: 'Financial' },
    };

    const templates = await this.getBusinessTemplates(userId);
    
    const familyCounts: Record<string, { count: number; hasActive: boolean }> = {};
    for (const t of templates) {
      if (!familyCounts[t.family]) {
        familyCounts[t.family] = { count: 0, hasActive: false };
      }
      familyCounts[t.family].count++;
      if (t.isActive) {
        familyCounts[t.family].hasActive = true;
      }
    }

    return Object.entries(familyMeta).map(([family, meta]) => ({
      family,
      name: meta.name,
      description: meta.description,
      count: familyCounts[family]?.count || 0,
      hasActive: familyCounts[family]?.hasActive || false,
    }));
  }

  // Account Deletion (Apple App Store Compliance)
  // Cascades deletion through all user's data
  async deleteUserAccount(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }> {
    const deletedCounts: Record<string, number> = {};
    
    try {
      const countTables = async () => {
        const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.userId, userId));
        const [jobCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.userId, userId));
        const [quoteCount] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.userId, userId));
        const [invoiceCount] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.userId, userId));
        return {
          clients: Number(clientCount?.count || 0),
          jobs: Number(jobCount?.count || 0),
          quotes: Number(quoteCount?.count || 0),
          invoices: Number(invoiceCount?.count || 0),
        };
      };
      
      const counts = await countTables();
      Object.assign(deletedCounts, counts);
      
      const userResult = await db.delete(users)
        .where(eq(users.id, userId))
        .returning();
      deletedCounts.users = userResult.length;
      
      return { success: true, deletedCounts };
    } catch (error) {
      console.error('Error deleting user account:', error);
      return { success: false, deletedCounts };
    }
  }

  // Team Presence
  async getTeamPresence(businessOwnerId: string): Promise<TeamPresence[]> {
    const result = await db
      .select()
      .from(teamPresence)
      .where(eq(teamPresence.businessOwnerId, businessOwnerId))
      .orderBy(desc(teamPresence.lastSeenAt));
    return result;
  }

  async getPresenceByUserId(userId: string): Promise<TeamPresence | undefined> {
    const result = await db
      .select()
      .from(teamPresence)
      .where(eq(teamPresence.userId, userId))
      .limit(1);
    return result[0];
  }

  async updatePresence(userId: string, businessOwnerId: string, data: Partial<InsertTeamPresence>): Promise<TeamPresence> {
    const existing = await this.getPresenceByUserId(userId);
    
    if (existing) {
      const [updated] = await db
        .update(teamPresence)
        .set({
          ...data,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(teamPresence.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(teamPresence)
        .values({
          id: randomUUID(),
          userId,
          businessOwnerId,
          status: data.status || 'online',
          statusMessage: data.statusMessage,
          currentJobId: data.currentJobId,
          lastSeenAt: new Date(),
          lastLocationLat: data.lastLocationLat,
          lastLocationLng: data.lastLocationLng,
          lastLocationUpdatedAt: data.lastLocationLat && data.lastLocationLng ? new Date() : null,
        })
        .returning();
      return created;
    }
  }

  async markOffline(userId: string): Promise<void> {
    await db
      .update(teamPresence)
      .set({
        status: 'offline',
        updatedAt: new Date(),
      })
      .where(eq(teamPresence.userId, userId));
  }

  // Activity Feed
  async getActivityFeed(businessOwnerId: string, limit: number = 50, before?: Date): Promise<ActivityFeed[]> {
    let query = db
      .select()
      .from(activityFeed)
      .where(eq(activityFeed.businessOwnerId, businessOwnerId));
    
    if (before) {
      query = db
        .select()
        .from(activityFeed)
        .where(and(
          eq(activityFeed.businessOwnerId, businessOwnerId),
          lt(activityFeed.createdAt, before)
        ));
    }
    
    const result = await query
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit);
    return result;
  }

  async createActivity(activity: InsertActivityFeed): Promise<ActivityFeed> {
    const [created] = await db
      .insert(activityFeed)
      .values({
        id: randomUUID(),
        ...activity,
      })
      .returning();
    return created;
  }

  async markActivityRead(id: string, businessOwnerId: string): Promise<ActivityFeed | undefined> {
    const [updated] = await db
      .update(activityFeed)
      .set({ isRead: true })
      .where(and(
        eq(activityFeed.id, id),
        eq(activityFeed.businessOwnerId, businessOwnerId)
      ))
      .returning();
    return updated;
  }

  async markAllActivitiesRead(businessOwnerId: string): Promise<number> {
    const result = await db
      .update(activityFeed)
      .set({ isRead: true })
      .where(and(
        eq(activityFeed.businessOwnerId, businessOwnerId),
        eq(activityFeed.isRead, false)
      ));
    return result.rowCount || 0;
  }

  // Automation Settings
  async getAutomationSettings(userId: string): Promise<AutomationSettings | undefined> {
    const [settings] = await db
      .select()
      .from(automationSettings)
      .where(eq(automationSettings.userId, userId));
    return settings;
  }

  async createAutomationSettings(data: InsertAutomationSettings): Promise<AutomationSettings> {
    const [created] = await db
      .insert(automationSettings)
      .values({
        id: randomUUID(),
        ...data,
      })
      .returning();
    return created;
  }

  async updateAutomationSettings(userId: string, updates: Partial<AutomationSettings>): Promise<AutomationSettings | undefined> {
    const [updated] = await db
      .update(automationSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(automationSettings.userId, userId))
      .returning();
    return updated;
  }

  async upsertAutomationSettings(userId: string, data: Partial<InsertAutomationSettings>): Promise<AutomationSettings> {
    const existing = await this.getAutomationSettings(userId);
    if (existing) {
      return (await this.updateAutomationSettings(userId, data))!;
    }
    return this.createAutomationSettings({ userId, ...data } as InsertAutomationSettings);
  }

  // Job Reminders
  async createJobReminder(data: InsertJobReminder): Promise<JobReminder> {
    const [created] = await db
      .insert(jobReminders)
      .values({
        id: randomUUID(),
        ...data,
      })
      .returning();
    return created;
  }

  async getJobReminders(jobId: string): Promise<JobReminder[]> {
    return db
      .select()
      .from(jobReminders)
      .where(eq(jobReminders.jobId, jobId))
      .orderBy(desc(jobReminders.createdAt));
  }

  async getPendingJobReminders(): Promise<JobReminder[]> {
    const now = new Date();
    return db
      .select()
      .from(jobReminders)
      .where(and(
        eq(jobReminders.status, 'pending'),
        lte(jobReminders.sendAt, now)
      ))
      .orderBy(asc(jobReminders.sendAt));
  }

  async updateJobReminder(id: string, updates: Partial<JobReminder>): Promise<JobReminder | undefined> {
    const [updated] = await db
      .update(jobReminders)
      .set(updates)
      .where(eq(jobReminders.id, id))
      .returning();
    return updated;
  }

  async cancelJobReminders(jobId: string): Promise<void> {
    await db
      .update(jobReminders)
      .set({ status: 'cancelled' })
      .where(and(
        eq(jobReminders.jobId, jobId),
        eq(jobReminders.status, 'pending')
      ));
  }

  // Job Photo Requirements
  async createJobPhotoRequirement(data: InsertJobPhotoRequirement): Promise<JobPhotoRequirement> {
    const [created] = await db
      .insert(jobPhotoRequirements)
      .values({
        id: randomUUID(),
        ...data,
      })
      .returning();
    return created;
  }

  async getJobPhotoRequirements(jobId: string): Promise<JobPhotoRequirement[]> {
    return db
      .select()
      .from(jobPhotoRequirements)
      .where(eq(jobPhotoRequirements.jobId, jobId))
      .orderBy(asc(jobPhotoRequirements.stage));
  }

  async updateJobPhotoRequirement(id: string, updates: Partial<JobPhotoRequirement>): Promise<JobPhotoRequirement | undefined> {
    const [updated] = await db
      .update(jobPhotoRequirements)
      .set(updates)
      .where(eq(jobPhotoRequirements.id, id))
      .returning();
    return updated;
  }

  async fulfillPhotoRequirement(id: string, photoUrl: string): Promise<JobPhotoRequirement | undefined> {
    return this.updateJobPhotoRequirement(id, {
      isFulfilled: true,
      fulfilledAt: new Date(),
      photoUrl,
    });
  }

  // Defects
  async createDefect(data: InsertDefect): Promise<Defect> {
    const [created] = await db
      .insert(defects)
      .values({
        id: randomUUID(),
        ...data,
      })
      .returning();
    return created;
  }

  async getDefects(userId: string, filters?: { jobId?: string; status?: string; severity?: string }): Promise<Defect[]> {
    let conditions = [eq(defects.userId, userId)];
    
    if (filters?.jobId) {
      conditions.push(eq(defects.jobId, filters.jobId));
    }
    if (filters?.status) {
      conditions.push(eq(defects.status, filters.status));
    }
    if (filters?.severity) {
      conditions.push(eq(defects.severity, filters.severity));
    }
    
    return db
      .select()
      .from(defects)
      .where(and(...conditions))
      .orderBy(desc(defects.createdAt));
  }

  async getDefect(id: string, userId: string): Promise<Defect | undefined> {
    const [defect] = await db
      .select()
      .from(defects)
      .where(and(
        eq(defects.id, id),
        eq(defects.userId, userId)
      ));
    return defect;
  }

  async updateDefect(id: string, userId: string, updates: Partial<Defect>): Promise<Defect | undefined> {
    const [updated] = await db
      .update(defects)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(defects.id, id),
        eq(defects.userId, userId)
      ))
      .returning();
    return updated;
  }

  async acknowledgeDefect(id: string, userId: string): Promise<Defect | undefined> {
    return this.updateDefect(id, userId, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
    });
  }

  async resolveDefect(id: string, userId: string, resolutionNotes?: string): Promise<Defect | undefined> {
    return this.updateDefect(id, userId, {
      status: 'resolved',
      resolvedAt: new Date(),
      resolutionNotes,
    });
  }

  async closeDefect(id: string, userId: string): Promise<Defect | undefined> {
    return this.updateDefect(id, userId, {
      status: 'closed',
      closedAt: new Date(),
    });
  }

  // Timesheet Approvals
  async createTimesheetApproval(data: InsertTimesheetApproval): Promise<TimesheetApproval> {
    const [created] = await db
      .insert(timesheetApprovals)
      .values({
        id: randomUUID(),
        ...data,
      })
      .returning();
    return created;
  }

  async getPendingTimesheetApprovals(businessOwnerId: string): Promise<TimesheetApproval[]> {
    // Get team members for this business owner
    const members = await db
      .select({ memberId: teamMembers.memberId })
      .from(teamMembers)
      .where(eq(teamMembers.businessOwnerId, businessOwnerId));
    
    // memberId is nullable (pending invites have no user yet) — drop nulls so
    // the resulting array is string[] for the inArray() filter below.
    const memberIds = members
      .map(m => m.memberId)
      .filter((id): id is string => id !== null);
    
    // Include the business owner themselves plus all their team members
    const allUserIds = [businessOwnerId, ...memberIds];
    
    if (allUserIds.length === 0) {
      return [];
    }
    
    return db
      .select()
      .from(timesheetApprovals)
      .where(and(
        eq(timesheetApprovals.status, 'pending'),
        inArray(timesheetApprovals.submittedBy, allUserIds)
      ))
      .orderBy(asc(timesheetApprovals.submittedAt));
  }

  async getTimesheetApproval(id: string): Promise<TimesheetApproval | undefined> {
    const [approval] = await db
      .select()
      .from(timesheetApprovals)
      .where(eq(timesheetApprovals.id, id));
    return approval;
  }

  async approveTimesheet(id: string, approverId: string, notes?: string): Promise<TimesheetApproval | undefined> {
    const [updated] = await db
      .update(timesheetApprovals)
      .set({
        status: 'approved',
        approvedBy: approverId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      })
      .where(eq(timesheetApprovals.id, id))
      .returning();
    return updated;
  }

  async rejectTimesheet(id: string, approverId: string, notes: string): Promise<TimesheetApproval | undefined> {
    const [updated] = await db
      .update(timesheetApprovals)
      .set({
        status: 'rejected',
        approvedBy: approverId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      })
      .where(eq(timesheetApprovals.id, id))
      .returning();
    return updated;
  }

  async requestTimesheetRevision(id: string, approverId: string, notes: string): Promise<TimesheetApproval | undefined> {
    const [updated] = await db
      .update(timesheetApprovals)
      .set({
        status: 'revision_requested',
        approvedBy: approverId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      })
      .where(eq(timesheetApprovals.id, id))
      .returning();
    return updated;
  }

  // Recurring Contracts
  async getRecurringContracts(userId: string): Promise<RecurringContract[]> {
    return db
      .select()
      .from(recurringContracts)
      .where(eq(recurringContracts.userId, userId))
      .orderBy(desc(recurringContracts.createdAt));
  }

  async getRecurringContract(id: string, userId: string): Promise<RecurringContract | undefined> {
    const [contract] = await db
      .select()
      .from(recurringContracts)
      .where(and(
        eq(recurringContracts.id, id),
        eq(recurringContracts.userId, userId)
      ));
    return contract;
  }

  async createRecurringContract(contract: InsertRecurringContract & { userId: string }): Promise<RecurringContract> {
    const [created] = await db
      .insert(recurringContracts)
      .values({
        id: randomUUID(),
        ...contract,
      })
      .returning();
    return created;
  }

  async updateRecurringContract(id: string, userId: string, updates: Partial<InsertRecurringContract>): Promise<RecurringContract | undefined> {
    const [updated] = await db
      .update(recurringContracts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(recurringContracts.id, id),
        eq(recurringContracts.userId, userId)
      ))
      .returning();
    return updated;
  }

  async deleteRecurringContract(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(recurringContracts)
      .where(and(
        eq(recurringContracts.id, id),
        eq(recurringContracts.userId, userId)
      ));
    return true;
  }

  async getRecurringSchedules(contractId: string): Promise<RecurringSchedule[]> {
    return db
      .select()
      .from(recurringSchedules)
      .where(eq(recurringSchedules.contractId, contractId))
      .orderBy(desc(recurringSchedules.scheduledDate));
  }

  async createRecurringSchedule(schedule: InsertRecurringSchedule): Promise<RecurringSchedule> {
    const [created] = await db
      .insert(recurringSchedules)
      .values({
        id: randomUUID(),
        ...schedule,
      })
      .returning();
    return created;
  }

  // Leads / CRM Pipeline
  async getLeadsByUserAndPhone(userId: string, phone: string): Promise<Lead[]> {
    return db.select().from(leads).where(and(eq(leads.userId, userId), eq(leads.phone, phone))).orderBy(desc(leads.createdAt));
  }

  async getLeads(userId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string, userId: string): Promise<Lead | undefined> {
    const result = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createLead(lead: InsertLead & { userId: string }): Promise<Lead> {
    const [created] = await db
      .insert(leads)
      .values({
        id: randomUUID(),
        ...lead,
      })
      .returning();
    return created;
  }

  async updateLead(id: string, userId: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db
      .update(leads)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning();
    return updated;
  }

  async deleteLead(id: string, userId: string): Promise<boolean> {
    await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return true;
  }

  async getAiReceptionistConfig(userId: string): Promise<AiReceptionistConfig | undefined> {
    const result = await db
      .select()
      .from(aiReceptionistConfig)
      .where(eq(aiReceptionistConfig.userId, userId))
      .limit(1);
    return result[0];
  }

  async getAiReceptionistConfigById(configId: string): Promise<AiReceptionistConfig | undefined> {
    const result = await db
      .select()
      .from(aiReceptionistConfig)
      .where(eq(aiReceptionistConfig.id, configId))
      .limit(1);
    return result[0];
  }

  async getAiReceptionistConfigsByUser(userId: string): Promise<AiReceptionistConfig[]> {
    return db
      .select()
      .from(aiReceptionistConfig)
      .where(eq(aiReceptionistConfig.userId, userId))
      .orderBy(aiReceptionistConfig.createdAt);
  }

  async getAiReceptionistConfigByPhone(phoneNumber: string): Promise<AiReceptionistConfig | undefined> {
    const result = await db
      .select()
      .from(aiReceptionistConfig)
      .where(eq(aiReceptionistConfig.dedicatedPhoneNumber, phoneNumber))
      .limit(1);
    return result[0];
  }

  async getAllAiReceptionistConfigs(): Promise<AiReceptionistConfig[]> {
    return db.select().from(aiReceptionistConfig);
  }

  async createAiReceptionistConfig(config: InsertAiReceptionistConfig): Promise<AiReceptionistConfig> {
    const [created] = await db
      .insert(aiReceptionistConfig)
      .values({ id: randomUUID(), ...config })
      .returning();
    return created;
  }

  async updateAiReceptionistConfig(userId: string, updates: Partial<InsertAiReceptionistConfig>): Promise<AiReceptionistConfig | undefined> {
    const [updated] = await db
      .update(aiReceptionistConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiReceptionistConfig.userId, userId))
      .returning();
    return updated;
  }

  async updateAiReceptionistConfigById(configId: string, updates: Partial<InsertAiReceptionistConfig>): Promise<AiReceptionistConfig | undefined> {
    const [updated] = await db
      .update(aiReceptionistConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiReceptionistConfig.id, configId))
      .returning();
    return updated;
  }

  async getActiveAddonSubscription(userId: string, addon: string): Promise<AddonSubscription | undefined> {
    const result = await db
      .select()
      .from(addonSubscriptions)
      .where(and(
        eq(addonSubscriptions.userId, userId),
        eq(addonSubscriptions.addon, addon),
        eq(addonSubscriptions.status, 'active'),
      ))
      .limit(1);
    return result[0];
  }

  async getAddonSubscriptionByAppleTxn(originalTransactionId: string): Promise<AddonSubscription | undefined> {
    const result = await db
      .select()
      .from(addonSubscriptions)
      .where(eq(addonSubscriptions.appleOriginalTransactionId, originalTransactionId))
      .limit(1);
    return result[0];
  }

  // Insert-or-update an add-on subscription keyed by (userId, addon).
  // Used by both the Apple IAP verify path and the Apple Server Notification webhook.
  async upsertAddonSubscription(userId: string, addon: string, updates: Partial<InsertAddonSubscription>): Promise<AddonSubscription> {
    const existing = await db
      .select()
      .from(addonSubscriptions)
      .where(and(eq(addonSubscriptions.userId, userId), eq(addonSubscriptions.addon, addon)))
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(addonSubscriptions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(addonSubscriptions.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(addonSubscriptions)
      .values({ id: randomUUID(), userId, addon, ...updates })
      .returning();
    return created;
  }

  async updateAddonSubscriptionStatus(id: string, status: string): Promise<void> {
    await db
      .update(addonSubscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(addonSubscriptions.id, id));
  }

  async getAiReceptionistCalls(userId: string, limit: number = 50, phoneNumberId?: string): Promise<AiReceptionistCall[]> {
    const conditions = [eq(aiReceptionistCalls.userId, userId)];
    if (phoneNumberId) {
      conditions.push(eq(aiReceptionistCalls.phoneNumberId, phoneNumberId));
    }
    return db
      .select()
      .from(aiReceptionistCalls)
      .where(and(...conditions))
      .orderBy(desc(aiReceptionistCalls.createdAt))
      .limit(limit);
  }

  async getAiReceptionistCall(id: string, userId: string): Promise<AiReceptionistCall | undefined> {
    const result = await db
      .select()
      .from(aiReceptionistCalls)
      .where(and(eq(aiReceptionistCalls.id, id), eq(aiReceptionistCalls.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getAiReceptionistCallByVapiId(vapiCallId: string): Promise<AiReceptionistCall | undefined> {
    const result = await db
      .select()
      .from(aiReceptionistCalls)
      .where(eq(aiReceptionistCalls.vapiCallId, vapiCallId))
      .limit(1);
    return result[0];
  }

  async createAiReceptionistCall(call: InsertAiReceptionistCall): Promise<AiReceptionistCall> {
    const [created] = await db
      .insert(aiReceptionistCalls)
      .values({ id: randomUUID(), ...call })
      .returning();
    return created;
  }

  async updateAiReceptionistCall(id: string, userId: string, updates: Partial<InsertAiReceptionistCall>): Promise<AiReceptionistCall | undefined> {
    const [updated] = await db
      .update(aiReceptionistCalls)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(aiReceptionistCalls.id, id), eq(aiReceptionistCalls.userId, userId)))
      .returning();
    return updated;
  }

  // Voice Change Requests
  async getVoiceChangeRequests(userId: string): Promise<VoiceChangeRequest[]> {
    return db
      .select()
      .from(voiceChangeRequests)
      .where(eq(voiceChangeRequests.userId, userId))
      .orderBy(desc(voiceChangeRequests.createdAt));
  }

  async getAllVoiceChangeRequests(): Promise<VoiceChangeRequest[]> {
    return db
      .select()
      .from(voiceChangeRequests)
      .orderBy(desc(voiceChangeRequests.createdAt));
  }

  async createVoiceChangeRequest(request: InsertVoiceChangeRequest): Promise<VoiceChangeRequest> {
    const [created] = await db
      .insert(voiceChangeRequests)
      .values({ id: randomUUID(), ...request })
      .returning();
    return created;
  }

  async updateVoiceChangeRequest(id: string, updates: Partial<InsertVoiceChangeRequest>): Promise<VoiceChangeRequest | undefined> {
    const setPayload: Record<string, unknown> = {};
    if (updates.status !== undefined) setPayload.status = updates.status;
    if (updates.adminNotes !== undefined) setPayload.adminNotes = updates.adminNotes;
    if (updates.status === 'resolved' || updates.status === 'rejected') {
      setPayload.resolvedAt = new Date();
    }
    const [updated] = await db
      .update(voiceChangeRequests)
      .set(setPayload)
      .where(eq(voiceChangeRequests.id, id))
      .returning();
    return updated;
  }

  // Tap to Pay Terms & Conditions (Apple Requirement)
  async getTapToPayTermsAcceptance(userId: string): Promise<TapToPayTermsAcceptance | undefined> {
    const result = await db
      .select()
      .from(tapToPayTermsAcceptance)
      .where(eq(tapToPayTermsAcceptance.userId, userId))
      .limit(1);
    return result[0];
  }

  async createOrUpdateTapToPayTermsAcceptance(data: Partial<InsertTapToPayTermsAcceptance> & { userId: string; acceptedByUserId: string }): Promise<TapToPayTermsAcceptance> {
    const [result] = await db
      .insert(tapToPayTermsAcceptance)
      .values({
        id: randomUUID(),
        ...data,
        acceptedAt: data.acceptedAt || new Date(),
      })
      .onConflictDoUpdate({
        target: tapToPayTermsAcceptance.userId,
        set: {
          acceptedByUserId: data.acceptedByUserId,
          acceptedByName: data.acceptedByName,
          acceptedByEmail: data.acceptedByEmail,
          acceptedAt: data.acceptedAt || new Date(),
          termsVersion: data.termsVersion || '1.0',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateTapToPayTermsAcceptance(userId: string, updates: Partial<TapToPayTermsAcceptance>): Promise<TapToPayTermsAcceptance | undefined> {
    const [result] = await db
      .update(tapToPayTermsAcceptance)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(tapToPayTermsAcceptance.userId, userId))
      .returning();
    return result;
  }

  async deleteTapToPayTermsAcceptance(userId: string): Promise<void> {
    await db
      .delete(tapToPayTermsAcceptance)
      .where(eq(tapToPayTermsAcceptance.userId, userId));
  }

  async markTapToPaySplashShown(userId: string): Promise<void> {
    // Try to update, if no record exists just log it
    await db
      .update(tapToPayTermsAcceptance)
      .set({
        splashShown: true,
        splashShownAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tapToPayTermsAcceptance.userId, userId));
  }

  async getTeamMemberByUserId(userId: string): Promise<TeamMember | undefined> {
    const result = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.memberId, userId))
      .limit(1);
    return result[0];
  }

  // Payment Schedules (Installment Plans)
  async getPaymentSchedules(userId: string): Promise<PaymentSchedule[]> {
    return await db
      .select()
      .from(paymentSchedules)
      .where(eq(paymentSchedules.userId, userId))
      .orderBy(desc(paymentSchedules.createdAt));
  }

  async getPaymentSchedule(id: string, userId: string): Promise<PaymentSchedule | undefined> {
    const result = await db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.userId, userId)))
      .limit(1);
    return result[0];
  }

  async getPaymentScheduleByInvoice(invoiceId: string, userId: string): Promise<PaymentSchedule | undefined> {
    const result = await db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.invoiceId, invoiceId), eq(paymentSchedules.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createPaymentSchedule(schedule: InsertPaymentSchedule): Promise<PaymentSchedule> {
    const [created] = await db
      .insert(paymentSchedules)
      .values({
        id: randomUUID(),
        ...schedule,
      })
      .returning();
    return created;
  }

  async updatePaymentSchedule(id: string, userId: string, updates: Partial<InsertPaymentSchedule>): Promise<PaymentSchedule | undefined> {
    const [updated] = await db
      .update(paymentSchedules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.userId, userId)))
      .returning();
    return updated;
  }

  async deletePaymentSchedule(id: string, userId: string): Promise<boolean> {
    await db
      .delete(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.userId, userId)));
    return true;
  }

  // Payment Installments
  async getPaymentInstallments(scheduleId: string): Promise<PaymentInstallment[]> {
    return await db
      .select()
      .from(paymentInstallments)
      .where(eq(paymentInstallments.scheduleId, scheduleId))
      .orderBy(asc(paymentInstallments.installmentNumber));
  }

  async getPaymentInstallment(id: string): Promise<PaymentInstallment | undefined> {
    const result = await db
      .select()
      .from(paymentInstallments)
      .where(eq(paymentInstallments.id, id))
      .limit(1);
    return result[0];
  }

  async getDueInstallments(): Promise<PaymentInstallment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 3); // Due in next 3 days
    
    return await db
      .select()
      .from(paymentInstallments)
      .where(and(
        eq(paymentInstallments.status, 'pending'),
        gte(paymentInstallments.dueDate, today),
        lte(paymentInstallments.dueDate, tomorrow)
      ))
      .orderBy(asc(paymentInstallments.dueDate));
  }

  async getOverdueInstallments(): Promise<PaymentInstallment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await db
      .select()
      .from(paymentInstallments)
      .where(and(
        eq(paymentInstallments.status, 'pending'),
        lt(paymentInstallments.dueDate, today)
      ))
      .orderBy(asc(paymentInstallments.dueDate));
  }

  async createPaymentInstallment(installment: InsertPaymentInstallment): Promise<PaymentInstallment> {
    const [created] = await db
      .insert(paymentInstallments)
      .values({
        id: randomUUID(),
        ...installment,
      })
      .returning();
    return created;
  }

  async updatePaymentInstallment(id: string, updates: Partial<InsertPaymentInstallment>): Promise<PaymentInstallment | undefined> {
    const [updated] = await db
      .update(paymentInstallments)
      .set(updates)
      .where(eq(paymentInstallments.id, id))
      .returning();
    return updated;
  }

  async markInstallmentPaid(id: string, paidAmount: string, paymentMethod: string): Promise<PaymentInstallment | undefined> {
    const [updated] = await db
      .update(paymentInstallments)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paidAmount,
        paymentMethod,
      })
      .where(eq(paymentInstallments.id, id))
      .returning();
    return updated;
  }

  // Job Invites (Shareable magic links for subcontractors)
  async getJobInvites(jobId: string, userId: string): Promise<JobInvite[]> {
    return await db
      .select()
      .from(jobInvites)
      .where(and(eq(jobInvites.jobId, jobId), eq(jobInvites.userId, userId)))
      .orderBy(desc(jobInvites.createdAt));
  }

  async getJobInviteByCode(code: string): Promise<JobInvite | undefined> {
    const result = await db
      .select()
      .from(jobInvites)
      .where(eq(jobInvites.inviteCode, code))
      .limit(1);
    return result[0];
  }

  async createJobInvite(invite: InsertJobInvite): Promise<JobInvite> {
    const inviteCode = crypto.randomBytes(32).toString('hex');
    const [created] = await db
      .insert(jobInvites)
      .values({
        id: randomUUID(),
        ...invite,
        inviteCode,
        status: 'pending',
      })
      .returning();
    return created;
  }

  async revokeJobInvite(id: string, userId: string): Promise<JobInvite | undefined> {
    const [updated] = await db
      .update(jobInvites)
      .set({ status: 'revoked' })
      .where(and(eq(jobInvites.id, id), eq(jobInvites.userId, userId)))
      .returning();
    return updated;
  }

  async acceptJobInvite(code: string, acceptingUserId: string): Promise<JobInvite | undefined> {
    const [updated] = await db
      .update(jobInvites)
      .set({
        status: 'accepted',
        usedAt: new Date(),
        usedBy: acceptingUserId,
      })
      .where(and(
        eq(jobInvites.inviteCode, code),
        eq(jobInvites.status, 'pending')
      ))
      .returning();
    return updated;
  }

  // Client Portal Verification (OTP-based access)
  async createPortalVerificationCode(phone: string, code: string, expiresAt: Date): Promise<PortalVerificationCode> {
    const [created] = await db
      .insert(portalVerificationCodes)
      .values({
        id: randomUUID(),
        phone,
        code,
        expiresAt,
        verified: false,
        attempts: 0,
      })
      .returning();
    return created;
  }

  async getPortalVerificationCode(phone: string, code: string): Promise<PortalVerificationCode | undefined> {
    const [result] = await db
      .select()
      .from(portalVerificationCodes)
      .where(and(
        eq(portalVerificationCodes.phone, phone),
        eq(portalVerificationCodes.code, code),
        eq(portalVerificationCodes.verified, false),
        gt(portalVerificationCodes.expiresAt, new Date())
      ))
      .limit(1);
    return result;
  }

  async incrementVerificationAttempts(id: string): Promise<void> {
    await db
      .update(portalVerificationCodes)
      .set({ attempts: sql`${portalVerificationCodes.attempts} + 1` })
      .where(eq(portalVerificationCodes.id, id));
  }

  async countRecentVerificationCodes(phone: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(portalVerificationCodes)
      .where(and(
        eq(portalVerificationCodes.phone, phone),
        gt(portalVerificationCodes.createdAt, since)
      ));
    return Number(result[0]?.count || 0);
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await db
      .update(portalVerificationCodes)
      .set({ verified: true })
      .where(eq(portalVerificationCodes.id, id));
  }

  async cleanupExpiredVerificationCodes(): Promise<void> {
    await db
      .delete(portalVerificationCodes)
      .where(lt(portalVerificationCodes.expiresAt, new Date()));
  }

  // Client Portal Sessions
  async createPortalSession(phone: string, sessionToken: string, expiresAt: Date): Promise<PortalSession> {
    const [created] = await db
      .insert(portalSessions)
      .values({
        id: randomUUID(),
        phone,
        sessionToken,
        expiresAt,
      })
      .returning();
    return created;
  }

  async getPortalSessionByToken(token: string): Promise<PortalSession | undefined> {
    const [result] = await db
      .select()
      .from(portalSessions)
      .where(and(
        eq(portalSessions.sessionToken, token),
        gt(portalSessions.expiresAt, new Date())
      ))
      .limit(1);
    return result;
  }

  async deletePortalSession(token: string): Promise<void> {
    await db
      .delete(portalSessions)
      .where(eq(portalSessions.sessionToken, token));
  }

  async cleanupExpiredPortalSessions(): Promise<void> {
    await db
      .delete(portalSessions)
      .where(lt(portalSessions.expiresAt, new Date()));
  }

  // Client Portal Data Access
  async getClientsByPhone(phone: string): Promise<Client[]> {
    // Normalize phone number: strip formatting, convert to +61 format
    let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+61' + normalizedPhone.slice(1);
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+61' + normalizedPhone.replace(/^61/, '');
    }
    // Also create the local format (0xxx) for matching
    const localFormat = '0' + normalizedPhone.replace(/^\+61/, '');
    
    // Match against both +61 and 0-prefixed formats after stripping formatting
    const results = await db
      .select()
      .from(clients)
      .where(sql`
        REPLACE(REPLACE(REPLACE(REPLACE(${clients.phone}, ' ', ''), '-', ''), '(', ''), ')', '') 
        IN (${normalizedPhone}, ${localFormat})
      `);
    return results;
  }

  async getQuotesForClientIds(clientIds: string[]): Promise<Quote[]> {
    if (clientIds.length === 0) return [];
    const results = await db
      .select()
      .from(quotes)
      .where(inArray(quotes.clientId, clientIds))
      .orderBy(desc(quotes.createdAt));
    return results;
  }

  async getQuotesByClient(clientId: string): Promise<Quote[]> {
    const results = await db
      .select()
      .from(quotes)
      .where(eq(quotes.clientId, clientId))
      .orderBy(desc(quotes.createdAt));
    return results;
  }

  async getInvoicesForClientIds(clientIds: string[]): Promise<any[]> {
    if (clientIds.length === 0) return [];
    const results = await db
      .select()
      .from(invoices)
      .where(inArray(invoices.clientId, clientIds))
      .orderBy(desc(invoices.createdAt));
    return results;
  }

  async getReceiptsForClientIds(clientIds: string[]): Promise<any[]> {
    if (clientIds.length === 0) return [];
    const results = await db
      .select()
      .from(receipts)
      .where(inArray(receipts.clientId, clientIds))
      .orderBy(desc(receipts.createdAt));
    return results;
  }

  async getJobsForClientIds(clientIds: string[]): Promise<Job[]> {
    if (clientIds.length === 0) return [];
    const results = await db
      .select()
      .from(jobs)
      .where(inArray(jobs.clientId, clientIds))
      .orderBy(desc(jobs.scheduledAt));
    return results;
  }
  async createJobPortalToken(data: InsertJobPortalToken): Promise<JobPortalToken> {
    const [result] = await db.insert(jobPortalTokens).values(data).returning();
    return result;
  }

  async getJobPortalTokenByToken(token: string): Promise<JobPortalToken | null> {
    const [result] = await db
      .select()
      .from(jobPortalTokens)
      .where(
        and(
          eq(jobPortalTokens.token, token),
          isNull(jobPortalTokens.revokedAt),
          gt(jobPortalTokens.expiresAt, new Date())
        )
      );
    return result || null;
  }

  async getJobPortalTokensByJobId(jobId: string): Promise<JobPortalToken[]> {
    return await db
      .select()
      .from(jobPortalTokens)
      .where(eq(jobPortalTokens.jobId, jobId))
      .orderBy(desc(jobPortalTokens.createdAt));
  }

  async revokeJobPortalToken(tokenId: string): Promise<void> {
    await db
      .update(jobPortalTokens)
      .set({ revokedAt: new Date() })
      .where(eq(jobPortalTokens.id, tokenId));
  }

  async updateJobPortalTokenAccess(tokenId: string): Promise<void> {
    await db
      .update(jobPortalTokens)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${jobPortalTokens.accessCount} + 1`,
      })
      .where(eq(jobPortalTokens.id, tokenId));
  }

  async updateJobPortalTokenExpiry(tokenId: string, expiresAt: Date): Promise<void> {
    await db
      .update(jobPortalTokens)
      .set({ expiresAt })
      .where(eq(jobPortalTokens.id, tokenId));
  }

  async updateJobPortalTokenSettings(tokenId: string, settings: { showTimeline?: boolean; showPhotos?: boolean; showChecklist?: boolean; showActivityFeed?: boolean; clientMessage?: string | null }): Promise<JobPortalToken | null> {
    const updateData: any = {};
    if (settings.showTimeline !== undefined) updateData.showTimeline = settings.showTimeline;
    if (settings.showPhotos !== undefined) updateData.showPhotos = settings.showPhotos;
    if (settings.showChecklist !== undefined) updateData.showChecklist = settings.showChecklist;
    if (settings.showActivityFeed !== undefined) updateData.showActivityFeed = settings.showActivityFeed;
    if (settings.clientMessage !== undefined) updateData.clientMessage = settings.clientMessage;
    if (Object.keys(updateData).length === 0) return null;
    const [result] = await db
      .update(jobPortalTokens)
      .set(updateData)
      .where(eq(jobPortalTokens.id, tokenId))
      .returning();
    return result || null;
  }

  async getJobAssignments(jobId: string): Promise<JobAssignment[]> {
    return await db.select().from(jobAssignments)
      .where(eq(jobAssignments.jobId, jobId));
  }

  async createJobAssignment(assignment: InsertJobAssignment): Promise<JobAssignment> {
    const result = await db.insert(jobAssignments).values(assignment).returning();
    return result[0];
  }

  async getTeamMemberByOwnerAndMemberId(businessOwnerId: string, memberId: string): Promise<TeamMember | undefined> {
    const result = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.businessOwnerId, businessOwnerId), eq(teamMembers.memberId, memberId)))
      .limit(1);
    return result[0];
  }

  async getActiveJobPortalToken(jobId: string): Promise<JobPortalToken | null> {
    const [result] = await db
      .select()
      .from(jobPortalTokens)
      .where(
        and(
          eq(jobPortalTokens.jobId, jobId),
          isNull(jobPortalTokens.revokedAt),
          gt(jobPortalTokens.expiresAt, new Date())
        )
      )
      .orderBy(desc(jobPortalTokens.createdAt))
      .limit(1);
    return result || null;
  }

  async getJobAssignment(assignmentId: string): Promise<JobAssignment | undefined> {
    const [result] = await db.select().from(jobAssignments)
      .where(eq(jobAssignments.id, assignmentId))
      .limit(1);
    return result;
  }

  async getJobAssignmentForUser(jobId: string, userId: string): Promise<JobAssignment | undefined> {
    const [result] = await db.select().from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, userId), eq(jobAssignments.isActive, true)))
      .limit(1);
    return result;
  }

  async getEnRouteAssignmentsForUser(userId: string): Promise<JobAssignment[]> {
    return await db.select().from(jobAssignments)
      .where(and(eq(jobAssignments.userId, userId), eq(jobAssignments.isActive, true), eq(jobAssignments.assignmentStatus, 'en_route')));
  }

  async getAssignedJobIdsForUser(userId: string, teamMemberId?: string | null): Promise<string[]> {
    const matchers = [eq(jobAssignments.userId, userId)];
    if (teamMemberId) matchers.push(eq(jobAssignments.teamMemberId, teamMemberId));
    const rows = await db.select({ jobId: jobAssignments.jobId })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.isActive, true), or(...matchers)));
    return Array.from(new Set(rows.map(r => r.jobId)));
  }

  async updateJobAssignment(assignmentId: string, data: any): Promise<JobAssignment | undefined> {
    const [result] = await db.update(jobAssignments)
      .set(data)
      .where(eq(jobAssignments.id, assignmentId))
      .returning();
    return result;
  }

  async createAssignmentEvent(event: { assignmentId: string; jobId: string; actorUserId: string; eventType: string; eventData?: any }): Promise<any> {
    const [result] = await db.insert(assignmentEvents).values({
      assignmentId: event.assignmentId,
      jobId: event.jobId,
      actorUserId: event.actorUserId,
      eventType: event.eventType,
      eventData: event.eventData || {},
    }).returning();
    return result;
  }

  async createSmsNotificationLog(log: { jobId: string; assignmentId?: string; userId: string; clientPhone: string; notificationType: string; smsMessageId?: string; portalTokenId?: string; etaMinutes?: number }): Promise<any> {
    const [result] = await db.insert(smsNotificationLog).values({
      jobId: log.jobId,
      assignmentId: log.assignmentId || null,
      userId: log.userId,
      clientPhone: log.clientPhone,
      notificationType: log.notificationType,
      smsMessageId: log.smsMessageId || null,
      portalTokenId: log.portalTokenId || null,
      etaMinutes: log.etaMinutes || null,
    }).returning();
    return result;
  }

  async getLastSmsNotification(assignmentId: string, notificationType: string): Promise<any> {
    const [result] = await db.select().from(smsNotificationLog)
      .where(and(
        eq(smsNotificationLog.assignmentId, assignmentId),
        eq(smsNotificationLog.notificationType, notificationType)
      ))
      .orderBy(desc(smsNotificationLog.sentAt))
      .limit(1);
    return result || null;
  }

  async getAssignmentEvents(assignmentId: string): Promise<any[]> {
    return await db.select().from(assignmentEvents)
      .where(eq(assignmentEvents.assignmentId, assignmentId))
      .orderBy(desc(assignmentEvents.createdAt));
  }

  async getActivePortalTokenForAssignment(assignmentId: string): Promise<JobPortalToken | null> {
    const [result] = await db.select().from(jobPortalTokens)
      .where(and(
        eq(jobPortalTokens.assignmentId, assignmentId),
        isNull(jobPortalTokens.revokedAt),
        gt(jobPortalTokens.expiresAt, new Date())
      ))
      .orderBy(desc(jobPortalTokens.createdAt))
      .limit(1);
    return result || null;
  }

  async createLocationPing(ping: InsertLocationPing): Promise<LocationPing> {
    // Demo pin override — see upsertTradieStatus for rationale.
    const DEMO_PINNED_PING_USERS: Record<string, { lat: string; lng: string }> = {
      '9be6ed6c-c472-4e07-b1e5-f7d42291d4ae': { lat: '-16.8989487', lng: '145.7530458' },
    };
    const pin = DEMO_PINNED_PING_USERS[ping.userId];
    if (pin) {
      ping = { ...ping, latitude: Number(pin.lat), longitude: Number(pin.lng) };
    }
    const [result] = await db.insert(locationPings).values(ping).returning();
    return result;
  }

  async getLatestLocationPing(assignmentId: string): Promise<LocationPing | null> {
    const [result] = await db.select().from(locationPings)
      .where(eq(locationPings.assignmentId, assignmentId))
      .orderBy(desc(locationPings.recordedAt))
      .limit(1);
    return result || null;
  }

  async getLocationPings(assignmentId: string, limit: number = 50): Promise<LocationPing[]> {
    return await db.select().from(locationPings)
      .where(eq(locationPings.assignmentId, assignmentId))
      .orderBy(desc(locationPings.recordedAt))
      .limit(limit);
  }

  async createSubcontractorToken(data: InsertSubcontractorToken): Promise<SubcontractorToken> {
    const [token] = await db.insert(subcontractorTokens).values(data).returning();
    return token;
  }

  async getSubcontractorTokenByToken(token: string): Promise<SubcontractorToken | null> {
    const [result] = await db.select().from(subcontractorTokens).where(eq(subcontractorTokens.token, token)).limit(1);
    return result || null;
  }

  async getSubcontractorTokensByJobId(jobId: string): Promise<SubcontractorToken[]> {
    return await db.select().from(subcontractorTokens).where(eq(subcontractorTokens.jobId, jobId));
  }

  async updateSubcontractorTokenStatus(id: string, status: string, acceptedAt?: Date): Promise<SubcontractorToken | null> {
    const updateData: any = { status };
    if (acceptedAt) updateData.acceptedAt = acceptedAt;
    const [result] = await db.update(subcontractorTokens).set(updateData).where(eq(subcontractorTokens.id, id)).returning();
    return result || null;
  }

  async revokeSubcontractorToken(id: string): Promise<void> {
    await db.update(subcontractorTokens).set({ revokedAt: new Date(), status: 'revoked' }).where(eq(subcontractorTokens.id, id));
  }

  async updateSubcontractorTokenAccess(id: string): Promise<void> {
    await db.update(subcontractorTokens).set({ lastAccessedAt: new Date() }).where(eq(subcontractorTokens.id, id));
  }

  async updateSubcontractorTokenContact(id: string, phone: string): Promise<void> {
    await db.update(subcontractorTokens).set({ contactPhone: phone }).where(eq(subcontractorTokens.id, id));
  }

  async updateSubcontractorToken(id: string, updates: Partial<{ etaMinutes: number | null }>): Promise<void> {
    await db.update(subcontractorTokens).set(updates).where(eq(subcontractorTokens.id, id));
  }

  async createSubcontractorSession(tokenId: string, sessionToken: string, phone: string, expiresAt: Date): Promise<SubcontractorSession> {
    const [session] = await db.insert(subcontractorSessions).values({ tokenId, sessionToken, phone, expiresAt }).returning();
    return session;
  }

  async getSubcontractorSessionByToken(sessionToken: string): Promise<SubcontractorSession | null> {
    const [result] = await db.select().from(subcontractorSessions).where(eq(subcontractorSessions.sessionToken, sessionToken)).limit(1);
    return result || null;
  }

  async deleteSubcontractorSession(sessionToken: string): Promise<void> {
    await db.delete(subcontractorSessions).where(eq(subcontractorSessions.sessionToken, sessionToken));
  }

  async createSubcontractorEvent(data: InsertSubcontractorEvent): Promise<SubcontractorEvent> {
    const [event] = await db.insert(subcontractorEvents).values(data).returning();
    return event;
  }

  async getSubcontractorEventsByJob(jobId: string): Promise<SubcontractorEvent[]> {
    return await db.select().from(subcontractorEvents).where(eq(subcontractorEvents.jobId, jobId)).orderBy(subcontractorEvents.createdAt);
  }

  async createSubcontractorLocationPing(data: InsertSubcontractorLocationPing): Promise<SubcontractorLocationPing> {
    const [ping] = await db.insert(subcontractorLocationPings).values(data).returning();
    return ping;
  }

  async getLatestSubcontractorLocationPing(tokenId: string): Promise<SubcontractorLocationPing | null> {
    const [result] = await db.select().from(subcontractorLocationPings)
      .where(eq(subcontractorLocationPings.tokenId, tokenId))
      .orderBy(desc(subcontractorLocationPings.recordedAt))
      .limit(1);
    return result || null;
  }

  async getSubcontractorLocationPingsByJob(jobId: string): Promise<SubcontractorLocationPing[]> {
    return await db.select().from(subcontractorLocationPings)
      .where(eq(subcontractorLocationPings.jobId, jobId))
      .orderBy(desc(subcontractorLocationPings.recordedAt));
  }

  async getEquipment(userId: string): Promise<Equipment[]> {
    return await db.select().from(equipment)
      .where(eq(equipment.userId, userId))
      .orderBy(desc(equipment.createdAt));
  }

  async getEquipmentById(id: string, userId: string): Promise<Equipment | undefined> {
    const [result] = await db.select().from(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.userId, userId)));
    return result;
  }

  async createEquipment(data: InsertEquipment & { userId: string }): Promise<Equipment> {
    const [result] = await db.insert(equipment).values(data).returning();
    return result;
  }

  async updateEquipment(id: string, userId: string, updates: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [result] = await db.update(equipment)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(equipment.id, id), eq(equipment.userId, userId)))
      .returning();
    return result;
  }

  async deleteEquipment(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getEquipmentCategories(userId: string): Promise<EquipmentCategory[]> {
    return await db.select().from(equipmentCategories)
      .where(eq(equipmentCategories.userId, userId))
      .orderBy(asc(equipmentCategories.name));
  }

  async createEquipmentCategory(data: InsertEquipmentCategory & { userId: string }): Promise<EquipmentCategory> {
    const [result] = await db.insert(equipmentCategories).values(data).returning();
    return result;
  }

  async getEquipmentMaintenance(equipmentId: string, userId: string): Promise<EquipmentMaintenance[]> {
    return await db.select().from(equipmentMaintenance)
      .where(and(eq(equipmentMaintenance.equipmentId, equipmentId), eq(equipmentMaintenance.userId, userId)))
      .orderBy(desc(equipmentMaintenance.createdAt));
  }

  async createEquipmentMaintenance(data: InsertEquipmentMaintenance & { userId: string }): Promise<EquipmentMaintenance> {
    const [result] = await db.insert(equipmentMaintenance).values(data).returning();
    return result;
  }

  async createWorkerRequest(data: InsertWorkerRequest): Promise<WorkerRequest> {
    const [request] = await db.insert(workerRequests).values(data).returning();
    return request;
  }

  async getWorkerRequests(businessOwnerId: string): Promise<WorkerRequest[]> {
    return await db.select().from(workerRequests).where(eq(workerRequests.businessOwnerId, businessOwnerId)).orderBy(desc(workerRequests.createdAt));
  }

  async getWorkerRequestsByClient(clientId: string): Promise<WorkerRequest[]> {
    return await db.select().from(workerRequests).where(eq(workerRequests.clientId, clientId)).orderBy(desc(workerRequests.createdAt));
  }

  async updateWorkerRequestStatus(id: string, status: string): Promise<WorkerRequest | undefined> {
    const [updated] = await db.update(workerRequests).set({ status, respondedAt: new Date() }).where(eq(workerRequests.id, id)).returning();
    return updated;
  }

  async getComplianceDocuments(businessOwnerId: string): Promise<ComplianceDocument[]> {
    return await db.select().from(complianceDocuments).where(eq(complianceDocuments.businessOwnerId, businessOwnerId)).orderBy(desc(complianceDocuments.createdAt));
  }

  async getComplianceDocument(id: string, businessOwnerId: string): Promise<ComplianceDocument | undefined> {
    const [doc] = await db.select().from(complianceDocuments).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.businessOwnerId, businessOwnerId)));
    return doc;
  }

  async getComplianceDocumentsByHolder(holderUserId: string, businessOwnerId?: string): Promise<ComplianceDocument[]> {
    const conditions = [eq(complianceDocuments.holderUserId, holderUserId)];
    if (businessOwnerId) conditions.push(eq(complianceDocuments.businessOwnerId, businessOwnerId));
    return await db.select().from(complianceDocuments).where(and(...conditions)).orderBy(desc(complianceDocuments.createdAt));
  }

  async createComplianceDocument(doc: InsertComplianceDocument): Promise<ComplianceDocument> {
    const [created] = await db.insert(complianceDocuments).values(doc).returning();
    return created;
  }

  async updateComplianceDocument(id: string, businessOwnerId: string, updates: Partial<InsertComplianceDocument>): Promise<ComplianceDocument | undefined> {
    const [updated] = await db.update(complianceDocuments).set({ ...updates, updatedAt: new Date() }).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.businessOwnerId, businessOwnerId))).returning();
    return updated;
  }

  async deleteComplianceDocument(id: string, businessOwnerId: string): Promise<boolean> {
    const result = await db.delete(complianceDocuments).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.businessOwnerId, businessOwnerId))).returning();
    return result.length > 0;
  }

  async getExpiringComplianceDocuments(businessOwnerId: string, withinDays: number): Promise<ComplianceDocument[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);
    return await db.select().from(complianceDocuments)
      .where(and(
        eq(complianceDocuments.businessOwnerId, businessOwnerId),
        lte(complianceDocuments.expiryDate, futureDate)
      ))
      .orderBy(complianceDocuments.expiryDate);
  }

  async createJobRequest(data: InsertJobRequest): Promise<JobRequest> {
    const [created] = await db.insert(jobRequests).values(data).returning();
    return created;
  }

  async getJobRequests(userId: string, status?: string): Promise<any[]> {
    const baseQuery = db.select({
      id: jobRequests.id,
      userId: jobRequests.userId,
      clientId: jobRequests.clientId,
      title: jobRequests.title,
      description: jobRequests.description,
      preferredDate: jobRequests.preferredDate,
      urgency: jobRequests.urgency,
      clientNotes: jobRequests.clientNotes,
      status: jobRequests.status,
      reviewedAt: jobRequests.reviewedAt,
      reviewNotes: jobRequests.reviewNotes,
      jobId: jobRequests.jobId,
      createdAt: jobRequests.createdAt,
      updatedAt: jobRequests.updatedAt,
      preferredWorkerId: jobRequests.preferredWorkerId,
      preferredWorkerName: jobRequests.preferredWorkerName,
      referenceJobId: jobRequests.referenceJobId,
      referenceJobTitle: jobRequests.referenceJobTitle,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(jobRequests)
    .leftJoin(clients, eq(jobRequests.clientId, clients.id));

    if (status) {
      return await baseQuery.where(and(eq(jobRequests.userId, userId), eq(jobRequests.status, status))).orderBy(desc(jobRequests.createdAt));
    }
    return await baseQuery.where(eq(jobRequests.userId, userId)).orderBy(desc(jobRequests.createdAt));
  }

  async getJobRequest(id: string, userId: string): Promise<JobRequest | undefined> {
    const [request] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, id), eq(jobRequests.userId, userId)));
    return request;
  }

  async updateJobRequest(id: string, userId: string, updates: Partial<JobRequest>): Promise<JobRequest | undefined> {
    const [updated] = await db.update(jobRequests).set({ ...updates, updatedAt: new Date() }).where(and(eq(jobRequests.id, id), eq(jobRequests.userId, userId))).returning();
    return updated;
  }

  async updateJobRequestByClient(id: string, clientId: string, updates: Partial<JobRequest>): Promise<JobRequest | undefined> {
    const [updated] = await db.update(jobRequests).set({ ...updates, updatedAt: new Date() }).where(and(eq(jobRequests.id, id), eq(jobRequests.clientId, clientId), eq(jobRequests.status, 'pending'))).returning();
    return updated;
  }

  async deleteJobRequest(id: string, clientId: string): Promise<boolean> {
    const result = await db.delete(jobRequests).where(and(eq(jobRequests.id, id), eq(jobRequests.clientId, clientId), eq(jobRequests.status, 'pending'))).returning();
    return result.length > 0;
  }

  async getJobRequestsByClientForUser(userId: string, clientId: string): Promise<any[]> {
    return await db.select({
      id: jobRequests.id,
      userId: jobRequests.userId,
      clientId: jobRequests.clientId,
      title: jobRequests.title,
      description: jobRequests.description,
      preferredDate: jobRequests.preferredDate,
      urgency: jobRequests.urgency,
      clientNotes: jobRequests.clientNotes,
      status: jobRequests.status,
      reviewedAt: jobRequests.reviewedAt,
      reviewNotes: jobRequests.reviewNotes,
      jobId: jobRequests.jobId,
      createdAt: jobRequests.createdAt,
      updatedAt: jobRequests.updatedAt,
      preferredWorkerId: jobRequests.preferredWorkerId,
      preferredWorkerName: jobRequests.preferredWorkerName,
      referenceJobId: jobRequests.referenceJobId,
      referenceJobTitle: jobRequests.referenceJobTitle,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(jobRequests)
    .leftJoin(clients, eq(jobRequests.clientId, clients.id))
    .where(and(eq(jobRequests.userId, userId), eq(jobRequests.clientId, clientId)))
    .orderBy(desc(jobRequests.createdAt));
  }

  async getJobRequestsByClient(clientId: string): Promise<JobRequest[]> {
    return await db.select().from(jobRequests).where(eq(jobRequests.clientId, clientId)).orderBy(desc(jobRequests.createdAt));
  }

  async getSavedFilters(userId: string, entityType?: string): Promise<SavedFilter[]> {
    const conditions = [eq(savedFilters.userId, userId)];
    if (entityType) {
      conditions.push(eq(savedFilters.entityType, entityType));
    }
    return await db.select().from(savedFilters).where(and(...conditions)).orderBy(desc(savedFilters.createdAt));
  }

  async createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter> {
    const [result] = await db.insert(savedFilters).values(filter).returning();
    return result;
  }

  async deleteSavedFilter(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(savedFilters).where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId))).returning();
    return result.length > 0;
  }

  // ============================================
  // WHS - Incident Reports
  // ============================================
  async getIncidentReports(userId: string, jobId?: string): Promise<IncidentReport[]> {
    const conditions = [eq(incidentReports.userId, userId)];
    if (jobId) conditions.push(eq(incidentReports.jobId, jobId));
    return await db.select().from(incidentReports).where(and(...conditions)).orderBy(desc(incidentReports.createdAt));
  }

  async getIncidentReport(id: string, userId: string): Promise<IncidentReport | undefined> {
    const [result] = await db.select().from(incidentReports).where(and(eq(incidentReports.id, id), eq(incidentReports.userId, userId)));
    return result;
  }

  async createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.insert(incidentReports).values(report as typeof incidentReports.$inferInsert).returning();
    return result;
  }

  async updateIncidentReport(id: string, userId: string, updates: Partial<InsertIncidentReport>): Promise<IncidentReport | undefined> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.update(incidentReports).set({ ...updates, updatedAt: new Date() } as Partial<typeof incidentReports.$inferInsert>).where(and(eq(incidentReports.id, id), eq(incidentReports.userId, userId))).returning();
    return result;
  }

  async deleteIncidentReport(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(incidentReports).where(and(eq(incidentReports.id, id), eq(incidentReports.userId, userId))).returning();
    return result.length > 0;
  }

  // ============================================
  // WHS - Site Emergency Info
  // ============================================
  async getSiteEmergencyInfo(userId: string, jobId?: string): Promise<SiteEmergencyInfo[]> {
    const conditions = [eq(siteEmergencyInfo.userId, userId)];
    if (jobId) conditions.push(eq(siteEmergencyInfo.jobId, jobId));
    return await db.select().from(siteEmergencyInfo).where(and(...conditions)).orderBy(desc(siteEmergencyInfo.createdAt));
  }

  async getSiteEmergencyInfoById(id: string, userId: string): Promise<SiteEmergencyInfo | undefined> {
    const [result] = await db.select().from(siteEmergencyInfo).where(and(eq(siteEmergencyInfo.id, id), eq(siteEmergencyInfo.userId, userId)));
    return result;
  }

  async createSiteEmergencyInfo(info: InsertSiteEmergencyInfo): Promise<SiteEmergencyInfo> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.insert(siteEmergencyInfo).values(info as typeof siteEmergencyInfo.$inferInsert).returning();
    return result;
  }

  async updateSiteEmergencyInfo(id: string, userId: string, updates: Partial<InsertSiteEmergencyInfo>): Promise<SiteEmergencyInfo | undefined> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.update(siteEmergencyInfo).set({ ...updates, updatedAt: new Date() } as Partial<typeof siteEmergencyInfo.$inferInsert>).where(and(eq(siteEmergencyInfo.id, id), eq(siteEmergencyInfo.userId, userId))).returning();
    return result;
  }

  async deleteSiteEmergencyInfo(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(siteEmergencyInfo).where(and(eq(siteEmergencyInfo.id, id), eq(siteEmergencyInfo.userId, userId))).returning();
    return result.length > 0;
  }

  // ============================================
  // WHS - JSA Documents
  // ============================================
  async getJsaDocuments(userId: string, jobId?: string): Promise<JsaDocument[]> {
    const conditions = [eq(jsaDocuments.userId, userId)];
    if (jobId) conditions.push(eq(jsaDocuments.jobId, jobId));
    return await db.select().from(jsaDocuments).where(and(...conditions)).orderBy(desc(jsaDocuments.createdAt));
  }

  async getJsaDocument(id: string, userId: string): Promise<JsaDocument | undefined> {
    const [result] = await db.select().from(jsaDocuments).where(and(eq(jsaDocuments.id, id), eq(jsaDocuments.userId, userId)));
    return result;
  }

  async createJsaDocument(doc: InsertJsaDocument): Promise<JsaDocument> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.insert(jsaDocuments).values(doc as typeof jsaDocuments.$inferInsert).returning();
    return result;
  }

  async updateJsaDocument(id: string, userId: string, updates: Partial<InsertJsaDocument>): Promise<JsaDocument | undefined> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.update(jsaDocuments).set({ ...updates, updatedAt: new Date() } as Partial<typeof jsaDocuments.$inferInsert>).where(and(eq(jsaDocuments.id, id), eq(jsaDocuments.userId, userId))).returning();
    return result;
  }

  async deleteJsaDocument(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(jsaDocuments).where(and(eq(jsaDocuments.id, id), eq(jsaDocuments.userId, userId))).returning();
    return result.length > 0;
  }

  async getJsaSteps(jsaId: string): Promise<JsaStep[]> {
    return await db.select().from(jsaSteps).where(eq(jsaSteps.jsaId, jsaId)).orderBy(asc(jsaSteps.sortOrder));
  }

  async getJsaStep(id: string): Promise<JsaStep | undefined> {
    const [result] = await db.select().from(jsaSteps).where(eq(jsaSteps.id, id));
    return result;
  }

  async createJsaStep(step: InsertJsaStep): Promise<JsaStep> {
    const [result] = await db.insert(jsaSteps).values(step).returning();
    return result;
  }

  async updateJsaStep(id: string, updates: Partial<InsertJsaStep>): Promise<JsaStep | undefined> {
    const [result] = await db.update(jsaSteps).set(updates).where(eq(jsaSteps.id, id)).returning();
    return result;
  }

  async deleteJsaStep(id: string): Promise<boolean> {
    const result = await db.delete(jsaSteps).where(eq(jsaSteps.id, id)).returning();
    return result.length > 0;
  }

  // ============================================
  // WHS - Site Hazardous Environments
  // ============================================
  async getSiteHazardousEnvironments(userId: string, jobId?: string): Promise<SiteHazardousEnvironment[]> {
    const conditions = [eq(siteHazardousEnvironments.userId, userId)];
    if (jobId) conditions.push(eq(siteHazardousEnvironments.jobId, jobId));
    return await db.select().from(siteHazardousEnvironments).where(and(...conditions)).orderBy(desc(siteHazardousEnvironments.createdAt));
  }

  async createSiteHazardousEnvironment(env: InsertSiteHazardousEnvironment): Promise<SiteHazardousEnvironment> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.insert(siteHazardousEnvironments).values(env as typeof siteHazardousEnvironments.$inferInsert).returning();
    return result;
  }

  async updateSiteHazardousEnvironment(id: string, userId: string, updates: Partial<InsertSiteHazardousEnvironment>): Promise<SiteHazardousEnvironment | undefined> {
    // drizzle-zod json array columns infer a structural type that isn't assignable to the drizzle-core column type; cast to the native insert type.
    const [result] = await db.update(siteHazardousEnvironments).set({ ...updates, updatedAt: new Date() } as Partial<typeof siteHazardousEnvironments.$inferInsert>).where(and(eq(siteHazardousEnvironments.id, id), eq(siteHazardousEnvironments.userId, userId))).returning();
    return result;
  }

  async deleteSiteHazardousEnvironment(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(siteHazardousEnvironments).where(and(eq(siteHazardousEnvironments.id, id), eq(siteHazardousEnvironments.userId, userId))).returning();
    return result.length > 0;
  }

  // ============================================
  // WHS - Site Safety Signage
  // ============================================
  async getSiteSafetySignage(userId: string, jobId?: string): Promise<SiteSafetySignage[]> {
    const conditions = [eq(siteSafetySignage.userId, userId)];
    if (jobId) conditions.push(eq(siteSafetySignage.jobId, jobId));
    return await db.select().from(siteSafetySignage).where(and(...conditions)).orderBy(desc(siteSafetySignage.createdAt));
  }

  async createSiteSafetySignage(sign: InsertSiteSafetySignage): Promise<SiteSafetySignage> {
    const [result] = await db.insert(siteSafetySignage).values(sign).returning();
    return result;
  }

  async updateSiteSafetySignage(id: string, userId: string, updates: Partial<InsertSiteSafetySignage>): Promise<SiteSafetySignage | undefined> {
    const [result] = await db.update(siteSafetySignage).set({ ...updates, updatedAt: new Date() }).where(and(eq(siteSafetySignage.id, id), eq(siteSafetySignage.userId, userId))).returning();
    return result;
  }

  async deleteSiteSafetySignage(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(siteSafetySignage).where(and(eq(siteSafetySignage.id, id), eq(siteSafetySignage.userId, userId))).returning();
    return result.length > 0;
  }

  async getHazardReports(userId: string, jobId?: string): Promise<HazardReport[]> {
    const conditions = [eq(hazardReports.userId, userId)];
    if (jobId) conditions.push(eq(hazardReports.jobId, jobId));
    return await db.select().from(hazardReports).where(and(...conditions)).orderBy(desc(hazardReports.createdAt));
  }

  async createHazardReport(report: InsertHazardReport): Promise<HazardReport> {
    const [result] = await db.insert(hazardReports).values(report).returning();
    return result;
  }

  async updateHazardReport(id: string, userId: string, updates: Partial<InsertHazardReport>): Promise<HazardReport | undefined> {
    const [result] = await db.update(hazardReports).set({ ...updates, updatedAt: new Date() }).where(and(eq(hazardReports.id, id), eq(hazardReports.userId, userId))).returning();
    return result;
  }

  async deleteHazardReport(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(hazardReports).where(and(eq(hazardReports.id, id), eq(hazardReports.userId, userId))).returning();
    return result.length > 0;
  }

  async getPpeChecklists(userId: string, jobId?: string): Promise<PpeChecklist[]> {
    const conditions = [eq(ppeChecklists.userId, userId)];
    if (jobId) conditions.push(eq(ppeChecklists.jobId, jobId));
    return await db.select().from(ppeChecklists).where(and(...conditions)).orderBy(desc(ppeChecklists.createdAt));
  }

  async createPpeChecklist(checklist: InsertPpeChecklist): Promise<PpeChecklist> {
    const [result] = await db.insert(ppeChecklists).values(checklist).returning();
    return result;
  }

  async deletePpeChecklist(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(ppeChecklists).where(and(eq(ppeChecklists.id, id), eq(ppeChecklists.userId, userId))).returning();
    return result.length > 0;
  }

  async getTrainingRecords(userId: string): Promise<TrainingRecord[]> {
    return await db.select().from(trainingRecords).where(eq(trainingRecords.userId, userId)).orderBy(desc(trainingRecords.createdAt));
  }

  async createTrainingRecord(record: InsertTrainingRecord): Promise<TrainingRecord> {
    const [result] = await db.insert(trainingRecords).values(record).returning();
    return result;
  }

  async updateTrainingRecord(id: string, userId: string, updates: Partial<InsertTrainingRecord>): Promise<TrainingRecord | undefined> {
    const [result] = await db.update(trainingRecords).set({ ...updates, updatedAt: new Date() }).where(and(eq(trainingRecords.id, id), eq(trainingRecords.userId, userId))).returning();
    return result;
  }

  async deleteTrainingRecord(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(trainingRecords).where(and(eq(trainingRecords.id, id), eq(trainingRecords.userId, userId))).returning();
    return result.length > 0;
  }

  // ============================================
  // Website Addons
  // ============================================
  async getWebsiteAddon(businessId: string): Promise<WebsiteAddon | undefined> {
    const [result] = await db.select().from(websiteAddons).where(eq(websiteAddons.businessId, businessId)).limit(1);
    return result;
  }

  async createWebsiteAddon(data: InsertWebsiteAddon): Promise<WebsiteAddon> {
    const [result] = await db.insert(websiteAddons).values(data).returning();
    return result;
  }

  async updateWebsiteAddon(businessId: string, updates: Partial<InsertWebsiteAddon>): Promise<WebsiteAddon | undefined> {
    const [result] = await db.update(websiteAddons).set({ ...updates, updatedAt: new Date() }).where(eq(websiteAddons.businessId, businessId)).returning();
    return result;
  }

  // ============================================
  // Website Change Requests
  // ============================================
  async getWebsiteChangeRequests(businessId: string): Promise<WebsiteChangeRequest[]> {
    return await db.select().from(websiteChangeRequests).where(eq(websiteChangeRequests.businessId, businessId)).orderBy(desc(websiteChangeRequests.createdAt));
  }

  async getAllWebsiteChangeRequests(): Promise<WebsiteChangeRequest[]> {
    return await db.select().from(websiteChangeRequests).orderBy(desc(websiteChangeRequests.createdAt));
  }

  async createWebsiteChangeRequest(data: InsertWebsiteChangeRequest): Promise<WebsiteChangeRequest> {
    const [result] = await db.insert(websiteChangeRequests).values(data).returning();
    return result;
  }

  async updateWebsiteChangeRequestStatus(id: string, status: string): Promise<WebsiteChangeRequest | undefined> {
    const [result] = await db.update(websiteChangeRequests).set({ status, updatedAt: new Date() }).where(eq(websiteChangeRequests.id, id)).returning();
    return result;
  }

  // ============================================
  // Subcontractor Invoices
  // ============================================
  async getSubcontractorInvoices(subcontractorUserId: string, businessOwnerId?: string): Promise<SubcontractorInvoice[]> {
    const conditions = [eq(subcontractorInvoices.subcontractorUserId, subcontractorUserId)];
    if (businessOwnerId) {
      conditions.push(eq(subcontractorInvoices.businessOwnerId, businessOwnerId));
    }
    return await db.select().from(subcontractorInvoices).where(and(...conditions)).orderBy(desc(subcontractorInvoices.createdAt));
  }

  async getSubcontractorInvoice(id: string): Promise<SubcontractorInvoice | undefined> {
    const [result] = await db.select().from(subcontractorInvoices).where(eq(subcontractorInvoices.id, id)).limit(1);
    return result;
  }

  async getSubcontractorInvoiceWithItems(id: string): Promise<(SubcontractorInvoice & { items: SubcontractorInvoiceItem[] }) | undefined> {
    const invoice = await this.getSubcontractorInvoice(id);
    if (!invoice) return undefined;
    const items = await this.getSubcontractorInvoiceItems(id);
    return { ...invoice, items };
  }

  async createSubcontractorInvoice(invoice: InsertSubcontractorInvoice): Promise<SubcontractorInvoice> {
    // If no number was supplied, generate it inside a transaction holding a
    // per-subcontractor advisory lock so two simultaneous creates can never
    // compute the same next number (select-then-max race).
    if (!invoice.invoiceNumber) {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'subinv:' + invoice.subcontractorUserId}))`);
        const existing = await tx.select({ invoiceNumber: subcontractorInvoices.invoiceNumber }).from(subcontractorInvoices).where(eq(subcontractorInvoices.subcontractorUserId, invoice.subcontractorUserId));
        const maxNum = existing.reduce((max, inv) => {
          const match = inv.invoiceNumber.match(/(\d+)$/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        const prefix = await this.getSubcontractorInvoicePrefix(invoice.subcontractorUserId);
        const invoiceNumber = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
        const [result] = await tx.insert(subcontractorInvoices).values({ ...invoice, invoiceNumber }).returning();
        return result;
      });
    }
    const [result] = await db.insert(subcontractorInvoices).values(invoice).returning();
    return result;
  }

  async updateSubcontractorInvoice(id: string, updates: Partial<InsertSubcontractorInvoice>): Promise<SubcontractorInvoice | undefined> {
    const [result] = await db.update(subcontractorInvoices).set({ ...updates, updatedAt: new Date() }).where(eq(subcontractorInvoices.id, id)).returning();
    return result;
  }

  async getSubcontractorInvoicesByBusiness(businessOwnerId: string): Promise<SubcontractorInvoice[]> {
    return await db.select().from(subcontractorInvoices).where(eq(subcontractorInvoices.businessOwnerId, businessOwnerId)).orderBy(desc(subcontractorInvoices.createdAt));
  }

  async getNextSubcontractorInvoiceNumber(subcontractorUserId: string): Promise<string> {
    const existing = await db.select({ invoiceNumber: subcontractorInvoices.invoiceNumber }).from(subcontractorInvoices).where(eq(subcontractorInvoices.subcontractorUserId, subcontractorUserId));
    const maxNum = existing.reduce((max, inv) => {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    const prefix = await this.getSubcontractorInvoicePrefix(subcontractorUserId);
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
  }

  private async getSubcontractorInvoicePrefix(subcontractorUserId: string): Promise<string> {
    // Number it like a real invoice from the subcontractor's own business:
    // their configured invoice prefix, else initials of their business name, else INV-.
    const settings = await this.getBusinessSettings(subcontractorUserId);
    let prefix = (settings?.invoicePrefix || '').trim();
    if (!prefix && settings?.businessName) {
      const initials = settings.businessName
        .replace(/[^A-Za-z0-9 ]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w[0]!.toUpperCase())
        .join('')
        .slice(0, 4);
      if (initials) prefix = `${initials}-`;
    }
    if (!prefix) prefix = 'INV-';
    if (!/[-\s]$/.test(prefix)) prefix = `${prefix}-`;
    return prefix;
  }

  // Subcontractor Invoice Items
  async getSubcontractorInvoiceItems(invoiceId: string): Promise<SubcontractorInvoiceItem[]> {
    return await db.select().from(subcontractorInvoiceItems).where(eq(subcontractorInvoiceItems.invoiceId, invoiceId));
  }

  async createSubcontractorInvoiceItem(item: InsertSubcontractorInvoiceItem): Promise<SubcontractorInvoiceItem> {
    const [result] = await db.insert(subcontractorInvoiceItems).values(item).returning();
    return result;
  }

  async deleteSubcontractorInvoiceItems(invoiceId: string): Promise<boolean> {
    const result = await db.delete(subcontractorInvoiceItems).where(eq(subcontractorInvoiceItems.invoiceId, invoiceId)).returning();
    return result.length > 0;
  }

  async deleteSubcontractorInvoice(id: string): Promise<boolean> {
    await db.delete(subcontractorInvoiceItems).where(eq(subcontractorInvoiceItems.invoiceId, id));
    const result = await db.delete(subcontractorInvoices).where(eq(subcontractorInvoices.id, id)).returning();
    return result.length > 0;
  }

  // Worker payment details (Task #271)
  async getWorkerPaymentDetails(userId: string): Promise<WorkerPaymentDetails | undefined> {
    const [result] = await db.select().from(workerPaymentDetails).where(eq(workerPaymentDetails.userId, userId)).limit(1);
    return result;
  }

  async upsertWorkerPaymentDetails(userId: string, data: Partial<InsertWorkerPaymentDetails>): Promise<WorkerPaymentDetails> {
    const existing = await this.getWorkerPaymentDetails(userId);
    if (existing) {
      const [result] = await db.update(workerPaymentDetails)
        .set({ ...data, userId, updatedAt: new Date() })
        .where(eq(workerPaymentDetails.userId, userId))
        .returning();
      return result;
    }
    const [result] = await db.insert(workerPaymentDetails)
      .values({ ...data, userId })
      .returning();
    return result;
  }

  // Payroll pay runs (Task #271)
  async getPayrollPayments(businessOwnerId: string, filters?: { start?: Date; end?: Date; workerUserId?: string }): Promise<PayrollPayment[]> {
    const conditions = [eq(payrollPayments.businessOwnerId, businessOwnerId)];
    if (filters?.workerUserId) {
      conditions.push(eq(payrollPayments.workerUserId, filters.workerUserId));
    }
    // Exact-period identity (NOT containment): a payment matches only when its
    // period boundaries equal the requested period. Using range comparisons here
    // would falsely treat a nested sub-period payment as covering a larger period.
    if (filters?.start) {
      conditions.push(eq(payrollPayments.periodStart, filters.start));
    }
    if (filters?.end) {
      conditions.push(eq(payrollPayments.periodEnd, filters.end));
    }
    return await db.select().from(payrollPayments).where(and(...conditions)).orderBy(desc(payrollPayments.paidAt));
  }

  async getPayrollPayment(id: string): Promise<PayrollPayment | undefined> {
    const [result] = await db.select().from(payrollPayments).where(eq(payrollPayments.id, id)).limit(1);
    return result;
  }

  async createPayrollPayment(payment: InsertPayrollPayment): Promise<PayrollPayment> {
    const [result] = await db.insert(payrollPayments).values(payment).returning();
    return result;
  }

  async updatePayrollPayment(id: string, updates: Partial<InsertPayrollPayment>): Promise<PayrollPayment | undefined> {
    const [result] = await db.update(payrollPayments).set({ ...updates, updatedAt: new Date() }).where(eq(payrollPayments.id, id)).returning();
    return result;
  }

  // Worker States
  async getWorkerState(userId: string, businessOwnerId?: string): Promise<WorkerState | undefined> {
    try {
      if (businessOwnerId) {
        const [result] = await db.select().from(workerStates)
          .where(and(eq(workerStates.userId, userId), eq(workerStates.businessOwnerId, businessOwnerId)))
          .limit(1);
        return result;
      }
      const [result] = await db.select().from(workerStates).where(eq(workerStates.userId, userId)).limit(1);
      return result;
    } catch (error: unknown) {
      if (getErrorMessage(error)?.includes('does not exist')) return undefined;
      throw error;
    }
  }

  async getWorkerStatesByBusiness(businessOwnerId: string): Promise<WorkerState[]> {
    try {
      return await db.select().from(workerStates).where(eq(workerStates.businessOwnerId, businessOwnerId));
    } catch (error: unknown) {
      if (getErrorMessage(error)?.includes('does not exist')) return [];
      throw error;
    }
  }

  async upsertWorkerState(userId: string, businessOwnerId: string, state: string, jobId?: string | null, note?: string | null): Promise<WorkerState> {
    try {
      const [result] = await db
        .insert(workerStates)
        .values({ userId, businessOwnerId, state, jobId: jobId ?? null, note: note ?? null })
        .onConflictDoUpdate({
          target: [workerStates.businessOwnerId, workerStates.userId],
          set: { state, jobId: jobId ?? null, note: note ?? null, updatedAt: new Date() },
        })
        .returning();
      return result;
    } catch (error: unknown) {
      if (getErrorMessage(error)?.includes('does not exist')) {
        return { id: '', userId, businessOwnerId, state, jobId: jobId ?? null, note: note ?? null, updatedAt: new Date(), createdAt: new Date() } as WorkerState;
      }
      throw error;
    }
  }

  async getNumberPortRequests(userId: string): Promise<NumberPortRequest[]> {
    return await db.select().from(numberPortRequests).where(eq(numberPortRequests.userId, userId)).orderBy(desc(numberPortRequests.createdAt));
  }

  async getNumberPortRequest(id: string): Promise<NumberPortRequest | undefined> {
    const [result] = await db.select().from(numberPortRequests).where(eq(numberPortRequests.id, id)).limit(1);
    return result;
  }

  async getAllNumberPortRequests(): Promise<NumberPortRequest[]> {
    return await db.select().from(numberPortRequests).orderBy(desc(numberPortRequests.createdAt));
  }

  async createNumberPortRequest(request: InsertNumberPortRequest): Promise<NumberPortRequest> {
    const [result] = await db.insert(numberPortRequests).values(request).returning();
    return result;
  }

  async updateNumberPortRequest(id: string, updates: Partial<NumberPortRequest>): Promise<NumberPortRequest | undefined> {
    const [result] = await db.update(numberPortRequests).set({ ...updates, updatedAt: new Date() }).where(eq(numberPortRequests.id, id)).returning();
    return result;
  }
}

export const storage = new PostgresStorage();
