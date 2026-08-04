/**
 * SMS ADD-ON GATE.
 *
 * Replaces `requireFeature('sms_campaigns')` as the authorization for every SMS
 * capability, and does so for two distinct reasons.
 *
 * ── 1. It closes a real bypass ──
 * The tier gate was mounted on /events/:id/campaigns but NOT on
 * /events/:id/invitations, whose `channel: 'sms'` branch forwards straight to the
 * same campaign dispatcher (invitationController.sendInvitations). An organizer on
 * a tier without SMS could therefore launch a full campaign through the
 * invitations endpoint. Because this middleware is the single answer to "may this
 * event send SMS at all", mounting it on both routes makes that class of gap
 * structural rather than a thing to remember.
 *
 * ── 2. Paying for SMS is no longer a property of the plan ──
 * SMS is an add-on bought at event checkout, available on ANY tier. Tying it to
 * the tier meant a customer who wanted only SMS had to buy a plan for it, while a
 * customer on the right plan could still have no allowance. `sms_addon_purchased_at`
 * is the honest question: did this event pay for SMS?
 *
 * The allowance BALANCE is deliberately not checked here. Running out mid-event is
 * a per-message condition handled at dispatch (where the automated types fall back
 * to email), not a reason to 403 the whole surface — an organizer with an empty
 * wallet must still reach the page that lets them top it up.
 */

const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

const requireSmsAddon = async (req, res, next) => {
  const { eventId } = req.params;

  // Super admins bypass, mirroring requireFeature and the RBAC middleware.
  if (req.user?.isSuperAdmin) return next();

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, is_paid, manual_override, status, tier_name, sms_addon_purchased_at, sms_settings')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.',
      });
    }

    // manual_override is how support comps an event; it has always implied full
    // access, and silently excluding SMS from it would make comped events behave
    // differently from the paid ones they are meant to imitate.
    if (!event.sms_addon_purchased_at && !event.manual_override) {
      return res.status(402).json({
        success: false,
        error: 'SMS_ADDON_REQUIRED',
        message: 'Text messaging is not enabled for this event. Add SMS messaging to unlock invitations, reminders, entry-pass links and campaigns by text.',
        upgrade_action: 'purchase_sms_addon',
      });
    }

    req.event = event;
    return next();
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
    // How many this request is actually asking to send. An explicit recipient
    // list is exact; an audience segment is not knowable here without running the
    // audience query, so those are checked against the cap inside the controller
    // once the recipient count is known (see sendBulkSMSCampaign).
    const guestIds = req.body?.guestIds;
    const requested = Array.isArray(guestIds) ? guestIds.length : null;
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

module.exports = { requireSmsAddon, requireSendLimit };
