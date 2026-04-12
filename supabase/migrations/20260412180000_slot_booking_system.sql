-- Slot Booking System Migration
-- Adds booking_date and time_slot columns for BookMyShow-style availability

-- Add booking_date and time_slot columns if they don't exist
ALTER TABLE public.queue 
  ADD COLUMN IF NOT EXISTS booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS time_slot TIME NOT NULL DEFAULT '10:00:00';

-- Drop old unique constraint if exists (named unique_barber_booking)
ALTER TABLE public.queue
  DROP CONSTRAINT IF EXISTS unique_barber_booking;

-- Add new unique constraint to prevent double-booking same barber + date + time
ALTER TABLE public.queue
  ADD CONSTRAINT unique_barber_slot 
  UNIQUE (barber_id, booking_date, time_slot);

-- Performance indexes for slot lookups
CREATE INDEX IF NOT EXISTS idx_queue_slot_lookup 
  ON public.queue(salon_id, booking_date, time_slot, status);

CREATE INDEX IF NOT EXISTS idx_queue_barber_slot 
  ON public.queue(barber_id, booking_date, time_slot);

-- Index for checking available barbers on a date/time
CREATE INDEX IF NOT EXISTS idx_queue_date_time_status 
  ON public.queue(booking_date, time_slot, status);
