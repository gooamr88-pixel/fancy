const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { requireAuth, verifyEventOwner } = require('./middleware/auth');

// Startup environment validation — fail fast if critical secrets are missing
const REQUIRED_ENV = ['JWT_SECRET', 'QR_JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Enable security headers
app.use(helmet());

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  optionsSuccessStatus: 200
}));

// Capture raw body for Stripe Webhooks verification
app.use(express.json({
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

// OpenAPI Specification Route
app.get('/api/v1/openapi.json', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'docs', 'openapi.json'));
});

// Interactive API Docs Route (Swagger UI CDN)
app.get('/docs', (req, res) => {
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
});

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
        details = error.message;
      }
    }
    
    return res.status(200).json({
      status: 'healthy',
      database: dbStatus,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
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
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  logger.error({ err, stack: err.stack }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred on the server.'
  });
});

module.exports = app;
