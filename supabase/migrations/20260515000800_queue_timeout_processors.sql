-- Timeout and no-show processors for operational reliability

CREATE OR REPLACE FUNCTION public.process_queue_timeouts(p_salon_id uuid DEFAULT NULL)
RETURNS TABLE(updated_id uuid, new_status text) LANGUAGE plpgsql AS $$
BEGIN
  -- Mark stale waiting as expired (example threshold: 8 hours)
  RETURN QUERY
  WITH target AS (
    SELECT id FROM public.queue_bookings
    WHERE (p_salon_id IS NULL OR salon_id = p_salon_id)
      AND status = 'waiting'
      AND created_at < now() - interval '8 hours'
  ), upd AS (
    UPDATE public.queue_bookings qb
    SET status = 'expired'
    FROM target t
    WHERE qb.id = t.id
    RETURNING qb.id, qb.status
  )
  SELECT upd.id, upd.status::text FROM upd;
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_no_show(p_salon_id uuid DEFAULT NULL)
RETURNS TABLE(updated_id uuid, new_status text) LANGUAGE plpgsql AS $$
BEGIN
  -- Mark confirmed/arriving as no_show if too old (example threshold: 45m)
  RETURN QUERY
  WITH target AS (
    SELECT id FROM public.queue_bookings
    WHERE (p_salon_id IS NULL OR salon_id = p_salon_id)
      AND status IN ('confirmed','arriving')
      AND created_at < now() - interval '45 minutes'
  ), upd AS (
    UPDATE public.queue_bookings qb
    SET status = 'no_show'
    FROM target t
    WHERE qb.id = t.id
    RETURNING qb.id, qb.status
  )
  SELECT upd.id, upd.status::text FROM upd;
END;
$$;
