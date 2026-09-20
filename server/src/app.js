import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db/pool.js';
import businessesRouter from './routes/businesses.js';
import smsRouter from './routes/sms.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy (Render, Fly, nginx) the client IP arrives in
  // X-Forwarded-For; rate limiting needs that to see the real visitor.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' })); // Twilio webhook form posts

  // Health check that actually touches the database, so a deploy platform
  // can tell "process is up" apart from "process is up but cannot serve requests".
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', error: 'database unavailable' });
    }
  });

  app.use('/api/businesses', businessesRouter);
  app.use('/api/sms', smsRouter);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Catch-all error handler: without this, an unhandled rejection in any route
  // (e.g. the DB connection dropping) crashes the whole process instead of
  // returning a normal 500. Express 4 doesn't auto-catch async route errors.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    console.error('Unhandled error:', err.stack || err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
