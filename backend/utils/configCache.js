const { supabase } = require('../config/supabase');

/**
 * In-process cache for the singleton `super_admin_config` row.
 *
 * It was previously re-read from the DB on every checkout, SMS-credit purchase
 * and manual-payment initiation — a round-trip per payment op for data that
 * changes only when an admin edits pricing. A short TTL keeps it fresh within a
 * minute; updatePricingConfig calls invalidate() for immediate effect.
 * (Mirrors the cache pattern in services/rbacService.js.)
 */
const CONFIG_ID = '00000000-0000-0000-0000-000000000000';
const TTL_MS = 30 * 1000;

let cached = null; // { value, expires }

/**
 * Returns the platform config row, served from cache when warm.
 * @param {{ force?: boolean }} [opts] force a fresh read (bypass cache)
 * @throws if the underlying DB read errors (caller maps to CONFIG_ERROR)
 */
async function getPlatformConfig({ force = false } = {}) {
  if (!force && cached && cached.expires > Date.now()) return cached.value;

  const { data, error } = await supabase
    .from('super_admin_config')
    .select('*')
    .eq('id', CONFIG_ID)
    .single();

  if (error || !data) throw (error || new Error('super_admin_config row not found'));

  cached = { value: data, expires: Date.now() + TTL_MS, cachedAt: Date.now() };
  return data;
}

/** Drops the cached config so the next read reloads it (call after a pricing update). */
function invalidate() { cached = null; }

module.exports = { getPlatformConfig, invalidate, CONFIG_ID, TTL_MS };
