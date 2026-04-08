-- Ensure queue schema matches booking/walk-in frontend fields
ALTER TABLE public.queue
ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS booking_date DATE,
ADD COLUMN IF NOT EXISTS booking_time TIME,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Helpful indexes for booking conflict checks and customer lookups
CREATE INDEX IF NOT EXISTS idx_queue_customer_phone ON public.queue(customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queue_booking_slot ON public.queue(salon_id, barber_id, booking_date, booking_time)
WHERE booking_date IS NOT NULL AND booking_time IS NOT NULL;
