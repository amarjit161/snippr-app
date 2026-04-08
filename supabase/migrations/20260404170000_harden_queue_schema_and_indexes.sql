-- Idempotent queue schema hardening for customer/booking fields and constraints

-- 1) Ensure required columns exist with requested types
ALTER TABLE public.queue
ADD COLUMN IF NOT EXISTS customer_first_name TEXT,
ADD COLUMN IF NOT EXISTS customer_last_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS booking_date DATE,
ADD COLUMN IF NOT EXISTS booking_time TIME,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2) Normalize column types in case they were introduced with different text-like types
ALTER TABLE public.queue
  ALTER COLUMN customer_first_name TYPE TEXT USING customer_first_name::TEXT,
  ALTER COLUMN customer_last_name TYPE TEXT USING customer_last_name::TEXT,
  ALTER COLUMN customer_phone TYPE TEXT USING customer_phone::TEXT,
  ALTER COLUMN notes TYPE TEXT USING notes::TEXT;

-- 3) Ensure status default is waiting
ALTER TABLE public.queue
  ALTER COLUMN status SET DEFAULT 'waiting';

-- 4) Make customer_phone NOT NULL safely for existing rows
UPDATE public.queue
SET customer_phone = ''
WHERE customer_phone IS NULL;

ALTER TABLE public.queue
  ALTER COLUMN customer_phone SET NOT NULL,
  ALTER COLUMN customer_phone SET DEFAULT '';

-- 5) Resolve existing active duplicate barber bookings so partial unique index can be created safely
WITH ranked_duplicates AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY barber_id, booking_date, booking_time
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.queue
  WHERE status IN ('waiting', 'in_progress')
    AND barber_id IS NOT NULL
    AND booking_date IS NOT NULL
    AND booking_time IS NOT NULL
)
UPDATE public.queue q
SET
  status = 'cancelled',
  notes = CASE
    WHEN q.notes IS NULL OR q.notes = '' THEN 'Auto-cancelled duplicate active booking during migration.'
    ELSE q.notes || ' | Auto-cancelled duplicate active booking during migration.'
  END
FROM ranked_duplicates d
WHERE q.id = d.id
  AND d.rn > 1;

-- 6) Add requested indexes
CREATE INDEX IF NOT EXISTS idx_queue_customer_phone
  ON public.queue (customer_phone);

CREATE INDEX IF NOT EXISTS idx_queue_salon_booking_date_time
  ON public.queue (salon_id, booking_date, booking_time);

-- 7) Prevent duplicate active bookings per barber per slot
CREATE UNIQUE INDEX IF NOT EXISTS ux_queue_barber_active_booking_slot
  ON public.queue (barber_id, booking_date, booking_time)
  WHERE status IN ('waiting', 'in_progress')
    AND barber_id IS NOT NULL
    AND booking_date IS NOT NULL
    AND booking_time IS NOT NULL;
