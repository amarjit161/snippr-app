-- Multi-Service Booking Engine Migration
-- Phase 1: Database schema updates for multi-service support
-- Date: May 27, 2026

-- ================================================================
-- 1. Create booking_services junction table
-- ================================================================
CREATE TABLE IF NOT EXISTS public.booking_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_id, service_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id ON public.booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service_id ON public.booking_services(service_id);

-- Enable RLS
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_services
CREATE POLICY "Users can read booking services for their bookings"
ON public.booking_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.queue q
    WHERE q.id = booking_services.booking_id
    AND q.user_id = auth.uid()
  )
);

CREATE POLICY "Public can read booking services for availability"
ON public.booking_services
FOR SELECT
USING (true);

CREATE POLICY "System can manage booking services"
ON public.booking_services
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.queue q
    WHERE q.id = booking_services.booking_id
    AND (q.user_id = auth.uid() OR
         EXISTS(
           SELECT 1 FROM public.salons s
           WHERE s.id = q.salon_id
           AND s.owner_id = auth.uid()
         ))
  )
);

-- ================================================================
-- 2. Extend queue table for multi-service support
-- ================================================================

ALTER TABLE public.queue
ADD COLUMN IF NOT EXISTS total_duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_multi_service BOOLEAN DEFAULT FALSE;

-- Create index for multi-service queries
CREATE INDEX IF NOT EXISTS idx_queue_multi_service 
ON public.queue(salon_id, is_multi_service, status);

CREATE INDEX IF NOT EXISTS idx_queue_duration 
ON public.queue(salon_id, barber_id, total_duration);

-- ================================================================
-- 3. Create barber_services mapping table
-- ================================================================
-- This tracks which services each barber can perform
CREATE TABLE IF NOT EXISTS public.barber_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  specialization_level INTEGER DEFAULT 1, -- 1=basic, 2=intermediate, 3=expert
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(barber_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_barber_services_barber_id 
ON public.barber_services(barber_id);

CREATE INDEX IF NOT EXISTS idx_barber_services_service_id 
ON public.barber_services(service_id);

ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read barber services"
ON public.barber_services
FOR SELECT
USING (true);

-- ================================================================
-- 4. Create barber_workload view for smart assignment
-- ================================================================
-- This view calculates current workload for each barber
CREATE OR REPLACE VIEW public.barber_workload_view AS
SELECT 
  b.id as barber_id,
  b.salon_id,
  b.name,
  COUNT(DISTINCT q.id) as active_booking_count,
  COALESCE(SUM(q.total_duration), 0) as total_active_duration,
  COALESCE(AVG(q.total_duration), 0) as avg_booking_duration,
  MAX(q.created_at) as last_booking_time,
  (SELECT COUNT(*) FROM public.barber_services WHERE barber_id = b.id) as service_count,
  CASE 
    WHEN b.is_online THEN 1 
    ELSE 0 
  END as online_score
FROM public.barbers b
LEFT JOIN public.queue q ON b.id = q.barber_id 
  AND q.status IN ('waiting', 'confirmed', 'in_progress')
  AND q.booking_date = CURRENT_DATE
GROUP BY b.id, b.salon_id, b.name, b.is_online;

-- ================================================================
-- 5. Create booking_assignments table for audit trail
-- ================================================================
CREATE TABLE IF NOT EXISTS public.booking_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.queue(id) ON DELETE CASCADE,
  assigned_barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE SET NULL,
  assignment_reason TEXT,
  workload_score DECIMAL(10, 2),
  completion_estimate INTEGER, -- in minutes
  assigned_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_assignments_booking_id 
ON public.booking_assignments(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_assignments_barber_id 
ON public.booking_assignments(assigned_barber_id);

ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon owners can read assignments"
ON public.booking_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.queue q, public.salons s
    WHERE q.id = booking_assignments.booking_id
    AND s.id = q.salon_id
    AND s.owner_id = auth.uid()
  )
);

-- ================================================================
-- 6. Helper functions
-- ================================================================

