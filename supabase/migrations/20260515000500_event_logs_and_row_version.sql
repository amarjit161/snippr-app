-- Add event log table and row_version for optimistic concurrency
CREATE TABLE IF NOT EXISTS public.queue_event_logs (
  seq_id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  row_id uuid NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_event_logs_row_id ON public.queue_event_logs USING btree(row_id);

-- Add a row_version column for optimistic concurrency on canonical queue
ALTER TABLE IF EXISTS public.queue_bookings
  ADD COLUMN IF NOT EXISTS row_version integer DEFAULT 0 NOT NULL;

-- Trigger function to log events into queue_event_logs and bump row_version on update
CREATE OR REPLACE FUNCTION public.log_queue_event_and_bump() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.queue_event_logs(event_type, row_id, payload) VALUES ('INSERT', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- bump version
    NEW.row_version := COALESCE(OLD.row_version, 0) + 1;
    INSERT INTO public.queue_event_logs(event_type, row_id, payload) VALUES ('UPDATE', NEW.id, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.queue_event_logs(event_type, row_id, payload) VALUES ('DELETE', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

-- Attach the trigger to queue_bookings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'queue_bookings' AND n.nspname = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_queue_event_and_bump') THEN
      CREATE TRIGGER trg_log_queue_event_and_bump
      AFTER INSERT OR UPDATE OR DELETE ON public.queue_bookings
      FOR EACH ROW EXECUTE FUNCTION public.log_queue_event_and_bump();
    END IF;
  END IF;
END$$;
