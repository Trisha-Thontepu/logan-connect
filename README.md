# Logan Connect

A community directory and bilingual SMS booking platform for Latinx-owned
businesses in Logan Heights, San Diego. It is built around Logan Nails Spa
(1985 National Ave), my mother's shop, as the anchor business.

## What's inside

- **`server/`** — Express + Postgres API. Directory endpoints (search, filter,
  business profiles) and a bilingual (English/Spanish) SMS booking engine that
  parses free-text messages, books appointments, and supports cancellation.
- **`client/`** — React (Vite) frontend. Directory grid, Leaflet map, business
  profile pages with bilingual story toggle, and a live "text to book" demo
  widget so you can try the SMS flow in the browser without a real phone.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running locally, or update the connection details below)

## 1. Set up the database

```bash
# Create a user and database (adjust as needed for your local Postgres setup)
psql -c "CREATE USER loganconnect WITH PASSWORD 'loganconnect_dev' CREATEDB;"
psql -c "CREATE DATABASE logan_connect OWNER loganconnect;"

# Apply migrations, load the directory listings, and look up map coordinates
cd server
npm install
npm run db:setup
```

`db:setup` is three steps you can also run on their own:

- `npm run db:migrate` applies the numbered files in `server/src/db/migrations/`.
  It is safe to run on a database created by the older `schema.sql`.
- `npm run db:seed` loads the directory. It is safe to run on every deploy: unclaimed
  listings are refreshed, and a listing an owner has claimed is never overwritten.
- `npm run db:geocode` turns each address into map coordinates using the free U.S. Census
  geocoder (needs internet). Until it has run, listings appear in the directory but not
  on the map.

If your local Postgres uses different credentials, copy `server/.env.example`
to `server/.env` and update the values.

## 2. Run the backend

```bash
cd server
npm run dev      # auto-restarts on file changes, http://localhost:4000
```

Verify it's up: `curl http://localhost:4000/api/health` should return `{"status":"ok"}`.

## 3. Run the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev       # http://localhost:5173
```

The client reads the API URL from `client/.env` (`VITE_API_BASE`), already
pointed at `http://localhost:4000/api`.

## Trying the SMS booking demo

Open any business profile page and use the "Try it" widget — it calls the
real booking engine (`/api/sms/simulate`) over HTTP instead of a real SMS
carrier, so no Twilio account is needed to test it. Try starting with "hi"
or "hola" and see the conversation stay in whichever language you started in.

A Twilio-compatible webhook (`/api/sms/webhook`) is also included as a
drop-in target for connecting a real phone number later.

## Notes on the data

Logan Nails Spa is the founder's business and has a hand-written profile. The other
listings are real storefronts in Logan Heights taken from public listings (Fresha, Yelp,
Apple Maps). They contain only what those listings state: name, address, phone, advertised
service names and, where printed, hours. Each one shows where its information came from
and when it was checked, is marked unclaimed, and does not take text bookings until an
owner opts in. The directory does not say who owns a business; ownership badges are
labels owners apply to themselves.

To add more listings, edit `server/src/db/seed-data.js` and run `npm run db:seed`. Only
add facts from a source you can point to, and leave anything else empty.

## Tests

```bash
cd server
npm test
```

Tests run against a real Postgres database named `logan_connect_test`, created and rebuilt
automatically from the migrations. Your development database is never touched. The role in
`.env` needs `CREATEDB`, as in the setup above.

## SMS booking

The booking engine (`server/src/sms/`) understands day and time in English and Spanish
("gel manicure jueves 3pm", "friday at 2"), remembers the conversation between texts,
checks opening hours and how many chairs are free, and never double-books. Customers can
text `HELP`, `STOP`, `START`, and `CANCEL APPT` (`CANCELAR CITA`).

To connect a real number, set `TWILIO_AUTH_TOKEN` (and `TWILIO_WEBHOOK_URL` if the server
is behind a proxy), store the number on the business in `businesses.sms_number` in E.164
form, and point the number's webhook at `/api/sms/webhook`. Requests without a valid Twilio
signature are rejected. Twilio's default opt-out keywords include `CANCEL`, so check the
opt-out settings on your number; the replies use `CANCEL APPT` for that reason.

The "Try it" widget on a profile page uses the same engine over HTTP as a separate demo
customer. Demo bookings never block real appointment slots.

## Known limitations

- Owner-facing tools (adding a business, claiming a listing, editing a profile, viewing
  appointments) are being built on this branch and are not finished yet.
- The frontend has not been updated for the new listing fields yet.
- Text booking is only enabled for Logan Nails Spa.
