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

# Load schema and seed data
psql -U loganconnect -d logan_connect -f server/src/db/schema.sql
psql -U loganconnect -d logan_connect -f server/src/db/seed.sql
```

If your local Postgres uses different credentials, copy `server/.env.example`
to `server/.env` and update the values — `server/src/db/pool.js` reads from
`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

## 2. Run the backend

```bash
cd server
npm install
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

Logan Nails Spa is real. The other five businesses (Panadería La Perla,
Taquería El Portal, Barbería Don Chuy, Lavandería Rápida Logan, Estética
Bella Vida) are realistic placeholder businesses styled after the
neighborhood, included to round out the directory demo and are not real listings.

## Known limitations (good next steps)

- The day/time parser in `server/src/sms/engine.js` is intentionally simple
  (regex-based) for the demo; a production version would need a real
  date/time parsing library and timezone handling.
- No authentication yet — there's no owner-facing dashboard to manage
  appointments or edit a business's own listing.
- SMS is simulated; connecting a real Twilio number just requires pointing
  its webhook at `/api/sms/webhook`.
