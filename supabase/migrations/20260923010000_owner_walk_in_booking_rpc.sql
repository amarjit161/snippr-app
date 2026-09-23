-- Owner manual/walk-in booking, Step 4B.
--
-- Fixes the previously-broken addWalkIn() path (Step 4A audit): it inserted
-- columns that don't exist on the live public.bookings table and stamped
-- customer_id with the OWNER's own auth id instead of a real customer's.
--
-- This migration:
--   1. Adds bookings.source so an owner-created walk-in can be told apart
--      from an app/QR customer booking, without touching customer_id.
--   2. Adds one SECURITY DEFINER RPC, create_owner_walk_in_booking(), that
--      atomically: authenticates the caller, verifies they own the salon,
--      validates the service/barber belong to that salon, resolves an
--      existing Snippr account by exact case-insensitive email match
--      against auth.users.email (never customer_profiles.email, which has
--      no uniqueness guarantee) when explicitly asked to, and performs the
--      booking insert.
--
-- auth.users is never exposed to the client: the function only ever returns
-- the new booking id and a 'existing' | 'not_found' | 'guest' tag — never an
-- email, name, phone, or the matched user's id itself.
--
-- p_customer_mode is an explicit, required 'existing' | 'guest' parameter —
-- never inferred from whether an email happens to be present — so the two
-- modes stay strictly separate:
--   'existing' + match      -> booking created, customer_id = the real user
--   'existing' + no match   -> NO booking is created at all ('not_found'),
--                              so the owner can never mistake a guest
--                              booking for one linked to a Snippr account
--   'guest'                 -> no lookup is ever attempted, customer_id NULL

-- 1. Distinguish booking origin without touching customer_id or existing rows'
-- meaning. Defaults to 'app' so every historical row and every row inserted
-- through the existing (unmodified) customer/QR booking path is backfilled
-- and continues to be tagged 'app' with zero changes to that code path.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_source_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_check
  CHECK (source IN ('app', 'qr', 'owner_walk_in'));

-- 2. The single, atomic owner walk-in operation. The original signature (no
-- p_customer_mode) is dropped explicitly rather than left as a second,
-- looser overload — CREATE OR REPLACE cannot replace a function whose
-- parameter list changed, and leaving the old signature callable would
-- reintroduce the silent "no match -> guest" behavior this fix removes.
DROP FUNCTION IF EXISTS public.create_owner_walk_in_booking(uuid, uuid, uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_owner_walk_in_booking(
  p_salon_id uuid,
  p_service_id uuid,
  p_barber_id uuid,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_customer_mode text,
  p_customer_email text DEFAULT NULL
)
RETURNS TABLE (booking_id uuid, customer_match text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_resolved_customer_id uuid;
  v_customer_match text;
  v_normalized_email text;
  v_booking_id uuid;
  v_next_position int;
  v_first text := nullif(btrim(p_customer_first_name), '');
  v_last text := nullif(btrim(p_customer_last_name), '');
  v_phone text := nullif(btrim(p_customer_phone), '');
  v_notes text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_salon_id IS NULL THEN
    RAISE EXCEPTION 'salon_id is required' USING ERRCODE = '22004';
  END IF;

  -- Ownership check: the caller must own THIS exact salon. This is what
  -- prevents an owner from creating a booking for another salon, and is
  -- also what lets this function's INSERT succeed with an arbitrary
  -- customer_id even though the regular client-facing RLS policy on
  -- bookings (customer_id = auth.uid() OR is_admin()) would otherwise
  -- reject it — the check here IS the authorization, done once, in one
  -- audited place, before anything is written.
  IF NOT EXISTS (
    SELECT 1 FROM public.salons s WHERE s.id = p_salon_id AND s.owner_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not authorized for this salon' USING ERRCODE = '42501';
  END IF;

  IF p_service_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.services sv WHERE sv.id = p_service_id AND sv.salon_id = p_salon_id
  ) THEN
    RAISE EXCEPTION 'Service does not belong to this salon' USING ERRCODE = '22023';
  END IF;

  IF p_barber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.barbers b WHERE b.id = p_barber_id AND b.salon_id = p_salon_id
  ) THEN
    RAISE EXCEPTION 'Barber does not belong to this salon' USING ERRCODE = '22023';
  END IF;

  IF v_first IS NULL OR v_last IS NULL OR v_phone IS NULL THEN
    RAISE EXCEPTION 'Customer first name, last name and phone are required' USING ERRCODE = '22004';
  END IF;

  IF p_customer_mode NOT IN ('existing', 'guest') THEN
    RAISE EXCEPTION 'customer_mode must be ''existing'' or ''guest''' USING ERRCODE = '22023';
  END IF;

  IF p_customer_mode = 'existing' THEN
    IF p_customer_email IS NULL OR length(btrim(p_customer_email)) = 0 THEN
      RAISE EXCEPTION 'Email is required when customer_mode is ''existing''' USING ERRCODE = '22004';
    END IF;
    IF position('@' in p_customer_email) = 0 THEN
      RAISE EXCEPTION 'Invalid email format' USING ERRCODE = '22023';
    END IF;

    -- auth.users.email is the authoritative, unique account identity
    -- (customer_profiles.email carries no uniqueness guarantee and is never
    -- used as a lookup key here). auth.users itself is never exposed past
    -- this function: only the tag below ever leaves it, never the row, the
    -- id, or any other column.
    v_normalized_email := lower(btrim(p_customer_email));

    SELECT u.id INTO v_resolved_customer_id
    FROM auth.users u
    WHERE lower(u.email) = v_normalized_email
    LIMIT 1;

    IF v_resolved_customer_id IS NULL THEN
      -- No match: do NOT create a booking. Returning early here (instead of
      -- falling back to a guest booking) is the whole point of this fix —
      -- the owner must not be able to mistake an unlinked guest booking for
      -- one that's actually tied to the customer's Snippr account.
      RETURN QUERY SELECT NULL::uuid, 'not_found'::text;
      RETURN;
    END IF;

    v_customer_match := 'existing';
  ELSE
    -- Guest mode: no lookup is attempted at all, regardless of any email
    -- value that might have been passed.
    v_resolved_customer_id := NULL;
    v_customer_match := 'guest';
  END IF;

  SELECT coalesce(max(position), 0) + 1 INTO v_next_position
  FROM public.bookings
  WHERE salon_id = p_salon_id;

  -- bookings has no name/phone columns of its own (only public.queue, an
  -- unused table, does) — notes is the one existing, appropriate column
  -- left to record who a walk-in was for.
  v_notes := 'Walk-in: ' || v_first || ' ' || v_last || ' | ' || v_phone;

  INSERT INTO public.bookings (
    salon_id, customer_id, service_id, stylist_id, status, position,
    created_at, booking_date, booking_time, queue_position, notes, source
  ) VALUES (
    p_salon_id, v_resolved_customer_id, p_service_id, p_barber_id, 'waiting', v_next_position,
    now(), current_date, to_char(now(), 'HH24:MI:SS'), v_next_position, v_notes, 'owner_walk_in'
  )
  RETURNING id INTO v_booking_id;

  booking_id := v_booking_id;
  customer_match := v_customer_match;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_owner_walk_in_booking(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_owner_walk_in_booking(uuid, uuid, uuid, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_owner_walk_in_booking(uuid, uuid, uuid, text, text, text, text, text) TO authenticated;
