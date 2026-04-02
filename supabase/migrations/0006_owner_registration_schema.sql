-- Add fields needed by the salon owner registration flow
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS open_time TIME;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS close_time TIME;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS is_manual_closed BOOLEAN NOT NULL DEFAULT false;

-- Backfill address from existing location where possible
UPDATE public.salons
SET address = location
WHERE address IS NULL;

-- Ensure barbers supports experience field used by registration UI
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS experience INTEGER NOT NULL DEFAULT 0;

-- RLS policies for owner-managed inserts/updates
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'salons' AND policyname = 'Owners can insert salons'
  ) THEN
    CREATE POLICY "Owners can insert salons"
      ON public.salons
      FOR INSERT
      WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'salons' AND policyname = 'Owners can update own salons'
  ) THEN
    CREATE POLICY "Owners can update own salons"
      ON public.salons
      FOR UPDATE
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Owners can insert services'
  ) THEN
    CREATE POLICY "Owners can insert services"
      ON public.services
      FOR INSERT
      WITH CHECK (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Owners can update services'
  ) THEN
    CREATE POLICY "Owners can update services"
      ON public.services
      FOR UPDATE
      USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
      )
      WITH CHECK (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'barbers' AND policyname = 'Owners can insert barbers'
  ) THEN
    CREATE POLICY "Owners can insert barbers"
      ON public.barbers
      FOR INSERT
      WITH CHECK (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'barbers' AND policyname = 'Owners can update barbers'
  ) THEN
    CREATE POLICY "Owners can update barbers"
      ON public.barbers
      FOR UPDATE
      USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
      )
      WITH CHECK (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
      );
  END IF;
END $$;
