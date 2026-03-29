ALTER TABLE public.bookings ADD COLUMN salon_id UUID REFERENCES public.salons(id);
