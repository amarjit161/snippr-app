-- Alert intelligence, escalation workflows, maintenance mode, and diagnostics

CREATE TABLE IF NOT EXISTS public.operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  dedupe_key text,
  group_key text,
  details jsonb,
  status text NOT NULL DEFAULT 'open',
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  cooldown_until timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_alerts_salon_last_seen ON public.operational_alerts USING btree(salon_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_open ON public.operational_alerts USING btree(status, severity, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.operational_runbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_key text NOT NULL UNIQUE,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  checklist jsonb NOT NULL,
  automation_hints jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  alert_id uuid,
  channel text NOT NULL DEFAULT 'in_app',
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  delivered_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operator_escalation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  workflow_key text NOT NULL,
  severity text NOT NULL,
  target_role text NOT NULL,
  escalation_after_minutes integer NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id, workflow_key, target_role)
);

CREATE TABLE IF NOT EXISTS public.operator_escalation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  alert_id uuid,
  workflow_id uuid,
  escalated_to text,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  enabled boolean NOT NULL DEFAULT false,
  reason text,
  fallback_mode text NOT NULL DEFAULT 'read_only',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(salon_id)
);

CREATE TABLE IF NOT EXISTS public.replay_failure_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  replay_token text,
  source_event_seq bigint,
  error text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.queue_integrity_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid,
  queue_id uuid,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  details jsonb,
  detected_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.raise_operational_alert(
  p_salon_id uuid,
  p_alert_type text,
  p_severity text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL,
  p_group_key text DEFAULT NULL,
  p_cooldown_seconds integer DEFAULT 60
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  existing_rec record;
  new_id uuid;
BEGIN
  SELECT * INTO existing_rec
  FROM public.operational_alerts
  WHERE salon_id IS NOT DISTINCT FROM p_salon_id
    AND COALESCE(dedupe_key, '') = COALESCE(p_dedupe_key, '')
    AND alert_type = p_alert_type
    AND status = 'open'
  ORDER BY last_seen_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF existing_rec.cooldown_until IS NOT NULL AND existing_rec.cooldown_until > now() THEN
      UPDATE public.operational_alerts
      SET occurrence_count = occurrence_count + 1,
          last_seen_at = now(),
          details = COALESCE(p_details, details)
      WHERE id = existing_rec.id;
      RETURN existing_rec.id;
    END IF;

    UPDATE public.operational_alerts
    SET occurrence_count = occurrence_count + 1,
        last_seen_at = now(),
        severity = p_severity,
        details = COALESCE(p_details, details),
        cooldown_until = now() + make_interval(secs => p_cooldown_seconds)
    WHERE id = existing_rec.id;

    RETURN existing_rec.id;
  END IF;

  INSERT INTO public.operational_alerts(
    salon_id, alert_type, severity, dedupe_key, group_key, details, status, first_seen_at, last_seen_at, cooldown_until
  ) VALUES (
    p_salon_id,
    p_alert_type,
    p_severity,
    p_dedupe_key,
    p_group_key,
    COALESCE(p_details, '{}'::jsonb),
    'open',
    now(),
    now(),
    now() + make_interval(secs => p_cooldown_seconds)
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_queue_corruption(p_salon_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  issue_count integer := 0;
BEGIN
  -- Duplicate active position in same salon
  INSERT INTO public.queue_integrity_issues(salon_id, queue_id, issue_type, severity, details)
  SELECT q.salon_id, q.id, 'DUPLICATE_POSITION', 'critical', jsonb_build_object('position', q.position)
  FROM public.queue_bookings q
  JOIN (
    SELECT salon_id, position
    FROM public.queue_bookings
    WHERE status NOT IN ('completed','cancelled','expired','no_show')
      AND position IS NOT NULL
    GROUP BY salon_id, position
    HAVING COUNT(*) > 1
  ) dup ON dup.salon_id = q.salon_id AND dup.position = q.position
  WHERE q.salon_id = p_salon_id;

  GET DIAGNOSTICS issue_count = ROW_COUNT;

  -- Invalid row version guard
  INSERT INTO public.queue_integrity_issues(salon_id, queue_id, issue_type, severity, details)
  SELECT salon_id, id, 'INVALID_ROW_VERSION', 'warning', jsonb_build_object('row_version', row_version)
  FROM public.queue_bookings
  WHERE salon_id = p_salon_id AND (row_version IS NULL OR row_version < 0);

  RETURN issue_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_salon_reliability_score(p_salon_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS numeric
LANGUAGE sql
AS $$
  WITH a AS (
    SELECT
      COALESCE(SUM(CASE WHEN severity = 'critical' AND status = 'open' THEN 1 ELSE 0 END), 0) AS critical_open,
      COALESCE(SUM(CASE WHEN severity = 'warning' AND status = 'open' THEN 1 ELSE 0 END), 0) AS warning_open
    FROM public.operational_alerts
    WHERE salon_id = p_salon_id
      AND last_seen_at >= p_from
      AND last_seen_at <= p_to
  ),
  m AS (
    SELECT
      COALESCE(AVG(CASE WHEN events_total > 0 THEN (events_total - delayed_events - shed_events)::numeric / events_total ELSE 1 END), 1) AS event_quality,
      COALESCE(AVG(CASE WHEN p95_latency_ms <= 0 THEN 1 ELSE GREATEST(0, 1 - (p95_latency_ms::numeric / 30000)) END), 1) AS latency_quality
    FROM public.realtime_metrics_aggregates
    WHERE salon_id = p_salon_id
      AND metric_window_start >= p_from
      AND metric_window_end <= p_to
  )
  SELECT ROUND((
    (m.event_quality * 0.45 + m.latency_quality * 0.35 + (1 / (1 + a.warning_open + a.critical_open * 2)) * 0.20)
  * 100)::numeric, 2)
  FROM a, m;
$$;

-- Seed minimal runbooks for fast operator guidance
INSERT INTO public.operational_runbooks(runbook_key, title, severity, checklist, automation_hints)
VALUES
  (
    'RECONNECT_STORM',
    'Reconnect Storm Mitigation',
    'critical',
    '["Verify network path","Enable degraded mode","Lower batch size","Check circuit breaker alerts"]'::jsonb,
    '{"suggestions":["Temporarily switch to read-only queue updates","Increase reconnect cooldown"]}'::jsonb
  ),
  (
    'QUEUE_CORRUPTION',
    'Queue Integrity Recovery',
    'critical',
    '["Run integrity checker","Freeze write operations","Create snapshot","Replay restore on staging first"]'::jsonb,
    '{"suggestions":["Invoke queue-integrity-checker edge function","Escalate to L2 operator"]}'::jsonb
  ),
  (
    'SLA_BREACH',
    'SLA Breach Handling',
    'warning',
    '["Inspect latency and backlog","Check delayed event processor","Notify salon operator"]'::jsonb,
    '{"suggestions":["Increase throttling for non-critical updates","Open temporary congestion banner"]}'::jsonb
  )
ON CONFLICT (runbook_key) DO NOTHING;
