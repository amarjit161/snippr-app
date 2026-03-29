-- Create Predefined Demo Salons in Delhi

-- Laxmi Nagar Salon
DO $$
DECLARE
    v_laxmi_id UUID;
    v_nirman_id UUID;
    v_karka_id UUID;
    v_anand_id UUID;
BEGIN
    -- 1. Laxmi Nagar
    INSERT INTO salons (name, location, lat, lng, status)
    VALUES ('Laxmi Nagar Premium Cuts', 'Laxmi Nagar, Delhi', 28.6304, 77.2774, 'open')
    RETURNING id INTO v_laxmi_id;

    INSERT INTO barbers (salon_id, name) VALUES (v_laxmi_id, 'Raj Kumar');
    INSERT INTO barbers (salon_id, name) VALUES (v_laxmi_id, 'Amit Singh');
    INSERT INTO services (salon_id, name, price, duration) VALUES (v_laxmi_id, 'Haircut & Styling', 15.00, 30);
    INSERT INTO services (salon_id, name, price, duration) VALUES (v_laxmi_id, 'Beard Trim', 10.00, 15);

    -- 2. Nirman Vihar
    INSERT INTO salons (name, location, lat, lng, status)
    VALUES ('Nirman Vihar Elegance Salon', 'Nirman Vihar, Delhi', 28.6366, 77.2874, 'open')
    RETURNING id INTO v_nirman_id;

    INSERT INTO barbers (salon_id, name) VALUES (v_nirman_id, 'Sunil Das');
    INSERT INTO services (salon_id, name, price, duration) VALUES (v_nirman_id, 'Classic Cut', 18.00, 35);
    INSERT INTO services (salon_id, name, price, duration) VALUES (v_nirman_id, 'Hair Spa', 25.00, 45);

    -- 3. Karkarduma
    INSERT INTO salons (name, location, lat, lng, status)
    VALUES ('Karkarduma Style Studio', 'Karkarduma, Delhi', 28.6496, 77.3023, 'open')
    RETURNING id INTO v_karka_id;

    INSERT INTO barbers (salon_id, name) VALUES (v_karka_id, 'Deepak Verma');
    INSERT INTO services (salon_id, name, price, duration) VALUES (v_karka_id, 'Express Style', 12.00, 20);

    -- 4. Anand Vihar
    INSERT INTO salons (name, location, lat, lng, status)
    VALUES ('Anand Vihar Premium Lounge', 'Anand Vihar, Delhi', 28.6473, 77.3155, 'open')
    RETURNING id INTO v_anand_id;

    INSERT INTO barbers (salon_id, name) VALUES (v_anand_id, 'Vivek Sharma');
    INSERT INTO services (salon_id, name, price, duration) VALUES (v_anand_id, 'Executive Grooming', 35.00, 45);

END $$;
