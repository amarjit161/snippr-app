-- Migration: fix_multi_service_queue.sql
-- Adds multi-service booking support columns and indexes to public.queue
BEGIN;

-- Add missing columns safely (nullable, with defaults for compatibility)
ALTER TABLE IF EXISTS public.queue
  ADD COLUMN IF NOT EXISTS is_multi_service boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_duration integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS services_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS selected_services jsonb DEFAULT '[]'::jsonb;

-- Add booking_time alias column if missing for compatibility with alternate payloads
ALTER TABLE IF EXISTS public.queue
  ADD COLUMN IF NOT EXISTS booking_time time without time zone;

-- Create indexes to support queries
CREATE INDEX IF NOT EXISTS idx_queue_salon_id ON public.queue (salon_id);
CREATE INDEX IF NOT EXISTS idx_queue_barber_id ON public.queue (barber_id);
CREATE INDEX IF NOT EXISTS idx_queue_booking_date ON public.queue (booking_date);
CREATE INDEX IF NOT EXISTS idx_queue_customer_id ON public.queue (customer_id);

COMMIT;
