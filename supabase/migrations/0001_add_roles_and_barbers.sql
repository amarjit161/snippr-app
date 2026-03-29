-- 1. Add owner_id to salons
ALTER TABLE salons ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 2. Create barbers table
CREATE TABLE IF NOT EXISTS barbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add barber_id to queue
ALTER TABLE queue ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL;

-- 4. Support multiple services
-- Create a bridge table for multiple services per queue entry
CREATE TABLE IF NOT EXISTS queue_services (
    queue_id UUID NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (queue_id, service_id)
);

-- Migrate existing queue.service_id -> queue_services before we eventually drop it (optional)
INSERT INTO queue_services (queue_id, service_id)
SELECT id, service_id FROM queue WHERE service_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Create join_queue function that handles multiple services safely
CREATE OR REPLACE FUNCTION join_queue(
    p_salon_id UUID,
    p_user_id UUID,
    p_service_ids UUID[],
    p_barber_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
    v_position INT;
    v_service_id UUID;
BEGIN
    -- Calculate next position in queue
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
    FROM queue
    WHERE salon_id = p_salon_id AND status IN ('waiting', 'in_progress');

    -- Insert into queue (storing the first service as primary for backward compatibility easily if needed, or null)
    -- We can just store p_service_ids[1] into the legacy service_id column so old code doesn't immediately crash.
    INSERT INTO queue (salon_id, user_id, service_id, barber_id, position, status)
    VALUES (p_salon_id, p_user_id, p_service_ids[1], p_barber_id, v_position, 'waiting')
    RETURNING id INTO v_queue_id;

    -- Insert all services into the bridge table
    FOREACH v_service_id IN ARRAY p_service_ids
    LOOP
        INSERT INTO queue_services (queue_id, service_id)
        VALUES (v_queue_id, v_service_id);
    END LOOP;

    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;
