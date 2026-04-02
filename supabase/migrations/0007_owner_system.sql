-- Owner system without Supabase auth
CREATE TABLE IF NOT EXISTS public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS owner_record_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS open_time TIME;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS close_time TIME;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS auto_close BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS specialization TEXT;

-- Make owner system work without Supabase Auth by allowing anon usage.
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'owners' AND policyname = 'Public can read owners'
  ) THEN
    CREATE POLICY "Public can read owners" ON public.owners FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'owners' AND policyname = 'Public can insert owners'
  ) THEN
    CREATE POLICY "Public can insert owners" ON public.owners FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'salons' AND policyname = 'Public can insert salons owner flow'
  ) THEN
    CREATE POLICY "Public can insert salons owner flow" ON public.salons FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'salons' AND policyname = 'Public can update salons owner flow'
  ) THEN
    CREATE POLICY "Public can update salons owner flow" ON public.salons FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Public can insert services owner flow'
  ) THEN
    CREATE POLICY "Public can insert services owner flow" ON public.services FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Public can update services owner flow'
  ) THEN
    CREATE POLICY "Public can update services owner flow" ON public.services FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'barbers' AND policyname = 'Public can insert barbers owner flow'
  ) THEN
    CREATE POLICY "Public can insert barbers owner flow" ON public.barbers FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'barbers' AND policyname = 'Public can update barbers owner flow'
  ) THEN
    CREATE POLICY "Public can update barbers owner flow" ON public.barbers FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
