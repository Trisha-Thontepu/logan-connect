# Logan Connect

**A bilingual local-business discovery and appointment-booking platform built for the Logan Heights community in San Diego.**

I built Logan Connect after seeing firsthand how difficult it can be for small, locally owned businesses to build an online presence and manage appointments. Growing up in Logan Heights, I helped with my mother's beauty business, where much of the day-to-day scheduling happened through calls and text messages.

Logan Connect started from a simple question: **what if discovering a local business and booking an appointment could be as easy as sending a text?**

The platform combines a searchable community business directory with a bilingual English/Spanish SMS booking system. Customers can discover businesses, view their information, and book appointments conversationally without downloading another app or navigating a complicated scheduling system.

## What I Built

### Local Business Discovery

The directory includes real salons and barbershops in Logan Heights gathered from publicly available business listings. Each unclaimed profile records its source and when the information was last checked rather than inventing business information.

Users can search and filter businesses, view individual business profiles, and discover businesses geographically through an interactive map.

Business addresses are converted into map coordinates using the U.S. Census Geocoder.

### Bilingual SMS Appointment Booking

I built a conversational booking engine that allows customers to request appointments through natural-language text messages in **English or Spanish**.

Instead of requiring customers to fill out a rigid booking form, the backend interprets the requested service, day, and time while maintaining context across multiple messages.

Before confirming an appointment, the system:

- Parses natural-language dates and times
- Maintains conversation state between messages
- Remembers the selected service throughout the booking flow
- Checks the business's operating hours
- Checks available chair capacity
- Prevents appointments on closed days
- Prevents conflicting and double bookings
- Stores confirmed appointments in PostgreSQL
- Supports appointment cancellation

The booking flow integrates with **Twilio** for real SMS conversations. The frontend also includes a browser-based "text to book" demo so the complete booking experience can be tested without a phone.

### Backend Engineering

I designed the backend as a **Node.js + Express + PostgreSQL REST API** supporting the business directory, business profiles, scheduling, and SMS booking system.

One of the more interesting engineering problems was handling multiple customers attempting to reserve availability at nearly the same time. I implemented **per-business database locking** so availability checks and appointment creation happen safely before another request can reserve the same capacity.

I also introduced **versioned database migrations** so the schema can evolve as the project grows without rebuilding the database from scratch. I tested the migration path by creating a database using the previous schema and upgrading it to the current version.

### Security & Reliability

As the project grew beyond its original prototype, I added several protections to make the backend safer and more reliable:

- Twilio webhook signature verification
- CORS allow-listing
- Helmet security headers
- API rate limiting
- Request-size limits
- Environment-based configuration
- Protection of customer message history from public demo endpoints

I also fixed several issues from the original booking implementation, including appointments being stored at the wrong time, bookings being allowed on closed days, selected services being forgotten between messages, and the Twilio webhook occasionally returning an empty response.

### Testing

The backend includes **57 integration tests** that run against a real PostgreSQL database.

The test suite covers booking behavior, database operations, scheduling constraints, conversation state, cancellations, closed businesses, conflicting appointments, and other edge cases.

Testing the application against a real database also helps verify that the booking logic, database constraints, and migrations work together rather than testing each component only in isolation.

## Tech Stack

**Frontend:** React, Vite, Leaflet  
**Backend:** Node.js, Express, REST APIs  
**Database:** PostgreSQL  
**Messaging:** Twilio SMS  
**Testing:** Vitest  
**Geocoding:** U.S. Census Geocoder  
**Languages:** JavaScript, SQL, HTML/CSS

## Repository Structure

`server/` — Express + PostgreSQL API containing the directory endpoints, business profiles, database migrations, scheduling logic, and bilingual SMS booking engine.

`client/` — React frontend containing the searchable business directory, interactive Leaflet map, business profile pages, bilingual content, and browser-based booking demo.

## Project Status

Logan Connect is actively being developed. The core directory, database, booking engine, SMS integration, and backend testing infrastructure are implemented.

I'm currently expanding the business-owner side of the platform, including:

- Business owner submissions
- Listing claiming and verification
- Admin review
- Owner dashboard
- Frontend flows for the new directory and booking features

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## 1. Set Up the Database

Create a PostgreSQL user and database for Logan Connect:

```bash
psql -c "CREATE USER loganconnect WITH PASSWORD 'loganconnect_dev' CREATEDB;"
psql -c "CREATE DATABASE logan_connect OWNER loganconnect;"
```

Then install the backend dependencies and initialize the database:

```bash
cd server
npm install
npm run db:setup
```

`db:setup` handles three database setup steps that can also be run individually:

```bash
npm run db:migrate
npm run db:seed
npm run db:geocode
```

- `npm run db:migrate` applies the numbered migrations in `server/src/db/migrations/`.
- `npm run db:seed` loads the business directory. Unclaimed listings can be refreshed without overwriting a listing that an owner has claimed.
- `npm run db:geocode` converts business addresses into map coordinates using the U.S. Census Geocoder. Internet access is required for this step.

If your local PostgreSQL instance uses different credentials, copy:

```bash
server/.env.example
```

to:

```bash
server/.env
```

and update the database configuration.

## 2. Run the Backend

From the `server/` directory:

```bash
npm install
npm start
```

Make sure your PostgreSQL database is running and your environment variables are configured before starting the server.

## 3. Run the Frontend

Open another terminal and navigate to the client:

```bash
cd client
npm install
npm run dev
```

Vite will start the React development server and provide the local URL for opening Logan Connect in your browser.

## 4. Run the Tests

From the `server/` directory:

```bash
npm test
```

The integration test suite runs against PostgreSQL and tests the directory, booking engine, scheduling logic, database behavior, and important edge cases.

## Why I Built Logan Connect

Logan Connect is personal to me because the problem behind it is one I grew up around.

Helping with my mother's beauty business showed me how much work small-business owners handle outside of the service they actually provide. Answering calls, responding to messages, coordinating appointments, and maintaining an online presence all take time.

At the same time, many neighborhood businesses are difficult to discover online even when they have been serving their communities for years.

I wanted to use what I've learned in software engineering, data, and business to explore what a better experience could look like for both sides: **making local businesses easier to discover while making appointment scheduling simpler for customers and owners.**

Logan Connect is still evolving, but my goal is to keep building it around that original problem.
