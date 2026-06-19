const { getTwilioClient, getTwilioFromNumber } = require('../utils/twilioClient');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Dispatches bulk SMS invitations to all pending guests.
 * Deducts credits atomically per message.
 * POST /api/v1/events/:eventId/campaigns/send-sms
 */
const sendBulkSMSCampaign = async (req, res, next) => {
  const { eventId } = req.params;
  const { messageTemplate } = req.body; // e.g. "Hey {name}, you are invited to our wedding! RSVP at {url}"

  if (!messageTemplate) {
    return res.status(400).json({ success: false, error: 'messageTemplate string is required.' });
  }

  if (messageTemplate.length > 1600) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Message template exceeds maximum length of 1600 characters' });
  }

  try {
    // Fetch event slug
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('slug')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'Event not found.' });
    }

    // 1. Fetch pending guest list with phones
    const { data: guests, error: guestError } = await supabase
      .from('rsvps')
      .select('id, guest_name, phone, email')
      .eq('event_id', eventId)
      .eq('response', 'pending')
      .not('phone', 'is', null);

    if (guestError) throw guestError;

    if (!guests || guests.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending guest records with valid phone numbers were found to invite.',
        sentCount: 0
      });
    }

    // 2. Fetch SMS credit wallet remaining balance (pre-check)
    const { data: wallet, error: walletError } = await supabase
      .from('sms_credit_wallets')
      .select('credits_remaining')
      .eq('event_id', eventId)
      .single();

    if (walletError || !wallet) {
      return res.status(402).json({
        success: false,
        error: 'NO_CREDIT_WALLET',
        message: 'No SMS credit wallet exists for this event. Purchase credits before launching campaign.'
      });
    }

    const availableCredits = wallet.credits_remaining;
    if (availableCredits < guests.length) {
      return res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Campaign requires ${guests.length} credits, but wallet only has ${availableCredits} remaining. Purchase more credits.`,
        requiredCredits: guests.length,
        availableCredits
      });
    }

    // 3. Send in concurrent batches (atomic deduction per message)
    const BATCH_SIZE = 15;
    const twilio = getTwilioClient();
    const sentMessages = [];
    const failedMessages = [];

    // Inline chunking helper — no external deps
    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // Processes a single guest; returns a result object for aggregation
    const processGuest = async (guest) => {
      // Personalize template. The `?g=<rsvpId>` contract matches the public RSVP
      // page reader ([slug]/rsvp/page.js) and the getGuestById resolver endpoint,
      // so the link pre-fills the guest's identity instead of leaving them anonymous.
      const guestUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/${event.slug}/rsvp?g=${guest.id}`;
      let personalizedBody = messageTemplate
        .replace(/{name}/g, guest.guest_name)
        .replace(/{url}/g, guestUrl);

      // Append branding suffix
      const branding = " — Fancy RSVP";
      if (!personalizedBody.endsWith(branding)) {
        personalizedBody = `${personalizedBody}${branding}`;
      }

      try {
        // Deduct credit atomically first
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_sms_credit_atomic', {
          p_event_id: eventId,
          p_phone: guest.phone
        });

        if (deductError || !deductResult || !deductResult.success) {
          return {
            ok: false,
            guestId: guest.id,
            guestName: guest.guest_name,
            error: deductResult?.error || 'INSUFFICIENT_CREDITS'
          };
        }

        const { wallet_id, ledger_id } = deductResult;

        if (!twilio) {
          // Mock send in local development if twilio is missing
          logger.info(`[MOCK BULK SMS] To: ${guest.phone} | Content: ${personalizedBody}`);

          const mockSid = `mock-sid-${Date.now()}-${guest.id}`;
          await supabase
            .from('sms_credit_ledger')
            .update({ sms_sid: mockSid })
            .eq('id', ledger_id);

          return { ok: true, guestId: guest.id, guestName: guest.guest_name, status: 'mock_sent' };
        }

        try {
          const msg = await twilio.messages.create({
            body: personalizedBody,
            from: getTwilioFromNumber(),
            to: guest.phone
          });

          // Update ledger with real sid
          await supabase
            .from('sms_credit_ledger')
            .update({ sms_sid: msg.sid })
            .eq('id', ledger_id);

          return { ok: true, guestId: guest.id, guestName: guest.guest_name, sid: msg.sid };
        } catch (smsErr) {
          // Refund on transmission failure
          logger.error(`Failed to send SMS to ${guest.guest_name}, initiating refund: ${smsErr.message}`);
          await supabase.rpc('refund_sms_credit_atomic', {
            p_wallet_id: wallet_id,
            p_event_id: eventId,
            p_ledger_id: ledger_id
          });
          return { ok: false, guestId: guest.id, guestName: guest.guest_name, error: smsErr.message };
        }
      } catch (err) {
        logger.error(`Deduction operation failed for ${guest.guest_name}: ${err.message}`);
        return { ok: false, guestId: guest.id, guestName: guest.guest_name, error: err.message };
      }
    };

    // Process all guests in batches of BATCH_SIZE
    const batches = chunkArray(guests, BATCH_SIZE);
    for (const batch of batches) {
      const results = await Promise.allSettled(batch.map(processGuest));

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const val = result.value;
          if (val.ok) {
            sentMessages.push({ guestId: val.guestId, guestName: val.guestName, ...(val.sid ? { sid: val.sid } : { status: val.status }) });
          } else {
            failedMessages.push({ guestId: val.guestId, guestName: val.guestName, error: val.error });
          }
        } else {
          // Unexpected rejection — should not normally occur
          logger.error(`Unexpected batch rejection: ${result.reason}`);
          failedMessages.push({ guestId: 'unknown', guestName: 'unknown', error: String(result.reason) });
        }
      }
    }

    // Insert audit log
    await supabase.from('activity_logs').insert({
      event_id: eventId,
      action: 'sms_campaign_sent',
      entity_type: 'campaign',
      metadata: {
        total_recipients: guests.length,
        sent_successfully: sentMessages.length,
        failed_count: failedMessages.length
      }
    });

    return res.status(200).json({
      success: true,
      message: `Campaign executed. Sent: ${sentMessages.length}, Failed: ${failedMessages.length}.`,
      sentCount: sentMessages.length,
      failedCount: failedMessages.length,
      sentMessages,
      failedMessages
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch campaign logs and SMS credit transactions.
 * GET /api/v1/events/:eventId/campaigns/history
 */
const getCampaignHistory = async (req, res, next) => {
  const { eventId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: wallet } = await supabase
      .from('sms_credit_wallets')
      .select('*')
      .eq('event_id', eventId)
      .single();

    const { data: config } = await supabase
      .from('super_admin_config')
      .select('sms_rate_cents_per_credit')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    const { data: ledger, error, count: totalCount } = await supabase
      .from('sms_credit_ledger')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return res.json({
      success: true,
      wallet: wallet || { credits_purchased: 0, credits_used: 0, credits_remaining: 0 },
      history: ledger || [],
      smsRateCents: config?.sms_rate_cents_per_credit || 8,
      pagination: { page, limit, count: (ledger || []).length, total: totalCount }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendBulkSMSCampaign,
  getCampaignHistory
};
