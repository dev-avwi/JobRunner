-- Add distanceKm to time_entries for driving/travel distance tracking
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "distance_km" numeric(10, 2);

-- Add travelRatePerKm to business_settings for per-km travel allowance rate
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "travel_rate_per_km" numeric(10, 4) DEFAULT '0.0000';
