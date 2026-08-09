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
	"require_photo_before_start" boolean DEFAULT false,
	"require_photo_after_complete" boolean DEFAULT false,
	"auto_check_in_on_arrival" boolean DEFAULT false,
	"auto_check_out_on_departure" boolean DEFAULT false,
	"daily_summary_enabled" boolean DEFAULT false,
	"daily_summary_time" text DEFAULT '18:00',
	"daily_summary_last_sent" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "automation_settings_user_id_unique" UNIQUE("user_id")
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
	"is_primary" boolean DEFAULT false
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
	"total_cost" numeric(10, 2) DEFAULT '0',
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subcontractor_tokens_token_unique" UNIQUE("token")
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
ALTER TABLE "business_settings" ALTER COLUMN "brand_color" SET DEFAULT '#2563EB';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "time_rounding_minutes" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "has_seen_walkthrough" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "onboarding_level" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "xero_sales_account_code" text DEFAULT '200';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "xero_bank_account_code" text DEFAULT '090';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "xero_expense_account_code" text DEFAULT '400';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "xero_tax_type" text DEFAULT 'OUTPUT';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "outlook_connected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "outlook_access_token" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "outlook_refresh_token" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "outlook_token_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "outlook_email" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "bank_bsb" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "accept_card_payments" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "accept_bank_transfer" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "accept_becs_debit" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "accept_payto" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "enable_card_surcharge" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "card_surcharge_percent" numeric(4, 2) DEFAULT '1.95';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "card_surcharge_fixed_cents" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "surcharge_disclaimer" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "enable_early_payment_discount" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "early_payment_discount_percent" numeric(4, 2) DEFAULT '2.00';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "early_payment_discount_days" integer DEFAULT 7;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "default_payment_method" text DEFAULT 'card';--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "simple_mode" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "business_templates" ADD COLUMN "trade_type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD COLUMN "trade_type" text DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "custom_forms" ADD COLUMN "is_default" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD COLUMN "assignment_id" varchar;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "is_default" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "notify_job_assigned" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "notify_job_updates" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "notify_job_reminders" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "notify_team_messages" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "notify_team_locations" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "notify_daily_summary" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD COLUMN "push_notifications_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_xero_import" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "xero_contact_id" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "quickbooks_invoice_id" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "quickbooks_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_template" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_template_settings" json;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "worker_status" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "worker_status_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "worker_eta" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "worker_eta_minutes" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "portal_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "priority" text DEFAULT 'info';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_label" text;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "option_id" varchar;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "is_multi_option" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "selected_option_id" varchar;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "is_xero_import" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "xero_quote_id" varchar;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "xero_contact_id" varchar;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "xero_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document_template" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document_template_settings" json;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "view_token" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "is_billable" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "time_category" text DEFAULT 'work';--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "last_heartbeat" timestamp;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "device_time_offset" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "beta_user" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "beta_lifetime_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "testimonial_consent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "testimonial_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "beta_cohort_number" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_demo_data" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_data_ids" jsonb;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_signal_logs" ADD CONSTRAINT "gps_signal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_signal_logs" ADD CONSTRAINT "gps_signal_logs_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_signal_logs" ADD CONSTRAINT "gps_signal_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment_requests" ADD CONSTRAINT "job_assignment_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_invites" ADD CONSTRAINT "job_invites_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_invites" ADD CONSTRAINT "job_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_invites" ADD CONSTRAINT "job_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photo_requirements" ADD CONSTRAINT "job_photo_requirements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_portal_tokens" ADD CONSTRAINT "job_portal_tokens_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_portal_tokens" ADD CONSTRAINT "job_portal_tokens_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_portal_tokens" ADD CONSTRAINT "job_portal_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reminders" ADD CONSTRAINT "job_reminders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reminders" ADD CONSTRAINT "job_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_schedule_id_payment_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."payment_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_sms_message_id_sms_messages_id_fk" FOREIGN KEY ("sms_message_id") REFERENCES "public"."sms_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notification_log" ADD CONSTRAINT "sms_notification_log_portal_token_id_job_portal_tokens_id_fk" FOREIGN KEY ("portal_token_id") REFERENCES "public"."job_portal_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_presets" ADD CONSTRAINT "style_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_events" ADD CONSTRAINT "subcontractor_events_token_id_subcontractor_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."subcontractor_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_events" ADD CONSTRAINT "subcontractor_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_location_pings" ADD CONSTRAINT "subcontractor_location_pings_token_id_subcontractor_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."subcontractor_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_location_pings" ADD CONSTRAINT "subcontractor_location_pings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_sessions" ADD CONSTRAINT "subcontractor_sessions_token_id_subcontractor_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."subcontractor_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_invite_id_job_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."job_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontractor_tokens" ADD CONSTRAINT "subcontractor_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_to_pay_terms_acceptance" ADD CONSTRAINT "tap_to_pay_terms_acceptance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tap_to_pay_terms_acceptance" ADD CONSTRAINT "tap_to_pay_terms_acceptance_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_members" ADD CONSTRAINT "team_group_members_group_id_team_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."team_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_group_members" ADD CONSTRAINT "team_group_members_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_groups" ADD CONSTRAINT "team_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_availability" ADD CONSTRAINT "team_member_availability_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_metrics" ADD CONSTRAINT "team_member_metrics_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_skills" ADD CONSTRAINT "team_member_skills_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_time_off" ADD CONSTRAINT "team_member_time_off_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member_time_off" ADD CONSTRAINT "team_member_time_off_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presence" ADD CONSTRAINT "team_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presence" ADD CONSTRAINT "team_presence_business_owner_id_users_id_fk" FOREIGN KEY ("business_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presence" ADD CONSTRAINT "team_presence_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_locations" ADD CONSTRAINT "terminal_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_payments" ADD CONSTRAINT "terminal_payments_location_id_terminal_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."terminal_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_edits" ADD CONSTRAINT "time_entry_edits_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entry_edits" ADD CONSTRAINT "time_entry_edits_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_time_entry_id_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_assignment_id_job_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_option_id_quote_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."quote_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_view_token_unique" UNIQUE("view_token");