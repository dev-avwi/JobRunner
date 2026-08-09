-- Migration 0018: Add missing foreign-key indexes.
--
-- Adds an index for every .references(...) column in shared/schema.ts that
-- did not already have one (either a single-column index, a unique constraint,
-- or the leading column of a composite index/primary key).
--
-- Why: FK columns without indexes cause sequential scans on joins and slow
-- cascading deletes. Under the ~100-concurrent-user envelope these show up as
-- p95 spikes on hot reads that join through these tables.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Apply this file with psql directly (NOT via drizzle-kit push):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0018_fk_indexes.sql
--
-- IF NOT EXISTS makes every statement idempotent so a partial run is safe to
-- retry. Concurrent index builds hold a backend slot for the duration of the
-- build — do not run during peak hours (Neon serverless cap is 15).

-- activity_feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_activity_feed_business_owner_id" ON "activity_feed" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_activity_feed_actor_user_id" ON "activity_feed" ("actor_user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_activity_feed_team_member_id" ON "activity_feed" ("team_member_id");

-- activity_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_activity_logs_user_id" ON "activity_logs" ("user_id");

-- assignment_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_assignment_events_assignment_id" ON "assignment_events" ("assignment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_assignment_events_job_id" ON "assignment_events" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_assignment_events_actor_user_id" ON "assignment_events" ("actor_user_id");

-- automation_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_automation_logs_automation_id" ON "automation_logs" ("automation_id");

-- automations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_automations_user_id" ON "automations" ("user_id");

-- business_settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_business_settings_user_id" ON "business_settings" ("user_id");

-- business_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_business_templates_user_id" ON "business_templates" ("user_id");

-- checklist_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_checklist_items_job_id" ON "checklist_items" ("job_id");

-- client_assets
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_assets_user_id" ON "client_assets" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_assets_client_id" ON "client_assets" ("client_id");

-- client_asset_services
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_asset_services_user_id" ON "client_asset_services" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_asset_services_asset_id" ON "client_asset_services" ("asset_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_asset_services_job_id" ON "client_asset_services" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_asset_services_performed_by" ON "client_asset_services" ("performed_by");

-- clients
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_clients_user_id" ON "clients" ("user_id");

-- compliance_documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_compliance_documents_business_owner_id" ON "compliance_documents" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_compliance_documents_holder_user_id" ON "compliance_documents" ("holder_user_id");

-- customer_sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customer_sessions_customer_user_id" ON "customer_sessions" ("customer_user_id");

-- customer_surveys
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customer_surveys_user_id" ON "customer_surveys" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customer_surveys_job_id" ON "customer_surveys" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customer_surveys_client_id" ON "customer_surveys" ("client_id");

-- customer_users
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customer_users_client_id" ON "customer_users" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customer_users_business_owner_id" ON "customer_users" ("business_owner_id");

-- custom_forms
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_custom_forms_user_id" ON "custom_forms" ("user_id");

-- defects
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_defects_job_id" ON "defects" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_defects_user_id" ON "defects" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_defects_client_id" ON "defects" ("client_id");

-- digital_signatures
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_digital_signatures_form_submission_id" ON "digital_signatures" ("form_submission_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_digital_signatures_assignment_id" ON "digital_signatures" ("assignment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_digital_signatures_job_id" ON "digital_signatures" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_digital_signatures_quote_id" ON "digital_signatures" ("quote_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_digital_signatures_invoice_id" ON "digital_signatures" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_digital_signatures_client_id" ON "digital_signatures" ("client_id");

-- direct_messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_direct_messages_sender_id" ON "direct_messages" ("sender_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_direct_messages_recipient_id" ON "direct_messages" ("recipient_id");

-- document_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_document_templates_user_id" ON "document_templates" ("user_id");

-- email_campaigns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_campaigns_user_id" ON "email_campaigns" ("user_id");

-- email_delivery_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_logs_user_id" ON "email_delivery_logs" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_logs_email_integration_id" ON "email_delivery_logs" ("email_integration_id");

-- email_integrations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_integrations_user_id" ON "email_integrations" ("user_id");

-- equipment
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_user_id" ON "equipment" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_category_id" ON "equipment" ("category_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_assigned_to" ON "equipment" ("assigned_to");

-- equipment_categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_categories_user_id" ON "equipment_categories" ("user_id");

-- equipment_maintenance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_maintenance_user_id" ON "equipment_maintenance" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_maintenance_equipment_id" ON "equipment_maintenance" ("equipment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_equipment_maintenance_performed_by" ON "equipment_maintenance" ("performed_by");

-- expense_categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expense_categories_user_id" ON "expense_categories" ("user_id");

-- expenses
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_user_id" ON "expenses" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_job_id" ON "expenses" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_category_id" ON "expenses" ("category_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_expenses_approved_by" ON "expenses" ("approved_by");

-- form_submissions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_form_submissions_form_id" ON "form_submissions" ("form_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_form_submissions_job_id" ON "form_submissions" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_form_submissions_submitted_by" ON "form_submissions" ("submitted_by");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_form_submissions_customer_user_id" ON "form_submissions" ("customer_user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_form_submissions_reviewed_by" ON "form_submissions" ("reviewed_by");

-- geofence_alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_geofence_alerts_user_id" ON "geofence_alerts" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_geofence_alerts_job_id" ON "geofence_alerts" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_geofence_alerts_business_owner_id" ON "geofence_alerts" ("business_owner_id");

-- gps_signal_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gps_signal_logs_user_id" ON "gps_signal_logs" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gps_signal_logs_business_owner_id" ON "gps_signal_logs" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gps_signal_logs_job_id" ON "gps_signal_logs" ("job_id");

-- hazard_reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_hazard_reports_user_id" ON "hazard_reports" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_hazard_reports_job_id" ON "hazard_reports" ("job_id");

-- incident_reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_incident_reports_user_id" ON "incident_reports" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_incident_reports_job_id" ON "incident_reports" ("job_id");

-- integration_settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_integration_settings_user_id" ON "integration_settings" ("user_id");

-- inventory_categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_categories_user_id" ON "inventory_categories" ("user_id");

-- inventory_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_items_user_id" ON "inventory_items" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_items_category_id" ON "inventory_items" ("category_id");

-- inventory_transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_transactions_user_id" ON "inventory_transactions" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_transactions_item_id" ON "inventory_transactions" ("item_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_transactions_job_id" ON "inventory_transactions" ("job_id");

-- invite_codes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invite_codes_business_owner_id" ON "invite_codes" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invite_codes_role_id" ON "invite_codes" ("role_id");

-- invoice_edits
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoice_edits_invoice_id" ON "invoice_edits" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoice_edits_edited_by" ON "invoice_edits" ("edited_by");

-- invoice_line_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoice_line_items_invoice_id" ON "invoice_line_items" ("invoice_id");

-- invoice_reminder_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoice_reminder_logs_invoice_id" ON "invoice_reminder_logs" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoice_reminder_logs_user_id" ON "invoice_reminder_logs" ("user_id");

-- invoices
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_user_id" ON "invoices" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_client_id" ON "invoices" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_job_id" ON "invoices" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_invoices_quote_id" ON "invoices" ("quote_id");

-- job_assignment_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignment_requests_job_id" ON "job_assignment_requests" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignment_requests_team_member_id" ON "job_assignment_requests" ("team_member_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignment_requests_requester_id" ON "job_assignment_requests" ("requester_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignment_requests_business_owner_id" ON "job_assignment_requests" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignment_requests_responded_by" ON "job_assignment_requests" ("responded_by");

-- job_assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignments_job_id" ON "job_assignments" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignments_user_id" ON "job_assignments" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_assignments_team_member_id" ON "job_assignments" ("team_member_id");

-- job_chat
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_chat_job_id" ON "job_chat" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_chat_user_id" ON "job_chat" ("user_id");

-- job_checkins
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_checkins_job_id" ON "job_checkins" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_checkins_user_id" ON "job_checkins" ("user_id");

-- job_documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_documents_user_id" ON "job_documents" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_documents_job_id" ON "job_documents" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_documents_uploaded_by" ON "job_documents" ("uploaded_by");

-- job_equipment
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_equipment_job_id" ON "job_equipment" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_equipment_equipment_id" ON "job_equipment" ("equipment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_equipment_user_id" ON "job_equipment" ("user_id");

-- job_invites
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_invites_job_id" ON "job_invites" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_invites_user_id" ON "job_invites" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_invites_used_by" ON "job_invites" ("used_by");

-- job_materials
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_materials_job_id" ON "job_materials" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_materials_user_id" ON "job_materials" ("user_id");

-- job_notes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_notes_user_id" ON "job_notes" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_notes_job_id" ON "job_notes" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_notes_created_by" ON "job_notes" ("created_by");

-- job_photo_requirements
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_photo_requirements_job_id" ON "job_photo_requirements" ("job_id");

-- job_photos
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_photos_user_id" ON "job_photos" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_photos_job_id" ON "job_photos" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_photos_uploaded_by" ON "job_photos" ("uploaded_by");

-- job_portal_tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_portal_tokens_job_id" ON "job_portal_tokens" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_portal_tokens_assignment_id" ON "job_portal_tokens" ("assignment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_portal_tokens_user_id" ON "job_portal_tokens" ("user_id");

-- job_reminders
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_reminders_job_id" ON "job_reminders" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_reminders_user_id" ON "job_reminders" ("user_id");

-- job_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_requests_user_id" ON "job_requests" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_requests_client_id" ON "job_requests" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_requests_reference_job_id" ON "job_requests" ("reference_job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_requests_job_id" ON "job_requests" ("job_id");

-- jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_jobs_user_id" ON "jobs" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_jobs_client_id" ON "jobs" ("client_id");

-- job_variations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_variations_user_id" ON "job_variations" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_variations_job_id" ON "job_variations" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_job_variations_created_by" ON "job_variations" ("created_by");

-- jsa_documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_jsa_documents_user_id" ON "jsa_documents" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_jsa_documents_job_id" ON "jsa_documents" ("job_id");

-- jsa_steps
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_jsa_steps_jsa_id" ON "jsa_steps" ("jsa_id");

-- leads
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_leads_user_id" ON "leads" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_leads_client_id" ON "leads" ("client_id");

-- line_item_catalog
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_line_item_catalog_user_id" ON "line_item_catalog" ("user_id");

-- location_pings
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_location_pings_assignment_id" ON "location_pings" ("assignment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_location_pings_user_id" ON "location_pings" ("user_id");

-- location_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_location_tracking_user_id" ON "location_tracking" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_location_tracking_job_id" ON "location_tracking" ("job_id");

-- myob_connections
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_myob_connections_user_id" ON "myob_connections" ("user_id");

-- notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("user_id");

-- payment_installments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_installments_schedule_id" ON "payment_installments" ("schedule_id");

-- payment_records
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_records_invoice_id" ON "payment_records" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_records_user_id" ON "payment_records" ("user_id");

-- payment_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_requests_user_id" ON "payment_requests" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_requests_invoice_id" ON "payment_requests" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_requests_job_id" ON "payment_requests" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_requests_client_id" ON "payment_requests" ("client_id");

-- payment_schedules
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_schedules_user_id" ON "payment_schedules" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_schedules_invoice_id" ON "payment_schedules" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_payment_schedules_client_id" ON "payment_schedules" ("client_id");

-- permission_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_permission_requests_team_member_id" ON "permission_requests" ("team_member_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_permission_requests_business_owner_id" ON "permission_requests" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_permission_requests_responded_by" ON "permission_requests" ("responded_by");

-- ppe_checklists
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ppe_checklists_user_id" ON "ppe_checklists" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ppe_checklists_job_id" ON "ppe_checklists" ("job_id");

-- purchase_order_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_purchase_order_items_po_id" ON "purchase_order_items" ("po_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_purchase_order_items_inventory_item_id" ON "purchase_order_items" ("inventory_item_id");

-- purchase_orders
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_purchase_orders_user_id" ON "purchase_orders" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_purchase_orders_supplier_id" ON "purchase_orders" ("supplier_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_purchase_orders_job_id" ON "purchase_orders" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_purchase_orders_approved_by" ON "purchase_orders" ("approved_by");

-- push_tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_push_tokens_user_id" ON "push_tokens" ("user_id");

-- quickbooks_connections
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quickbooks_connections_user_id" ON "quickbooks_connections" ("user_id");

-- quick_replies
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quick_replies_user_id" ON "quick_replies" ("user_id");

-- quote_line_items
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quote_line_items_quote_id" ON "quote_line_items" ("quote_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quote_line_items_option_id" ON "quote_line_items" ("option_id");

-- quote_options
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quote_options_quote_id" ON "quote_options" ("quote_id");

-- quotes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quotes_user_id" ON "quotes" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quotes_client_id" ON "quotes" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quotes_job_id" ON "quotes" ("job_id");

-- quote_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quote_templates_user_id" ON "quote_templates" ("user_id");

-- quote_versions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_quote_versions_quote_id" ON "quote_versions" ("quote_id");

-- rate_cards
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rate_cards_user_id" ON "rate_cards" ("user_id");

-- rebates
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rebates_user_id" ON "rebates" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rebates_client_id" ON "rebates" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rebates_job_id" ON "rebates" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_rebates_invoice_id" ON "rebates" ("invoice_id");

-- receipts
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_receipts_user_id" ON "receipts" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_receipts_job_id" ON "receipts" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_receipts_invoice_id" ON "receipts" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_receipts_client_id" ON "receipts" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_receipts_payment_request_id" ON "receipts" ("payment_request_id");

-- recurring_contracts
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_recurring_contracts_user_id" ON "recurring_contracts" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_recurring_contracts_client_id" ON "recurring_contracts" ("client_id");

-- recurring_schedules
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_recurring_schedules_contract_id" ON "recurring_schedules" ("contract_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_recurring_schedules_job_id" ON "recurring_schedules" ("job_id");

-- report_configurations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_report_configurations_user_id" ON "report_configurations" ("user_id");

-- routes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_routes_user_id" ON "routes" ("user_id");

-- saved_filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_saved_filters_user_id" ON "saved_filters" ("user_id");

-- saved_reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_saved_reports_config_id" ON "saved_reports" ("config_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_saved_reports_user_id" ON "saved_reports" ("user_id");

-- service_reminders
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_service_reminders_job_id" ON "service_reminders" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_service_reminders_client_id" ON "service_reminders" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_service_reminders_user_id" ON "service_reminders" ("user_id");

-- site_emergency_info
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_emergency_info_user_id" ON "site_emergency_info" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_emergency_info_job_id" ON "site_emergency_info" ("job_id");

-- site_hazardous_environments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_hazardous_environments_user_id" ON "site_hazardous_environments" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_hazardous_environments_job_id" ON "site_hazardous_environments" ("job_id");

-- site_safety_signage
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_safety_signage_user_id" ON "site_safety_signage" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_site_safety_signage_job_id" ON "site_safety_signage" ("job_id");

-- sms_automation_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_automation_logs_rule_id" ON "sms_automation_logs" ("rule_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_automation_logs_message_id" ON "sms_automation_logs" ("message_id");

-- sms_automation_rules
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_automation_rules_user_id" ON "sms_automation_rules" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_automation_rules_template_id" ON "sms_automation_rules" ("template_id");

-- sms_booking_links
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_booking_links_job_id" ON "sms_booking_links" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_booking_links_business_owner_id" ON "sms_booking_links" ("business_owner_id");

-- sms_conversations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_conversations_business_owner_id" ON "sms_conversations" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_conversations_client_id" ON "sms_conversations" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_conversations_job_id" ON "sms_conversations" ("job_id");

-- sms_messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_messages_conversation_id" ON "sms_messages" ("conversation_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_messages_sender_user_id" ON "sms_messages" ("sender_user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_messages_job_created_from_sms" ON "sms_messages" ("job_created_from_sms");

-- sms_notification_log
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_notification_log_job_id" ON "sms_notification_log" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_notification_log_assignment_id" ON "sms_notification_log" ("assignment_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_notification_log_user_id" ON "sms_notification_log" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_notification_log_sms_message_id" ON "sms_notification_log" ("sms_message_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_notification_log_portal_token_id" ON "sms_notification_log" ("portal_token_id");

-- sms_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_templates_user_id" ON "sms_templates" ("user_id");

-- sms_tracking_links
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_tracking_links_job_id" ON "sms_tracking_links" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_tracking_links_team_member_id" ON "sms_tracking_links" ("team_member_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sms_tracking_links_business_owner_id" ON "sms_tracking_links" ("business_owner_id");

-- staff_schedules
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_staff_schedules_user_id" ON "staff_schedules" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_staff_schedules_job_id" ON "staff_schedules" ("job_id");

-- stripe_payouts
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_stripe_payouts_user_id" ON "stripe_payouts" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_stripe_payouts_invoice_id" ON "stripe_payouts" ("invoice_id");

-- style_presets
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_style_presets_user_id" ON "style_presets" ("user_id");

-- subcontractor_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_events_token_id" ON "subcontractor_events" ("token_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_events_job_id" ON "subcontractor_events" ("job_id");

-- subcontractor_location_pings
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_location_pings_token_id" ON "subcontractor_location_pings" ("token_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_location_pings_job_id" ON "subcontractor_location_pings" ("job_id");

-- subcontractor_sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_sessions_token_id" ON "subcontractor_sessions" ("token_id");

-- subcontractor_tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_tokens_job_id" ON "subcontractor_tokens" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_tokens_invite_id" ON "subcontractor_tokens" ("invite_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_tokens_user_id" ON "subcontractor_tokens" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_subcontractor_tokens_recipient_user_id" ON "subcontractor_tokens" ("recipient_user_id");

-- suppliers
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_suppliers_user_id" ON "suppliers" ("user_id");

-- swms_documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_swms_documents_user_id" ON "swms_documents" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_swms_documents_job_id" ON "swms_documents" ("job_id");

-- swms_hazards
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_swms_hazards_swms_id" ON "swms_hazards" ("swms_id");

-- swms_signatures
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_swms_signatures_swms_id" ON "swms_signatures" ("swms_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_swms_signatures_worker_user_id" ON "swms_signatures" ("worker_user_id");

-- tap_to_pay_terms_acceptance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tap_to_pay_terms_acceptance_accepted_by_user_id" ON "tap_to_pay_terms_acceptance" ("accepted_by_user_id");

-- team_chat
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_chat_business_owner_id" ON "team_chat" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_chat_sender_id" ON "team_chat" ("sender_id");

-- team_group_members
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_group_members_group_id" ON "team_group_members" ("group_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_group_members_team_member_id" ON "team_group_members" ("team_member_id");

-- team_groups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_groups_user_id" ON "team_groups" ("user_id");

-- team_member_availability
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_member_availability_team_member_id" ON "team_member_availability" ("team_member_id");

-- team_member_metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_member_metrics_team_member_id" ON "team_member_metrics" ("team_member_id");

-- team_members
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_members_business_owner_id" ON "team_members" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_members_member_id" ON "team_members" ("member_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_members_role_id" ON "team_members" ("role_id");

-- team_member_skills
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_member_skills_team_member_id" ON "team_member_skills" ("team_member_id");

-- team_member_time_off
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_member_time_off_team_member_id" ON "team_member_time_off" ("team_member_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_member_time_off_approved_by" ON "team_member_time_off" ("approved_by");

-- team_presence
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_presence_user_id" ON "team_presence" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_presence_business_owner_id" ON "team_presence" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_team_presence_current_job_id" ON "team_presence" ("current_job_id");

-- template_analysis_jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_template_analysis_jobs_user_id" ON "template_analysis_jobs" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_template_analysis_jobs_created_template_id" ON "template_analysis_jobs" ("created_template_id");

-- terminal_locations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_terminal_locations_user_id" ON "terminal_locations" ("user_id");

-- terminal_payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_terminal_payments_user_id" ON "terminal_payments" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_terminal_payments_client_id" ON "terminal_payments" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_terminal_payments_invoice_id" ON "terminal_payments" ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_terminal_payments_job_id" ON "terminal_payments" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_terminal_payments_location_id" ON "terminal_payments" ("location_id");

-- time_entries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entries_user_id" ON "time_entries" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entries_job_id" ON "time_entries" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entries_approved_by" ON "time_entries" ("approved_by");

-- time_entry_dispute_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entry_dispute_events_time_entry_id" ON "time_entry_dispute_events" ("time_entry_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entry_dispute_events_actor_id" ON "time_entry_dispute_events" ("actor_id");

-- time_entry_edits
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entry_edits_time_entry_id" ON "time_entry_edits" ("time_entry_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_time_entry_edits_edited_by" ON "time_entry_edits" ("edited_by");

-- timesheet_approvals
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_timesheet_approvals_time_entry_id" ON "timesheet_approvals" ("time_entry_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_timesheet_approvals_submitted_by" ON "timesheet_approvals" ("submitted_by");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_timesheet_approvals_approved_by" ON "timesheet_approvals" ("approved_by");

-- timesheets
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_timesheets_user_id" ON "timesheets" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_timesheets_approved_by" ON "timesheets" ("approved_by");

-- tradie_status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tradie_status_business_owner_id" ON "tradie_status" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tradie_status_current_job_id" ON "tradie_status" ("current_job_id");

-- training_records
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_training_records_user_id" ON "training_records" ("user_id");

-- voice_notes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_notes_user_id" ON "voice_notes" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_notes_job_id" ON "voice_notes" ("job_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_notes_recorded_by" ON "voice_notes" ("recorded_by");

-- worker_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_worker_requests_client_id" ON "worker_requests" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_worker_requests_business_owner_id" ON "worker_requests" ("business_owner_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_worker_requests_preferred_worker_id" ON "worker_requests" ("preferred_worker_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_worker_requests_reference_job_id" ON "worker_requests" ("reference_job_id");

-- xero_connections
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_xero_connections_user_id" ON "xero_connections" ("user_id");

-- xero_sync_state
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_xero_sync_state_user_id" ON "xero_sync_state" ("user_id");

-- =====================================================================
-- ROLLBACK (run manually if needed; also requires being outside a tx):
-- =====================================================================
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_activity_feed_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_activity_feed_actor_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_activity_feed_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_activity_logs_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_assignment_events_assignment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_assignment_events_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_assignment_events_actor_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_automation_logs_automation_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_automations_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_business_settings_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_business_templates_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_checklist_items_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_client_assets_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_client_assets_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_client_asset_services_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_client_asset_services_asset_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_client_asset_services_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_client_asset_services_performed_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_clients_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_compliance_documents_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_compliance_documents_holder_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_customer_sessions_customer_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_customer_surveys_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_customer_surveys_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_customer_surveys_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_customer_users_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_customer_users_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_custom_forms_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_defects_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_defects_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_defects_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_digital_signatures_form_submission_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_digital_signatures_assignment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_digital_signatures_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_digital_signatures_quote_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_digital_signatures_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_digital_signatures_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_direct_messages_sender_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_direct_messages_recipient_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_document_templates_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_email_campaigns_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_email_delivery_logs_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_email_delivery_logs_email_integration_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_email_integrations_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_category_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_assigned_to";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_categories_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_maintenance_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_maintenance_equipment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_equipment_maintenance_performed_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_expense_categories_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_expenses_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_expenses_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_expenses_category_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_expenses_approved_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_form_submissions_form_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_form_submissions_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_form_submissions_submitted_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_form_submissions_customer_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_form_submissions_reviewed_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_geofence_alerts_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_geofence_alerts_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_geofence_alerts_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_gps_signal_logs_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_gps_signal_logs_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_gps_signal_logs_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_hazard_reports_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_hazard_reports_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_incident_reports_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_incident_reports_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_integration_settings_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_inventory_categories_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_inventory_items_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_inventory_items_category_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_inventory_transactions_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_inventory_transactions_item_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_inventory_transactions_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invite_codes_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invite_codes_role_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoice_edits_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoice_edits_edited_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoice_line_items_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoice_reminder_logs_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoice_reminder_logs_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoices_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoices_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoices_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_invoices_quote_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignment_requests_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignment_requests_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignment_requests_requester_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignment_requests_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignment_requests_responded_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignments_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignments_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_assignments_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_chat_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_chat_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_checkins_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_checkins_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_documents_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_documents_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_documents_uploaded_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_equipment_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_equipment_equipment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_equipment_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_invites_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_invites_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_invites_used_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_materials_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_materials_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_notes_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_notes_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_notes_created_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_photo_requirements_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_photos_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_photos_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_photos_uploaded_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_portal_tokens_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_portal_tokens_assignment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_portal_tokens_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_reminders_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_reminders_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_requests_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_requests_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_requests_reference_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_requests_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_jobs_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_jobs_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_variations_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_variations_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_job_variations_created_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_jsa_documents_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_jsa_documents_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_jsa_steps_jsa_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_leads_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_leads_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_line_item_catalog_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_location_pings_assignment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_location_pings_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_location_tracking_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_location_tracking_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_myob_connections_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_notifications_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_installments_schedule_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_records_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_records_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_requests_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_requests_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_requests_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_requests_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_schedules_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_schedules_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_payment_schedules_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_permission_requests_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_permission_requests_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_permission_requests_responded_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_ppe_checklists_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_ppe_checklists_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_purchase_order_items_po_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_purchase_order_items_inventory_item_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_purchase_orders_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_purchase_orders_supplier_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_purchase_orders_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_purchase_orders_approved_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_push_tokens_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quickbooks_connections_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quick_replies_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quote_line_items_quote_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quote_line_items_option_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quote_options_quote_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quotes_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quotes_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quotes_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quote_templates_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_quote_versions_quote_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_rate_cards_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_rebates_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_rebates_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_rebates_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_rebates_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_receipts_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_receipts_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_receipts_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_receipts_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_receipts_payment_request_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_recurring_contracts_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_recurring_contracts_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_recurring_schedules_contract_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_recurring_schedules_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_report_configurations_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_routes_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_saved_filters_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_saved_reports_config_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_saved_reports_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_service_reminders_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_service_reminders_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_service_reminders_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_site_emergency_info_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_site_emergency_info_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_site_hazardous_environments_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_site_hazardous_environments_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_site_safety_signage_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_site_safety_signage_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_automation_logs_rule_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_automation_logs_message_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_automation_rules_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_automation_rules_template_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_booking_links_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_booking_links_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_conversations_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_conversations_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_conversations_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_messages_conversation_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_messages_sender_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_messages_job_created_from_sms";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_notification_log_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_notification_log_assignment_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_notification_log_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_notification_log_sms_message_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_notification_log_portal_token_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_templates_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_tracking_links_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_tracking_links_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_sms_tracking_links_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_staff_schedules_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_staff_schedules_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_stripe_payouts_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_stripe_payouts_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_style_presets_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_events_token_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_events_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_location_pings_token_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_location_pings_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_sessions_token_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_tokens_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_tokens_invite_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_tokens_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_subcontractor_tokens_recipient_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_suppliers_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_swms_documents_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_swms_documents_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_swms_hazards_swms_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_swms_signatures_swms_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_swms_signatures_worker_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_tap_to_pay_terms_acceptance_accepted_by_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_chat_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_chat_sender_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_group_members_group_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_group_members_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_groups_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_member_availability_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_member_metrics_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_members_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_members_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_members_role_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_member_skills_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_member_time_off_team_member_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_member_time_off_approved_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_presence_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_presence_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_team_presence_current_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_template_analysis_jobs_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_template_analysis_jobs_created_template_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_terminal_locations_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_terminal_payments_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_terminal_payments_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_terminal_payments_invoice_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_terminal_payments_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_terminal_payments_location_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entries_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entries_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entries_approved_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entry_dispute_events_time_entry_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entry_dispute_events_actor_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entry_edits_time_entry_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_time_entry_edits_edited_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_timesheet_approvals_time_entry_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_timesheet_approvals_submitted_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_timesheet_approvals_approved_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_timesheets_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_timesheets_approved_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_tradie_status_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_tradie_status_current_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_training_records_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_voice_notes_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_voice_notes_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_voice_notes_recorded_by";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_worker_requests_client_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_worker_requests_business_owner_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_worker_requests_preferred_worker_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_worker_requests_reference_job_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_xero_connections_user_id";
-- DROP INDEX CONCURRENTLY IF EXISTS "idx_xero_sync_state_user_id";
