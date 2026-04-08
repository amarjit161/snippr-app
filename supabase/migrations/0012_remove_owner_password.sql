-- SQL Migration: Remove 'password' from 'owners' and update RLS
-- This migration ensures that the 'owners' table is purely a profile table linked to 'auth.users'.

DO $$ 
BEGIN
  -- 1. Remove 'password' column from 'owners' if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'password') THEN
    ALTER TABLE public.owners DROP COLUMN password;
  END IF;

  -- 2. Update RLS policies for 'owners'
  -- Drop existing policies first
  DROP POLICY IF EXISTS "Public can read owners" ON public.owners;
  DROP POLICY IF EXISTS "Public can insert owners" ON public.owners;
  DROP POLICY IF EXISTS "Enable update for owners based on id" ON public.owners;

  -- Create new RLS policies
  -- Allow anyone to read profiles (or restrict as needed)
  CREATE POLICY "Public can read owners" ON public.owners FOR SELECT USING (true);

  -- Allow authenticated users to insert their own profile
  CREATE POLICY "Authenticated users can insert their own profile" ON public.owners FOR INSERT WITH CHECK (auth.uid() = id);

  -- Allow users to update only their own profile
  CREATE POLICY "Users can update their own profile" ON public.owners FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

END $$;

-- Reload Schema cache
NOTIFY pgrst, 'reload schema';
