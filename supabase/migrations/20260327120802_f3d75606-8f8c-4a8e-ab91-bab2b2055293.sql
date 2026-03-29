
-- Create salons table
CREATE TABLE public.salons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  rating NUMERIC(2,1) DEFAULT 4.5,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salons are viewable by everyone" ON public.salons FOR SELECT USING (true);

-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  duration INTEGER NOT NULL
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone)
  VALUES (NEW.id, NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create queue table
CREATE TABLE public.queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view queue for any salon" ON public.queue FOR SELECT USING (true);
CREATE POLICY "Users can join queue" ON public.queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own queue entry" ON public.queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can cancel own queue entry" ON public.queue FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime on queue table
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue;

-- Seed salon data
INSERT INTO public.salons (name, location, image_url, rating, status, lat, lng) VALUES
  ('The Grand Salon', 'Downtown, 5th Avenue', '/salon-1', 4.8, 'open', 40.7580, -73.9855),
  ('Urban Barbers', 'Midtown, Brick Lane', '/salon-2', 4.6, 'open', 40.7484, -73.9857),
  ('Blush & Bloom', 'Uptown, Rose Street', '/salon-3', 4.9, 'open', 40.7829, -73.9654),
  ('Verde Studio', 'East Side, Oak Park', '/salon-4', 4.7, 'closed', 40.7282, -73.7949);

-- Seed services
INSERT INTO public.services (salon_id, name, price, duration)
SELECT s.id, v.name, v.price, v.duration
FROM public.salons s
CROSS JOIN (VALUES 
  ('Haircut', 30, 40),
  ('Beard Trim', 15, 20),
  ('Styling', 25, 30)
) AS v(name, price, duration)
WHERE s.name = 'The Grand Salon';

INSERT INTO public.services (salon_id, name, price, duration)
SELECT s.id, v.name, v.price, v.duration
FROM public.salons s
CROSS JOIN (VALUES 
  ('Classic Cut', 25, 35),
  ('Hot Towel Shave', 20, 20),
  ('Fade', 35, 30)
) AS v(name, price, duration)
WHERE s.name = 'Urban Barbers';

INSERT INTO public.services (salon_id, name, price, duration)
SELECT s.id, v.name, v.price, v.duration
FROM public.salons s
CROSS JOIN (VALUES 
  ('Blowout', 40, 40),
  ('Keratin Treatment', 120, 90),
  ('Highlights', 80, 75)
) AS v(name, price, duration)
WHERE s.name = 'Blush & Bloom';

INSERT INTO public.services (salon_id, name, price, duration)
SELECT s.id, v.name, v.price, v.duration
FROM public.salons s
CROSS JOIN (VALUES 
  ('Haircut & Style', 45, 45),
  ('Scalp Treatment', 35, 30)
) AS v(name, price, duration)
WHERE s.name = 'Verde Studio';
