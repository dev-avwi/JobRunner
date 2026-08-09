CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"entity_type" text,
	"entity_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"processed_at" timestamp DEFAULT now(),
	"result" text,
	"error_message" text,
	CONSTRAINT "automation_logs_automation_id_entity_type_entity_id_unique" UNIQUE("automation_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"trigger" jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_name" text NOT NULL,
	"abn" text,
	"phone" text,
	"email" text,
	"address" text,
	"logo_url" text,
	"detected_colors" json DEFAULT '[]'::json,
	"primary_color" text,
	"secondary_color" text,
	"accent_color" text,
	"custom_theme_enabled" boolean DEFAULT false,
	"gst_enabled" boolean DEFAULT false,
	"default_hourly_rate" numeric(10, 2) DEFAULT '100.00',
	"callout_fee" numeric(10, 2) DEFAULT '80.00',
	"quote_validity_days" integer DEFAULT 30,
	"invoice_prefix" text DEFAULT 'TT-',
	"quote_prefix" text DEFAULT 'QT-',
	"payment_instructions" text,
	"brand_color" text DEFAULT '#3B5998',
	"team_size" text DEFAULT 'solo',
	"number_of_employees" integer DEFAULT 1,
	"license_number" text,
	"regulator_registration" text,
	"insurance_details" text,
	"insurance_policy_number" text,
	"insurance_provider" text,
	"insurance_amount" text,
	"bank_details" text,
	"warranty_period" text DEFAULT '12 months',
	"late_fee_rate" text DEFAULT '1.5% per month',
	"quote_terms" text,
	"invoice_terms" text,
	"default_payment_terms_days" integer DEFAULT 14,
	"stripe_connect_account_id" text,
	"stripe_connect_onboarding_status" text DEFAULT 'not_started',
	"stripe_connect_tos_accepted_at" timestamp,
	"connect_charges_enabled" boolean DEFAULT false,
	"connect_payouts_enabled" boolean DEFAULT false,
	"platform_fee_percent" numeric(5, 2) DEFAULT '2.50',
	"auto_reminders_enabled" boolean DEFAULT true,
	"reminder_days" json DEFAULT '[7,14,30]'::json,
	"reminder_tone" text DEFAULT 'friendly',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'none',
	"current_period_end" timestamp,
	"seat_count" integer DEFAULT 0,
	"default_signature" text,
	"signature_name" text,
	"include_signature_on_quotes" boolean DEFAULT false,
	"include_signature_on_invoices" boolean DEFAULT false,
	"document_template" text DEFAULT 'professional',
	"document_template_settings" json,
	"theme_mode" text DEFAULT 'system',
	"twilio_phone_number" text,
	"twilio_sender_id" text,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"onboarding_completed" boolean DEFAULT false,
	"ai_enabled" boolean DEFAULT true,
	"ai_photo_analysis_enabled" boolean DEFAULT true,
	"ai_suggestions_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"text" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"saved_signature_data" text,
	"saved_signature_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"form_type" text DEFAULT 'general',
	"fields" json DEFAULT '[]'::json,
	"settings" json DEFAULT '{}'::json,
	"requires_signature" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_user_id" varchar NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_surveys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"client_id" varchar NOT NULL,
	"survey_type" text DEFAULT 'satisfaction',
	"questions" json DEFAULT '[]'::json,
	"responses" json DEFAULT '{}'::json,
	"overall_rating" integer,
	"completed_at" timestamp,
	"sent_at" timestamp,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_at" timestamp,
	"status" text DEFAULT 'pending',
	"public_review_posted" boolean DEFAULT false,
	"review_platform" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"email_verified" boolean DEFAULT false,
	"verification_token" text,
	"reset_token" text,
	"reset_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "digital_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_submission_id" varchar,
	"job_id" varchar,
	"quote_id" varchar,
	"invoice_id" varchar,
	"client_id" varchar,
	"signer_name" text NOT NULL,
	"signer_email" text,
	"signer_role" text DEFAULT 'client',
	"signature_data" text NOT NULL,
	"signed_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"document_type" text NOT NULL,
	"is_valid" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"content" text NOT NULL,
	"attachment_url" text,
	"attachment_type" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"family_key" varchar NOT NULL,
	"name" text NOT NULL,
	"trade_type" text NOT NULL,
	"rate_card_id" varchar,
	"styling" json DEFAULT '{}'::json,
	"sections" json DEFAULT '{}'::json,
	"defaults" json DEFAULT '{}'::json,
	"default_line_items" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"template_type" text DEFAULT 'custom',
	"target_audience" text DEFAULT 'all_clients',
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"status" text DEFAULT 'draft',
	"recipient_count" integer DEFAULT 0,
	"open_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"bounce_count" integer DEFAULT 0,
	"unsubscribe_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_delivery_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_integration_id" varchar,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"type" text NOT NULL,
	"related_id" varchar,
	"status" text DEFAULT 'pending',
	"sent_via" text,
	"message_id" text,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending',
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_password" text,
	"smtp_secure" boolean DEFAULT true,
	"email_address" text,
	"display_name" text,
	"last_used_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"model" text,
	"serial_number" text,
	"manufacturer" text,
	"purchase_date" timestamp,
	"purchase_price" numeric(10, 2),
	"current_value" numeric(10, 2),
	"warranty_expires_at" timestamp,
	"warranty_provider" text,
	"location" text,
	"status" text DEFAULT 'active',
	"assigned_to" varchar,
	"photos" json DEFAULT '[]'::json,
	"documents" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_maintenance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"equipment_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"cost" numeric(10, 2),
	"vendor" text,
	"performed_by" varchar,
	"status" text DEFAULT 'scheduled',
	"next_due_date" timestamp,
	"photos" json DEFAULT '[]'::json,
	"documents" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"category_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00',
	"description" text NOT NULL,
	"vendor" text,
	"receipt_url" text,
	"receipt_number" text,
	"expense_date" timestamp NOT NULL,
	"is_billable" boolean DEFAULT true,
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" text,
	"status" text DEFAULT 'pending',
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "external_accounting_ids" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_entity_type" varchar NOT NULL,
	"local_entity_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"external_id" varchar NOT NULL,
	"sync_status" varchar DEFAULT 'synced',
	"last_sync_at" timestamp,
	CONSTRAINT "external_accounting_ids_local_entity_type_local_entity_id_provider_unique" UNIQUE("local_entity_type","local_entity_id","provider")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" varchar NOT NULL,
	"job_id" varchar,
	"submitted_by" varchar,
	"customer_user_id" varchar,
	"submission_data" json DEFAULT '{}'::json,
	"submitted_at" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text,
	"status" text DEFAULT 'submitted',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "geofence_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"address" text,
	"distance_from_site" numeric(10, 2),
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_enabled" boolean DEFAULT false,
	"email_enabled" boolean DEFAULT false,
	"auto_send_invoices" boolean DEFAULT false,
	"auto_generate_payment_links" boolean DEFAULT false,
	"email_template" text,
	"payment_terms" text DEFAULT 'Net 30',
	"notify_quote_responses" boolean DEFAULT true,
	"notify_payment_confirmations" boolean DEFAULT true,
	"notify_overdue_invoices" boolean DEFAULT true,
	"notify_weekly_summary" boolean DEFAULT false,
	"google_calendar_connected" boolean DEFAULT false,
	"google_calendar_access_token" text,
	"google_calendar_refresh_token" text,
	"google_calendar_token_expiry" timestamp,
	"google_calendar_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"sku" text,
	"barcode" text,
	"unit" text DEFAULT 'each',
	"cost_price" numeric(10, 2),
	"sell_price" numeric(10, 2),
	"current_stock" integer DEFAULT 0,
	"minimum_stock" integer DEFAULT 0,
	"maximum_stock" integer,
	"reorder_level" integer DEFAULT 0,
	"reorder_quantity" integer,
	"supplier_id" varchar,
	"location" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"job_id" varchar,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"reference" text,
	"notes" text,
	"transaction_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_reminder_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"reminder_type" text NOT NULL,
	"days_past_due" integer,
	"sent_via" text,
	"email_sent" boolean DEFAULT false,
	"sms_sent" boolean DEFAULT false,
	"response" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"job_id" varchar,
	"quote_id" varchar,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"due_date" timestamp,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"receipt_sent_at" timestamp,
	"payment_reference" text,
	"payment_method" text,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"allow_online_payment" boolean DEFAULT false,
	"payment_token" text,
	"stripe_payment_link" text,
	"notes" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"template_id" varchar,
	"family_key" varchar,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"recurrence_interval" integer DEFAULT 1,
	"recurrence_end_date" timestamp,
	"parent_invoice_id" varchar,
	"next_recurrence_date" timestamp,
	"archived_at" timestamp,
	"xero_invoice_id" varchar,
	"xero_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_payment_token_unique" UNIQUE("payment_token")
);
--> statement-breakpoint
CREATE TABLE "job_chat" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"attachment_url" text,
	"attachment_name" text,
	"is_system_message" boolean DEFAULT false,
	"read_by" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_checkins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text DEFAULT 'checkin' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"accuracy" numeric(10, 2),
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"object_storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"category" text DEFAULT 'general',
	"caption" text,
	"taken_at" timestamp,
	"uploaded_by" varchar,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp,
	"scheduled_time" text,
	"estimated_duration" integer DEFAULT 60,
	"assigned_to" text,
	"notes" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"template_id" varchar,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"recurrence_interval" integer DEFAULT 1,
	"recurrence_end_date" timestamp,
	"parent_job_id" varchar,
	"next_recurrence_date" timestamp,
	"geofence_enabled" boolean DEFAULT false,
	"geofence_radius" integer DEFAULT 100,
	"geofence_auto_clock_in" boolean DEFAULT false,
	"geofence_auto_clock_out" boolean DEFAULT false,
	"calendar_event_id" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "line_item_catalog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"trade_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"default_qty" numeric(10, 2) DEFAULT '1.00',
	"tags" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(10, 2),
	"address" text,
	"speed" numeric(10, 2),
	"heading" numeric(10, 2),
	"altitude" numeric(10, 2),
	"battery_level" integer,
	"is_charging" boolean DEFAULT false,
	"activity_type" text DEFAULT 'stationary',
	"timestamp" timestamp NOT NULL,
	"tracking_type" text DEFAULT 'automatic',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "myob_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_id" varchar NOT NULL,
	"company_name" varchar,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"cf_username" text,
	"cf_password" text,
	"scope" varchar,
	"connected_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp,
	"status" varchar DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_id" varchar,
	"related_type" text,
	"read" boolean DEFAULT false,
	"dismissed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"invoice_id" varchar,
	"job_id" varchar,
	"client_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_client_secret" text,
	"paid_at" timestamp,
	"payment_method" text,
	"expires_at" timestamp,
	"qr_code_url" text,
	"notifications_sent" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" varchar NOT NULL,
	"inventory_item_id" varchar,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"line_total" numeric(10, 2) NOT NULL,
	"received_quantity" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"supplier_id" varchar NOT NULL,
	"job_id" varchar,
	"po_number" text NOT NULL,
	"order_date" timestamp DEFAULT now(),
	"required_date" timestamp,
	"delivery_date" timestamp,
	"status" text DEFAULT 'pending',
	"subtotal" numeric(10, 2) DEFAULT '0.00',
	"gst_amount" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) DEFAULT '0.00',
	"terms" text,
	"notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"device_id" text,
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cost" numeric(10, 2),
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"job_id" varchar,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"valid_until" timestamp,
	"sent_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"acceptance_token" varchar,
	"accepted_by" text,
	"acceptance_ip" text,
	"decline_reason" text,
	"notes" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"template_id" varchar,
	"family_key" varchar,
	"deposit_required" boolean DEFAULT false,
	"deposit_percent" numeric(5, 2),
	"deposit_amount" numeric(10, 2),
	"deposit_paid" boolean DEFAULT false,
	"deposit_paid_at" timestamp,
	"deposit_payment_intent_id" varchar,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "quotes_number_unique" UNIQUE("number"),
	CONSTRAINT "quotes_acceptance_token_unique" UNIQUE("acceptance_token")
);
--> statement-breakpoint
CREATE TABLE "rate_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"trade_type" text NOT NULL,
	"hourly_rate" numeric(10, 2) DEFAULT '100.00' NOT NULL,
	"callout_fee" numeric(10, 2) DEFAULT '80.00' NOT NULL,
	"material_markup_pct" numeric(5, 2) DEFAULT '20.00',
	"after_hours_multiplier" numeric(3, 2) DEFAULT '1.50',
	"gst_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"contract_value" numeric(10, 2),
	"frequency" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"next_job_date" timestamp NOT NULL,
	"auto_create_jobs" boolean DEFAULT true,
	"auto_send_invoices" boolean DEFAULT false,
	"job_template" json DEFAULT '{}'::json,
	"invoice_template" json DEFAULT '{}'::json,
	"status" text DEFAULT 'active',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"job_id" varchar,
	"scheduled_date" timestamp NOT NULL,
	"completed_date" timestamp,
	"status" text DEFAULT 'scheduled',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"report_type" text NOT NULL,
	"filters" json DEFAULT '{}'::json,
	"group_by" text,
	"date_range" json DEFAULT '{}'::json,
	"chart_type" text DEFAULT 'table',
	"is_scheduled" boolean DEFAULT false,
	"schedule_frequency" text,
	"email_recipients" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"job_ids" json DEFAULT '[]'::json,
	"start_address" text,
	"end_address" text,
	"waypoints" json DEFAULT '[]'::json,
	"distance" numeric(10, 2),
	"estimated_duration" integer,
	"actual_duration" integer,
	"optimized_order" json DEFAULT '[]'::json,
	"route_date" timestamp,
	"status" text DEFAULT 'saved',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"report_data" json DEFAULT '{}'::json,
	"generated_at" timestamp DEFAULT now(),
	"file_url" text,
	"parameters" json DEFAULT '{}'::json,
	"is_auto_generated" boolean DEFAULT false,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_automation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"message_id" varchar,
	"status" text DEFAULT 'sent',
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sms_automation_logs_rule_id_entity_type_entity_id_unique" UNIQUE("rule_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "sms_automation_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true,
	"trigger_type" text NOT NULL,
	"delay_minutes" integer DEFAULT 0,
	"template_id" varchar,
	"custom_message" text,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"last_triggered_at" timestamp,
	"trigger_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_booking_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" text DEFAULT 'pending',
	"client_response" text,
	"client_notes" text,
	"expires_at" timestamp NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sms_booking_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sms_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"client_id" varchar,
	"job_id" varchar,
	"client_phone" varchar(20) NOT NULL,
	"client_name" varchar(255),
	"last_message_at" timestamp DEFAULT now(),
	"unread_count" integer DEFAULT 0,
	"is_archived" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"sender_user_id" varchar,
	"status" text DEFAULT 'pending',
	"twilio_sid" varchar(50),
	"error_message" text,
	"is_quick_action" boolean DEFAULT false,
	"quick_action_type" text,
	"media_urls" jsonb DEFAULT '[]'::jsonb,
	"is_job_request" boolean DEFAULT false,
	"intent_confidence" text,
	"intent_type" text,
	"suggested_job_title" varchar(100),
	"suggested_description" text,
	"job_created_from_sms" varchar,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" text DEFAULT 'general',
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_tracking_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"team_member_id" varchar,
	"business_owner_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_location_lat" numeric(10, 7),
	"last_location_lng" numeric(10, 7),
	"last_location_at" timestamp,
	"estimated_arrival" timestamp,
	"expires_at" timestamp NOT NULL,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sms_tracking_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"scheduled_date" timestamp NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_payouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"invoice_id" varchar,
	"stripe_payout_id" text,
	"stripe_transfer_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'aud',
	"status" text DEFAULT 'pending',
	"failure_message" text,
	"arrival_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "stripe_payouts_stripe_payout_id_unique" UNIQUE("stripe_payout_id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"abn" text,
	"account_number" text,
	"payment_terms" text DEFAULT 'Net 30',
	"discount_rate" numeric(5, 2),
	"credit_limit" numeric(10, 2),
	"notes" text,
	"rating" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_chat" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"attachment_url" text,
	"attachment_name" text,
	"is_announcement" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"read_by" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"member_id" varchar,
	"role_id" varchar NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"invite_status" text DEFAULT 'pending' NOT NULL,
	"invite_token" text,
	"invite_sent_at" timestamp,
	"invite_accepted_at" timestamp,
	"custom_permissions" json,
	"use_custom_permissions" boolean DEFAULT false,
	"allow_location_sharing" boolean DEFAULT true,
	"location_enabled_by_owner" boolean DEFAULT true,
	"hourly_rate" numeric(10, 2),
	"start_date" timestamp,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"hourly_rate" numeric(10, 2),
	"description" text,
	"is_break" boolean DEFAULT false,
	"is_overtime" boolean DEFAULT false,
	"approved" boolean DEFAULT false,
	"approved_by" varchar,
	"origin" text DEFAULT 'manual',
	"geofence_event_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"week_starting" timestamp NOT NULL,
	"total_hours" numeric(10, 2) DEFAULT '0.00',
	"regular_hours" numeric(10, 2) DEFAULT '0.00',
	"overtime_hours" numeric(10, 2) DEFAULT '0.00',
	"total_earnings" numeric(10, 2) DEFAULT '0.00',
	"status" text DEFAULT 'draft',
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tradie_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"current_latitude" numeric(10, 7),
	"current_longitude" numeric(10, 7),
	"current_address" text,
	"activity_status" text DEFAULT 'offline',
	"current_job_id" varchar,
	"battery_level" integer,
	"is_charging" boolean DEFAULT false,
	"speed" numeric(10, 2),
	"heading" numeric(10, 2),
	"last_seen_at" timestamp,
	"last_location_update" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tradie_status_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"permissions" json DEFAULT '[]'::json,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"username" text,
	"password" text,
	"google_id" varchar,
	"apple_id" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"theme_color" varchar,
	"trade_type" text,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"email_verification_expires_at" timestamp,
	"password_reset_token" text,
	"password_reset_expires_at" timestamp,
	"subscription_tier" text DEFAULT 'free',
	"jobs_created_this_month" integer DEFAULT 0,
	"invoices_created_this_month" integer DEFAULT 0,
	"quotes_created_this_month" integer DEFAULT 0,
	"usage_reset_date" timestamp DEFAULT now(),
	"trial_started_at" timestamp,
	"trial_ends_at" timestamp,
	"trial_status" text,
	"subscription_reset_date" timestamp DEFAULT now(),
	"is_platform_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id")
);
--> statement-breakpoint
CREATE TABLE "voice_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"object_storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text DEFAULT 'audio/webm',
	"duration" integer,
	"title" text,
	"transcription" text,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "xero_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tenant_name" varchar,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"scope" varchar,
	"connected_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp,
	"status" varchar DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE "xero_sync_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"last_sync_cursor" varchar,
	"last_sync_at" timestamp,
	"sync_direction" varchar DEFAULT 'bidirectional'
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_user_id_customer_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_surveys" ADD CONSTRAINT "customer_surveys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_surveys" ADD CONSTRAINT "customer_surveys_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_surveys" ADD CONSTRAINT "customer_surveys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_users" ADD CONSTRAINT "customer_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_users" ADD CONSTRAINT "customer_users_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_form_submission_id_form_submissions_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_email_integration_id_email_integrations_id_fk" FOREIGN KEY ("email_integration_id") REFERENCES "public"."email_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_integrations" ADD CONSTRAINT "email_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_customer_user_id_customer_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminder_logs" ADD CONSTRAINT "invoice_reminder_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminder_logs" ADD CONSTRAINT "invoice_reminder_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat" ADD CONSTRAINT "job_chat_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat" ADD CONSTRAINT "job_chat_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checkins" ADD CONSTRAINT "job_checkins_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checkins" ADD CONSTRAINT "job_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_catalog" ADD CONSTRAINT "line_item_catalog_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_tracking" ADD CONSTRAINT "location_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_tracking" ADD CONSTRAINT "location_tracking_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "myob_connections" ADD CONSTRAINT "myob_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_contract_id_recurring_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."recurring_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_configurations" ADD CONSTRAINT "report_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_config_id_report_configurations_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."report_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_automation_logs" ADD CONSTRAINT "sms_automation_logs_rule_id_sms_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."sms_automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_automation_logs" ADD CONSTRAINT "sms_automation_logs_message_id_sms_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."sms_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_automation_rules" ADD CONSTRAINT "sms_automation_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_automation_rules" ADD CONSTRAINT "sms_automation_rules_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_booking_links" ADD CONSTRAINT "sms_booking_links_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_booking_links" ADD CONSTRAINT "sms_booking_links_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_conversations" ADD CONSTRAINT "sms_conversations_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_conversations" ADD CONSTRAINT "sms_conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_conversations" ADD CONSTRAINT "sms_conversations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_conversation_id_sms_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sms_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_job_created_from_sms_jobs_id_fk" FOREIGN KEY ("job_created_from_sms") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_tracking_links" ADD CONSTRAINT "sms_tracking_links_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_tracking_links" ADD CONSTRAINT "sms_tracking_links_team_member_id_users_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_tracking_links" ADD CONSTRAINT "sms_tracking_links_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payouts" ADD CONSTRAINT "stripe_payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payouts" ADD CONSTRAINT "stripe_payouts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat" ADD CONSTRAINT "team_chat_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat" ADD CONSTRAINT "team_chat_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_role_id_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradie_status" ADD CONSTRAINT "tradie_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradie_status" ADD CONSTRAINT "tradie_status_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradie_status" ADD CONSTRAINT "tradie_status_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_sync_state" ADD CONSTRAINT "xero_sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");