-- Add arrival OTP system to queue table
-- This enables secure seat confirmation with 4-digit codes

ALTER TABLE public.queue
ADD COLUMN IF NOT EXISTS arrival_otp VARCHAR(4),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ;

-- Index for efficient OTP lookups and expiry checks
CREATE INDEX IF NOT EXISTS idx_queue_arrival_otp 
  ON public.queue(arrival_otp) 
  WHERE arrival_otp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_queue_otp_expires 
  ON public.queue(otp_expires_at) 
  WHERE otp_expires_at IS NOT NULL AND otp_verified_at IS NULL;

-- Index for checking verified arrivals
CREATE INDEX IF NOT EXISTS idx_queue_otp_verified 
  ON public.queue(otp_verified_at) 
  WHERE otp_verified_at IS NOT NULL;
