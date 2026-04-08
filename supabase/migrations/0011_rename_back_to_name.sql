-- SQL Migration: Rename 'owner_name' to 'name' in 'owners' table
-- This migration ensures that the 'owners' table has a 'name' column instead of 'owner_name'.

DO $$ 
BEGIN
  -- 1. Ensure 'name' exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'name') THEN
    -- If 'owner_name' exists, rename it. Otherwise, create 'name'.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'owner_name') THEN
      ALTER TABLE public.owners RENAME COLUMN owner_name TO name;
    ELSE
      ALTER TABLE public.owners ADD COLUMN name TEXT;
    END IF;
  END IF;

  -- 2. Drop 'owner_name' if it still exists (it shouldn't after rename)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'owner_name') THEN
    ALTER TABLE public.owners DROP COLUMN owner_name;
  END IF;

  -- 3. Ensure 'name' is NOT NULL and correctly typed
  ALTER TABLE public.owners ALTER COLUMN name SET NOT NULL;

END $$;

-- Reload Schema cache
NOTIFY pgrst, 'reload schema';
