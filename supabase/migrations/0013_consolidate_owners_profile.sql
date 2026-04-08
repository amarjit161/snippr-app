-- Migration: Consolidate owners profile and remove profiles table

DO $$ 
BEGIN
  -- 1. Ensure owners table is correctly structured
  -- Check if owners table exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'owners' AND table_schema = 'public') THEN
    CREATE TABLE public.owners (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      is_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- Ensure columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'is_verified') THEN
      ALTER TABLE public.owners ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'is_active') THEN
      ALTER TABLE public.owners ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Ensure id is UUID and references auth.users
    -- (This might be tricky if data exists, but we'll try to keep it safe)
  END IF;

  -- 2. Drop profiles table
  DROP TABLE IF EXISTS public.profiles CASCADE;

  -- 3. Update RLS policies for owners
  ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
  
  DROP POLICY IF EXISTS "Public can read owners" ON public.owners;
  DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON public.owners;
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.owners;

  CREATE POLICY "Public can read owners" ON public.owners FOR SELECT USING (true);
  CREATE POLICY "Authenticated users can insert their own profile" ON public.owners FOR INSERT WITH CHECK (auth.uid() = id);
  CREATE POLICY "Users can update their own profile" ON public.owners FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

END $$;

NOTIFY pgrst, 'reload schema';
