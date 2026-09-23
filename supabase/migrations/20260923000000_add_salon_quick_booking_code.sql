-- Permanent, unique, public QR identity for salons ("Step 1" of the QR
-- booking feature). This column is the only thing the eventual /q/:code
-- route and QR image need — no QR image or routing is created here.
--
-- salons.quick_booking_code is:
--   * unique            -> enforced by a unique index
--   * stable            -> a trigger blocks any change once it is set
--   * publicly safe     -> a random opaque string, unrelated to any
--                          customer/owner data, and salons are already
--                          publicly readable ("Salons are viewable by
--                          everyone")
--   * URL-safe           -> fixed-length, alphanumeric only (enforced by a
--                          CHECK constraint)
--   * unpredictable      -> generated from pgcrypto's gen_random_bytes(),
--                          a CSPRNG, never PostgreSQL's random() and never
--                          client-side Math.random()
--   * never sequential   -> not derived from id/created_at/row count
--
-- The alphabet below deliberately drops visually-ambiguous characters
-- (0/O, 1/I/l) so printed/scanned codes are less error-prone.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS quick_booking_code text;

-- Generates one candidate code and retries until it finds a value that does
-- not already exist on public.salons. Only ever reads/writes this column;
-- it never touches auth.users or any other sensitive table.
CREATE OR REPLACE FUNCTION public.generate_quick_booking_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  alphabet_len int := length(alphabet);
  code_len int := 8;
  candidate text;
  raw_bytes bytea;
  i int;
  attempt int := 0;
  max_attempts int := 50;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > max_attempts THEN
      RAISE EXCEPTION 'generate_quick_booking_code: could not find a unique code after % attempts', max_attempts;
    END IF;

    raw_bytes := gen_random_bytes(code_len);
    candidate := '';
    FOR i IN 0..code_len - 1 LOOP
      candidate := candidate || substr(alphabet, (get_byte(raw_bytes, i) % alphabet_len) + 1, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.salons WHERE quick_booking_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

-- Assigns a code to new rows that don't already carry one, and makes an
-- already-assigned code immutable: once set, no UPDATE (whatever columns it
-- touches, and regardless of the wide-open "Public can update salons owner
-- flow" policy) can change or clear it.
CREATE OR REPLACE FUNCTION public.set_salon_quick_booking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.quick_booking_code IS NOT NULL THEN
    NEW.quick_booking_code := OLD.quick_booking_code;
  ELSIF NEW.quick_booking_code IS NULL THEN
    NEW.quick_booking_code := public.generate_quick_booking_code();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salons_set_quick_booking_code ON public.salons;
CREATE TRIGGER trg_salons_set_quick_booking_code
  BEFORE INSERT OR UPDATE ON public.salons
  FOR EACH ROW EXECUTE FUNCTION public.set_salon_quick_booking_code();

-- Backfill existing salons one row at a time (not a single set-based
-- UPDATE) so each generated code is checked against every code assigned
-- earlier in this same loop, not just what was on disk when the migration
-- started.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.salons WHERE quick_booking_code IS NULL LOOP
    UPDATE public.salons
      SET quick_booking_code = public.generate_quick_booking_code()
      WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.salons
  ALTER COLUMN quick_booking_code SET NOT NULL;

ALTER TABLE public.salons
  DROP CONSTRAINT IF EXISTS salons_quick_booking_code_format;
ALTER TABLE public.salons
  ADD CONSTRAINT salons_quick_booking_code_format
  CHECK (quick_booking_code ~ '^[A-Za-z0-9]{8}$');

CREATE UNIQUE INDEX IF NOT EXISTS salons_quick_booking_code_key
  ON public.salons (quick_booking_code);
