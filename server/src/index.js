import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import businessesRouter from './routes/businesses.js';
import smsRouter from './routes/sms.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for Twilio webhook form posts

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/businesses', businessesRouter);
app.use('/api/sms', smsRouter);

// Catch-all error handler: without this, an unhandled rejection in any route
// (e.g. the DB connection dropping) crashes the whole process instead of
// returning a normal 500. Express 4 doesn't auto-catch async route errors.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Logan Connect API listening on :${PORT}`));
