-- Presence table, admin activity logs, archived queue table and archive function

CREATE TABLE IF NOT EXISTS public.queue_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  user_id uuid,
  connection_id text NOT NULL,
  meta jsonb,
  last_seen timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_presence_salon ON public.queue_presence USING btree(salon_id);

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.archived_queue_bookings AS TABLE public.queue_bookings WITH NO DATA;

-- Archive function: move completed rows older than p_days into archived table
CREATE OR REPLACE FUNCTION public.archive_old_queue_bookings(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  moved integer := 0;
BEGIN
  INSERT INTO public.archived_queue_bookings
  SELECT * FROM public.queue_bookings WHERE status = 'completed' AND created_at < now() - (p_days || ' days')::interval;

  GET DIAGNOSTICS moved = ROW_COUNT;

  DELETE FROM public.queue_bookings WHERE id IN (SELECT id FROM public.archived_queue_bookings);

  RETURN moved;
END; $$;
