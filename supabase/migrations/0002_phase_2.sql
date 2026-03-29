-- 1. Modify Profiles Table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES salons(id) ON DELETE SET NULL;

-- 2. Create RPC for Transactional Salon Registration
CREATE OR REPLACE FUNCTION register_salon(
    p_salon_name TEXT,
    p_owner_name TEXT,
    p_barber_name TEXT,
    p_email TEXT,
    p_price_list NUMERIC,
    p_duration INT
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_salon_id UUID;
    v_barber_id UUID;
    v_service_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Create salon
    INSERT INTO salons (name, location, status)
    VALUES (p_salon_name, 'New Location', 'open')
    RETURNING id INTO v_salon_id;

    -- Update salon with owner_id now that we have one
    UPDATE salons SET owner_id = v_user_id WHERE id = v_salon_id;

    -- Create barber
    INSERT INTO barbers (salon_id, name)
    VALUES (v_salon_id, p_barber_name)
    RETURNING id INTO v_barber_id;

    -- Create default service
    INSERT INTO services (salon_id, name, price, duration)
    VALUES (v_salon_id, 'Standard Haircut', p_price_list, p_duration)
    RETURNING id INTO v_service_id;

    -- Update profile to make them an owner
    UPDATE profiles SET role = 'salon_owner', salon_id = v_salon_id, name = p_owner_name
    WHERE user_id = v_user_id;

    RETURN v_salon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Basic RLS (Row Level Security) ensuring isolation
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Customers can read all queues to see wait times, but Owners can only see theirs, wait, if customers can read all, then owners can read all too for simplicity, but owners can only UPDATE their own.
CREATE POLICY "Anyone can view queues" ON queue FOR SELECT USING (true);

CREATE POLICY "Customers can join queue" ON queue FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their salon queue" ON queue FOR UPDATE USING (
    salon_id IN (SELECT salon_id FROM profiles WHERE user_id = auth.uid() AND role = 'salon_owner')
);

CREATE POLICY "Users can delete their own queue" ON queue FOR DELETE USING (auth.uid() = user_id);
-- Also let owners delete their salon queues
CREATE POLICY "Owners can delete their salon queue" ON queue FOR DELETE USING (
    salon_id IN (SELECT salon_id FROM profiles WHERE user_id = auth.uid() AND role = 'salon_owner')
);
