-- Logan Connect: community directory + bilingual SMS booking schema

CREATE TABLE IF NOT EXISTS businesses (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,           -- e.g. 'Nail Salon', 'Panaderia', 'Barberia'
  tagline         TEXT,
  story_en        TEXT,
  story_es        TEXT,
  owner_name      TEXT,
  address         TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  phone           TEXT,
  appointment_only BOOLEAN DEFAULT FALSE,
  languages       TEXT[] DEFAULT ARRAY['en','es'],
  hours_json      JSONB,                  -- { "mon": "9:00-19:00", ... }
  photo_seed      TEXT,                   -- used to pick a deterministic accent color/icon client-side
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name_en       TEXT NOT NULL,
  name_es       TEXT,
  price_cents   INTEGER,
  duration_min  INTEGER DEFAULT 30
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  name          TEXT,
  preferred_lang TEXT DEFAULT 'en',       -- 'en' or 'es', auto-detected from first message
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id    INTEGER REFERENCES services(id),
  starts_at     TIMESTAMPTZ NOT NULL,
  status        TEXT DEFAULT 'pending',   -- pending | confirmed | reminded | completed | cancelled | no_show
  created_via   TEXT DEFAULT 'sms',       -- 'sms' or 'web'
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Every inbound/outbound SMS, so the agent's conversation state can be reconstructed
CREATE TABLE IF NOT EXISTS sms_messages (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  business_id   INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL,            -- 'inbound' | 'outbound'
  body          TEXT NOT NULL,
  lang          TEXT DEFAULT 'en',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_sms_customer ON sms_messages(customer_id);
