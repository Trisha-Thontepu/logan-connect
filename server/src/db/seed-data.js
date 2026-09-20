// Seed data for the directory.
//
// Logan Nails Spa is the founder's own business and carries the hand-written profile from
// the original seed.
//
// Every other entry is a real storefront taken from a public listing (Fresha, Yelp or
// Apple Maps) and is deliberately limited to facts those listings state: name, address,
// phone, category, the service names they advertise and, where a listing prints them,
// opening hours. Nothing else is invented. No owner names, no stories, no taglines, no
// claims about who owns the business. Each is marked unclaimed and shows where its
// information came from; owners can claim the listing and replace all of it.
//
// Checked 2026-09-19. Businesses that Yelp marks as closed were left out.

export const CHECKED_ON = '2026-09-19';

export const FOUNDER_LISTING = {
  slug: 'logan-nails-spa',
  name: 'Logan Nails Spa',
  category: 'Nail Salon',
  tagline: 'Twenty years of steady hands in the heart of Logan Heights',
  story_en:
    'Logan Nails Spa has been a fixture on National Avenue for two decades, built one client and one referral at a time. The shop runs on the same trust that built the neighborhood: come in once, and you keep coming back.',
  story_es:
    'Logan Nails Spa lleva dos décadas en la Avenida National, construida cliente por cliente y referencia por referencia. El negocio funciona con la misma confianza que construyó al vecindario: ven una vez, y seguirás regresando.',
  owner_name: 'Maria',
  address: '1985 National Ave, Ste 1109, San Diego, CA 92113',
  phone: '(619) 955-5599',
  appointment_only: true,
  hours: { mon: '9:00-19:00', tue: '9:00-19:00', wed: '9:00-19:00', thu: '9:00-19:00', fri: '9:00-19:00', sat: '9:00-17:00', sun: 'closed' },
  badges: ['family_owned'],
  photo_seed: 'rose',
  origin: 'founder',
  claim_status: 'claimed',
  booking_enabled: true,
  services: [
    { name_en: 'Classic Manicure', name_es: 'Manicure Clásico', price_cents: 2500, duration_min: 30 },
    { name_en: 'Gel Manicure', name_es: 'Manicure de Gel', price_cents: 4000, duration_min: 45 },
    { name_en: 'Pedicure', name_es: 'Pedicure', price_cents: 4500, duration_min: 45 },
    { name_en: 'Full Set Acrylics', name_es: 'Acrílicos Completos', price_cents: 6500, duration_min: 75 },
  ],
};

const listing = (fields) => ({
  origin: 'public_listing',
  claim_status: 'unclaimed',
  booking_enabled: false,
  appointment_only: false,
  hours: null,
  badges: [],
  service_tags: [],
  ...fields,
});

export const PUBLIC_LISTINGS = [
  listing({
    slug: 'nail-addictionz',
    name: 'Nail Addictionz',
    category: 'Nail Salon',
    address: '2547 Imperial Ave, Suite A, San Diego, CA 92102',
    phone: '(619) 957-6954',
    service_tags: ['Pedicure', 'Manicure', 'Gel nails', 'Spa pedicure'],
    photo_seed: 'rose',
    data_source: 'Fresha public listing',
  }),
  listing({
    slug: 'dve-beauty-salon',
    name: 'DVE Beauty Salon',
    category: 'Beauty Salon',
    address: '2930 National Ave, San Diego, CA 92113',
    phone: '(619) 380-2956',
    service_tags: ['Makeup', 'Eyebrow threading', 'Facials'],
    photo_seed: 'scissors',
    data_source: 'Fresha public listing',
  }),
  listing({
    slug: 'luzs-beauty-salon',
    name: "Luz's Beauty Salon",
    category: 'Beauty Salon',
    address: '3095 National Ave, Unit A, San Diego, CA 92113',
    phone: '(619) 233-7339',
    service_tags: ['Makeup', "Men's facials"],
    photo_seed: 'scissors',
    data_source: 'Fresha public listing',
  }),
  listing({
    slug: 'picasso-hair-design',
    name: 'Picasso Hair Design',
    category: 'Hair Salon',
    address: '2592 Imperial Ave, San Diego, CA 92102',
    phone: '(619) 232-8533',
    service_tags: ['Makeup'],
    photo_seed: 'scissors',
    data_source: 'Fresha public listing (category taken from the business name)',
  }),
  listing({
    slug: 'lore-barber-salon',
    name: 'Lore Barber Salon',
    category: 'Hair Salon',
    address: '3109 Imperial Ave, San Diego, CA 92102',
    phone: '(619) 674-4222',
    service_tags: ['Hair treatments', 'Permanent hair straightening'],
    photo_seed: 'comb',
    data_source: 'Fresha public listing',
  }),
  listing({
    slug: 'ag-hair-salon-and-barber',
    name: 'AG Hair Salon & Barber',
    category: 'Barbershop',
    address: '2115 Logan Ave, San Diego, CA 92113',
    phone: '(619) 962-4981',
    hours: { mon: 'closed', tue: '9:00-19:00', wed: '9:00-19:00', thu: '9:00-19:00', fri: '9:00-19:00', sat: '9:00-19:00', sun: '9:00-15:00' },
    service_tags: ['Haircuts', 'Fades', 'Beard trims', 'Shaves', 'Coloring', 'Styling'],
    photo_seed: 'comb',
    data_source: 'Yelp public listing',
  }),
  listing({
    slug: 'sd-bladez-barbershop',
    name: 'SD Bladez Barbershop',
    category: 'Barbershop',
    address: '3042 Ocean View Blvd, San Diego, CA 92113',
    phone: '(619) 984-2887',
    website: 'https://menshaircutssandiego.com',
    hours: { mon: 'closed', tue: '9:00-19:00', wed: '9:00-19:00', thu: '9:00-19:00', fri: '9:00-19:00', sat: '9:00-19:00', sun: 'closed' },
    service_tags: ['Haircuts'],
    photo_seed: 'comb',
    data_source: 'Apple Maps public listing',
  }),
];
