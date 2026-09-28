-- Customer booking reschedule.
--
-- The customer "Reschedule" flow on /bookings used a direct client-side
--   UPDATE bookings SET booking_date, booking_time WHERE id = … AND customer_id = auth.uid()
-- but the live bookings_update_access policy's WITH CHECK only accepts a
-- customer's own UPDATE when the new row has status = 'cancelled' (the same
-- restriction that made the removed client-side OTP backfill fail with 42501
-- — see the note in src/pages/Dashboard.tsx fetchBookings). So:
--   * rescheduling an active booking was always rejected by RLS, and
--   * rescheduling from the post-cancel popup "succeeded" only because the
--     row was already cancelled — leaving a cancelled booking with a new
--     date while the UI reported a successful reschedule.
--
-- Rather than loosening that policy (which would let a customer rewrite any
-- column of their own booking — status, stylist, otp, position …), this adds
-- one SECURITY DEFINER RPC that performs exactly one operation: move the
-- caller's own, still-reschedulable booking to a new date/time, after
-- validating it server-side. No table, column, index or policy is changed.
--
-- Rules enforced here mirror the existing client rules rather than inventing
-- new ones:
--   * ownership: bookings.customer_id = auth.uid() (row locked FOR UPDATE)
--   * status: only 'pending' / 'waiting' — Dashboard's RESCHEDULE_LOCKED set
--     (accepted, confirmed, in_progress, done, completed) and the terminal
--     cancelled / rejected states are refused
--   * date window: IST today .. IST today + 30 days (BookingDraftContext
--     getMinDate/getMaxDate)
--   * salon_holidays date => closed (useSlotAvailability)
--   * time must be one of the salon's 30-minute slots between open_time and
--     close_time, falling back to 09:00-20:00 (useSlotAvailability), and not
--     already in the past when the date is IST today
--   * conflicts: same salon + same stylist + same date, any active status,
--     overlapping [start, start + service duration), excluding this booking
--     itself; with no stylist, per-slot capacity = number of salon barbers
--     (useSlotAvailability's no-barber mode)
--
-- Errors are raised with stable message keys so the client can map them to
-- clear, actionable messages (src/lib/reschedule.ts).

CREATE OR REPLACE FUNCTION public.reschedule_customer_booking(
  p_booking_id uuid,
  p_new_date date,
  p_new_time text
)
RETURNS TABLE (rescheduled_id uuid, new_booking_date text, new_booking_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_status text;
  v_now_ist timestamp := now() AT TIME ZONE 'Asia/Kolkata';
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_new_time time;
  v_new_time_text text;
  v_new_date_text text;
  v_open time;
  v_close time;
  v_open_min int;
  v_close_min int;
  v_new_min int;
  v_grid_min int;
  v_duration int;
  v_capacity int;
  v_taken int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_booking_id IS NULL OR p_new_date IS NULL OR p_new_time IS NULL THEN
    RAISE EXCEPTION 'missing_parameters' USING ERRCODE = '22004';
  END IF;

  BEGIN
    v_new_time := btrim(p_new_time)::time;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_time' USING ERRCODE = '22023';
  END;

  IF extract(second FROM v_new_time) <> 0 THEN
    RAISE EXCEPTION 'invalid_time' USING ERRCODE = '22023';
  END IF;

  v_new_time_text := v_new_time::text;            -- HH:MM:SS
  v_new_date_text := to_char(p_new_date, 'YYYY-MM-DD');
  v_new_min := extract(hour FROM v_new_time)::int * 60 + extract(minute FROM v_new_time)::int;

  -- Ownership + existence in one predicate: another customer's booking is
  -- indistinguishable from a missing one, so ids can't be probed.
  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.customer_id = v_caller
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_status := lower(btrim(coalesce(v_booking.status, '')));
  IF v_status NOT IN ('pending', 'waiting') THEN
    RAISE EXCEPTION 'booking_not_reschedulable' USING ERRCODE = 'P0001';
  END IF;

  IF p_new_date < v_today OR p_new_date > v_today + 30 THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.salon_holidays h
    WHERE h.salon_id = v_booking.salon_id
      AND h.date::text = v_new_date_text
  ) THEN
    RAISE EXCEPTION 'salon_closed' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT
      coalesce(nullif(btrim(s.open_time::text), ''), '09:00')::time,
      coalesce(nullif(btrim(s.close_time::text), ''), '20:00')::time
    INTO v_open, v_close
    FROM public.salons s
    WHERE s.id = v_booking.salon_id;
  EXCEPTION WHEN others THEN
    v_open := NULL;
    v_close := NULL;
  END;
  v_open := coalesce(v_open, '09:00'::time);
  v_close := coalesce(v_close, '20:00'::time);

  v_open_min := extract(hour FROM v_open)::int * 60 + extract(minute FROM v_open)::int;
  v_close_min := extract(hour FROM v_close)::int * 60 + extract(minute FROM v_close)::int;
  IF v_close_min <= v_open_min THEN
    v_close_min := v_close_min + 1440;            -- overnight hours
  END IF;
  v_grid_min := v_new_min;
  IF v_grid_min < v_open_min THEN
    v_grid_min := v_grid_min + 1440;
  END IF;
  IF v_grid_min >= v_close_min OR (v_grid_min - v_open_min) % 30 <> 0 THEN
    RAISE EXCEPTION 'invalid_time' USING ERRCODE = '22023';
  END IF;

  IF p_new_date = v_today AND v_new_time <= date_trunc('minute', v_now_ist)::time THEN
    RAISE EXCEPTION 'time_in_past' USING ERRCODE = '22023';
  END IF;

  IF v_booking.booking_date::text = v_new_date_text
     AND left(coalesce(v_booking.booking_time::text, ''), 5) = left(v_new_time_text, 5) THEN
    RAISE EXCEPTION 'same_slot' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent reschedules into the same stylist/day so two
  -- customers can't both pass the conflict check below.
  PERFORM pg_advisory_xact_lock(hashtext(
    'booking-slot:' || v_booking.salon_id::text || ':' ||
    coalesce(v_booking.stylist_id::text, 'any') || ':' || v_new_date_text
  ));

  SELECT coalesce(nullif(sv.duration, 0), 30)::int INTO v_duration
  FROM public.services sv
  WHERE sv.id = v_booking.service_id;
  v_duration := greatest(coalesce(v_duration, 30), 1);

  IF v_booking.stylist_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT
          -- CASE (not just the WHERE regex) guards the casts: the planner may
          -- evaluate the outer overlap predicate before the regex filter.
          CASE WHEN o.booking_time::text ~ '^[0-9]{1,2}:[0-9]{2}' THEN
            split_part(o.booking_time::text, ':', 1)::int * 60
              + substring(split_part(o.booking_time::text, ':', 2) FROM 1 FOR 2)::int
          END AS start_min,
          greatest(coalesce(nullif(osv.duration, 0), 30)::int, 1) AS dur
        FROM public.bookings o
        LEFT JOIN public.services osv ON osv.id = o.service_id
        WHERE o.id <> v_booking.id
          AND o.salon_id = v_booking.salon_id
          AND o.stylist_id = v_booking.stylist_id
          AND o.booking_date::text = v_new_date_text
          AND lower(btrim(coalesce(o.status, ''))) IN ('pending', 'waiting', 'confirmed', 'accepted', 'in_progress')
      ) other
      WHERE other.start_min < v_new_min + v_duration
        AND v_new_min < other.start_min + other.dur
    ) THEN
      RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23505';
    END IF;
  ELSE
    SELECT greatest(count(*)::int, 1) INTO v_capacity
    FROM public.barbers br
    WHERE br.salon_id = v_booking.salon_id;

    SELECT count(*)::int INTO v_taken
    FROM public.bookings o
    WHERE o.id <> v_booking.id
      AND o.salon_id = v_booking.salon_id
      AND o.booking_date::text = v_new_date_text
      AND left(coalesce(o.booking_time::text, ''), 5) = left(v_new_time_text, 5)
      AND lower(btrim(coalesce(o.status, ''))) IN ('pending', 'waiting', 'confirmed', 'accepted', 'in_progress');

    IF v_taken >= v_capacity THEN
      RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- The ::time / date values are assignment-cast to the column type, so this
  -- stores 'YYYY-MM-DD' / 'HH:MM:SS' whether the columns are text or date/time.
  UPDATE public.bookings b
  SET booking_date = p_new_date,
      booking_time = v_new_time,
      updated_at = now()
  WHERE b.id = v_booking.id
    AND b.customer_id = v_caller;

  rescheduled_id := v_booking.id;
  new_booking_date := v_new_date_text;
  new_booking_time := v_new_time_text;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_customer_booking(uuid, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_customer_booking(uuid, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reschedule_customer_booking(uuid, date, text) TO authenticated;
