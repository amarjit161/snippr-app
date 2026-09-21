-- Active login session registry ("WhatsApp-style" device list).
--
-- This does NOT replace Supabase Auth's own session/refresh-token store — it
-- cannot; that lives in the auth schema and isn't writable from the client.
-- It's a thin, user-owned bookkeeping table keyed by the `session_id` claim
-- Supabase already puts on every access-token JWT, so the app can show
-- "which devices are logged in" and let a user end sessions via Supabase's
-- own supported sign-out scopes ('others' / 'global'). No passwords, no
-- access/refresh tokens, no session secrets are ever stored here.

CREATE TABLE IF NOT EXISTS public.snippr_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  device_name text,
  browser text,
  platform text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_snippr_user_sessions_user_id
  ON public.snippr_user_sessions (user_id, last_seen_at DESC);

ALTER TABLE public.snippr_user_sessions ENABLE ROW LEVEL SECURITY;

-- Belt-and-braces: never trust user_id/session_id/created_at supplied by the
-- client. This trigger forces user_id to the caller's own auth.uid(), AND
-- forces session_id to the `session_id` claim on the JWT actually presented
-- for THIS request (auth.jwt() ->> 'session_id') — on both INSERT and
-- UPDATE, regardless of what the request body contains. A client can
-- therefore only ever create/touch a row for the exact session it is
-- currently authenticated as: never an arbitrary session_id (closes a gap
-- where INSERT alone did not previously constrain session_id), and never a
-- DIFFERENT one of its own other sessions' rows (an UPDATE attempted from
-- session A against session B's row is rejected outright, not merely
-- normalized) — even before RLS is considered.
CREATE OR REPLACE FUNCTION public.snippr_user_sessions_set_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    jwt_session_id := (auth.jwt() ->> 'session_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    jwt_session_id := NULL;
  END;

  IF jwt_session_id IS NULL THEN
    RAISE EXCEPTION 'No session_id claim on the current request';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.session_id IS DISTINCT FROM jwt_session_id THEN
    RAISE EXCEPTION 'Cannot modify a session row for a different session';
  END IF;

  NEW.user_id := auth.uid();
  NEW.session_id := jwt_session_id;
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snippr_user_sessions_set_owner ON public.snippr_user_sessions;
CREATE TRIGGER trg_snippr_user_sessions_set_owner
  BEFORE INSERT OR UPDATE ON public.snippr_user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.snippr_user_sessions_set_owner();

-- RLS: a user may only ever see/write/delete their OWN session rows.
DROP POLICY IF EXISTS "snippr_user_sessions_select_own" ON public.snippr_user_sessions;
CREATE POLICY "snippr_user_sessions_select_own" ON public.snippr_user_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "snippr_user_sessions_insert_own" ON public.snippr_user_sessions;
CREATE POLICY "snippr_user_sessions_insert_own" ON public.snippr_user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "snippr_user_sessions_update_own" ON public.snippr_user_sessions;
CREATE POLICY "snippr_user_sessions_update_own" ON public.snippr_user_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "snippr_user_sessions_delete_own" ON public.snippr_user_sessions;
CREATE POLICY "snippr_user_sessions_delete_own" ON public.snippr_user_sessions
  FOR DELETE USING (auth.uid() = user_id);
