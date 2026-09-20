-- Listings that can exist before their owner joins, owner-submitted listings that wait
-- for review, claim requests, owner access, and the state the SMS booking flow needs.

-- ---------------------------------------------------------------- businesses
-- Coordinates become optional: a listing can be created from an address and geocoded
-- afterwards, instead of every row needing hand-typed lat/lng at insert time.
ALTER TABLE businesses ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE businesses ALTER COLUMN lng DROP NOT NULL;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS status          TEXT    NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS claim_status    TEXT    NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS origin          TEXT    NOT NULL DEFAULT 'founder',
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chairs          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS timezone        TEXT    NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS sms_number      TEXT,
  ADD COLUMN IF NOT EXISTS website         TEXT,
  ADD COLUMN IF NOT EXISTS service_tags    TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badges          TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_source     TEXT,
  ADD COLUMN IF NOT EXISTS data_checked_on DATE,
  ADD COLUMN IF NOT EXISTS geocoded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE businesses
  ADD CONSTRAINT businesses_status_check
    CHECK (status IN ('pending', 'published', 'rejected', 'suspended')),
  ADD CONSTRAINT businesses_claim_status_check
    CHECK (claim_status IN ('unclaimed', 'claimed')),
  ADD CONSTRAINT businesses_origin_check
    CHECK (origin IN ('founder', 'public_listing', 'owner_submission')),
  ADD CONSTRAINT businesses_chairs_check CHECK (chairs BETWEEN 1 AND 20);

-- Before this migration every business accepted SMS bookings; keep that for rows
-- that already exist. New listings default to FALSE and owners opt in.
UPDATE businesses SET booking_enabled = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_sms_number
  ON businesses (sms_number) WHERE sms_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses (status);

-- ------------------------------------------------------------------ services
-- Owners can retire a service without deleting it, because past appointments
-- still reference it (appointments.service_id has no ON DELETE clause).
ALTER TABLE services ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- ------------------------------------------------------------ owner contact
-- Private. Never selected by any public endpoint.
CREATE TABLE IF NOT EXISTS owner_contacts (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Owners sign in with a secret link instead of a password. Only a SHA-256 hash of
-- the token is stored, so a database leak does not hand out working links.
CREATE TABLE IF NOT EXISTS owner_access_tokens (
  id           SERIAL PRIMARY KEY,
  business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

-- ------------------------------------------------------------ claim requests
CREATE TABLE IF NOT EXISTS claim_requests (
  id             SERIAL PRIMARY KEY,
  business_id    INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  claimant_name  TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT NOT NULL,
  relationship   TEXT,
  message        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ
);
-- One open claim per listing at a time; a second claimant sees "under review".
CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_one_pending
  ON claim_requests (business_id) WHERE status = 'pending';

-- ------------------------------------------------------------------ booking
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
UPDATE appointments a
   SET ends_at = a.starts_at + make_interval(mins => COALESCE(s.duration_min, 30))
  FROM services s
 WHERE a.service_id = s.id AND a.ends_at IS NULL;
UPDATE appointments SET ends_at = starts_at + interval '30 minutes' WHERE ends_at IS NULL;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('pending', 'confirmed', 'reminded', 'completed', 'cancelled', 'no_show'));

CREATE INDEX IF NOT EXISTS idx_appointments_business_time
  ON appointments (business_id, starts_at);

-- Conversation memory for the SMS flow. Without it "gel manicure" followed by
-- "friday 2pm" fails, because the second text has no service in it.
CREATE TABLE IF NOT EXISTS sms_sessions (
  customer_id        INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id        INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pending_service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  pending_date       DATE,   -- a day the customer gave before giving a time
  pending_time       TIME,   -- a time the customer gave before giving a day
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, business_id)
);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;
