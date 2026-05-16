-- Draft migration: add audit table, verification columns, and example RLS
-- SAFE: add-only changes; do not drop or alter live customer_bookings

-- 1) Audit table for sync issues
CREATE TABLE IF NOT EXISTS public.queue_sync_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid,
  salon_id uuid,
  action text,
  error text,
  created_at timestamptz DEFAULT now()
);

-- 2) Add verification columns to canonical queue_bookings (idempotent)
ALTER TABLE IF EXISTS public.queue_bookings
  ADD COLUMN IF NOT EXISTS verification_code_hash text,
  ADD COLUMN IF NOT EXISTS verification_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_attempt_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz;

-- 3) Example RLS: salon owners can manage rows for their salon
ALTER TABLE IF EXISTS public.queue_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: owners can SELECT rows from their salon
CREATE POLICY IF NOT EXISTS "owners_select_own_queue" ON public.queue_bookings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = public.queue_bookings.salon_id AND s.owner_id = current_setting('jwt.claims.user_id')::uuid));

-- Policy: owners can UPDATE rows in their salon
CREATE POLICY IF NOT EXISTS "owners_update_own_queue" ON public.queue_bookings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = public.queue_bookings.salon_id AND s.owner_id = current_setting('jwt.claims.user_id')::uuid));

-- Policy: customers can INSERT their own bookings (example, tuned per auth)
CREATE POLICY IF NOT EXISTS "customers_insert_own" ON public.queue_bookings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR user_id IS NULL));

-- 4) Add publication to supabase_realtime if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication p WHERE p.pubname = 'supabase_realtime' AND EXISTS (SELECT 1 FROM pg_publication_rel pr WHERE pr.prpubid = p.oid AND pr.prrelid = 'public.queue_bookings'::regclass)) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_bookings;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- publication or table missing in older projects; ignore safely
  RAISE NOTICE 'Publication or table not found, skipping add-to-publication';
END$$;

-- 5) Example function to atomically verify a numeric code server-side
CREATE OR REPLACE FUNCTION public.verify_queue_code(p_queue_id uuid, p_code_hash text)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.queue_bookings
  SET verification_verified = true, verification_attempt_count = verification_attempt_count + 1
  WHERE id = p_queue_id AND verification_code_hash = p_code_hash;

  RETURN FOUND;
END; $$;

-- Note: This migration is a draft. Test in staging before applying to production.
