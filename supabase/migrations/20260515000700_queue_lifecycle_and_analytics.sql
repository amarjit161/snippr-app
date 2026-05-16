-- Queue lifecycle events + analytics aggregation

CREATE TABLE IF NOT EXISTS public.queue_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid,
  salon_id uuid,
  event_name text NOT NULL,
  from_status text,
  to_status text,
  actor text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_lifecycle_events_salon_created ON public.queue_lifecycle_events USING btree(salon_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.queue_analytics_aggregate(p_salon_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(status text, count bigint) LANGUAGE sql AS $$
  SELECT qb.status::text, COUNT(*)::bigint
  FROM public.queue_bookings qb
  WHERE qb.salon_id = p_salon_id
    AND qb.created_at >= p_from
    AND qb.created_at < p_to
  GROUP BY qb.status;
$$;
