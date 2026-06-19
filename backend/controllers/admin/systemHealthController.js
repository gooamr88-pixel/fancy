const { supabase } = require('../../config/supabase');

/**
 * System Health Center (Master Plan §20). Probes the dependencies the platform
 * relies on and reports per-service status + latency. Configuration presence is
 * used as a lightweight readiness signal for outbound providers (a deep probe
 * would consume quota / send traffic).
 */

async function probe(name, fn) {
  const start = Date.now();
  try {
    await fn();
    return { name, status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return { name, status: 'degraded', latencyMs: Date.now() - start, error: err.message };
  }
}

/** GET /api/v1/admin/health */
const getSystemHealth = async (req, res, next) => {
  try {
    const services = [];

    // Database — real round trip.
    services.push(await probe('database', async () => {
      const { error } = await supabase.from('super_admin_config').select('id').limit(1);
      if (error && error.code !== 'PGRST205') throw error;
    }));

    // Storage — list buckets (cheap, real).
    services.push(await probe('storage', async () => {
      const { error } = await supabase.storage.listBuckets();
      if (error) throw error;
    }));

    // Outbound providers — config-presence readiness (no traffic sent).
    const configured = (keys) => keys.every((k) => !!process.env[k]);
    services.push({ name: 'email', status: configured(['BREVO_API_KEY']) || configured(['SMTP_HOST']) ? 'configured' : 'unconfigured' });
    services.push({ name: 'sms', status: configured(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']) ? 'configured' : 'unconfigured' });
    services.push({ name: 'payments', status: configured(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) ? 'configured' : 'unconfigured' });

    const overall = services.some((s) => s.status === 'degraded') ? 'degraded' : 'healthy';

    return res.json({ success: true, health: { overall, services, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSystemHealth };
