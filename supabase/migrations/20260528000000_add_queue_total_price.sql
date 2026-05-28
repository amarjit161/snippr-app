-- Add missing total_price column to queue for booking inserts
ALTER TABLE public.queue
ADD COLUMN IF NOT EXISTS total_price numeric DEFAULT 0;
