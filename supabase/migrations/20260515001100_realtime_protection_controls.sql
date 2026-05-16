-- Realtime protection controls: thresholds, alerts, and salon-level token limits

CREATE TABLE IF NOT EXISTS public.realtime_alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  max_reconnects_per_min integer DEFAULT 12,
  max_delayed_events_per_min integer DEFAULT 30,
  max_backlog integer DEFAULT 500,
  max_latency_ms integer DEFAULT 15000,
  max_conflicts_per_hour integer DEFAULT 25,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id)
);

CREATE TABLE IF NOT EXISTS public.realtime_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  details jsonb,
  created_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.salon_realtime_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  bucket_key text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 120,
  refill_per_min integer NOT NULL DEFAULT 120,
  last_refill_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, bucket_key)
);

CREATE OR REPLACE FUNCTION public.consume_salon_realtime_tokens(
  p_salon_id uuid,
  p_bucket_key text,
  p_cost integer DEFAULT 1,
  p_capacity integer DEFAULT 120,
  p_refill_per_min integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  row_rec record;
  elapsed_mins numeric;
  refill_tokens integer;
  effective_tokens integer;
BEGIN
  INSERT INTO public.salon_realtime_limits(salon_id, bucket_key, tokens, capacity, refill_per_min, last_refill_at)
  VALUES (p_salon_id, p_bucket_key, p_capacity, p_capacity, p_refill_per_min, now())
  ON CONFLICT (salon_id, bucket_key) DO NOTHING;

  SELECT * INTO row_rec
  FROM public.salon_realtime_limits
  WHERE salon_id = p_salon_id AND bucket_key = p_bucket_key
  FOR UPDATE;

  elapsed_mins := EXTRACT(EPOCH FROM (now() - row_rec.last_refill_at)) / 60.0;
  refill_tokens := FLOOR(elapsed_mins * row_rec.refill_per_min);
  effective_tokens := LEAST(row_rec.capacity, row_rec.tokens + refill_tokens);

  IF effective_tokens < p_cost THEN
    UPDATE public.salon_realtime_limits
    SET tokens = effective_tokens,
        last_refill_at = now(),
        updated_at = now()
    WHERE id = row_rec.id;
    RETURN false;
  END IF;

  UPDATE public.salon_realtime_limits
  SET tokens = effective_tokens - p_cost,
      last_refill_at = now(),
      updated_at = now()
  WHERE id = row_rec.id;

  RETURN true;
END;
$$;
