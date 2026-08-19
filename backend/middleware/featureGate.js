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
 *   - `events.tier_key` — the plan's STABLE identity (set at fulfillment).
 *     `tier_name` is display text an admin may edit at any moment and is only
 *     a legacy fallback for rows sold before keys existed.
 *   - `events.tier_features` — the purchase-time snapshot, used when the tier
 *     has been deleted outright, so a config edit cannot revoke a purchase.
 *   - `super_admin_config.pricing_tiers[].features` (set by admin via config UI)
 *   - `configCache.getPlatformConfig()` (30 s TTL, no extra DB hit per request)
 */

const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getPlatformConfig } = require('../utils/configCache');
const { FREE_TIER_FEATURES, getFeatureByKey, isValidFeatureKey } = require('../config/featureRegistry');
const { entitledFeatures, selectEventWithTier } = require('../utils/tierResolver');

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
    // selectEventWithTier, not a plain select: an unapplied tier-identity
    // migration would otherwise make this read fail and every paid feature on
    // the platform report EVENT_NOT_FOUND. See utils/tierResolver.js.
    const { data: event, error } = await selectEventWithTier(
      supabase, eventId, 'id, is_paid, manual_override, status');

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

    if (event.tier_key || event.tier_name) {
      try {
        const config = await getPlatformConfig();
        // Resolved by KEY, with the event's own purchase-time snapshot as the
        // fallback when the plan no longer exists.
        //
        // What used to be here looked the tier up by DISPLAY NAME and, on a
        // miss, left this empty — "a deleted tier grants NOTHING rather than
        // everything". Safe against a wildcard, catastrophic in the case that
        // actually happens: an admin renaming a plan revoked every paid
        // feature from every event that had bought it, instantly, and the 403
        // below then named a plan that no longer existed. Renaming is a
        // display-text edit; it must not be an entitlement event.
        const resolved = entitledFeatures(config.pricing_tiers, event);
        tierFeatures = resolved.features;

        if (resolved.source === 'snapshot') {
          // The plan is gone but the purchase stands. Loud, because it means
          // an admin deleted a tier that customers are still on.
          logger.warn({ eventId, featureKey, tierName: event.tier_name, tierKey: event.tier_key },
            'featureGate: tier no longer exists — honouring the purchase-time feature snapshot');
        }
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
    // selectEventWithTier, not a plain select: an unapplied tier-identity
    // migration would otherwise make this read fail and every paid feature on
    // the platform report EVENT_NOT_FOUND. See utils/tierResolver.js.
    const { data: event, error } = await selectEventWithTier(
      supabase, eventId, 'id, is_paid, manual_override, status');

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

    // Paid — resolve tier features. Same resolution as requireFeature above
    // (key, then legacy name, then the purchase-time snapshot); two different
    // answers to "does this plan include X" is how a surface ends up visible
    // and un-callable.
    let tierFeatures = [];
    if (event.tier_key || event.tier_name) {
      try {
        const config = await getPlatformConfig();
        tierFeatures = entitledFeatures(config.pricing_tiers, event).features;
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
