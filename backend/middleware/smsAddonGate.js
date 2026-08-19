/**
 * SMS ACCESS GATE — the single answer to "may this event send text messages?"
 *
 * ── It closes a real bypass ──
 * The old tier gate was mounted on /events/:id/campaigns but NOT on
 * /events/:id/invitations, whose `channel: 'sms'` branch forwards straight to the
 * same dispatcher. An organizer without SMS could therefore send through the
 * invitations endpoint. Because this middleware is the ONE answer to the
 * question, mounting it on both routes makes that class of gap structural rather
 * than a thing to remember.
 *
 * ── TWO QUESTIONS, BOTH ASKED, IN THIS ORDER ──
 *
 *   1. MAY this plan text at all?  → the `sms_campaigns` tier feature, switched
 *      on per plan in Admin -> Config -> Subscription Tiers.
 *   2. HAS this event paid for messages? → events.sms_addon_purchased_at.
 *
 * They are genuinely different and neither implies the other, which is why this
 * file previously could not express what the product needed. It briefly asked
 * only (2) — on the reasoning that any plan could buy the add-on — and that made
 * texting un-gateable: there was no way to sell it as part of a plan tier, and
 * nothing for an admin to switch. Before that it asked only (1), and a customer
 * on the right plan could still have no allowance.
 *
 * The failures are deliberately DIFFERENT, because the fix is different:
 *   • no tier feature → 403 FEATURE_NOT_AVAILABLE   ("upgrade your plan")
 *   • tier ok, unpaid → 402 SMS_ADDON_REQUIRED      ("buy messages")
 * Collapsing them would send an organizer to a purchase screen they are not
 * allowed to use, or to an upgrade page when their plan was never the problem.
 *
 * ── GRANDFATHERING, and why it comes first ──
 *
 * An event that has ALREADY bought credits keeps sending, even if its tier later
 * loses the feature. Money changed hands for messages that are sitting in a
 * wallet; revoking access would strand a paid balance mid-event, and an admin
 * re-organising plan contents must not be able to do that by accident. So the
 * purchase is checked BEFORE the tier, not after.
 *
 * The allowance BALANCE is deliberately not checked here. Running out mid-event is
 * a per-message condition handled at dispatch (where the automated types fall back
 * to email), not a reason to 403 the whole surface — an organizer with an empty
 * wallet must still reach the page that lets them top it up.
 */

const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getPlatformConfig } = require('../utils/configCache');
const { getFeatureByKey } = require('../config/featureRegistry');
const { entitledFeatures, selectEventWithTier } = require('../utils/tierResolver');

/** The registry key an admin toggles per tier to sell texting with a plan. */
const SMS_FEATURE_KEY = 'sms_campaigns';

/**
 * Does this event's plan include texting?
 *
 * Mirrors featureGate.requireFeature's resolution exactly — and now literally,
 * through the shared resolver — because two different answers to "does this
 * plan include X" is how a surface ends up visible and un-callable.
 *
 * A RENAMED tier keeps granting what it granted: identity is `tier_key`, not
 * the display name. A DELETED tier falls back to the event's purchase-time
 * feature snapshot. Neither is a wildcard — an event that never had the
 * feature still does not get it.
 */
async function tierGrantsSms(event) {
  if (!event.tier_key && !event.tier_name) return false;
  const config = await getPlatformConfig();
  return entitledFeatures(config.pricing_tiers, event).features.includes(SMS_FEATURE_KEY);
}

const requireSmsAddon = async (req, res, next) => {
  const { eventId } = req.params;

  // Super admins bypass, mirroring requireFeature and the RBAC middleware.
  if (req.user?.isSuperAdmin) return next();

  try {
    const { data: event, error } = await selectEventWithTier(
      supabase, eventId, 'id, is_paid, manual_override, status, sms_addon_purchased_at, sms_settings');

    if (error || !event) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.',
      });
    }

    // ① Already paid for messages → in, whatever the tier says now. See the
    //    grandfathering note above. manual_override is how support comps an
    //    event and has always implied full access.
    if (event.sms_addon_purchased_at || event.manual_override) {
      req.event = event;
      return next();
    }

    // ② Otherwise the plan has to include texting before anything else is
    //    offered — including the purchase screen.
    let planHasSms = false;
    try {
      planHasSms = await tierGrantsSms(event);
    } catch (configErr) {
      // Fail CLOSED, same as featureGate: an unverifiable entitlement must not
      // permit sending, because the alternative is billing an organizer whose
      // access we could not confirm.
      logger.error({ err: configErr, eventId }, 'smsAddonGate: tier lookup failed — denying');
      return res.status(500).json({
        success: false,
        error: 'CONFIG_ERROR',
        message: 'Could not verify text messaging access. Please try again.',
      });
    }

    if (!planHasSms) {
      const feat = getFeatureByKey(SMS_FEATURE_KEY);
      return res.status(403).json({
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        feature: SMS_FEATURE_KEY,
        featureLabel: feat?.label || 'Text messaging',
        message: `Your current plan${event.tier_name ? ` ('${event.tier_name}')` : ''} does not include text messaging. Upgrade your plan to send invitations and reminders by SMS.`,
        currentTier: event.tier_name || null,
        upgrade_action: 'upgrade_plan',
      });
    }

    // ③ Plan allows it, this event just has not bought an allowance yet.
    return res.status(402).json({
      success: false,
      error: 'SMS_ADDON_REQUIRED',
      message: 'Text messaging is not enabled for this event. Add SMS messaging to unlock invitations, reminders, entry-pass links and campaigns by text.',
      upgrade_action: 'purchase_sms_addon',
    });
  } catch (err) {
    // Fail CLOSED. An unverifiable add-on state must not permit sending: the
    // alternative is billing an organizer whose entitlement we could not confirm.
    logger.error({ err, eventId }, 'smsAddonGate: lookup failed — denying');
    return res.status(500).json({
      success: false,
      error: 'SMS_ADDON_CHECK_FAILED',
      message: 'Could not verify SMS access. Please try again.',
    });
  }
};

