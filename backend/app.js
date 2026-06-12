const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { requireAuth, verifyEventOwner, requireSuperAdmin } = require('./middleware/auth');

// Startup environment validation — fail fast if critical secrets are missing
const REQUIRED_ENV = ['JWT_SECRET', 'QR_JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GOOGLE_CLIENT_ID'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Enable security headers
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}));


// Configure CORS with multi-origin support
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());
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

// Parse cookies (httpOnly auth cookie)
app.use(cookieParser());

// Capture raw body for Stripe Webhooks verification
app.use(express.json({
  limit: '5mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/v1/payments/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// Permissive Rate Limiter for organizer dashboards (preventing blockages on updates)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Strict rate limiter for authentication endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 minutes per IP
  message: {
    success: false,
    error: 'TOO_MANY_AUTH_REQUESTS',
    message: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);
app.use('/api/v1/auth/verify-registration', authLimiter);
app.use('/api/v1/auth/google-login', authLimiter);
app.use('/api/v1/auth/google-register', authLimiter);

// Rate limiter for public RSVP submissions
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 RSVP submissions per 15 minutes per IP
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many submissions. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/public/events', publicLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
    }, `${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
});

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
const adminRoutes = require('./routes/adminRoutes');
const fieldRoutes = require('./routes/fieldRoutes');

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
app.use('/api/v1/events/:eventId/fields', requireAuth, verifyEventOwner, fieldRoutes);
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
  
  // In production, include a sanitized error code so logs can be cross-referenced
  const errorCode = err.code || err.name || 'UNKNOWN';
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    code: errorCode,
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred on the server.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
