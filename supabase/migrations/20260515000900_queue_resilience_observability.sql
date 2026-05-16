-- Operational resilience and observability foundation (additive only)

CREATE TABLE IF NOT EXISTS public.queue_recovery_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  snapshot_version bigint NOT NULL,
  queue_state jsonb NOT NULL,
  source_event_seq bigint,
  created_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, snapshot_version)
);

CREATE TABLE IF NOT EXISTS public.queue_replay_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  event_seq bigint,
  event_type text NOT NULL,
  payload jsonb,
  replay_token text,
  replayed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.queue_sla_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  metric_date date NOT NULL,
  avg_wait_seconds integer DEFAULT 0,
  p95_wait_seconds integer DEFAULT 0,
  completion_rate numeric(6,3) DEFAULT 0,
  no_show_rate numeric(6,3) DEFAULT 0,
  recovery_success_rate numeric(6,3) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.realtime_metrics_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  metric_window_start timestamptz NOT NULL,
  metric_window_end timestamptz NOT NULL,
  events_total integer DEFAULT 0,
  delayed_events integer DEFAULT 0,
  deduped_events integer DEFAULT 0,
  reconnect_count integer DEFAULT 0,
  conflict_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.queue_conflict_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  queue_id uuid,
  expected_row_version integer,
  actual_row_version integer,
  action text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delayed_queue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  queue_id uuid,
  event_type text NOT NULL,
  payload jsonb,
  available_at timestamptz NOT NULL,
  processed_at timestamptz,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_snapshots_salon_created ON public.queue_recovery_snapshots USING btree(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_replay_salon_created ON public.queue_replay_events USING btree(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delayed_queue_events_ready ON public.delayed_queue_events USING btree(status, available_at);

CREATE OR REPLACE FUNCTION public.queue_health_score(p_salon_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS numeric LANGUAGE sql AS $$
  WITH agg AS (
    SELECT
      COALESCE(AVG(CASE WHEN events_total > 0 THEN (events_total - delayed_events)::numeric / events_total ELSE 1 END), 1) AS event_quality,
      COALESCE(AVG(CASE WHEN events_total > 0 THEN (events_total - conflict_count)::numeric / events_total ELSE 1 END), 1) AS conflict_quality,
      COALESCE(AVG(CASE WHEN reconnect_count >= 0 THEN 1.0 / (1 + reconnect_count) ELSE 1 END), 1) AS reconnect_quality
    FROM public.realtime_metrics_aggregates
    WHERE salon_id = p_salon_id
      AND metric_window_start >= p_from
      AND metric_window_end <= p_to
  )
  SELECT ROUND(((event_quality * 0.4 + conflict_quality * 0.4 + reconnect_quality * 0.2) * 100)::numeric, 2)
  FROM agg;
$$;
