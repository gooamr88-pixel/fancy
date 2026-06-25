// Size the libuv threadpool BEFORE anything triggers it (PBKDF2 password hashing
// runs on this pool; the default of 4 makes concurrent logins queue). Authoritative
// value comes from the environment (pm2 ecosystem sets 16); this is the fallback
// for a direct `node server.js`. Must run before the first crypto/fs/dns call.
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = '16';
}

require('dotenv').config({ override: true });
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`=========================================`);
  logger.info(`🚀 Fancy RSVP Backend running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`=========================================`);

  // Lifecycle email automation (reminders, reports, post-event). No-ops unless
  // EMAIL_AUTOMATION_ENABLED=true; single-leader + idempotent (see emailScheduler).
  try {
    require('./services/emailScheduler').start();
  } catch (err) {
    logger.warn({ err }, 'Email scheduler failed to start (non-fatal)');
  }

  // Async SMS campaign worker (drains large queued campaigns). On by default;
  // single-leader + idempotent (see smsCampaignWorker). Disable with SMS_WORKER_ENABLED=false.
  try {
    require('./services/smsCampaignWorker').start();
  } catch (err) {
    logger.warn({ err }, 'SMS campaign worker failed to start (non-fatal)');
  }

  // Daily revenue rollup refresher — keeps mv_daily_revenue (Financial Command
  // Center §22) current. On by default; single-leader + idempotent (see
  // revenueRollup). Disable with REVENUE_ROLLUP_ENABLED=false.
  try {
    require('./services/revenueRollup').start();
  } catch (err) {
    logger.warn({ err }, 'Revenue rollup refresher failed to start (non-fatal)');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  try { require('./services/emailScheduler').stop(); } catch { /* ignore */ }
  try { require('./services/smsCampaignWorker').stop(); } catch { /* ignore */ }
  try { require('./services/revenueRollup').stop(); } catch { /* ignore */ }
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

// Catch uncaught exceptions — log and exit gracefully
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  server.close(() => {
    process.exit(1);
  });
  // Force exit if server hasn't closed within 10 seconds
  setTimeout(() => process.exit(1), 10000).unref();
});
