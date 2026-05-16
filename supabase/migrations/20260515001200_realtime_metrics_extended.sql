-- Extend realtime metrics for latency/backpressure/degradation visibility

ALTER TABLE IF EXISTS public.realtime_metrics_aggregates
  ADD COLUMN IF NOT EXISTS avg_latency_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS p95_latency_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queue_backlog integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shed_events integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS circuit_open_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'normal';
