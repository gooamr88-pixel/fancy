const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth, verifyEventOwner } = require('./middleware/auth');

const app = express();

// Enable security headers
app.use(helmet());

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
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
    return res.status(200).json({
      status: 'healthy',
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
    documentation: 'Contact system administrator for API documentation access.'
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred on the server.'
  });
});

module.exports = app;
