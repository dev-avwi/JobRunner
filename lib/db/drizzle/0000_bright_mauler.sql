CREATE TABLE "activity_feed" (
	"id" varchar PRIMARY KEY NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"actor_user_id" varchar,
	"actor_name" varchar(255),
	"team_member_id" varchar,
	"activity_type" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar,
	"entity_title" varchar(255),
	"description" text,
	"metadata" jsonb,
	"is_important" boolean DEFAULT false,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "addon_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"addon" text NOT NULL,
	"source" text DEFAULT 'apple' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"apple_product_id" text,
	"apple_original_transaction_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_receptionist_calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"vapi_call_id" text NOT NULL,
	"phone_number_id" varchar,
	"called_number" text,
	"caller_phone" text,
	"caller_name" text,
	"status" text DEFAULT 'ringing' NOT NULL,
	"duration" integer,
	"summary" text,
	"transcript" text,
	"recording_url" text,
	"lead_id" varchar,
	"outcome" text,
	"transferred_to" text,
	"transfer_status" text,
	"caller_intent" text,
	"extracted_info" json,
	"ended_reason" text,
	"cost" numeric(8, 4),
	"sentiment" text,
	"sentiment_score" real,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_receptionist_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"label" text,
	"vapi_assistant_id" text,
	"vapi_phone_number_id" text,
	"voice_id" text,
	"voice_name" text DEFAULT 'Jess',
	"greeting" text,
	"mode" text DEFAULT 'off' NOT NULL,
	"transfer_numbers" json DEFAULT '[]'::json,
	"business_hours" json,
	"enabled" boolean DEFAULT false NOT NULL,
	"dedicated_phone_number" text,
	"approval_status" text DEFAULT 'none',
	"provisioning_error" text,
	"stripe_subscription_item_id" text,
	"twilio_number_sid" text,
	"provisioned_at" timestamp,
	"approved_at" timestamp,
	"knowledge_bank" json,
	"sms_notifications" boolean DEFAULT false NOT NULL,
	"recording_enabled" boolean DEFAULT false NOT NULL,
	"voice_stability" real DEFAULT 0.5,
	"voice_clarity" real DEFAULT 0.75,
	"voice_speed" real DEFAULT 1,
	"voice_style_exaggeration" real DEFAULT 0,
	"voice_speaker_boost" boolean DEFAULT false,
	"voicemail_detection_enabled" boolean DEFAULT true,
	"voicemail_message" text,
	"silence_timeout_seconds" integer DEFAULT 30,
	"max_call_duration_seconds" integer DEFAULT 600,
	"end_call_message" text,
	"background_sound" text DEFAULT 'off',
	"ai_model" text DEFAULT 'gpt-4o-mini',
	"ai_max_tokens" integer DEFAULT 250,
	"ai_temperature" real DEFAULT 0.5,
	"custom_instructions" text,
	"auto_reply_enabled" boolean DEFAULT true NOT NULL,
	"auto_reply_message" text DEFAULT 'Thanks for calling {{business_name}}. We got your message and will get back to you shortly. — Sent via JobRunner',
	"last_latency_ms" integer,
	"last_latency_checked_at" timestamp,
	"latency_status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assignment_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar NOT NULL,
	"target_user_id" varchar NOT NULL,
	"action_type" text NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
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
	CONSTRAINT "uniqueAutomationEntity" UNIQUE("automation_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "automation_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_reminder_enabled" boolean DEFAULT false,
	"job_reminder_hours_before" integer DEFAULT 24,
	"job_reminder_type" text DEFAULT 'sms',
	"quote_follow_up_enabled" boolean DEFAULT false,
	"quote_follow_up_days" integer DEFAULT 3,
	"quote_follow_up_type" text DEFAULT 'email',
	"invoice_reminder_enabled" boolean DEFAULT false,
	"invoice_reminder_days_before_due" integer DEFAULT 3,
	"invoice_overdue_reminder_days" integer DEFAULT 7,
	"invoice_reminder_type" text DEFAULT 'email',
	"quote_follow_up_message" text,
	"job_reminder_message" text,
	"invoice_reminder_message" text,
	"review_request_message" text,
	"auto_invoice_on_complete" boolean DEFAULT false,
	"auto_review_request" boolean DEFAULT false,
	"auto_review_request_type" text DEFAULT 'email',
	"require_photo_before_start" boolean DEFAULT false,
	"require_photo_after_complete" boolean DEFAULT false,
	"photo_requirements_enabled" boolean DEFAULT false,
	"auto_check_in_on_arrival" boolean DEFAULT false,
	"auto_check_out_on_departure" boolean DEFAULT false,
	"gps_auto_check_in_enabled" boolean DEFAULT false,
	"technician_en_route_enabled" boolean DEFAULT false,
	"technician_en_route_channel" text DEFAULT 'sms',
	"daily_summary_enabled" boolean DEFAULT false,
	"daily_summary_time" text DEFAULT '18:00',
	"daily_summary_last_sent" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "automation_settings_user_id_unique" UNIQUE("user_id")
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
	"time_rounding_minutes" integer DEFAULT 5,
	"minimum_callout_hours" numeric(10, 2) DEFAULT '0',
	"include_location_proof_on_invoices" boolean DEFAULT true,
	"bill_breaks" boolean DEFAULT false,
	"callout_fee" numeric(10, 2) DEFAULT '80.00',
	"quote_validity_days" integer DEFAULT 30,
	"invoice_prefix" text DEFAULT 'TT-',
	"quote_prefix" text DEFAULT 'QT-',
	"invoice_next_number" integer,
	"quote_next_number" integer,
	"payment_instructions" text,
	"brand_color" text DEFAULT '#2563EB',
	"team_size" text DEFAULT 'solo',
	"account_type" text DEFAULT 'business',
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
	"subscription_paused_at" timestamp,
	"subscription_canceled_at" timestamp,
	"data_retention_expires_at" timestamp,
	"current_period_end" timestamp,
	"seat_count" integer DEFAULT 0,
	"payment_method_last4" text,
	"payment_method_brand" text,
	"default_payment_method_id" text,
	"next_billing_date" timestamp,
	"last_billing_reminder_sent_at" timestamp,
	"billing_reminder_days" json DEFAULT '[3,1]'::json,
	"billing_reminders_enabled" boolean DEFAULT true,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"trial_converted" boolean DEFAULT false,
	"default_signature" text,
	"signature_name" text,
	"include_signature_on_quotes" boolean DEFAULT false,
	"include_signature_on_invoices" boolean DEFAULT false,
	"document_template" text DEFAULT 'professional',
	"document_template_settings" json,
	"theme_mode" text DEFAULT 'system',
	"sms_mode" text DEFAULT 'standard',
	"geofence_sms_alerts" boolean DEFAULT false,
	"dedicated_phone_number" text,
	"archived_phone_number" text,
	"sms_sender_attribution" text DEFAULT 'off',
	"vapi_assistant_id" text,
	"vapi_phone_number_id" text,
	"ai_receptionist_mode" text DEFAULT 'off',
	"ai_receptionist_voice" text DEFAULT 'Jess',
	"ai_receptionist_greeting" text,
	"ai_receptionist_transfer_numbers" json DEFAULT '[]'::json,
	"ai_receptionist_business_hours" json,
	"ai_receptionist_enabled" boolean DEFAULT false,
	"twilio_phone_number" text,
	"twilio_sender_id" text,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"onboarding_completed" boolean DEFAULT false,
	"has_seen_walkthrough" boolean DEFAULT false,
	"onboarding_level" integer DEFAULT 0,
	"ai_enabled" boolean DEFAULT true,
	"ai_photo_analysis_enabled" boolean DEFAULT true,
	"ai_suggestions_enabled" boolean DEFAULT true,
	"email_sending_mode" text DEFAULT 'manual',
	"google_calendar_connected" boolean DEFAULT false,
	"google_calendar_access_token" text,
	"google_calendar_refresh_token" text,
	"google_calendar_token_expiry" timestamp,
	"google_calendar_email" text,
	"timezone" text DEFAULT 'Australia/Sydney',
	"xero_sales_account_code" text DEFAULT '200',
	"xero_bank_account_code" text DEFAULT '090',
	"xero_expense_account_code" text DEFAULT '400',
	"xero_tax_type" text DEFAULT 'OUTPUT',
	"quickbooks_default_item_ref" json,
	"xero_sales_account_id" text,
	"xero_tax_rate_id" text,
	"xero_default_item_code" text,
	"xero_active_tenant_id" text,
	"xero_last_webhook_at" timestamp,
	"qbo_sales_account_id" text,
	"qbo_tax_rate_id" text,
	"qbo_default_item_id" text,
	"qbo_last_webhook_at" timestamp,
	"myob_income_account_id" text,
	"myob_tax_code_id" text,
	"myob_default_item_id" text,
	"outlook_connected" boolean DEFAULT false,
	"outlook_access_token" text,
	"outlook_refresh_token" text,
	"outlook_token_expiry" timestamp,
	"outlook_email" text,
	"bank_bsb" text,
	"bank_account_number" text,
	"bank_account_name" text,
	"accept_card_payments" boolean DEFAULT true,
	"accept_bank_transfer" boolean DEFAULT true,
	"accept_becs_debit" boolean DEFAULT false,
	"accept_payto" boolean DEFAULT false,
	"enable_card_surcharge" boolean DEFAULT false,
	"card_surcharge_percent" numeric(4, 2) DEFAULT '1.95',
	"card_surcharge_fixed_cents" integer DEFAULT 30,
	"surcharge_disclaimer" text,
	"enable_early_payment_discount" boolean DEFAULT false,
	"early_payment_discount_percent" numeric(4, 2) DEFAULT '2.00',
	"early_payment_discount_days" integer DEFAULT 7,
	"default_payment_method" text DEFAULT 'card',
	"google_review_url" text,
	"booking_slug" text,
	"booking_page_enabled" boolean DEFAULT false,
	"booking_page_services" json DEFAULT '[]'::json,
	"booking_page_description" text,
	"email_on_quote_accepted" boolean DEFAULT false,
	"email_on_invoice_paid" boolean DEFAULT false,
	"require_take5_before_start" boolean DEFAULT false,
	"block_job_start_on_expired_compliance" boolean DEFAULT false,
	"simple_mode" boolean DEFAULT true,
	"schedule_start_hour" integer DEFAULT 6,
	"schedule_end_hour" integer DEFAULT 20,
	"tracking_hours_enabled" boolean DEFAULT false,
	"work_hours_start" text DEFAULT '07:00',
	"work_hours_end" text DEFAULT '17:00',
	"work_days" json DEFAULT '[1,2,3,4,5]'::json,
	"sheet_sync_enabled" boolean DEFAULT false,
	"sheet_sync_target" text DEFAULT 'google_sheets',
	"sheet_sync_frequency" text DEFAULT 'daily',
	"sheet_sync_data_types" json DEFAULT '["clients","jobs","invoices","payments"]'::json,
	"google_sheets_connected" boolean DEFAULT false,
	"google_sheets_access_token" text,
	"google_sheets_refresh_token" text,
	"google_sheets_token_expiry" timestamp,
	"google_sheets_email" text,
	"sheet_sync_spreadsheet_id" text,
	"sheet_sync_spreadsheet_url" text,
	"sheet_sync_last_run_at" timestamp,
	"sheet_sync_last_status" text,
	"sheet_sync_last_error" text,
	"sheet_sync_recipients" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"family" text NOT NULL,
	"purpose" text DEFAULT 'general',
	"trade_type" text DEFAULT 'general' NOT NULL,
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
	"tags" text[] DEFAULT '{}'::text[],
	"client_type" text,
	"referral_source" text,
	"xero_contact_id" varchar,
	"xero_synced_at" timestamp,
	"is_sample" boolean DEFAULT false NOT NULL,
	"import_run_id" varchar,
	"import_row_number" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"document_number" text,
	"issuer" text,
	"holder_name" text,
	"holder_user_id" varchar,
	"expiry_date" timestamp,
	"coverage_amount" text,
	"insurer" text,
	"vehicle_plate" text,
	"attachment_url" text,
	"attachment_type" text,
	"notes" text,
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
	"trade_type" text DEFAULT 'general',
	"fields" json DEFAULT '[]'::json,
	"settings" json DEFAULT '{}'::json,
	"requires_signature" boolean DEFAULT false,
	"is_job_card" boolean DEFAULT false,
	"block_job_completion" boolean DEFAULT false,
	"task_rules" json DEFAULT '[]'::json,
	"is_default" boolean DEFAULT false,
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
CREATE TABLE "defects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'reported' NOT NULL,
	"reported_by" text,
	"reported_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"resolution_notes" text,
	"warranty_claim_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "digital_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_submission_id" varchar,
	"assignment_id" varchar,
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
	"is_default" boolean DEFAULT false,
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
	"user_id" varchar,
	"email_integration_id" varchar,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"type" text,
	"related_id" varchar,
	"status" text DEFAULT 'pending',
	"sent_via" text,
	"message_id" text,
	"error_message" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"bounce_reason" text,
	"last_event_type" text,
	"last_event_at" timestamp,
	"open_count" integer DEFAULT 0,
	"click_count" integer DEFAULT 0,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 5,
	"next_retry_at" timestamp,
	"permanently_failed" boolean DEFAULT false,
	"payload_json" jsonb,
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
CREATE TABLE "error_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"user_id" varchar,
	"metadata" jsonb,
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "form_submission_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"submission_data" json DEFAULT '{}'::json,
	"edited_by" varchar,
	"edited_at" timestamp DEFAULT now()
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
	"dwell_seconds" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gps_signal_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"job_id" varchar,
	"event_type" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"accuracy" numeric(10, 2),
	"address" text,
	"battery_level" integer,
	"is_charging" boolean DEFAULT false,
	"duration_seconds" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hazard_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"date_identified" text NOT NULL,
	"time_identified" text NOT NULL,
	"recommended_action" text NOT NULL,
	"date_reported_to_supervisor" text,
	"time_reported_to_supervisor" text,
	"reported_by" text NOT NULL,
	"supervisor_name" text,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"photos" text[],
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(512) NOT NULL,
	"response" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "idempotency_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text,
	"file_size" integer,
	"source" text DEFAULT 'csv' NOT NULL,
	"platform" text,
	"type" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"records_imported" integer DEFAULT 0 NOT NULL,
	"records_merged" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"records_removed" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"undone_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"incident_type" text DEFAULT 'near_miss' NOT NULL,
	"severity" text DEFAULT 'minor' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"incident_date" timestamp DEFAULT now() NOT NULL,
	"reported_to" text,
	"reported_to_role" text,
	"witnesses" json,
	"immediate_actions" text,
	"photos" json,
	"injury_details" text,
	"body_part_affected" text,
	"treatment_provided" text,
	"worker_name" text,
	"is_notifiable" boolean DEFAULT false,
	"status" text DEFAULT 'open' NOT NULL,
	"follow_up_actions" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"notify_job_assigned" boolean DEFAULT true,
	"notify_job_updates" boolean DEFAULT true,
	"notify_job_reminders" boolean DEFAULT true,
	"notify_team_messages" boolean DEFAULT true,
	"notify_team_locations" boolean DEFAULT true,
	"notify_daily_summary" boolean DEFAULT false,
	"smart_running_late_enabled" boolean DEFAULT true,
	"push_notifications_enabled" boolean DEFAULT true,
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
CREATE TABLE "invite_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"code" varchar(8) NOT NULL,
	"role_type" text DEFAULT 'worker' NOT NULL,
	"role_id" varchar,
	"max_uses" integer DEFAULT 10 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invite_codes_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invoice_edits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"edited_by" varchar NOT NULL,
	"edited_at" timestamp DEFAULT now(),
	"edit_reason" text,
	"field_changed" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"edit_source" text DEFAULT 'manual'
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"item_code" text,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"source_type" text,
	"source_id" varchar,
	"rate_snapshot" numeric(10, 2),
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
	"is_xero_import" boolean DEFAULT false,
	"xero_invoice_id" varchar,
	"xero_contact_id" varchar,
	"xero_synced_at" timestamp,
	"quickbooks_invoice_id" varchar,
	"quickbooks_synced_at" timestamp,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"document_template" text,
	"document_template_settings" json,
	"locked_at" timestamp,
	"locked_reason" text,
	"calculation_hash" text,
	"retention_percent" numeric(5, 2),
	"retention_amount" numeric(10, 2),
	"amount_paid" numeric(10, 2) DEFAULT '0.00',
	"payment_milestones" jsonb,
	"deposit_required" boolean DEFAULT false,
	"deposit_percent" numeric(5, 2),
	"deposit_amount" numeric(10, 2),
	"deposit_paid" boolean DEFAULT false,
	"deposit_paid_at" timestamp,
	"is_sample" boolean DEFAULT false NOT NULL,
	"import_run_id" varchar,
	"import_row_number" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_payment_token_unique" UNIQUE("payment_token")
);
--> statement-breakpoint
CREATE TABLE "job_assignment_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"team_member_id" varchar NOT NULL,
	"requester_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_by" varchar,
	"responded_at" timestamp,
	"response_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"team_member_id" varchar,
	"hourly_rate_override" numeric(10, 2),
	"display_name" text,
	"hide_name_on_invoice" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"assigned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"assignment_status" text DEFAULT 'assigned',
	"worker_display_name_snapshot" text,
	"worker_phone_snapshot" text,
	"show_worker_phone_to_client" boolean DEFAULT false,
	"show_worker_name_to_client" boolean DEFAULT true,
	"last_sms_sent_at" timestamp,
	"travel_started_at" timestamp,
	"arrived_at" timestamp,
	"eta_minutes" integer,
	"eta_updated_at" timestamp,
	"accepted_at" timestamp,
	"accepted_by_name" text,
	"acceptance_signature_data" text,
	"confidentiality_agreed" boolean DEFAULT false,
	"acceptance_ip_address" text,
	"acceptance_user_agent" text,
	"is_primary" boolean DEFAULT false,
	"completed_at" timestamp
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
CREATE TABLE "job_equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"equipment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"notes" text,
	"hours_used" numeric(8, 2),
	"km_travelled" numeric(10, 2),
	"capacity_used" text,
	"capacity_available" text,
	"post_job_notes" text,
	"was_oversized" boolean DEFAULT false,
	"completed_at" timestamp,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"invite_code" varchar(64) NOT NULL,
	"email" varchar(255),
	"role" varchar(50) DEFAULT 'subcontractor',
	"permissions" jsonb DEFAULT '["view_job","add_notes"]'::jsonb,
	"expires_at" timestamp,
	"used_at" timestamp,
	"used_by" varchar,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "job_invites_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "job_materials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(10, 2) DEFAULT '1',
	"unit" text DEFAULT 'each',
	"unit_cost" numeric(10, 2) DEFAULT '0',
	"unit_price" numeric(10, 2) DEFAULT '0',
	"total_cost" numeric(10, 2) DEFAULT '0',
	"total_price" numeric(10, 2) DEFAULT '0',
	"supplier" text,
	"tracking_number" text,
	"tracking_carrier" text,
	"tracking_url" text,
	"status" text DEFAULT 'needed',
	"notes" text,
	"markup_percent" numeric(5, 2),
	"receipt_photo_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_photo_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"stage" text NOT NULL,
	"description" text NOT NULL,
	"is_required" boolean DEFAULT true,
	"is_fulfilled" boolean DEFAULT false,
	"fulfilled_at" timestamp,
	"photo_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"object_storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"category" text DEFAULT 'general',
	"caption" text,
	"taken_at" timestamp,
	"uploaded_by" varchar,
	"latitude" double precision,
	"longitude" double precision,
	"address" text,
	"tags" text[] DEFAULT '{}',
	"ai_suggested_category" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_portal_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"assignment_id" varchar,
	"user_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"last_accessed_at" timestamp,
	"access_count" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"show_timeline" boolean DEFAULT true,
	"show_photos" boolean DEFAULT true,
	"show_checklist" boolean DEFAULT true,
	"show_activity_feed" boolean DEFAULT true,
	"client_message" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "job_portal_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "job_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text DEFAULT 'sms' NOT NULL,
	"send_at" timestamp NOT NULL,
	"hours_before_job" integer DEFAULT 24 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"preferred_date" timestamp,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"client_notes" text,
	"preferred_worker_id" varchar,
	"preferred_worker_name" text,
	"reference_job_id" varchar,
	"reference_job_title" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"review_notes" text,
	"job_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_variations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reason" text,
	"additional_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar,
	"created_by_name" text,
	"sent_at" timestamp,
	"approved_at" timestamp,
	"approved_by_name" text,
	"approved_by_signature" text,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"cancellation_reason" text,
	"scheduled_at" timestamp,
	"scheduled_time" text,
	"schedule_order" integer,
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
	"started_at" timestamp,
	"completed_at" timestamp,
	"invoiced_at" timestamp,
	"geofence_enabled" boolean DEFAULT false,
	"geofence_radius" integer DEFAULT 100,
	"geofence_auto_clock_in" boolean DEFAULT false,
	"geofence_auto_clock_out" boolean DEFAULT false,
	"calendar_event_id" text,
	"archived_at" timestamp,
	"is_xero_import" boolean DEFAULT false,
	"xero_job_id" varchar,
	"xero_contact_id" varchar,
	"xero_quote_id" varchar,
	"xero_synced_at" timestamp,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"worker_status" text,
	"worker_status_updated_at" timestamp,
	"worker_eta" text,
	"worker_eta_minutes" integer,
	"portal_enabled" boolean DEFAULT false,
	"requires_inspection" boolean DEFAULT false,
	"inspection_completed_at" timestamp,
	"inspection_notes" text,
	"lead_source" text,
	"lead_id" varchar,
	"version" integer DEFAULT 1 NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"import_run_id" varchar,
	"import_row_number" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jsa_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"site_address" text,
	"assessed_by" text,
	"assessed_date" timestamp DEFAULT now(),
	"ppe_requirements" json,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jsa_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jsa_id" varchar NOT NULL,
	"step_number" integer DEFAULT 1 NOT NULL,
	"task_description" text NOT NULL,
	"hazards" text NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"control_measures" text NOT NULL,
	"responsible_person" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"source" text DEFAULT 'other',
	"status" text DEFAULT 'new',
	"description" text,
	"estimated_value" numeric(10, 2),
	"notes" text,
	"follow_up_date" timestamp,
	"won_lost_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "line_item_catalog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"trade_type" text NOT NULL,
	"item_code" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"default_qty" numeric(10, 2) DEFAULT '1.00',
	"tags" json DEFAULT '[]'::json,
	"import_run_id" varchar,
	"import_row_number" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_pings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" double precision,
	"recorded_at" timestamp DEFAULT now()
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
	"priority" text DEFAULT 'info',
	"action_url" text,
	"action_label" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "number_port_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phone_number" text NOT NULL,
	"current_carrier" text NOT NULL,
	"account_number" text NOT NULL,
	"authorisation_agreed" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"admin_notes" text,
	"estimated_completion_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_installments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" varchar NOT NULL,
	"installment_number" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending',
	"paid_at" timestamp,
	"paid_amount" numeric(10, 2),
	"payment_method" text,
	"stripe_payment_intent_id" varchar,
	"reminder_sent_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by" varchar,
	"paid_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"invoice_id" varchar,
	"job_id" varchar,
	"client_id" varchar,
	"subcontractor_invoice_id" varchar,
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
CREATE TABLE "payment_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"number_of_installments" integer NOT NULL,
	"frequency" text DEFAULT 'monthly',
	"start_date" timestamp NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"worker_user_id" varchar NOT NULL,
	"team_member_id" varchar,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"regular_hours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"overtime_hours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_hours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"gross_pay" numeric(10, 2) DEFAULT '0' NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"reference" text,
	"notes" text,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"remittance_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permission_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"requested_permissions" json NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_by" varchar,
	"responded_at" timestamp,
	"response_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"session_token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "portal_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "portal_verification_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified" boolean DEFAULT false,
	"attempts" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppe_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"worker_name" text NOT NULL,
	"date" text NOT NULL,
	"hard_hat" boolean DEFAULT false NOT NULL,
	"hi_vis" boolean DEFAULT false NOT NULL,
	"safety_boots" boolean DEFAULT false NOT NULL,
	"safety_glasses" boolean DEFAULT false NOT NULL,
	"hearing_protection" boolean DEFAULT false NOT NULL,
	"gloves" boolean DEFAULT false NOT NULL,
	"sunscreen" boolean DEFAULT false NOT NULL,
	"respirator" boolean DEFAULT false NOT NULL,
	"safety_harness" boolean DEFAULT false NOT NULL,
	"other_ppe" text,
	"all_correct" boolean DEFAULT false NOT NULL,
	"supervisor_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "quick_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"label" varchar(60) NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"realm_id" varchar NOT NULL,
	"company_name" varchar,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp,
	"scope" varchar,
	"connected_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp,
	"status" varchar DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar NOT NULL,
	"option_id" varchar,
	"item_code" text,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cost" numeric(10, 2),
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_recommended" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trade_type" text DEFAULT 'general',
	"job_type" text,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"edited_by" varchar,
	"change_note" text,
	"snapshot" jsonb NOT NULL,
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
	"acceptance_signature_data" text,
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
	"is_multi_option" boolean DEFAULT false,
	"selected_option_id" varchar,
	"is_xero_import" boolean DEFAULT false,
	"xero_quote_id" varchar,
	"xero_contact_id" varchar,
	"xero_synced_at" timestamp,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"document_template" text,
	"document_template_settings" json,
	"is_sample" boolean DEFAULT false NOT NULL,
	"import_run_id" varchar,
	"import_row_number" integer,
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
CREATE TABLE "rate_limits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(512) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar,
	"job_id" varchar,
	"invoice_id" varchar,
	"rebate_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"received_at" timestamp,
	"expiry_date" timestamp,
	"reference_number" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"view_token" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "receipts_view_token_unique" UNIQUE("view_token")
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
CREATE TABLE "saved_filters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"entity_type" text DEFAULT 'jobs' NOT NULL,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "service_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar,
	"client_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"service_type" varchar(100) NOT NULL,
	"next_due_date" timestamp NOT NULL,
	"interval_months" integer,
	"reminder_days" integer DEFAULT 14,
	"reminder_sent_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_emergency_info" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"site_name" text,
	"site_address" text,
	"assembly_point" text,
	"first_aid_location" text,
	"first_aid_officer" text,
	"first_aid_officer_phone" text,
	"emergency_number" text DEFAULT '000',
	"nearest_hospital" text,
	"nearest_hospital_address" text,
	"fire_equipment_locations" json,
	"evacuation_routes" text,
	"site_specific_hazards" json,
	"additional_contacts" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_hazardous_environments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"environment_type" text NOT NULL,
	"hazards" json,
	"control_measures" json,
	"required_ppe" json,
	"required_licenses" json,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_safety_signage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"sign_type" text NOT NULL,
	"sign_category" text NOT NULL,
	"location" text,
	"description" text,
	"is_required" boolean DEFAULT true,
	"is_installed" boolean DEFAULT false,
	"installed_date" timestamp,
	"photo_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	CONSTRAINT "uniqueRuleEntity" UNIQUE("rule_id","entity_type","entity_id")
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
	"routing_state" text DEFAULT 'resolved',
	"pending_options" jsonb DEFAULT '[]'::jsonb,
	"last_routing_prompt_at" timestamp,
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
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_notification_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"assignment_id" varchar,
	"user_id" varchar NOT NULL,
	"client_phone" varchar NOT NULL,
	"notification_type" text NOT NULL,
	"sms_message_id" varchar,
	"portal_token_id" varchar,
	"eta_minutes" integer,
	"sent_at" timestamp DEFAULT now() NOT NULL,
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
CREATE TABLE "style_presets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"logo_url" text,
	"primary_color" text DEFAULT '#1e40af',
	"accent_color" text DEFAULT '#059669',
	"font_family" text DEFAULT 'Inter',
	"header_font_size" text DEFAULT '24px',
	"body_font_size" text DEFAULT '14px',
	"header_layout" text DEFAULT 'professional',
	"footer_layout" text DEFAULT 'standard',
	"show_logo" boolean DEFAULT true,
	"show_business_details" boolean DEFAULT true,
	"show_bank_details" boolean DEFAULT true,
	"table_borders" boolean DEFAULT true,
	"alternate_row_colors" boolean DEFAULT true,
	"compact_mode" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcontractor_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcontractor_invoice_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"description" text NOT NULL,
	"hours" numeric(10, 2),
	"rate" numeric(10, 2),
	"quantity" numeric(10, 2),
	"unit_price" numeric(10, 2),
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"job_id" varchar,
	"time_entry_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcontractor_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subcontractor_user_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"doc_type" text DEFAULT 'invoice' NOT NULL,
	"title" text,
	"gst_enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"invoice_number" text NOT NULL,
	"subtotal_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"due_date" timestamp,
	"valid_until" timestamp,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"paid_at" timestamp,
	"paid_method" text,
	"paid_reference" text,
	"paid_notes" text,
	"remittance_sent_at" timestamp,
	"accounting_provider" text,
	"accounting_bill_id" text,
	"accounting_synced_at" timestamp,
	"accounting_sync_error" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcontractor_location_pings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" varchar NOT NULL,
	"job_id" varchar NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" double precision,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcontractor_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" varchar NOT NULL,
	"session_token" varchar(64) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subcontractor_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "subcontractor_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"invite_id" varchar,
	"user_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"contact_phone" varchar(20),
	"contact_email" varchar(255),
	"contact_name" varchar(255),
	"permissions" jsonb DEFAULT '["view_job","add_notes","add_photos","update_status"]'::jsonb,
	"status" varchar(20) DEFAULT 'pending',
	"accepted_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"last_accessed_at" timestamp,
	"eta_minutes" integer,
	"hourly_rate" varchar(20),
	"require_code" boolean DEFAULT false,
	"code_hash" varchar(255),
	"code_attempts" integer DEFAULT 0,
	"code_issued_at" timestamp,
	"name_confirmed_at" timestamp,
	"last_opened_from_city" varchar(120),
	"last_opened_from_ip" varchar(64),
	"open_count" integer DEFAULT 0,
	"revoked_reason" varchar(40),
	"recipient_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subcontractor_tokens_token_unique" UNIQUE("token")
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
CREATE TABLE "swms_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"site_address" text,
	"work_activity_description" text,
	"ppe_requirements" jsonb DEFAULT '[]'::jsonb,
	"emergency_contact" text,
	"first_aid_location" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"attachment_url" text,
	"attachment_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swms_hazards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swms_id" varchar NOT NULL,
	"step_number" integer DEFAULT 1 NOT NULL,
	"activity_task" text NOT NULL,
	"hazard" text NOT NULL,
	"likelihood" text DEFAULT 'possible' NOT NULL,
	"consequence" text DEFAULT 'moderate' NOT NULL,
	"risk_before" text DEFAULT 'medium' NOT NULL,
	"control_measures" text,
	"risk_after" text DEFAULT 'low' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "swms_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swms_id" varchar NOT NULL,
	"worker_name" text NOT NULL,
	"worker_user_id" varchar,
	"signature_data" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"latitude" text,
	"longitude" text,
	"address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"user_id" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tap_to_pay_terms_acceptance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"accepted_by_user_id" varchar NOT NULL,
	"accepted_by_name" text,
	"accepted_by_email" text,
	"terms_version" text DEFAULT '1.0',
	"ip_address" text,
	"user_agent" text,
	"tutorial_completed" boolean DEFAULT false,
	"tutorial_completed_at" timestamp,
	"splash_shown" boolean DEFAULT false,
	"splash_shown_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tap_to_pay_terms_acceptance_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"job_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open',
	"assigned_to" varchar,
	"due_at" timestamp,
	"source" text DEFAULT 'manual',
	"source_form_id" varchar,
	"source_submission_id" varchar,
	"completed_at" timestamp,
	"completed_by" varchar,
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
CREATE TABLE "team_group_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"team_member_id" varchar NOT NULL,
	"role" varchar(20) DEFAULT 'member',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT '#3b82f6',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_member_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" varchar NOT NULL,
	"day_of_week" integer NOT NULL,
	"is_available" boolean DEFAULT true,
	"start_time" text DEFAULT '08:00',
	"end_time" text DEFAULT '17:00',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_member_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"jobs_completed" integer DEFAULT 0,
	"jobs_on_time" integer DEFAULT 0,
	"total_hours_worked" numeric(10, 2) DEFAULT '0',
	"average_job_duration" numeric(10, 2),
	"customer_rating_sum" numeric(10, 2) DEFAULT '0',
	"customer_rating_count" integer DEFAULT 0,
	"callback_rate" numeric(5, 2),
	"revenue_generated" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_member_skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" varchar NOT NULL,
	"skill_name" text NOT NULL,
	"skill_type" text DEFAULT 'certification' NOT NULL,
	"license_number" text,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"is_verified" boolean DEFAULT false,
	"document_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_member_time_off" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_member_id" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending',
	"notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
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
	"phone" text,
	"invite_status" text DEFAULT 'pending' NOT NULL,
	"invite_token" text,
	"invite_sent_at" timestamp,
	"invite_accepted_at" timestamp,
	"custom_permissions" json,
	"use_custom_permissions" boolean DEFAULT false,
	"allow_location_sharing" boolean DEFAULT true,
	"location_enabled_by_owner" boolean DEFAULT true,
	"work_hours_start" text DEFAULT '07:00',
	"work_hours_end" text DEFAULT '17:00',
	"work_days" json DEFAULT '[1,2,3,4,5]'::json,
	"after_hours_ghost_mode" boolean DEFAULT false,
	"whs_role" text DEFAULT 'none',
	"ai_receptionist_availability" boolean DEFAULT true,
	"availability_status" text DEFAULT 'available',
	"hourly_rate" numeric(10, 2),
	"start_date" timestamp,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_presence" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'offline',
	"status_message" varchar(255),
	"current_job_id" varchar,
	"last_seen_at" timestamp DEFAULT now(),
	"last_location_lat" real,
	"last_location_lng" real,
	"last_location_updated_at" timestamp,
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "terminal_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_location_id" varchar NOT NULL,
	"display_name" text NOT NULL,
	"address" jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "terminal_locations_stripe_location_id_unique" UNIQUE("stripe_location_id")
);
--> statement-breakpoint
CREATE TABLE "terminal_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_payment_intent_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'aud',
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"client_id" varchar,
	"invoice_id" varchar,
	"job_id" varchar,
	"location_id" varchar,
	"payment_method" text,
	"card_brand" varchar,
	"card_last_4" varchar,
	"receipt_url" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "terminal_payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "terms_acceptance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"terms_version" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"ip_address" varchar,
	"accepted_at" timestamp DEFAULT now() NOT NULL
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
	"is_billable" boolean DEFAULT true,
	"time_category" text DEFAULT 'work',
	"approved" boolean DEFAULT false,
	"approved_by" varchar,
	"origin" text DEFAULT 'manual',
	"geofence_event_id" varchar,
	"last_heartbeat" timestamp,
	"device_time_offset" integer,
	"clock_in_latitude" numeric(10, 7),
	"clock_in_longitude" numeric(10, 7),
	"clock_in_address" text,
	"clock_out_latitude" numeric(10, 7),
	"clock_out_longitude" numeric(10, 7),
	"clock_out_address" text,
	"is_disputed" boolean DEFAULT false,
	"dispute_reason" text,
	"disputed_at" timestamp,
	"dispute_resolved_at" timestamp,
	"dispute_resolution" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entry_dispute_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_entry_id" varchar NOT NULL,
	"action" text NOT NULL,
	"actor_id" varchar NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entry_edits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_entry_id" varchar NOT NULL,
	"edited_by" varchar NOT NULL,
	"edited_at" timestamp DEFAULT now(),
	"edit_reason" text,
	"field_changed" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"edit_source" text DEFAULT 'manual'
);
--> statement-breakpoint
CREATE TABLE "timesheet_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_entry_id" varchar NOT NULL,
	"submitted_by" varchar NOT NULL,
	"approved_by" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "training_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"team_member_id" varchar,
	"worker_name" text NOT NULL,
	"course_code" text NOT NULL,
	"course_name" text NOT NULL,
	"rto_name" text,
	"completion_date" text NOT NULL,
	"expiry_date" text,
	"certificate_number" text,
	"status" text DEFAULT 'current' NOT NULL,
	"attachment_url" text,
	"attachment_type" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_date" date NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_user_activity_user_date" UNIQUE("user_id","activity_date")
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
	"xero_id" varchar,
	"phone" varchar(32),
	"phone_normalized" varchar(20),
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
	"subscription_source" text,
	"apple_product_id" text,
	"apple_receipt_data" text,
	"apple_original_transaction_id" text,
	"jobs_created_this_month" integer DEFAULT 0,
	"invoices_created_this_month" integer DEFAULT 0,
	"quotes_created_this_month" integer DEFAULT 0,
	"usage_reset_date" timestamp DEFAULT now(),
	"trial_started_at" timestamp,
	"trial_ends_at" timestamp,
	"trial_status" text,
	"intended_tier" text,
	"subscription_reset_date" timestamp DEFAULT now(),
	"is_platform_admin" boolean DEFAULT false,
	"beta_user" boolean DEFAULT false,
	"beta_lifetime_access" boolean DEFAULT false,
	"testimonial_consent" boolean DEFAULT false,
	"testimonial_consent_at" timestamp,
	"beta_cohort_number" integer,
	"has_demo_data" boolean DEFAULT false,
	"demo_data_ids" jsonb,
	"active_business_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"lifecycle_emails_sent" jsonb DEFAULT '{}'::jsonb,
	"last_lifecycle_email_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id"),
	CONSTRAINT "users_xero_id_unique" UNIQUE("xero_id")
);
--> statement-breakpoint
CREATE TABLE "voice_change_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"requested_description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
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
	"summary" text,
	"detected_actions" jsonb,
	"recorded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" varchar NOT NULL,
	"domain_url" text,
	"domain_status" text DEFAULT 'not_set_up' NOT NULL,
	"hosting_status" text DEFAULT 'inactive' NOT NULL,
	"monthly_fee" numeric(10, 2),
	"website_click_to_call" boolean DEFAULT true,
	"website_chat_widget" boolean DEFAULT true,
	"website_booking_form" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "website_addons_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "website_change_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text,
	"description" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"screenshot_url" text,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worker_payment_details" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bank_bsb" text,
	"bank_account_number" text,
	"bank_account_name" text,
	"abn" text,
	"pay_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "worker_payment_details_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "worker_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"preferred_worker_id" varchar NOT NULL,
	"worker_name" text NOT NULL,
	"reference_job_id" varchar,
	"reference_job_title" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "worker_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_owner_id" varchar NOT NULL,
	"state" text DEFAULT 'available' NOT NULL,
	"job_id" varchar,
	"note" text,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_worker_states_biz_user" UNIQUE("business_owner_id","user_id")
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
	"sync_direction" varchar DEFAULT 'bidirectional',
	"outcome" varchar,
	"records_processed" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"duration_ms" integer,
	"error_details" text,
	"started_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_subscriptions" ADD CONSTRAINT "addon_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_receptionist_calls" ADD CONSTRAINT "ai_receptionist_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_receptionist_config" ADD CONSTRAINT "ai_receptionist_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_templates" ADD CONSTRAINT "business_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_asset_id_client_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."client_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_asset_services" ADD CONSTRAINT "client_asset_services_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_holder_user_id_users_id_fk" FOREIGN KEY ("holder_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_user_id_customer_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_surveys" ADD CONSTRAINT "customer_surveys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_surveys" ADD CONSTRAINT "customer_surveys_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_surveys" ADD CONSTRAINT "customer_surveys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_users" ADD CONSTRAINT "customer_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_users" ADD CONSTRAINT "customer_users_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_form_submission_id_form_submissions_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "form_submission_versions" ADD CONSTRAINT "form_submission_versions_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission_versions" ADD CONSTRAINT "form_submission_versions_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_customer_user_id_customer_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."customer_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_signal_logs" ADD CONSTRAINT "gps_signal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_signal_logs" ADD CONSTRAINT "gps_signal_logs_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_signal_logs" ADD CONSTRAINT "gps_signal_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_reports" ADD CONSTRAINT "hazard_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_reports" ADD CONSTRAINT "hazard_reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_role_id_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_edits" ADD CONSTRAINT "invoice_edits_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_edits" ADD CONSTRAINT "invoice_edits_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminder_logs" ADD CONSTRAINT "invoice_reminder_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminder_logs" ADD CONSTRAINT "invoice_reminder_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat" ADD CONSTRAINT "job_chat_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_chat" ADD CONSTRAINT "job_chat_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checkins" ADD CONSTRAINT "job_checkins_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checkins" ADD CONSTRAINT "job_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_equipment" ADD CONSTRAINT "job_equipment_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_equipment" ADD CONSTRAINT "job_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_equipment" ADD CONSTRAINT "job_equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_invites" ADD CONSTRAINT "job_invites_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_invites" ADD CONSTRAINT "job_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_invites" ADD CONSTRAINT "job_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photo_requirements" ADD CONSTRAINT "job_photo_requirements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_portal_tokens" ADD CONSTRAINT "job_portal_tokens_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_portal_tokens" ADD CONSTRAINT "job_portal_tokens_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_portal_tokens" ADD CONSTRAINT "job_portal_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reminders" ADD CONSTRAINT "job_reminders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reminders" ADD CONSTRAINT "job_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_reference_job_id_jobs_id_fk" FOREIGN KEY ("reference_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jsa_documents" ADD CONSTRAINT "jsa_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jsa_documents" ADD CONSTRAINT "jsa_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jsa_steps" ADD CONSTRAINT "jsa_steps_jsa_id_jsa_documents_id_fk" FOREIGN KEY ("jsa_id") REFERENCES "public"."jsa_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_catalog" ADD CONSTRAINT "line_item_catalog_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_tracking" ADD CONSTRAINT "location_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_tracking" ADD CONSTRAINT "location_tracking_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "myob_connections" ADD CONSTRAINT "myob_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_port_requests" ADD CONSTRAINT "number_port_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_schedule_id_payment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."payment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_checklists" ADD CONSTRAINT "ppe_checklists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_checklists" ADD CONSTRAINT "ppe_checklists_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_option_id_quote_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."quote_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_contract_id_recurring_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."recurring_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_configurations" ADD CONSTRAINT "report_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_config_id_report_configurations_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."report_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_emergency_info" ADD CONSTRAINT "site_emergency_info_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_emergency_info" ADD CONSTRAINT "site_emergency_info_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_hazardous_environments" ADD CONSTRAINT "site_hazardous_environments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_hazardous_environments" ADD CONSTRAINT "site_hazardous_environments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_safety_signage" ADD CONSTRAINT "site_safety_signage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_safety_signage" ADD CONSTRAINT "site_safety_signage_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_sms_message_id_sms_messages_id_fk" FOREIGN KEY ("sms_message_id") REFERENCES "public"."sms_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_portal_token_id_job_portal_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."job_portal_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_tracking_links" ADD CONSTRAINT "sms_tracking_links_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_tracking_links" ADD CONSTRAINT "sms_tracking_links_team_member_id_users_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_tracking_links" ADD CONSTRAINT "sms_tracking_links_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payouts" ADD CONSTRAINT "stripe_payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payouts" ADD CONSTRAINT "stripe_payouts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_presets" ADD CONSTRAINT "style_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_events" ADD CONSTRAINT "subcontractor_events_token_id_subcontractor_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."subcontractor_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_events" ADD CONSTRAINT "subcontractor_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_invoice_items" ADD CONSTRAINT "subcontractor_invoice_items_invoice_id_subcontractor_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."subcontractor_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_invoices" ADD CONSTRAINT "subcontractor_invoices_subcontractor_user_id_users_id_fk" FOREIGN KEY ("subcontractor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_invoices" ADD CONSTRAINT "subcontractor_invoices_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_location_pings" ADD CONSTRAINT "subcontractor_location_pings_token_id_subcontractor_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."subcontractor_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_location_pings" ADD CONSTRAINT "subcontractor_location_pings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_sessions" ADD CONSTRAINT "subcontractor_sessions_token_id_subcontractor_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."subcontractor_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_invite_id_job_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."job_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swms_documents" ADD CONSTRAINT "swms_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swms_documents" ADD CONSTRAINT "swms_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swms_hazards" ADD CONSTRAINT "swms_hazards_swms_id_swms_documents_id_fk" FOREIGN KEY ("swms_id") REFERENCES "public"."swms_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swms_signatures" ADD CONSTRAINT "swms_signatures_swms_id_swms_documents_id_fk" FOREIGN KEY ("swms_id") REFERENCES "public"."swms_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swms_signatures" ADD CONSTRAINT "swms_signatures_worker_user_id_users_id_fk" FOREIGN KEY ("worker_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_to_pay_terms_acceptance" ADD CONSTRAINT "tap_to_pay_terms_acceptance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_to_pay_terms_acceptance" ADD CONSTRAINT "tap_to_pay_terms_acceptance_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_form_id_custom_forms_id_fk" FOREIGN KEY ("source_form_id") REFERENCES "public"."custom_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_submission_id_form_submissions_id_fk" FOREIGN KEY ("source_submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat" ADD CONSTRAINT "team_chat_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat" ADD CONSTRAINT "team_chat_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_members" ADD CONSTRAINT "team_group_members_group_id_team_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."team_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_members" ADD CONSTRAINT "team_group_members_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_groups" ADD CONSTRAINT "team_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_availability" ADD CONSTRAINT "team_member_availability_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_metrics" ADD CONSTRAINT "team_member_metrics_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_skills" ADD CONSTRAINT "team_member_skills_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_time_off" ADD CONSTRAINT "team_member_time_off_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_time_off" ADD CONSTRAINT "team_member_time_off_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_role_id_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presence" ADD CONSTRAINT "team_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presence" ADD CONSTRAINT "team_presence_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presence" ADD CONSTRAINT "team_presence_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_analysis_jobs" ADD CONSTRAINT "template_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_analysis_jobs" ADD CONSTRAINT "template_analysis_jobs_created_template_id_document_templates_id_fk" FOREIGN KEY ("created_template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_locations" ADD CONSTRAINT "terminal_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_location_id_terminal_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."terminal_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_dispute_events" ADD CONSTRAINT "time_entry_dispute_events_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_dispute_events" ADD CONSTRAINT "time_entry_dispute_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_edits" ADD CONSTRAINT "time_entry_edits_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_edits" ADD CONSTRAINT "time_entry_edits_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradie_status" ADD CONSTRAINT "tradie_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradie_status" ADD CONSTRAINT "tradie_status_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradie_status" ADD CONSTRAINT "tradie_status_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_change_requests" ADD CONSTRAINT "voice_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_addons" ADD CONSTRAINT "website_addons_business_id_users_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_change_requests" ADD CONSTRAINT "website_change_requests_business_id_users_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_change_requests" ADD CONSTRAINT "website_change_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_payment_details" ADD CONSTRAINT "worker_payment_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_requests" ADD CONSTRAINT "worker_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_requests" ADD CONSTRAINT "worker_requests_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_requests" ADD CONSTRAINT "worker_requests_preferred_worker_id_users_id_fk" FOREIGN KEY ("preferred_worker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_requests" ADD CONSTRAINT "worker_requests_reference_job_id_jobs_id_fk" FOREIGN KEY ("reference_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_states" ADD CONSTRAINT "worker_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_states" ADD CONSTRAINT "worker_states_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xero_sync_state" ADD CONSTRAINT "xero_sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_feed_business_owner_id" ON "activity_feed" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_activity_feed_actor_user_id" ON "activity_feed" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_feed_team_member_id" ON "activity_feed" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_user_id" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_addon_subs_user" ON "addon_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_addon_subs_apple_txn" ON "addon_subscriptions" USING btree ("apple_original_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_user" ON "ai_receptionist_calls" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_vapi" ON "ai_receptionist_calls" USING btree ("vapi_call_id");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_created" ON "ai_receptionist_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_calls_phone_number" ON "ai_receptionist_calls" USING btree ("phone_number_id");--> statement-breakpoint
CREATE INDEX "idx_ai_config_user" ON "ai_receptionist_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_config_approval" ON "ai_receptionist_config" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_ai_config_phone" ON "ai_receptionist_config" USING btree ("dedicated_phone_number");--> statement-breakpoint
CREATE INDEX "idx_assignment_events_assignment_id" ON "assignment_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_assignment_events_job_id" ON "assignment_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_assignment_events_actor_user_id" ON "assignment_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_admin" ON "audit_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_target" ON "audit_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_automation_logs_automation_id" ON "automation_logs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "idx_automations_user_id" ON "automations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_business_settings_user_id" ON "business_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_business_templates_user_id" ON "business_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_checklist_items_job_id" ON "checklist_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_client_asset_services_user_id" ON "client_asset_services" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_asset_services_asset_id" ON "client_asset_services" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_client_asset_services_job_id" ON "client_asset_services" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_client_asset_services_performed_by" ON "client_asset_services" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_client_assets_user_id" ON "client_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_assets_client_id" ON "client_assets" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_clients_user_id" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_business_owner_id" ON "compliance_documents" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_holder_user_id" ON "compliance_documents" USING btree ("holder_user_id");--> statement-breakpoint
CREATE INDEX "idx_custom_forms_user_id" ON "custom_forms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_customer_sessions_customer_user_id" ON "customer_sessions" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "idx_customer_surveys_user_id" ON "customer_surveys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_customer_surveys_job_id" ON "customer_surveys" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_customer_surveys_client_id" ON "customer_surveys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_customer_users_client_id" ON "customer_users" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_customer_users_business_owner_id" ON "customer_users" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_defects_job_id" ON "defects" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_defects_user_id" ON "defects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_defects_client_id" ON "defects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_form_submission_id" ON "digital_signatures" USING btree ("form_submission_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_assignment_id" ON "digital_signatures" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_job_id" ON "digital_signatures" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_quote_id" ON "digital_signatures" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_invoice_id" ON "digital_signatures" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_client_id" ON "digital_signatures" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_direct_messages_sender_id" ON "direct_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_direct_messages_recipient_id" ON "direct_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_document_templates_user_id" ON "document_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_campaigns_user_id" ON "email_campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_delivery_logs_user_id" ON "email_delivery_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_delivery_logs_email_integration_id" ON "email_delivery_logs" USING btree ("email_integration_id");--> statement-breakpoint
CREATE INDEX "idx_email_integrations_user_id" ON "email_integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_user_id" ON "equipment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_category_id" ON "equipment" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_assigned_to" ON "equipment" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_equipment_categories_user_id" ON "equipment_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_maintenance_user_id" ON "equipment_maintenance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_maintenance_equipment_id" ON "equipment_maintenance" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "idx_equipment_maintenance_performed_by" ON "equipment_maintenance" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_error_logs_level" ON "error_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_error_logs_category" ON "error_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_error_logs_created" ON "error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_expense_categories_user_id" ON "expense_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_user_id" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_job_id" ON "expenses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_category_id" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_approved_by" ON "expenses" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_form_submission_versions_submission_id" ON "form_submission_versions" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_form_submissions_form_id" ON "form_submissions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "idx_form_submissions_job_id" ON "form_submissions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_form_submissions_submitted_by" ON "form_submissions" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_form_submissions_customer_user_id" ON "form_submissions" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "idx_form_submissions_reviewed_by" ON "form_submissions" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "idx_geofence_alerts_user_id" ON "geofence_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_geofence_alerts_job_id" ON "geofence_alerts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_geofence_alerts_business_owner_id" ON "geofence_alerts" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_gps_signal_logs_user_id" ON "gps_signal_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gps_signal_logs_business_owner_id" ON "gps_signal_logs" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_gps_signal_logs_job_id" ON "gps_signal_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_hazard_reports_user_id" ON "hazard_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hazard_reports_job_id" ON "hazard_reports" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_key" ON "idempotency_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_import_runs_user_id" ON "import_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_incident_reports_user_id" ON "incident_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_incident_reports_job_id" ON "incident_reports" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_integration_settings_user_id" ON "integration_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_categories_user_id" ON "inventory_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_user_id" ON "inventory_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_category_id" ON "inventory_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_user_id" ON "inventory_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_item_id" ON "inventory_transactions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_job_id" ON "inventory_transactions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_invite_codes_business_owner_id" ON "invite_codes" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_invite_codes_role_id" ON "invite_codes" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_edits_invoice_id" ON "invoice_edits" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_edits_edited_by" ON "invoice_edits" USING btree ("edited_by");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_id" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_reminder_logs_invoice_id" ON "invoice_reminder_logs" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_reminder_logs_user_id" ON "invoice_reminder_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_user_id" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_client_id" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_job_id" ON "invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_quote_id" ON "invoices" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignment_requests_job_id" ON "job_assignment_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignment_requests_team_member_id" ON "job_assignment_requests" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignment_requests_requester_id" ON "job_assignment_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignment_requests_business_owner_id" ON "job_assignment_requests" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignment_requests_responded_by" ON "job_assignment_requests" USING btree ("responded_by");--> statement-breakpoint
CREATE INDEX "idx_job_assignments_job_id" ON "job_assignments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignments_user_id" ON "job_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_assignments_team_member_id" ON "job_assignments" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_job_chat_job_id" ON "job_chat" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_chat_user_id" ON "job_chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_checkins_job_id" ON "job_checkins" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_checkins_user_id" ON "job_checkins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_user_id" ON "job_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_job_id" ON "job_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_uploaded_by" ON "job_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_job_equipment_job_id" ON "job_equipment" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_equipment_equipment_id" ON "job_equipment" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "idx_job_equipment_user_id" ON "job_equipment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_invites_job_id" ON "job_invites" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_invites_user_id" ON "job_invites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_invites_used_by" ON "job_invites" USING btree ("used_by");--> statement-breakpoint
CREATE INDEX "idx_job_materials_job_id" ON "job_materials" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_materials_user_id" ON "job_materials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_notes_user_id" ON "job_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_notes_job_id" ON "job_notes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_notes_created_by" ON "job_notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_job_photo_requirements_job_id" ON "job_photo_requirements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_photos_user_id" ON "job_photos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_photos_job_id" ON "job_photos" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_photos_uploaded_by" ON "job_photos" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_job_portal_tokens_job_id" ON "job_portal_tokens" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_portal_tokens_assignment_id" ON "job_portal_tokens" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_job_portal_tokens_user_id" ON "job_portal_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_reminders_job_id" ON "job_reminders" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_reminders_user_id" ON "job_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_requests_user_id" ON "job_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_requests_client_id" ON "job_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_job_requests_reference_job_id" ON "job_requests" USING btree ("reference_job_id");--> statement-breakpoint
CREATE INDEX "idx_job_requests_job_id" ON "job_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_variations_user_id" ON "job_variations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_variations_job_id" ON "job_variations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_variations_created_by" ON "job_variations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_jobs_user_id" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_client_id" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_jsa_documents_user_id" ON "jsa_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_jsa_documents_job_id" ON "jsa_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_jsa_steps_jsa_id" ON "jsa_steps" USING btree ("jsa_id");--> statement-breakpoint
CREATE INDEX "idx_leads_user_id" ON "leads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_leads_client_id" ON "leads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_line_item_catalog_user_id" ON "line_item_catalog" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_location_pings_assignment_id" ON "location_pings" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_location_pings_user_id" ON "location_pings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_location_tracking_user_id" ON "location_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_location_tracking_job_id" ON "location_tracking" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_myob_connections_user_id" ON "myob_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_port_requests_user" ON "number_port_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_port_requests_status" ON "number_port_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_installments_schedule_id" ON "payment_installments" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "idx_payment_records_invoice_id" ON "payment_records" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_records_user_id" ON "payment_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_user_id" ON "payment_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_invoice_id" ON "payment_requests" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_job_id" ON "payment_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_client_id" ON "payment_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_payment_schedules_user_id" ON "payment_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_schedules_invoice_id" ON "payment_schedules" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_schedules_client_id" ON "payment_schedules" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_payments_business" ON "payroll_payments" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_payments_worker" ON "payroll_payments" USING btree ("worker_user_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_payments_period" ON "payroll_payments" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_permission_requests_team_member_id" ON "permission_requests" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_permission_requests_business_owner_id" ON "permission_requests" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_permission_requests_responded_by" ON "permission_requests" USING btree ("responded_by");--> statement-breakpoint
CREATE INDEX "idx_ppe_checklists_user_id" ON "ppe_checklists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ppe_checklists_job_id" ON "ppe_checklists" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_items_po_id" ON "purchase_order_items" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_items_inventory_item_id" ON "purchase_order_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_user_id" ON "purchase_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_supplier_id" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_job_id" ON "purchase_orders" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_approved_by" ON "purchase_orders" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_push_tokens_user_id" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quick_replies_user_id" ON "quick_replies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quickbooks_connections_user_id" ON "quickbooks_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quote_line_items_quote_id" ON "quote_line_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_line_items_option_id" ON "quote_line_items" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_quote_options_quote_id" ON "quote_options" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_templates_user_id" ON "quote_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quote_versions_quote_id" ON "quote_versions" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_user_id" ON "quotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_client_id" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_job_id" ON "quotes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_rate_cards_user_id" ON "rate_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_key" ON "rate_limits" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_expires" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_rebates_user_id" ON "rebates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rebates_client_id" ON "rebates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_rebates_job_id" ON "rebates" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_rebates_invoice_id" ON "rebates" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_user_id" ON "receipts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_job_id" ON "receipts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_invoice_id" ON "receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_client_id" ON "receipts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_payment_request_id" ON "receipts" USING btree ("payment_request_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_contracts_user_id" ON "recurring_contracts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_contracts_client_id" ON "recurring_contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_contract_id" ON "recurring_schedules" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_job_id" ON "recurring_schedules" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_report_configurations_user_id" ON "report_configurations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_routes_user_id" ON "routes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_filters_user_id" ON "saved_filters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_reports_config_id" ON "saved_reports" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_saved_reports_user_id" ON "saved_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_service_reminders_job_id" ON "service_reminders" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_service_reminders_client_id" ON "service_reminders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_service_reminders_user_id" ON "service_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_site_emergency_info_user_id" ON "site_emergency_info" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_site_emergency_info_job_id" ON "site_emergency_info" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_site_hazardous_environments_user_id" ON "site_hazardous_environments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_site_hazardous_environments_job_id" ON "site_hazardous_environments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_site_safety_signage_user_id" ON "site_safety_signage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_site_safety_signage_job_id" ON "site_safety_signage" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_sms_automation_logs_rule_id" ON "sms_automation_logs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_sms_automation_logs_message_id" ON "sms_automation_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_sms_automation_rules_user_id" ON "sms_automation_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sms_automation_rules_template_id" ON "sms_automation_rules" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_sms_booking_links_job_id" ON "sms_booking_links" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_sms_booking_links_business_owner_id" ON "sms_booking_links" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_sms_conversations_business_owner_id" ON "sms_conversations" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_sms_conversations_client_id" ON "sms_conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_sms_conversations_job_id" ON "sms_conversations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_sms_messages_conversation_id" ON "sms_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_sms_messages_sender_user_id" ON "sms_messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "idx_sms_messages_job_created_from_sms" ON "sms_messages" USING btree ("job_created_from_sms");--> statement-breakpoint
CREATE INDEX "idx_sms_notification_log_job_id" ON "sms_notification_log" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_sms_notification_log_assignment_id" ON "sms_notification_log" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_sms_notification_log_user_id" ON "sms_notification_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sms_notification_log_sms_message_id" ON "sms_notification_log" USING btree ("sms_message_id");--> statement-breakpoint
CREATE INDEX "idx_sms_notification_log_portal_token_id" ON "sms_notification_log" USING btree ("portal_token_id");--> statement-breakpoint
CREATE INDEX "idx_sms_templates_user_id" ON "sms_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sms_tracking_links_job_id" ON "sms_tracking_links" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_sms_tracking_links_team_member_id" ON "sms_tracking_links" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_sms_tracking_links_business_owner_id" ON "sms_tracking_links" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_staff_schedules_user_id" ON "staff_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_staff_schedules_job_id" ON "staff_schedules" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_payouts_user_id" ON "stripe_payouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_payouts_invoice_id" ON "stripe_payouts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_style_presets_user_id" ON "style_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_events_token_id" ON "subcontractor_events" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_events_job_id" ON "subcontractor_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_subinv_item_invoice" ON "subcontractor_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_subinv_subcontractor" ON "subcontractor_invoices" USING btree ("subcontractor_user_id");--> statement-breakpoint
CREATE INDEX "idx_subinv_business" ON "subcontractor_invoices" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_subinv_status" ON "subcontractor_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_location_pings_token_id" ON "subcontractor_location_pings" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_location_pings_job_id" ON "subcontractor_location_pings" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_sessions_token_id" ON "subcontractor_sessions" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_tokens_job_id" ON "subcontractor_tokens" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_tokens_invite_id" ON "subcontractor_tokens" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_tokens_user_id" ON "subcontractor_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subcontractor_tokens_recipient_user_id" ON "subcontractor_tokens" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_suppliers_user_id" ON "suppliers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_swms_documents_user_id" ON "swms_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_swms_documents_job_id" ON "swms_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_swms_hazards_swms_id" ON "swms_hazards" USING btree ("swms_id");--> statement-breakpoint
CREATE INDEX "idx_swms_signatures_swms_id" ON "swms_signatures" USING btree ("swms_id");--> statement-breakpoint
CREATE INDEX "idx_swms_signatures_worker_user_id" ON "swms_signatures" USING btree ("worker_user_id");--> statement-breakpoint
CREATE INDEX "idx_system_events_type" ON "system_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_system_events_severity" ON "system_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_system_events_source" ON "system_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_system_events_created" ON "system_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tap_to_pay_terms_acceptance_accepted_by_user_id" ON "tap_to_pay_terms_acceptance" USING btree ("accepted_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_id" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_job_id" ON "tasks" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned_to" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_team_chat_business_owner_id" ON "team_chat" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_team_chat_sender_id" ON "team_chat" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_team_group_members_group_id" ON "team_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_team_group_members_team_member_id" ON "team_group_members" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_team_groups_user_id" ON "team_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_team_member_availability_team_member_id" ON "team_member_availability" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_team_member_metrics_team_member_id" ON "team_member_metrics" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_team_member_skills_team_member_id" ON "team_member_skills" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_team_member_time_off_team_member_id" ON "team_member_time_off" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "idx_team_member_time_off_approved_by" ON "team_member_time_off" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_team_members_business_owner_id" ON "team_members" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_member_id" ON "team_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_role_id" ON "team_members" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_team_presence_user_id" ON "team_presence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_team_presence_business_owner_id" ON "team_presence" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_team_presence_current_job_id" ON "team_presence" USING btree ("current_job_id");--> statement-breakpoint
CREATE INDEX "idx_template_analysis_jobs_user_id" ON "template_analysis_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_template_analysis_jobs_created_template_id" ON "template_analysis_jobs" USING btree ("created_template_id");--> statement-breakpoint
CREATE INDEX "idx_terminal_locations_user_id" ON "terminal_locations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_terminal_payments_user_id" ON "terminal_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_terminal_payments_client_id" ON "terminal_payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_terminal_payments_invoice_id" ON "terminal_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_terminal_payments_job_id" ON "terminal_payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_terminal_payments_location_id" ON "terminal_payments" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_time_entries_user_id" ON "time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_time_entries_job_id" ON "time_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_time_entries_approved_by" ON "time_entries" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_time_entry_dispute_events_time_entry_id" ON "time_entry_dispute_events" USING btree ("time_entry_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_dispute_events_actor_id" ON "time_entry_dispute_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_edits_time_entry_id" ON "time_entry_edits" USING btree ("time_entry_id");--> statement-breakpoint
CREATE INDEX "idx_time_entry_edits_edited_by" ON "time_entry_edits" USING btree ("edited_by");--> statement-breakpoint
CREATE INDEX "idx_timesheet_approvals_time_entry_id" ON "timesheet_approvals" USING btree ("time_entry_id");--> statement-breakpoint
CREATE INDEX "idx_timesheet_approvals_submitted_by" ON "timesheet_approvals" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_timesheet_approvals_approved_by" ON "timesheet_approvals" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_timesheets_user_id" ON "timesheets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_timesheets_approved_by" ON "timesheets" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_tradie_status_business_owner_id" ON "tradie_status" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_tradie_status_current_job_id" ON "tradie_status" USING btree ("current_job_id");--> statement-breakpoint
CREATE INDEX "idx_training_records_user_id" ON "training_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user" ON "user_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_activity_date" ON "user_activity" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "idx_vcr_user" ON "voice_change_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_vcr_status" ON "voice_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_voice_notes_user_id" ON "voice_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_voice_notes_job_id" ON "voice_notes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_voice_notes_recorded_by" ON "voice_notes" USING btree ("recorded_by");--> statement-breakpoint
CREATE INDEX "idx_website_addons_business" ON "website_addons" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_website_cr_business" ON "website_change_requests" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_website_cr_user" ON "website_change_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_website_cr_status" ON "website_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_worker_payment_details_user" ON "worker_payment_details" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_worker_requests_client_id" ON "worker_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_worker_requests_business_owner_id" ON "worker_requests" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_worker_requests_preferred_worker_id" ON "worker_requests" USING btree ("preferred_worker_id");--> statement-breakpoint
CREATE INDEX "idx_worker_requests_reference_job_id" ON "worker_requests" USING btree ("reference_job_id");--> statement-breakpoint
CREATE INDEX "idx_worker_states_user" ON "worker_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_worker_states_business" ON "worker_states" USING btree ("business_owner_id");--> statement-breakpoint
CREATE INDEX "idx_xero_connections_user_id" ON "xero_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_xero_sync_state_user_id" ON "xero_sync_state" USING btree ("user_id");