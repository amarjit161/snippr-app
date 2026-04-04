-- Add customer detail columns to queue table for walk-in customers
ALTER TABLE public.queue
ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

-- Create index on customer_phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_queue_customer_phone ON public.queue(customer_phone) WHERE customer_phone IS NOT NULL;
