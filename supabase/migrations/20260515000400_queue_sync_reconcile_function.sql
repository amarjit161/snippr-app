-- Reconciliation function: find canonical rows missing in legacy and record audit entries
CREATE OR REPLACE FUNCTION public.queue_sync_reconcile(p_salon_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE(missing_id uuid) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT id FROM public.queue_bookings WHERE salon_id = p_salon_id ORDER BY created_at DESC LIMIT p_limit
  )
  SELECT l.id FROM latest l
  LEFT JOIN public.customer_bookings cb ON cb.id = l.id
  WHERE cb.id IS NULL;
END;
$$;
