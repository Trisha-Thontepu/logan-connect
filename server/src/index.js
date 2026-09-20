import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

const app = createApp();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err);
});

const server = app.listen(config.port, () =>
  console.log(`Logan Connect API listening on :${config.port}`)
);

// Let in-flight requests finish and release DB connections when the platform
// sends SIGTERM (every deploy does), instead of cutting requests off mid-write.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
