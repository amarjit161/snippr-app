-- Queue RLS fix: enforce authenticated ownership via customer_id while preserving legacy user_id inserts.
-- This keeps the booking flow backend-safe without changing frontend behavior.

BEGIN;

ALTER TABLE public.queue
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.queue
SET customer_id = user_id
WHERE customer_id IS NULL
  AND user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_queue_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.customer_id := COALESCE(NEW.customer_id, NEW.user_id, auth.uid());
  NEW.user_id := COALESCE(NEW.user_id, NEW.customer_id, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_queue_customer_id ON public.queue;
CREATE TRIGGER trg_sync_queue_customer_id
BEFORE INSERT OR UPDATE ON public.queue
FOR EACH ROW
EXECUTE FUNCTION public.sync_queue_customer_id();

DROP POLICY IF EXISTS "queue_select_authenticated" ON public.queue;
DROP POLICY IF EXISTS "queue_insert_customer" ON public.queue;
DROP POLICY IF EXISTS "queue_insert_authenticated" ON public.queue;
DROP POLICY IF EXISTS "queue_update_authenticated" ON public.queue;
DROP POLICY IF EXISTS "queue_update_customer" ON public.queue;
DROP POLICY IF EXISTS "queue_delete_customer" ON public.queue;
DROP POLICY IF EXISTS "queue_update_owner" ON public.queue;
DROP POLICY IF EXISTS "queue_delete_owner" ON public.queue;
DROP POLICY IF EXISTS "Users can view queue for any salon" ON public.queue;
DROP POLICY IF EXISTS "Users can join queue" ON public.queue;
DROP POLICY IF EXISTS "Users can update own queue entry" ON public.queue;
DROP POLICY IF EXISTS "Users can cancel own queue entry" ON public.queue;
DROP POLICY IF EXISTS "Owners can update their salon queue" ON public.queue;
DROP POLICY IF EXISTS "Owners can delete their salon queue" ON public.queue;
DROP POLICY IF EXISTS "Anyone can view queues" ON public.queue;
DROP POLICY IF EXISTS "Customers can join queue" ON public.queue;
DROP POLICY IF EXISTS "Users can update own queue entry" ON public.queue;
DROP POLICY IF EXISTS "Users can cancel own queue entry" ON public.queue;

ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_select_authenticated"
  ON public.queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "queue_select_availability"
  ON public.queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "queue_insert_authenticated"
  ON public.queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
  );

CREATE POLICY "queue_update_customer"
  ON public.queue
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
  )
  WITH CHECK (
    customer_id = auth.uid()
  );

CREATE POLICY "queue_delete_customer"
  ON public.queue
  FOR DELETE
  TO authenticated
  USING (
    customer_id = auth.uid()
  );

CREATE POLICY "queue_update_owner"
  ON public.queue
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salons s
      WHERE s.id = queue.salon_id
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.salons s
      WHERE s.id = queue.salon_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "queue_delete_owner"
  ON public.queue
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salons s
      WHERE s.id = queue.salon_id
        AND s.owner_id = auth.uid()
    )
  );

REVOKE ALL ON public.queue FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue TO authenticated;

CREATE INDEX IF NOT EXISTS idx_queue_customer_id_status
  ON public.queue(customer_id, status)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_queue_salon_status_date
  ON public.queue(salon_id, status, booking_date)
  WHERE booking_date IS NOT NULL;

COMMIT;