/**
 * Cap how many messages ONE request may send, based on how many the organization
 * has delivered in its lifetime.
 *
 * The problem this solves: without it, the first thing a fraudulent signup can do
 * is buy a bundle and blast every message in it in a single request. There is no
 * ramp, no friction, and by the time anyone notices, the messages are delivered
 * and the carrier reputation damage is done — damage that lands on the shared
 * toll-free number and therefore on every legitimate customer at once.
 *
 * Why lifetime DELIVERED volume rather than account age or payment history:
 *   • age punishes the organizer whose wedding is next week, while a patient
 *     abuser simply waits out the window;
 *   • payment history caps every first-time paying customer on the one event
 *     they most need it for.
 * Delivered volume is the only signal that rises through genuine use and stays
 * flat for a throwaway account. A real organizer's limit lifts itself.
 *
 * Deliberately NOT a hard wall: it caps the size of a single send, never the
 * total. An organizer capped at 50 can send to 300 guests in six goes, and the
 * response says so. The cap is friction for a bot and an inconvenience for a
 * human — never a dead end. Every band is admin-editable, and the top band is
 * unlimited.
 *
 * Runs AFTER requireSmsAddon, so req.event is already loaded.
 */
const requireSendLimit = async (req, res, next) => {
  if (req.user?.isSuperAdmin) return next();

  const { eventId } = req.params;

  try {
    // How many this request is actually asking to send.
    //
    // BOTH key names are read, and that is not defensive habit — it is a bug this
    // middleware actually had. It only ever looked at `guestIds`, which was the
    // campaign blaster's field name. When the four-type rebuild replaced that
    // route with POST /invitations carrying `partyIds`, this check quietly fell
    // through to `return next()` on the only bulk send path left in the platform:
    // still mounted, still passing, enforcing nothing.
    //
    // A cap that silently stops capping is worse than no cap, because the route
    // still looks guarded. `partyIds` is the current name; `guestIds` is kept so
    // any caller still using it is bounded rather than exempt.
    const list = Array.isArray(req.body?.partyIds) ? req.body.partyIds
      : (Array.isArray(req.body?.guestIds) ? req.body.guestIds : null);
    const requested = list ? list.length : null;
    if (requested === null) return next();

    const [{ data: event }, config] = await Promise.all([
      supabase.from('events').select('org_id').eq('id', eventId).single(),
      require('../utils/configCache').getPlatformConfig().catch(() => null),
    ]);

    const { normalizeSmsPricing, maxPerSendFor } = require('../config/smsPricing');
    const pricing = normalizeSmsPricing(config?.sms_pricing_config);

    let delivered = 0;
    if (event?.org_id) {
      const { data: org } = await supabase
        .from('organizations').select('sms_delivered_total').eq('id', event.org_id).maybeSingle();
      delivered = Number(org?.sms_delivered_total) || 0;
    }

    const maxPerSend = maxPerSendFor(delivered, pricing.limits.ramp_up);
    if (maxPerSend === 0 || requested <= maxPerSend) {
      req.smsSendLimit = { maxPerSend, delivered };
      return next();
    }

    return res.status(429).json({
      success: false,
      error: 'SEND_LIMIT_EXCEEDED',
      maxPerSend,
      requested,
      // Written for the organizer, not for a log. It has to be obvious that this
      // is temporary, that nothing is lost, and what to do right now.
      message: `You can send up to ${maxPerSend} messages at a time while your account is new. Send this group in smaller batches — the limit lifts automatically as you send more.`,
    });
  } catch (err) {
    // Fail OPEN. This is abuse friction, not an entitlement check: the add-on
    // gate and the per-guest consent gate have already run and both fail closed.
    // Blocking a paying organizer's send because a counter lookup blipped would
    // cost more than the abuse it prevents.
    logger.warn({ err, eventId }, 'smsSendLimit: check failed — allowing the send');
    return next();
  }
};

module.exports = { requireSmsAddon, requireSendLimit, tierGrantsSms, SMS_FEATURE_KEY };
