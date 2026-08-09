CREATE TABLE "business_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"family" text NOT NULL,
	"purpose" text DEFAULT 'general',
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"subject" text,
	"content" text NOT NULL,
	"content_html" text,
	"sections" jsonb DEFAULT '[]'::jsonb,
	"merge_fields" text[] DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_asset_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"asset_id" varchar NOT NULL,
	"job_id" varchar,
	"service_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"service_date" timestamp NOT NULL,
	"performed_by" varchar,
	"cost" numeric(10, 2),
	"labor_hours" numeric(5, 2),
	"parts_used" json DEFAULT '[]'::json,
	"findings" text,
	"recommendations" text,
	"photos" json DEFAULT '[]'::json,
	"documents" json DEFAULT '[]'::json,
	"next_service_due" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"asset_type" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"install_date" timestamp,
	"installed_by" text,
	"purchase_price" numeric(10, 2),
	"warranty_expires_at" timestamp,
	"warranty_provider" text,
	"warranty_notes" text,
	"location" text,
	"notes" text,
	"specifications" json DEFAULT '{}'::json,
	"photos" json DEFAULT '[]'::json,
	"documents" json DEFAULT '[]'::json,
	"last_service_date" timestamp,
	"next_service_due" timestamp,
	"service_interval_months" integer,
	"status" text DEFAULT 'active',
	"replaced_by_asset_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"title" text NOT NULL,
	"document_type" text DEFAULT 'other' NOT NULL,
	"file_name" text NOT NULL,
	"object_storage_key" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"channel" varchar(10) NOT NULL,
	"category" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"invoice_id" varchar,
	"client_id" varchar,
	"payment_request_id" varchar,
	"receipt_number" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00',
	"subtotal" numeric(10, 2) DEFAULT '0.00',
	"description" text,
	"payment_method" text,
	"payment_reference" text,
	"paid_at" timestamp NOT NULL,
	"pdf_url" text,
	"signature_url" text,
	"email_sent_at" timestamp,
	"sms_sent_at" timestamp,
	"recipient_email" text,
	"recipient_phone" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "template_analysis_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"template_type" text NOT NULL,
	"original_file_name" text NOT NULL,
	"original_file_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"analysis_result" jsonb,
	"error" text,
	"created_template_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "payment_method_last4" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "payment_method_brand" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "default_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "next_billing_date" timestamp;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "last_billing_reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "billing_reminder_days" json DEFAULT '[3,1]'::json;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "billing_reminders_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "trial_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "trial_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "trial_converted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "email_sending_mode" text DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "google_calendar_connected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "google_calendar_access_token" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "google_calendar_refresh_token" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "google_calendar_token_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "google_calendar_email" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "invoiced_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_xero_import" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "xero_job_id" varchar;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "xero_contact_id" varchar;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "xero_quote_id" varchar;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "xero_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "intended_tier" text;--> statement-breakpoint
ALTER TABLE "business_templates" ADD CONSTRAINT "business_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_asset_id_client_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."client_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_analysis_jobs" ADD CONSTRAINT "template_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_analysis_jobs" ADD CONSTRAINT "template_analysis_jobs_created_template_id_document_templates_id_fk" FOREIGN KEY ("created_template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;