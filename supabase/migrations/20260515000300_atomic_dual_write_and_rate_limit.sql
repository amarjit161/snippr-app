-- Atomic dual-write function and rate limiting table
-- SAFE: add-only statements

-- 1) Rate limits table for verification attempts
CREATE TABLE IF NOT EXISTS public.verification_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_rate_limits_key ON public.verification_rate_limits USING btree(key);

-- 2) Atomic dual-write function: insert into canonical then legacy in a single transaction
CREATE OR REPLACE FUNCTION public.atomic_dual_write_queue(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  svc RECORD;
BEGIN
  -- Insert into canonical queue_bookings with generated id
  INSERT INTO public.queue_bookings (
    id, salon_id, user_id, service_id, barber_id, status, position, created_at,
    customer_first_name, customer_last_name, customer_phone, booking_date, time_slot, notes
  ) VALUES (
    gen_random_uuid(),
    (p_payload->>'salon_id')::uuid,
    NULLIF(p_payload->>'user_id','')::uuid,
    NULLIF(p_payload->>'service_id','')::uuid,
    NULLIF(p_payload->>'barber_id','')::uuid,
    COALESCE(p_payload->>'status','waiting')::text,
    COALESCE((p_payload->>'position')::int, NULL),
    COALESCE(NULLIF(p_payload->>'created_at','')::timestamptz, now()),
    p_payload->>'customer_first_name',
    p_payload->>'customer_last_name',
    p_payload->>'customer_phone',
    p_payload->>'booking_date',
    p_payload->>'time_slot',
    p_payload->>'notes'
  ) RETURNING * INTO svc;

  -- Insert into legacy customer_bookings using same id
  INSERT INTO public.customer_bookings (
    id, salon_id, user_id, service_id, barber_id, status, position, created_at,
    customer_first_name, customer_last_name, customer_phone, booking_date, time_slot, notes
  ) VALUES (
    svc.id, svc.salon_id, svc.user_id, svc.service_id, svc.barber_id, svc.status, svc.position, svc.created_at,
    svc.customer_first_name, svc.customer_last_name, svc.customer_phone, svc.booking_date, svc.time_slot, svc.notes
  );

  RETURN to_jsonb(svc);
END;
$$;
