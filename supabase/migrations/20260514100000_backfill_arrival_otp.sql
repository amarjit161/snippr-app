-- Backfill arrival_otp for existing bookings without OTP
-- OTP stays valid until booking is completed, cancelled, or rejected (status-based)
-- NOT time-based - works like Amazon/Flipkart delivery tracking

UPDATE public.queue
SET 
  arrival_otp = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
  -- Note: otp_expires_at is NOT set - OTP validity is based on booking status
WHERE 
  arrival_otp IS NULL 
  AND status IN ('waiting', 'confirmed', 'accepted', 'in_progress')
  AND created_at > NOW() - INTERVAL '30 days';

-- For completed/cancelled bookings, they don't need OTP
-- Log the results
SELECT 
  COUNT(*) as bookings_updated,
  COUNT(DISTINCT DATE(created_at)) as dates_affected,
  COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_count,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count
FROM public.queue
WHERE arrival_otp IS NOT NULL AND status IN ('waiting', 'confirmed', 'accepted', 'in_progress');

