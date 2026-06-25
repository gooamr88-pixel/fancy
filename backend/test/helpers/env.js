/**
 * Shared test env bootstrap. Several modules (config/supabase, utils/qrHelper)
 * validate required secrets at require-time and throw if absent. Requiring this
 * file FIRST in a test sets harmless dummy values so those modules can load
 * without a live Supabase/Stripe environment. No network calls are made unless a
 * Supabase query is actually executed (the tests here only exercise pure logic).
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.QR_JWT_SECRET = process.env.QR_JWT_SECRET || 'test-qr-jwt-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
// Existing payment/SMS tests exercise the LIVE (enabled) code paths, so turn the
// feature flags on here. Production defaults remain OFF (see config/features.js).
process.env.PAYMENTS_STRIPE_ENABLED = process.env.PAYMENTS_STRIPE_ENABLED || 'true';
process.env.SMS_ENABLED = process.env.SMS_ENABLED || 'true';
