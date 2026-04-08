-- Standardize owners schema to merge name and owner_name and add is_active
DO $$ 
BEGIN
  -- 1. Ensure owner_name exists (it should from 0007/0009)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'owner_name') THEN
    ALTER TABLE public.owners ADD COLUMN owner_name TEXT;
  END IF;

  -- 2. Migrate data from 'name' to 'owner_name' if 'name' exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'name') THEN
    UPDATE public.owners SET owner_name = COALESCE(owner_name, name);
    ALTER TABLE public.owners DROP COLUMN name;
  END IF;

  -- 3. Ensure is_verified exists (it should from 0009)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'is_verified') THEN
    ALTER TABLE public.owners ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- 4. Add is_active column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'is_active') THEN
    ALTER TABLE public.owners ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- 5. Standardize column types and constraints
  ALTER TABLE public.owners ALTER COLUMN email SET NOT NULL;
  ALTER TABLE public.owners ALTER COLUMN owner_name SET NOT NULL;
  ALTER TABLE public.owners ALTER COLUMN password SET NOT NULL;

END $$;

-- Reload Schema cache
NOTIFY pgrst, 'reload schema';
