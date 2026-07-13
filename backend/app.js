const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { requireAuth, verifyEventOwner, requireSuperAdmin } = require('./middleware/auth');

// Startup environment validation — fail fast if critical secrets are missing.
const REQUIRED_ENV = ['JWT_SECRET', 'QR_JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'IP_HASH_SALT'];
// Stripe secrets are required only when card payments are turned ON. Pre-live /
// manual-only mode boots with no Stripe keys. Keyed off the operator's INTENT
// (the flag) so enabling card payments without keys fails loudly instead of
// silently staying disabled.
const stripeIntended = /^(1|true|yes|on)$/i.test(String(process.env.PAYMENTS_STRIPE_ENABLED || '').trim());
if (stripeIntended) REQUIRED_ENV.push('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET');
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Behind nginx (Hostinger) the app receives every request from 127.0.0.1 with the
// real client IP in X-Forwarded-For. Trust exactly ONE proxy hop so:
//   • req.ip is the real client → rate limiters bucket per-user, not globally
//   • req.protocol reflects https (X-Forwarded-Proto) for correct redirect/callback URLs
// Use a numeric hop count (not `true`) so a spoofed XFF can't impersonate an IP.
app.set('trust proxy', 1);

// Enable security headers
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  // Explicit HSTS (L2): force HTTPS for a year, including subdomains, preload-eligible.
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));


// Configure CORS with multi-origin support.
// Use the shared resolver so malformed FRONTEND_URL entries (missing colon, trailing
// slash) are repaired into valid origins instead of silently failing CORS.
const { getAllowedOrigins } = require('./utils/publicUrl');
const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Gzip responses (large JSON: event lists, RSVP lists, exports). The threshold
// avoids spending CPU compressing tiny payloads.
app.use(compression({ threshold: 1024 }));

// Parse cookies (httpOnly auth cookie)
app.use(cookieParser());

// SEC-2: the public, unauthenticated guest RSVP writes must NOT accept large
// bodies (the 50mb global limit exists for authenticated CSV/image uploads). A
// tight parser mounted on these paths first sets req._body, so the global parser
// below short-circuits for them. An RSVP — even a party of 20 with custom answers
// — is well under 64kb.
const tightJson = express.json({ limit: '64kb' });
app.use('/api/v1/public/events/:slug/rsvp', tightJson);
app.use('/api/v1/public/rsvp', tightJson);

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/v1/payments/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── RATE LIMITING ───
// DISABLE_RATE_LIMIT=true turns limiting off entirely — ONLY for load testing
// against a throwaway environment. Never set this in production.
const RATE_LIMIT_DISABLED = process.env.DISABLE_RATE_LIMIT === 'true';

// Optional shared Redis store so limits are GLOBAL across pm2 cluster workers /
// horizontally-scaled instances. The default MemoryStore is per-process, which
// means with `instances: N` the effective limit is N× and inconsistent. Activates
// only when REDIS_URL is set AND the optional deps (ioredis, rate-limit-redis)
// are installed; otherwise it transparently falls back to the in-memory store.
let redisClient = null;
if (!RATE_LIMIT_DISABLED && process.env.REDIS_URL) {
  try {
    const IORedis = require('ioredis');
    redisClient = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 2 });
    redisClient.on('error', (e) => logger.error({ err: e.message }, 'Redis (rate-limit) error'));
    logger.info('Rate limiting backed by Redis (shared across instances)');
  } catch (e) {
    logger.warn(`REDIS_URL set but ioredis unavailable — falling back to in-memory rate limiter. (${e.message})`);
  }
}
const storeFor = (prefix) => {
  if (!redisClient) return undefined; // undefined => express-rate-limit's default MemoryStore
  const { RedisStore } = require('rate-limit-redis');
  return new RedisStore({ sendCommand: (...args) => redisClient.call(...args), prefix: `rl:${prefix}:` });
};

if (RATE_LIMIT_DISABLED) {
  logger.warn('⚠️  Rate limiting is DISABLED (DISABLE_RATE_LIMIT=true). Do NOT run production like this.');
} else {
  // Permissive limiter for organizer dashboards (preventing blockages on updates)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: storeFor('api'),
  });
  app.use('/api', apiLimiter);

  // Strict limiter for authentication endpoints (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // 15 attempts per 15 minutes per IP
    message: { success: false, error: 'TOO_MANY_AUTH_REQUESTS', message: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: storeFor('auth'),
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/auth/forgot-password', authLimiter);
  app.use('/api/v1/auth/reset-password', authLimiter);
  app.use('/api/v1/auth/verify-registration', authLimiter);
  app.use('/api/v1/auth/google', authLimiter);

  // Limiter for public RSVP submissions
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 30 RSVP submissions per 15 minutes per IP
    message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: storeFor('public'),
  });
  app.use('/api/v1/public/events', publicLimiter);
  // SEC-1: the token-based RSVP paths (one-click respond, guest/invite resolvers)
  // live under /public/rsvp and were previously covered only by the general 1000/15m
  // limiter. Apply the strict public limiter here too.
  app.use('/api/v1/public/rsvp', publicLimiter);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Strip the query string before logging: public search endpoints carry guest
    // names (e.g. ?query=John%20Doe) which would otherwise land guest PII in logs.
    const path = (req.originalUrl || '').split('?')[0];
    logger.info({
      method: req.method,
      url: path,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
    }, `${req.method} ${path} ${res.statusCode}`);
  });
  next();
});