-- Function to calculate total booking duration from services
CREATE OR REPLACE FUNCTION public.calculate_booking_duration(p_booking_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_duration INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(duration), 0) INTO v_total_duration
  FROM public.booking_services
  WHERE booking_id = p_booking_id;
  
  RETURN v_total_duration;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate total booking price from services
CREATE OR REPLACE FUNCTION public.calculate_booking_price(p_booking_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_total_price DECIMAL(10, 2) := 0;
BEGIN
  SELECT COALESCE(SUM(price), 0) INTO v_total_price
  FROM public.booking_services
  WHERE booking_id = p_booking_id;
  
  RETURN v_total_price;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get estimated wait time
CREATE OR REPLACE FUNCTION public.calculate_estimated_wait(
  p_salon_id UUID,
  p_barber_id UUID,
  p_booking_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_total_duration INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(q.total_duration), 0) INTO v_total_duration
  FROM public.queue q
  WHERE q.salon_id = p_salon_id
  AND q.barber_id = p_barber_id
  AND q.booking_date = p_booking_date
  AND q.status IN ('waiting', 'confirmed', 'in_progress')
  AND q.created_at <= NOW();
  
  RETURN v_total_duration;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if barber supports all services
CREATE OR REPLACE FUNCTION public.barber_supports_all_services(
  p_barber_id UUID,
  p_service_ids UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_supported_count INTEGER;
  v_requested_count INTEGER;
BEGIN
  v_requested_count := array_length(p_service_ids, 1);
  
  SELECT COUNT(*) INTO v_supported_count
  FROM public.barber_services
  WHERE barber_id = p_barber_id
  AND service_id = ANY(p_service_ids);
  
  RETURN v_supported_count = v_requested_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find best available barber for multi-service booking
CREATE OR REPLACE FUNCTION public.find_best_barber(
  p_salon_id UUID,
  p_service_ids UUID[],
  p_booking_date DATE
)
RETURNS TABLE(
  barber_id UUID,
  barber_name TEXT,
  workload_score DECIMAL,
  can_service_all BOOLEAN,
  active_queue_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    CAST((COUNT(DISTINCT q.id) * 0.5 + COALESCE(SUM(q.total_duration), 0) * 0.3 + 
          CASE WHEN NOT b.is_online THEN 1000 ELSE 0 END) AS DECIMAL),
    public.barber_supports_all_services(b.id, p_service_ids),
    COUNT(DISTINCT q.id)::INTEGER
  FROM public.barbers b
  LEFT JOIN public.queue q ON b.id = q.barber_id
    AND q.salon_id = p_salon_id
    AND q.booking_date = p_booking_date
    AND q.status IN ('waiting', 'confirmed', 'in_progress')
  WHERE b.salon_id = p_salon_id
  AND b.is_active = TRUE
  GROUP BY b.id, b.name, b.is_online
  ORDER BY 
    public.barber_supports_all_services(b.id, p_service_ids) DESC,
    COUNT(DISTINCT q.id) ASC,
    COALESCE(SUM(q.total_duration), 0) ASC,
    CASE WHEN b.is_online THEN 0 ELSE 1 END,
    b.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- 7. Grant permissions
-- ================================================================
GRANT EXECUTE ON FUNCTION public.calculate_booking_duration TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_booking_price TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_estimated_wait TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.barber_supports_all_services TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_best_barber TO postgres, authenticated, anon;

GRANT SELECT ON public.barber_workload_view TO postgres, authenticated, anon;
GRANT SELECT ON public.booking_services TO postgres, authenticated, anon;
GRANT SELECT ON public.barber_services TO postgres, authenticated, anon;
GRANT SELECT ON public.booking_assignments TO postgres, authenticated, anon;

-- ================================================================
-- 8. Migration notes
-- ================================================================
-- This migration adds comprehensive multi-service support to the booking engine
-- Backward compatibility maintained - existing single-service bookings still work
-- New columns have sensible defaults for existing data
--
-- Next steps:
-- 1. Update frontend to use booking_services junction table
-- 2. Implement ServiceSelector component for multi-service UI
-- 3. Integrate smart barber assignment logic
-- 4. Add dynamic wait time calculations
