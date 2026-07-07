-- Seed data: real anchor business + realistic Logan Heights companions
-- Logan Nails Spa is real (1985 National Ave, Ste 1109, San Diego, CA 92113)
-- Companion businesses are illustrative placeholders styled after the neighborhood.

INSERT INTO businesses
  (slug, name, category, tagline, story_en, story_es, owner_name, address, lat, lng, phone, appointment_only, languages, hours_json, photo_seed)
VALUES
(
  'logan-nails-spa',
  'Logan Nails Spa',
  'Nail Salon',
  'Twenty years of steady hands in the heart of Logan Heights',
  'Logan Nails Spa has been a fixture on National Avenue for two decades, built one client and one referral at a time. The shop runs on the same trust that built the neighborhood: come in once, and you keep coming back.',
  'Logan Nails Spa lleva dos décadas en la Avenida National, construida cliente por cliente y referencia por referencia. El negocio funciona con la misma confianza que construyó al vecindario: ven una vez, y seguirás regresando.',
  'Maria',
  '1985 National Ave, Ste 1109, San Diego, CA 92113',
  32.6998, -117.1257,
  '(619) 955-5599',
  true,
  ARRAY['en','es'],
  '{"mon":"9:00-19:00","tue":"9:00-19:00","wed":"9:00-19:00","thu":"9:00-19:00","fri":"9:00-19:00","sat":"9:00-17:00","sun":"closed"}',
  'rose'
),
(
  'panaderia-la-perla',
  'Panadería La Perla',
  'Panadería',
  'Pan dulce fresh out of the oven every morning since 1998',
  'What started as a single family recipe for conchas turned into a corner bakery that anchors the morning routine for half the block. The ovens start at 4am so the case is full by sunrise.',
  'Lo que comenzó como una receta familiar de conchas se convirtió en una panadería de esquina que es parte de la rutina matutina de medio vecindario. Los hornos se encienden a las 4am para que la vitrina esté llena al amanecer.',
  'Don Refugio Alvarez',
  '2310 Logan Ave, San Diego, CA 92113',
  32.7012, -117.1241,
  '(619) 234-7765',
  false,
  ARRAY['en','es'],
  '{"mon":"5:00-19:00","tue":"5:00-19:00","wed":"5:00-19:00","thu":"5:00-19:00","fri":"5:00-20:00","sat":"5:00-20:00","sun":"6:00-15:00"}',
  'wheat'
),
(
  'taqueria-el-portal',
  'Taquería El Portal',
  'Restaurant',
  'Carne asada tacos that have not changed in 25 years, on purpose',
  'El Portal opened as a single taco cart before moving into a storefront. The menu still has six items, because the family believes a menu that does six things perfectly beats one that does sixty things fine.',
  'El Portal abrió como un solo carrito de tacos antes de mudarse a un local. El menú todavía tiene seis platillos, porque la familia cree que un menú que hace seis cosas perfectamente es mejor que uno que hace sesenta cosas apenas bien.',
  'Familia Reyes',
  '3115 Main St, San Diego, CA 92113',
  32.6963, -117.1267,
  '(619) 318-4420',
  false,
  ARRAY['en','es'],
  '{"mon":"11:00-21:00","tue":"11:00-21:00","wed":"11:00-21:00","thu":"11:00-21:00","fri":"11:00-22:00","sat":"11:00-22:00","sun":"11:00-20:00"}',
  'chili'
),
(
  'barberia-don-chuy',
  'Barbería Don Chuy',
  'Barbershop',
  'Three chairs, one waiting bench, no appointments needed',
  'Don Chuy cuts hair the way his father taught him in Tijuana, and trained both of his sons the same way. The shop is part barbershop, part living room, where regulars stop by even on weeks they do not need a cut.',
  'Don Chuy corta el cabello como le enseñó su padre en Tijuana, y entrenó a sus dos hijos de la misma manera. El local es mitad barbería, mitad sala de estar, donde los clientes frecuentes pasan incluso en semanas que no necesitan corte.',
  'Jesus "Don Chuy" Maldonado',
  '2855 National Ave, San Diego, CA 92113',
  32.7001, -117.1276,
  '(619) 442-9013',
  false,
  ARRAY['en','es'],
  '{"mon":"10:00-19:00","tue":"10:00-19:00","wed":"10:00-19:00","thu":"10:00-19:00","fri":"10:00-20:00","sat":"9:00-18:00","sun":"closed"}',
  'comb'
),
(
  'lavanderia-rapida',
  'Lavandería Rápida Logan',
  'Laundromat',
  'Self-serve machines and a fold-and-fill drop-off service',
  'Built to serve the apartment buildings that surround it, the laundromat added a drop-off wash-and-fold service after too many customers asked the owner to "just take care of it" while they worked double shifts.',
  'Construida para servir a los edificios de apartamentos que la rodean, la lavandería agregó un servicio de lavado y doblado después de que demasiados clientes le pidieron a la dueña que "se encargara" mientras trabajaban turnos dobles.',
  'Rosa Delgado',
  '2640 Imperial Ave, San Diego, CA 92102',
  32.7034, -117.1219,
  '(619) 270-5588',
  false,
  ARRAY['en','es'],
  '{"mon":"7:00-21:00","tue":"7:00-21:00","wed":"7:00-21:00","thu":"7:00-21:00","fri":"7:00-21:00","sat":"7:00-21:00","sun":"7:00-21:00"}',
  'shirt'
),
(
  'estetica-bella-vida',
  'Estética Bella Vida',
  'Beauty Salon',
  'Color, cuts, and quinceañera styling for three generations of the same families',
  'Bella Vida has done hair for grandmothers, then their daughters, then their granddaughters preparing for quinceañeras. The owner keeps a notebook of every client''s color formula going back fifteen years.',
  'Bella Vida ha hecho el cabello de abuelas, luego sus hijas, y después sus nietas preparándose para sus quinceañeras. La dueña guarda un cuaderno con la fórmula de color de cada clienta desde hace quince años.',
  'Yolanda Cifuentes',
  '3030 National Ave, San Diego, CA 92113',
  32.6989, -117.1232,
  '(619) 696-3344',
  true,
  ARRAY['en','es'],
  '{"mon":"closed","tue":"10:00-19:00","wed":"10:00-19:00","thu":"10:00-19:00","fri":"10:00-19:00","sat":"9:00-18:00","sun":"10:00-15:00"}',
  'scissors'
);

INSERT INTO services (business_id, name_en, name_es, price_cents, duration_min) VALUES
(1, 'Classic Manicure', 'Manicure Clásico', 2500, 30),
(1, 'Gel Manicure', 'Manicure de Gel', 4000, 45),
(1, 'Pedicure', 'Pedicure', 4500, 45),
(1, 'Full Set Acrylics', 'Acrílicos Completos', 6500, 75),
(4, 'Haircut', 'Corte de Cabello', 2000, 30),
(4, 'Beard Trim', 'Arreglo de Barba', 1000, 15),
(6, 'Haircut & Style', 'Corte y Peinado', 5500, 60),
(6, 'Quinceañera Package', 'Paquete de Quinceañera', 15000, 180);
