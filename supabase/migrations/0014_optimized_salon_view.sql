-- Migration: Optimized Salon View 0014
-- Goal: Eliminate N+1 fetching in the frontend by pre-calculating stats

CREATE OR REPLACE VIEW salon_with_stats AS
SELECT 
    s.*,
    COALESCE(q.queue_count, 0) as queue_count,
    COALESCE(q.estimated_wait_time, 0) as wait_time
FROM salons s
LEFT JOIN (
    SELECT 
        q.salon_id, 
        count(*) as queue_count,
        sum(COALESCE(ser.duration, 20)) as estimated_wait_time
    FROM queue q
    LEFT JOIN services ser ON q.service_id = ser.id
    WHERE q.status = 'waiting'
    GROUP BY q.salon_id
) q ON s.id = q.salon_id;

-- Ensure read access is public or based on salons access
GRANT SELECT ON salon_with_stats TO anon, authenticated;