// CSRF defense-in-depth (M2): reject state-changing requests whose browser
// Origin/Referer isn't on the allowlist. Runs after body parsing, before routes.
const { csrfOriginGuard } = require('./middleware/csrf');
app.use(csrfOriginGuard);

// UUID format validation middleware for :eventId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
app.param('eventId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'eventId must be a valid UUID.' });
  }
  next();
});

// ─── ROUTES ───

const authRoutes = require('./routes/authRoutes');
const seatingRoutes = require('./routes/seatingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const checkinRoutes = require('./routes/checkinRoutes');
const eventRoutes = require('./routes/eventRoutes');
const rsvpRoutes = require('./routes/rsvpRoutes');
const publicRoutes = require('./routes/publicRoutes');
const tableRoutes = require('./routes/tableRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fieldRoutes = require('./routes/fieldRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const referralRoutes = require('./routes/referralRoutes');

// Mount public routes
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/payments', paymentRoutes); // paymentRoutes handles internal protection on endpoints (except webhook)

// Mount protected organizer routes
app.use('/api/v1/events/:eventId/seating', requireAuth, verifyEventOwner, seatingRoutes);
app.use('/api/v1/events/:eventId/notifications', requireAuth, verifyEventOwner, notificationRoutes);
app.use('/api/v1/events/:eventId/checkin', requireAuth, verifyEventOwner, checkinRoutes);
app.use('/api/v1/events/:eventId/rsvps', requireAuth, verifyEventOwner, rsvpRoutes);
app.use('/api/v1/events/:eventId/tables', requireAuth, verifyEventOwner, tableRoutes);
app.use('/api/v1/events/:eventId/campaigns', requireAuth, verifyEventOwner, campaignRoutes);
app.use('/api/v1/events/:eventId/invitations', requireAuth, verifyEventOwner, invitationRoutes);
app.use('/api/v1/events/:eventId/fields', requireAuth, verifyEventOwner, fieldRoutes);
app.use('/api/v1/events/:eventId/analytics', requireAuth, verifyEventOwner, analyticsRoutes);
app.use('/api/v1/dashboard', requireAuth, dashboardRoutes);
app.use('/api/v1/referrals', requireAuth, referralRoutes);
app.use('/api/v1/events', requireAuth, eventRoutes);

// Mount super admin control routes
app.use('/api/v1/admin', adminRoutes);

// OpenAPI Specification Route — gated behind auth in production
const serveOpenApiSpec = (req, res) => {
  res.sendFile(require('path').join(__dirname, 'docs', 'openapi.json'));
};

// Interactive API Docs Route (Swagger UI CDN)
const serveSwaggerDocs = (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Fancy RSVP API Documentation</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/api/v1/openapi.json',
            dom_id: '#swagger-ui',
            deepLinking: true
          });
        };
      </script>
    </body>
    </html>
  `);
};

if (process.env.NODE_ENV === 'production') {
  app.get('/api/v1/openapi.json', requireAuth, requireSuperAdmin, serveOpenApiSpec);
  app.get('/docs', requireAuth, requireSuperAdmin, serveSwaggerDocs);
} else {
  app.get('/api/v1/openapi.json', serveOpenApiSpec);
  app.get('/docs', serveSwaggerDocs);
}

// Health Check Endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    const { supabase } = require('./config/supabase');
    // Attempt to query the super_admin_config table
    const { error } = await supabase.from('super_admin_config').select('id').limit(1);
    
    let dbStatus = 'connected';
    let details = null;

    if (error) {
      // PGRST205 indicates the connection itself is alive but the table is missing (migration pending)
      if (error.code === 'PGRST205') {
        dbStatus = 'migration_pending';
        details = 'Database connection is healthy, but the super_admin_config table does not exist. Apply migrations.';
      } else {
        dbStatus = 'degraded';
        logger.warn({ err: error }, 'Health check: database degraded');
        details = 'Database is experiencing issues. Check server logs for details.';
      }
    }
    
    return res.status(200).json({
      status: 'healthy',
      database: dbStatus,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error({ err }, 'Health check: database disconnected');
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed. Check server logs for details.',
      timestamp: new Date().toISOString()
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Fancy RSVP API - Version 1.0.0 is live',
    documentation: '/docs'
  });
});

// 404 catch-all for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'The requested resource was not found.' });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  logger.error({ err, stack: err.stack, url: req.originalUrl, method: req.method }, 'Unhandled error');
  
  // L1: never leak internal error identifiers (err.code / err.name / stack) to
  // clients in production — they aid fingerprinting. The full error is already
  // logged above for cross-referencing. Detail is exposed only in development.
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred on the server.',
    ...(process.env.NODE_ENV === 'development' && { code: err.code || err.name || 'UNKNOWN', stack: err.stack })
  });
});

module.exports = app;
