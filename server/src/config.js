import dotenv from 'dotenv';

dotenv.config();

const env = process.env;

export const config = {
  port: Number(env.PORT) || 4000,
  corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
  publicAppUrl: (env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  // Admin endpoints stay disabled unless a long random token is configured.
  adminToken: env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 24 ? env.ADMIN_TOKEN : null,
  twilioAuthToken: env.TWILIO_AUTH_TOKEN || null,
  // Public URL Twilio calls; needed to verify webhook signatures behind a proxy.
  twilioWebhookUrl: env.TWILIO_WEBHOOK_URL || null,
  smtp: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT) || 587,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM || 'Logan Connect <no-reply@localhost>',
      }
    : null,
  isTest: env.NODE_ENV === 'test',
};
