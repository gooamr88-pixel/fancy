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
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
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
