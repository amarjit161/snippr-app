-- Replay-safe restore and event processing helpers

CREATE OR REPLACE FUNCTION public.create_queue_snapshot(p_salon_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  latest_seq bigint;
  snap_version bigint;
  state_data jsonb;
BEGIN
  SELECT COALESCE(MAX(seq_id), 0) INTO latest_seq FROM public.queue_event_logs;
  SELECT COALESCE(MAX(snapshot_version), 0) + 1 INTO snap_version FROM public.queue_recovery_snapshots WHERE salon_id = p_salon_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(qb)), '[]'::jsonb) INTO state_data
  FROM public.queue_bookings qb
  WHERE qb.salon_id = p_salon_id;

  INSERT INTO public.queue_recovery_snapshots (salon_id, snapshot_version, queue_state, source_event_seq)
  VALUES (p_salon_id, snap_version, state_data, latest_seq);

  RETURN jsonb_build_object('snapshot_version', snap_version, 'source_event_seq', latest_seq);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_queue_from_snapshot(p_salon_id uuid, p_snapshot_version bigint, p_replay_token text)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  snapshot_record record;
  applied_count integer := 0;
  event_row jsonb;
BEGIN
  SELECT * INTO snapshot_record
  FROM public.queue_recovery_snapshots
  WHERE salon_id = p_salon_id AND snapshot_version = p_snapshot_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found for salon % version %', p_salon_id, p_snapshot_version;
  END IF;

  FOR event_row IN SELECT * FROM jsonb_array_elements(snapshot_record.queue_state)
  LOOP
    INSERT INTO public.queue_replay_events(salon_id, event_seq, event_type, payload, replay_token, replayed_at)
    VALUES (
      p_salon_id,
      snapshot_record.source_event_seq,
      'SNAPSHOT_RESTORE',
      event_row,
      p_replay_token,
      now()
    );
    applied_count := applied_count + 1;
  END LOOP;

  RETURN applied_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_delayed_queue_events(p_salon_id uuid DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, salon_id uuid, queue_id uuid, event_type text, payload jsonb) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH ready AS (
    SELECT dqe.id, dqe.salon_id, dqe.queue_id, dqe.event_type, dqe.payload
    FROM public.delayed_queue_events dqe
    WHERE dqe.status = 'pending'
      AND dqe.available_at <= now()
      AND (p_salon_id IS NULL OR dqe.salon_id = p_salon_id)
    ORDER BY dqe.available_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), mark AS (
    UPDATE public.delayed_queue_events d
    SET status = 'processed', processed_at = now()
    FROM ready r
    WHERE d.id = r.id
    RETURNING r.id, r.salon_id, r.queue_id, r.event_type, r.payload
  )
  SELECT * FROM mark;
END;
$$;
