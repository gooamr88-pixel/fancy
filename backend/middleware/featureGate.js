/**
 * Zero-Trust Feature Gate Middleware.
 *
 * Enforces per-feature access based on the event's active pricing tier. Every
 * premium API endpoint is wrapped with `requireFeature('key')` — if the
 * organisation's tier lacks that feature key the request is immediately rejected
 * with a descriptive 403.
 *
 * Resolution order:
 *   1. Super admins bypass all gates (consistent with RBAC pattern).
 *   2. Event must exist (404 otherwise).
 *   3. Unpaid events get only FREE_TIER_FEATURES; everything else → 403.
 *   4. Paid events → look up tier definition from cached config → check if the
 *      requested feature key is in the tier's `features` array.
 *
 * Relies on:
 *   - `events.tier_name` (set at checkout fulfillment)
 *   - `super_admin_config.pricing_tiers[].features` (set by admin via config UI)
 *   - `configCache.getPlatformConfig()` (30 s TTL, no extra DB hit per request)
 */

const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getPlatformConfig } = require('../utils/configCache');
const { FREE_TIER_FEATURES, getFeatureByKey, isValidFeatureKey } = require('../config/featureRegistry');

/**
 * Primary feature-gate middleware factory.
 *
 * @param {string} featureKey  A key from the Feature Registry.
 * @returns Express middleware
 */
const requireFeature = (featureKey) => async (req, res, next) => {
  const { eventId } = req.params;

  // Super admins bypass all feature gates (mirrors requirePermission pattern).
  if (req.user?.isSuperAdmin) {
    return next();
  }

  try {
    // 1. Load event
    const { data: event, error } = await supabase
      .from('events')
      .select('id, is_paid, manual_override, status, tier_name')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.',
      });
    }

    // 2. Unpaid / free events — only FREE_TIER_FEATURES are allowed.
    if (!event.is_paid && !event.manual_override) {
      if (FREE_TIER_FEATURES.has(featureKey)) {
        req.event = event;
        req.tierFeatures = [...FREE_TIER_FEATURES];
        return next();
      }
      const feat = getFeatureByKey(featureKey);
      return res.status(403).json({
        success: false,
        error: 'FEATURE_REQUIRES_PAYMENT',
        feature: featureKey,
        featureLabel: feat?.label || featureKey,
        message: `This feature requires an active paid plan. Complete payment to unlock '${feat?.label || featureKey}'.`,
        upgrade_action: 'complete_payment',
      });
    }

    // 3. Paid / manually-overridden events — check the tier's feature list.
    let tierFeatures = [];

    if (event.tier_name) {
      try {
        const config = await getPlatformConfig();
        const tier = (config.pricing_tiers || []).find(
          (t) => (t.name || '').toLowerCase() === event.tier_name.toLowerCase(),
        );
        if (tier && Array.isArray(tier.features)) {
          tierFeatures = tier.features;
        }
        // If the tier is missing (renamed/deleted), tierFeatures stays empty
        // and we fall through to the "not in tier" check below. This is the
        // safe-fallback: a deleted tier grants NOTHING rather than everything.
      } catch (configErr) {
        logger.warn({ err: configErr, eventId, featureKey }, 'featureGate: config lookup failed — denying');
        return res.status(500).json({
          success: false,
          error: 'CONFIG_ERROR',
          message: 'Could not verify feature access. Please try again.',
        });
      }
    }

    // Check if the requested feature is in the tier's granted features.
    if (tierFeatures.includes(featureKey)) {
      req.event = event;
      req.tierFeatures = tierFeatures;
      return next();
    }

    // Feature not in tier → reject.
    const feat = getFeatureByKey(featureKey);
    return res.status(403).json({
      success: false,
      error: 'FEATURE_NOT_AVAILABLE',
      feature: featureKey,
      featureLabel: feat?.label || featureKey,
      message: `Your current plan${event.tier_name ? ` ('${event.tier_name}')` : ''} does not include '${feat?.label || featureKey}'. Upgrade to unlock this feature.`,
      currentTier: event.tier_name || null,
      upgrade_action: 'upgrade_plan',
    });
  } catch (err) {
    logger.error({ err, eventId, feature: featureKey }, 'featureGate: unexpected error');
    return next(err);
  }
};

/**
 * Passes if the tier includes ANY of the supplied feature keys.
 * Useful for endpoints shared across multiple feature areas.
 *
 * @param {...string} featureKeys
 * @returns Express middleware
 */
const requireAnyFeature = (...featureKeys) => async (req, res, next) => {
  const { eventId } = req.params;

  if (req.user?.isSuperAdmin) return next();

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, is_paid, manual_override, status, tier_name')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    // Unpaid — check if ANY requested feature is free-tier.
    if (!event.is_paid && !event.manual_override) {
      if (featureKeys.some((k) => FREE_TIER_FEATURES.has(k))) {
        req.event = event;
        return next();
      }
      return res.status(403).json({
        success: false,
        error: 'FEATURE_REQUIRES_PAYMENT',
        message: 'This feature requires an active paid plan.',
        upgrade_action: 'complete_payment',
      });
    }

    // Paid — resolve tier features.
    let tierFeatures = [];
    if (event.tier_name) {
      try {
        const config = await getPlatformConfig();
        const tier = (config.pricing_tiers || []).find(
          (t) => (t.name || '').toLowerCase() === event.tier_name.toLowerCase(),
        );
        if (tier && Array.isArray(tier.features)) tierFeatures = tier.features;
      } catch {
        return res.status(500).json({ success: false, error: 'CONFIG_ERROR', message: 'Could not verify feature access.' });
      }
    }

    if (featureKeys.some((k) => tierFeatures.includes(k))) {
      req.event = event;
      req.tierFeatures = tierFeatures;
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'FEATURE_NOT_AVAILABLE',
      message: `Your current plan does not include any of the required features. Upgrade to unlock them.`,
      currentTier: event.tier_name || null,
      upgrade_action: 'upgrade_plan',
    });
  } catch (err) {
    logger.error({ err, eventId }, 'featureGate(any): unexpected error');
    return next(err);
  }
};

// Backward-compat alias — existing route files import `requirePaidEvent`.
module.exports = { requireFeature, requirePaidEvent: requireFeature, requireAnyFeature };
