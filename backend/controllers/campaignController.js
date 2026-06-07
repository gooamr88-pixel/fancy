const twilio = require('twilio');
const { supabase } = require('../config/supabase');

// Initialize Twilio client
let twilioClient;
const getTwilioClient = () => {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
      twilioClient = twilio(sid, token);
    }
  }
  return twilioClient;
};

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

  try {
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

    // 3. Loop and send (atomic deduction)
    const twilio = getTwilioClient();
    const sentMessages = [];
    const failedMessages = [];

    for (const guest of guests) {
      // Personalize template
      const guestUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/events/rsvp/${guest.id}`;
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
          failedMessages.push({
            guestId: guest.id,
            guestName: guest.guest_name,
            error: deductResult?.error || 'INSUFFICIENT_CREDITS'
          });
          continue;
        }

        const { wallet_id, ledger_id } = deductResult;

        if (!twilio) {
          // Mock send in local development if twilio is missing
          console.log(`[MOCK BULK SMS] To: ${guest.phone} | Content: ${personalizedBody}`);
          
          const mockSid = `mock-sid-${Date.now()}-${guest.id}`;
          await supabase
            .from('sms_credit_ledger')
            .update({ sms_sid: mockSid })
            .eq('id', ledger_id);

          sentMessages.push({ guestId: guest.id, guestName: guest.guest_name, status: 'mock_sent' });
          continue;
        }

        try {
          const msg = await twilio.messages.create({
            body: personalizedBody,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: guest.phone
          });

          // Update ledger with real sid
          await supabase
            .from('sms_credit_ledger')
            .update({ sms_sid: msg.sid })
            .eq('id', ledger_id);

          sentMessages.push({ guestId: guest.id, guestName: guest.guest_name, sid: msg.sid });
        } catch (smsErr) {
          // Refund on transmission failure
          console.error(`Failed to send SMS to ${guest.guest_name}, initiating refund:`, smsErr.message);
          await supabase.rpc('refund_sms_credit_atomic', {
            p_wallet_id: wallet_id,
            p_event_id: eventId,
            p_ledger_id: ledger_id
          });
          failedMessages.push({ guestId: guest.id, guestName: guest.guest_name, error: smsErr.message });
        }
      } catch (err) {
        console.error(`Deduction operation failed for ${guest.guest_name}:`, err.message);
        failedMessages.push({ guestId: guest.id, guestName: guest.guest_name, error: err.message });
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

  try {
    const { data: wallet } = await supabase
      .from('sms_credit_wallets')
      .select('*')
      .eq('event_id', eventId)
      .single();

    const { data: ledger, error } = await supabase
      .from('sms_credit_ledger')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      wallet: wallet || { credits_purchased: 0, credits_used: 0, credits_remaining: 0 },
      history: ledger || []
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendBulkSMSCampaign,
  getCampaignHistory
};
