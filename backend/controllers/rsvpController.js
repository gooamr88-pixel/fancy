const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const notificationService = require('../utils/notificationService');
const guestService = require('../services/guestService');
const tokenService = require('../services/tokenService');
const invitationService = require('../services/invitationService');
const { parseCSV, generateCSV } = require('../utils/csvHelper');
const { escapeHtml, getDeclineConfirmationTemplate, getNewRsvpOrganizerTemplate, getRsvpClaimTemplate, buildTicketLinks } = require('../utils/emailTemplates');
const { sendTransactionalSms } = require('../services/smsDispatch');
const { getPublicBaseUrl } = require('../utils/publicUrl');
const { isEventLiveForGuests } = require('../utils/eventAccess');
const { normalizeToE164 } = require('../utils/phone');
const { normalizeEmail, escapeLikePattern } = require('../utils/normalize');
const { SMS_CONSENT_TEXT_VERSION, CONSENT_METHOD_GUEST, normalizeConsentSource, logSmsConsentDecision } = require('../utils/smsConsent');
const { broadcast } = require('../utils/realtime');
const { sendOk, sendFail, sendRpcFailure } = require('../utils/responseEnvelope');

/**
 * True if `err` is a raised (not returned-as-jsonb) GUEST_LIMIT_REACHED
 * failure — currently only possible from submit_rsvp_v2's unique_violation
 * exception paths surfacing a P0001; most guest-cap checks (add_guest_to_party,
 * update_party_response) return `{ success: false, code/error: 'GUEST_LIMIT_REACHED' }`
 * as normal jsonb instead, handled via sendRpcFailure/result.success checks.
 */
const isGuestLimitError = (err) => err?.code === 'P0001' && /GUEST_LIMIT_REACHED/.test(err.message || '');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes a CSV/XLSX "side" cell to 'partner1'/'partner2', accepting the
 * friendly wedding synonyms organizers are more likely to type than the
 * neutral storage values. Anything else (including blank) is dropped.
 */
const normalizeSideCsvValue = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (['partner1', 'side1', 'groom', 'groom\'s side', 'groom side'].includes(v)) return 'partner1';
  if (['partner2', 'side2', 'bride', 'bride\'s side', 'bride side'].includes(v)) return 'partner2';
  return null;
};

/**
 * Handles guest RSVP form submissions (insert or update).
 * All gating/validation/dedup/child-row writes happen atomically inside the
 * submit_rsvp_v2() RPC (see GuestService) — this handler only validates cheap
 * shape constraints up front, then fires the best-effort notification fanout
 * (confirmation/decline email, organizer notify, realtime broadcast).
 * POST /api/v1/public/events/:slug/rsvp
 */
const submitPublicRSVP = async (req, res, next) => {
  const { slug } = req.params;
  const { partyId, guestName, email, phone, response, partySize, notes, additionalGuests, primaryGuestMeal, primaryGuestDietaryNotes, customAnswers, decline_reason, maybe_confirm_by, side, smsConsent } = req.body;
  // The guest RSVP'd in a language they chose on the page — answer them in it.
  // Nothing is stored: this only styles the immediate confirmation/decline mail.
  const guestLang = String(req.body?.lang || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';

  if (!guestName || !response) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'guestName and response are required.' });
  }

  const isAttending = response === 'yes';

  // Phone is OPTIONAL for everyone, attending or not (Twilio TFV 30475).
  //
  // It used to be mandatory for attendees. That made the mobile number — the
  // identifier the SMS program runs on — a precondition of registering for the
  // event, with the SMS consent checkbox rendered in the same block. Even with
  // the checkbox itself optional, a guest had no way to complete an RSVP while
  // staying entirely outside the messaging program, which entangles consent with
  // event registration. Twilio's requirement is that agreeing to receive
  // messages be optional, and that is only true if declining to participate at
  // all — by withholding the number — still lets the guest attend.
  //
  // Nothing operational depended on it: email is required for attendees and is
  // the channel that actually carries confirmations, tickets, and logistics.
  // Whenever a number IS volunteered it must still be valid E.164.
  const hasPhone = phone && String(phone).trim();
  let normalizedPhone = null;
  if (hasPhone) {
    normalizedPhone = normalizeToE164(phone);
    if (!normalizedPhone) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).' });
    }
  }

  // TCPA / Twilio Toll-Free Verification: SMS consent is INDEPENDENT of the
  // RSVP itself. This endpoint used to reject a phone number submitted without
  // consent, which — since a phone is mandatory for attendees — made opting in
  // to SMS a precondition of attending. Bundled consent of exactly that shape
  // is what TFV review rejects.
  //
  // The submission is now accepted either way and `smsConsent` is persisted as
  // given (submit_rsvp_v2 stamps sms_consent_at on every write, so an explicit
  // `false` is itself a dated record of refusal). A phone number submitted
  // without consent is stored for the host's guest list and nothing more — it is
  // never treated as consent. Consent is enforced where it actually matters, at
  // send time: smsDispatch.fetchRecipients requires sms_consent = true, and
  // sendRecipient re-verifies it per message.

  // Email is required for attendees (confirmation + logistics), optional for a
  // decline; when present it must be valid either way.
  if (isAttending && (!email || !String(email).trim())) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'An email address is required.' });
  }
  if (email && String(email).trim() && !EMAIL_RE.test(String(email).trim())) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid email address.' });
  }

  if (side !== undefined && side !== null && side !== '' && !['partner1', 'partner2'].includes(side)) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'side must be partner1 or partner2.' });
  }

  if (Array.isArray(additionalGuests) && additionalGuests.length > guestService.MAX_ADDITIONAL_GUESTS) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Too many additional guests submitted.' });
  }
  if (Array.isArray(customAnswers) && customAnswers.length > guestService.MAX_CUSTOM_ANSWERS) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Too many custom answers submitted.' });
  }

  // Defense in depth: the frontend only shows an "Update my response" action
  // when the event's allow_guest_edits is on (useRsvpResolver.js) — nothing
  // stops a direct API call otherwise. Reject an edit to an already-answered
  // party server-side too, regardless of whether submit_rsvp_v2 also checks
  // this internally. A first-time response (party.response still 'pending',
  // or no partyId at all) is never blocked by this.
  if (partyId) {
    const { data: existingParty } = await supabase
      .from('rsvp_parties')
      .select('response, events(slug, allow_guest_edits, rsvp_deadline)')
      .eq('id', partyId)
      .maybeSingle();

    const ev = existingParty?.events;
    // Only an EDIT to an already-answered party is gated here — a first-time
    // response (still 'pending', or no partyId) is never blocked by this.
    const editingAnswered = ev?.slug === slug && ['yes', 'no', 'maybe'].includes(existingParty.response);

    if (editingAnswered && !ev?.allow_guest_edits) {
      return sendFail(res, {
        status: 403,
        error: 'RESPONSE_EDITS_DISABLED',
        message: 'The organizer has disabled changes to RSVPs after submission. Please contact them directly to update your response.',
      });
    }
    // Even when edits are allowed, they close at the RSVP deadline — matching the
    // organizer-facing promise ("guests can update their RSVP ... until the RSVP
    // deadline"). Enforced server-side so a direct API call can't slip past it.
    if (editingAnswered && ev?.allow_guest_edits && ev?.rsvp_deadline && new Date() > new Date(ev.rsvp_deadline)) {
      return sendFail(res, {
        status: 403,
        error: 'RESPONSE_EDITS_CLOSED',
        message: 'The deadline to change your RSVP has passed. Please contact the host to make any changes.',
      });
    }
  }

  if (response === 'yes') {
    const size = partySize || 1;
    if (size > 1) {
      if (!Array.isArray(additionalGuests) || additionalGuests.length < size - 1) {
        return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `Please provide details for all ${size - 1} additional guests.` });
      }
      // A companion is a NAME. Contact details, meal and dietary notes belong to
      // the person who opened the invitation and is filling this in; anyone they
      // bring is recorded so the organizer can seat, count and check them in.
      // Requiring an email per companion is what forced households sharing one
      // inbox into idx_guests_event_email_unique, which submit_rsvp_v2 used to
      // "resolve" by silently discarding the address.
      for (let idx = 0; idx < size - 1; idx++) {
        const g = additionalGuests[idx];
        if (!g || !g.fullName || !g.fullName.trim()) {
          return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `Guest #${idx + 2} must have a valid full name.` });
        }
      }
    }
  }

  // Reduced to the one field a companion has. Anything else a caller sends —
  // an old client still posting email/phone/meal, or a hand-rolled request — is
  // dropped here rather than rejected: the submission is valid, the extra keys
  // simply have nowhere to go now, and failing an otherwise-good RSVP over them
  // would be hostile.
  const sanitizedAdditional = Array.isArray(additionalGuests)
    ? additionalGuests
        .filter((g) => g && typeof g.fullName === 'string' && g.fullName.trim())
        .map((g) => ({ fullName: g.fullName.trim() }))
    : [];

  try {
    const result = await guestService.submitPublicRsvp({
      slug, partyId, guestName, email, phone: normalizedPhone, response,
      partySize: partySize || 1, notes, primaryMeal: primaryGuestMeal,
      dietaryNotes: primaryGuestDietaryNotes || null,
      additionalGuests: sanitizedAdditional,
      customAnswers: Array.isArray(customAnswers) ? customAnswers : [],
      declineReason: decline_reason, maybeConfirmBy: maybe_confirm_by,
      side: side || null,
      smsConsent: !!smsConsent,
      // Companion meals arrive as a tally for the group, not a choice per
      // person — see the migration's header. Validated inside the RPC against
      // the event's own meal options.
      companionMealCounts: req.body?.companionMealCounts || null,
    });

    if (!result || result.success === false) {
      return sendRpcFailure(res, result);
    }

    const eventId = result.event_id;
    const computedPartySize = result.party_size;

    // Consent provenance (Privacy Policy §3 record-keeping): stamp which
    // canonical consent-text version the guest was shown and which surface
    // captured the decision. Best-effort second write — never blocks or fails
    // the RSVP; sms_consent + sms_consent_at were already persisted atomically
    // by the RPC.
    //
    // Written for a REFUSAL as well as an opt-in (it used to require
    // `smsConsent`): now that the checkbox is optional, an unticked box is a
    // dated, deliberate decline that smsDispatch enforces as an exclusion, so
    // the record needs to show which wording was declined and where. The
    // condition stays keyed on `normalizedPhone` because a guest who gave no
    // number was never shown the checkbox at all.
    if (normalizedPhone && result.party_id) {
      const consentSource = normalizeConsentSource(req.body?.consentSource);
      supabase
        .from('rsvp_parties')
        .update({
          sms_consent_text_version: SMS_CONSENT_TEXT_VERSION,
          sms_consent_source: consentSource,
          // The guest has now decided for themselves, so the provenance must say
          // so. submit_rsvp_v2 writes sms_consent/sms_consent_at but has no
          // knowledge of the method columns (they arrived in a later migration),
          // which left a party that was previously host-attested still labelled
          // `host_attested` — with a stale attester and date — even after its
          // guest personally ticked or untucked the box. The dashboard badge read
          // "you confirmed" for a decision the guest made, and the party row
          // contradicted the append-only log written just below.
          sms_consent_method: CONSENT_METHOD_GUEST,
          sms_consent_attested_by: null,
          sms_consent_attested_at: null,
        })
        .eq('id', result.party_id)
        .then(
          ({ error }) => {
            if (error) logger.warn({ err: error, partyId: result.party_id }, 'sms consent provenance write failed (apply 20260809000000_sms_compliance.sql)');
          },
          // A rejected promise here (e.g. a network-layer throw) must never
          // become an unhandled rejection in the hot RSVP path.
          (err) => logger.warn({ err, partyId: result.party_id }, 'sms consent provenance write rejected'),
        );

      // Append-only consent log (Twilio TFV 30475). The columns above are
      // current state on a mutable row; this is the dated, immutable record of
      // the decision itself, with the phone number as it stood at capture time.
      // Logged for a REFUSAL as well as an opt-in — a dated decline is evidence
      // that consent was asked separately and freely declined. Fire-and-forget:
      // consent has already been persisted atomically by the RPC, so this must
      // never block or fail the guest's RSVP.
      logSmsConsentDecision({
        eventId,
        partyId: result.party_id,
        phone: normalizedPhone,
        consent: !!smsConsent,
        source: consentSource,
      });
    }

    broadcast(eventId, 'rsvp_submitted', {
      partyId: result.party_id, guestName, response: result.response, partySize: computedPartySize,
    });

    // Confirmation / decline email (best-effort). A 'maybe' is acknowledged
    // too — it used to fall through both branches and receive nothing at all,
    // which reads to the guest as "my response was never recorded".
    if (result.response === 'yes' || result.response === 'maybe') {
      if (result.guest_email) {
        notificationService.sendConfirmationEmail(eventId, result.party_id, guestLang)
          .catch((err) => logger.error({ err }, 'Confirmation email error'));
      } else {
        logger.warn({ partyId: result.party_id, eventId, response: result.response },
          'RSVP recorded without a guest email — confirmation email skipped');
      }
      // Companions are no longer mailed: they have no address of their own any
      // more. The one confirmation above goes to the person who filled the form
      // in, and it carries the entry pass for the whole party — the QR reads
      // "Admits N" and the door scanner checks in every member on one scan
      // (checkinController.scanCheckIn). notificationService still exports
      // sendCompanionConfirmationEmail; nothing calls it.
    } else if (result.response === 'no' && !result.guest_email) {
      logger.warn({ partyId: result.party_id, eventId }, 'Decline recorded without a guest email — thank-you email skipped');
    } else if (result.response === 'no') {
      // The decline acknowledgement is the one type whose SMS REPLACES its email
      // (smsMessageTypes.replacesEmail), so the text is attempted first and the
      // mail only goes if it did not. Two messages telling someone "thanks for
      // not coming" is the definition of noise.
      const declineSms = await sendTransactionalSms({
        type: 'decline_ack',
        eventId,
        partyId: result.party_id,
        ref: `rsvp:${result.party_id}`,
        lang: guestLang,
        context: { guestName, eventTitle: result.event_title },
      });

      if (!declineSms.sent) {
        const declineHtml = getDeclineConfirmationTemplate(
          { guest_name: guestName },
          { title: result.event_title, event_date: result.event_date, slug: result.event_slug },
          guestLang,
        );
        const declineSubject = guestLang === 'ar'
          ? `شكرًا لإخبارنا – ${escapeHtml(result.event_title)}`
          : `Thank You – ${escapeHtml(result.event_title)}`;
        notificationService.sendEmailViaBrevo(result.guest_email, declineSubject, declineHtml)
          .catch((err) => logger.error({ err }, 'Decline email error'));
      }
    }


    // Notify organizer of the new RSVP (best-effort).
    try {
      const prefs = result.notification_preferences;
      const isEmailPref = !prefs || prefs.email !== false;
      const isWhatsappPref = !!prefs?.whatsapp;
      const respLabel = result.response === 'yes' ? 'Attending' : result.response === 'maybe' ? 'Maybe' : 'Declined';

      // Fetched once and reused by both the organizer and partner emails below
      // so the "Side" row can name the actual groom/bride (template_data.partner1/
      // partner2) instead of the generic "Partner 1/2's Side" fallback.
      let td = {};
      if (isEmailPref) {
        const { data: eventRow } = await supabase.from('events').select('template_data').eq('id', eventId).single();
        td = eventRow?.template_data || {};
      }

      if (isEmailPref && result.org_email) {
        const orgEmailHtml = getNewRsvpOrganizerTemplate({
          eventTitle: result.event_title, guestName, response: result.response, partySize: computedPartySize, email,
          side: result.side, eventType: result.event_type, partner1Name: td.partner1, partner2Name: td.partner2,
        });
        notificationService.sendEmailViaBrevo(result.org_email, `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(result.event_title)}`, orgEmailHtml)
          .catch((err) => logger.error({ err }, 'Failed to notify organizer via email'));
      }

      // Also copy in the groom/bride, if the organizer configured their emails
      // on the event (template_data.partner1_email/partner2_email) — same
      // toggle, same template, just a public-page CTA instead of a dashboard one.
      if (isEmailPref) {
        for (const partnerEmail of [td.partner1_email, td.partner2_email]) {
          if (partnerEmail && EMAIL_RE.test(String(partnerEmail).trim())) {
            const partnerEmailHtml = getNewRsvpOrganizerTemplate({
              eventTitle: result.event_title, guestName, response: result.response, partySize: computedPartySize, email,
              side: result.side, eventType: result.event_type, recipientRole: 'partner', eventSlug: result.event_slug,
              partner1Name: td.partner1, partner2Name: td.partner2,
            });
            notificationService.sendEmailViaBrevo(partnerEmail.trim(), `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(result.event_title)}`, partnerEmailHtml)
              .catch((err) => logger.error({ err }, 'Failed to notify partner recipient via email'));
          }
        }
      }

      if (isWhatsappPref && result.org_phone) {
        const { getTwilioClient, getTwilioWhatsAppFrom } = require('../utils/twilioClient');
        const twilio = getTwilioClient();
        const whatsappFrom = getTwilioWhatsAppFrom();
        const messageText = `New RSVP Received for ${result.event_title}: ${guestName} has replied ${result.response === 'yes' ? 'Attending (Party of ' + computedPartySize + ')' : respLabel}. — Fancy RSVP`;
        if (twilio && whatsappFrom) {
          twilio.messages.create({ body: messageText, from: whatsappFrom, to: `whatsapp:${result.org_phone}` })
            .catch((err) => logger.error({ err }, 'Failed to notify organizer via WhatsApp'));
        } else if (twilio && !whatsappFrom) {
          // Previously this fell back to Twilio's public sandbox number, which only
          // delivers to handsets that manually joined it — so in production the
          // organizer simply never heard about their own RSVPs. Say so instead.
          logger.warn({ eventId }, 'WhatsApp notification skipped — TWILIO_WHATSAPP_FROM is not configured.');
        } else {
          logger.info(`[MOCK WHATSAPP NOTIFICATION] To: ${result.org_phone} | Content: ${messageText}`);
        }
      }
    } catch (orgNotifyErr) {
      logger.error({ err: orgNotifyErr }, 'Organizer notification error');
    }

    // Mint the real entrance QR ticket immediately on a "yes" — see
    // signQrTicketForResponse's doc comment for why this doesn't wait for
    // seating. The success screen (and any later return visit) can now show
    // a genuinely scannable code instead of a decorative placeholder.
    const qrToken = tokenService.signQrTicketForResponse({
      response: result.response, partyId: result.party_id, eventId,
      tableName: null, partySize: computedPartySize, eventDate: result.event_date,
    });

    // RSVP confirmation by text — sent HERE, after the pass exists, so the one
    // message can carry the entry-pass link rather than promising it separately.
    // Sending a `rsvp_confirmation` and a `qr_ticket` on the same submission would
    // put two texts on the guest's phone and charge the organizer twice for one
    // event; `qr_ticket` is reserved for an explicit resend.
    //
    // ADDITIVE to the confirmation email, not a replacement (see
    // smsMessageTypes.replacesEmail): the email carries the scannable QR image and
    // full logistics, which SMS structurally cannot.
    //
    // Fire-and-forget: the RSVP is already committed and the guest is waiting on
    // this response — a texting problem must never delay or fail it.
    if (result.response === 'yes' || result.response === 'maybe') {
      sendTransactionalSms({
        type: 'rsvp_confirmation',
        eventId,
        partyId: result.party_id,
        ref: `rsvp:${result.party_id}`,
        lang: guestLang,
        context: {
          guestName,
          eventTitle: result.event_title,
          response: result.response,
          // A 'maybe' has no pass to link to; the template omits it.
          ticketUrl: (result.response === 'yes' && qrToken) ? buildTicketLinks(qrToken).ticketUrl : null,
        },
      }).catch((err) => logger.warn({ err, partyId: result.party_id }, 'RSVP confirmation SMS failed'));
    }

    return sendOk(res, {
      partyId: result.party_id,
      message: result.is_update ? 'RSVP updated successfully.' : 'RSVP submitted successfully.',
      qrToken,
    }, { status: 201 });
  } catch (err) {
    if (isGuestLimitError(err)) {
      return sendFail(res, { status: 409, error: 'GUEST_LIMIT_REACHED', message: 'This event has reached its plan\'s guest limit. Contact the organizer.' });
    }
    next(err);
  }
};

/**
 * Resolves a single party invitation by its party id (public endpoint).
 * GET /api/v1/public/rsvp/guest/:guestId
 */
const getGuestById = async (req, res, next) => {
  const { guestId: partyId } = req.params;
  try {
    const resolved = await guestService.getPartyForPublicResolve(partyId);
    if (!resolved) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    if (!isEventLiveForGuests(resolved.event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const qrToken = tokenService.signQrTicketForResponse({
      response: resolved.response, partyId: resolved.id, eventId: resolved.eventId,
      tableName: resolved.tableName, partySize: resolved.partySize, eventDate: resolved.event.event_date,
    });

    return sendOk(res, {
      slug: resolved.event.slug,
      seatingLocked: !resolved.seatingRevealed,
      revealAt: resolved.revealAt,
      guest: {
        id: resolved.id,
        guest_name: resolved.label,
        party_size: resolved.partySize,
        response: resolved.response,
        table_name: resolved.tableName,
        qrToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches pre-registered guest invitations by name (public endpoint).
 * GET /api/v1/public/events/:slug/rsvp/search
 */
const searchPublicGuests = async (req, res, next) => {
  const { slug } = req.params;
  const { query } = req.query;
  const term = (query || '').trim();
  if (term.length < 2) return sendOk(res, { results: [] });

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, is_paid, status').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const results = await guestService.searchPartiesPublic(event.id, term, 10);
    return sendOk(res, { results });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists parties for an event (organizer dashboard endpoint).
 * GET /api/v1/events/:eventId/rsvps
 */
const getRSVPs = async (req, res, next) => {
  const { eventId } = req.params;
  const { response, search, seated, sort, meal, customFieldId, customFieldValue } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  try {
    const { parties, pagination } = await guestService.listParties(eventId, {
      response, search, seated, sort, meal, customFieldId, customFieldValue, page, limit,
    });
    return sendOk(res, { rsvps: parties }, { meta: { pagination } });
  } catch (err) {
    next(err);
  }
};

/**
 * Imports guest records in bulk from a CSV/XLSX payload.
 * POST /api/v1/events/:eventId/rsvps/import
 */
const importGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  const { csvData, fileData, fileName, consentAttested } = req.body;

  if (!csvData && !fileData) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'csvData or fileData string is required.' });
  }

  try {
    let parsedRows = [];

    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      const isExcel = fileName && fileName.toLowerCase().endsWith('.xlsx');

      if (isExcel) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        const headers = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text ? cell.text.trim().toLowerCase().replace(/\s+/g, '_') : '';
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowObj = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber];
            if (header) rowObj[header] = cell.text ? cell.text.trim() : '';
          });
          const mappedRow = {
            guest_name: rowObj.guest_name || rowObj.name || rowObj.guest || '',
            email: rowObj.email || '',
            phone: rowObj.phone || '',
            notes: rowObj.notes || rowObj.note || '',
            party_size: rowObj.party_size || '',
            side: rowObj.side || '',
          };
          if (mappedRow.guest_name) parsedRows.push(mappedRow);
        });
      } else {
        parsedRows = parseCSV(buffer.toString('utf-8'));
      }
    } else {
      parsedRows = parseCSV(csvData);
    }

    if (parsedRows.length === 0) {
      return sendFail(res, { status: 400, error: 'NO_VALID_ROWS', message: 'No valid data rows found.' });
    }
    if (parsedRows.length > 500) {
      return sendFail(res, { status: 400, error: 'FILE_TOO_LARGE', message: 'Import limited to 500 rows per batch. Please split your file.' });
    }

    // Dedup within the file by email (case-insensitive); rows without an email are
    // always kept — the per-event unique index only collides on non-null emails.
    const seenEmails = new Set();
    let skippedInFile = 0;
    const dedupedRows = [];
    for (const row of parsedRows) {
      const emailKey = normalizeEmail(row.email);
      if (emailKey) {
        if (seenEmails.has(emailKey)) { skippedInFile++; continue; }
        seenEmails.add(emailKey);
      }
      const parsedSize = parseInt(row.party_size, 10);
      dedupedRows.push({
        guest_name: row.guest_name || 'Unnamed Guest',
        email: emailKey,
        phone: normalizeToE164(row.phone),
        notes: row.notes || null,
        party_size: Number.isInteger(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, 20) : 1,
        side: normalizeSideCsvValue(row.side),
      });
    }

    // TCPA/CTIA + Terms §5 ("Host Consent Obligations"). The attestation is what
    // makes imported numbers textable: with it, each phone-bearing row is stamped
    // as host_attested consent; without it, the numbers still import (the
    // organizer may simply want them on their guest list) but are never sent an
    // SMS. Deliberately NOT a hard 400 — blocking the import would force an
    // organizer to claim consent they may not have just to store a number, which
    // is exactly the coerced-consent pattern this whole model avoids.
    const rowsWithPhone = dedupedRows.filter((r) => r.phone).length;
    const attested = consentAttested === true || consentAttested === 'true';

    const { imported, skippedExisting, errors } = await guestService.importGuests(
      eventId, req.user?.id || null, dedupedRows, { smsConsentAttested: attested },
    );
    const skippedCount = skippedInFile + skippedExisting;

    // Tell the organizer plainly what the import did to SMS eligibility, so the
    // consequence of the checkbox is visible at the moment it took effect.
    const smsNote = rowsWithPhone === 0
      ? null
      : attested
        ? `${rowsWithPhone} guest(s) with a phone number were recorded as consenting to event texts, based on your confirmation.`
        : `${rowsWithPhone} guest(s) have a phone number but were not marked as consenting to texts, so they can't be sent an SMS. They can opt in themselves on their RSVP form.`;

    return sendOk(res, {
      message: `Imported ${imported.length} guest record(s) in pending state`
        + (skippedCount ? `; skipped ${skippedCount} duplicate(s)` : '')
        + (errors.length ? `; ${errors.length} failed` : '') + '.'
        + (smsNote ? ` ${smsNote}` : ''),
      importedCount: imported.length, skippedCount, errorCount: errors.length, errors, guests: imported,
      smsConsentAttested: attested, phoneRowCount: rowsWithPhone,
    }, { status: 201 });
  } catch (err) {
    next(err);
  }
};

/**
 * Exports RSVPs dataset to a downloadable CSV stream.
 * GET /api/v1/events/:eventId/rsvps/export
 */
const exportGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    // exportParties returns { rows, meta } — the row array plus a truncation flag.
    const { rows, meta } = await guestService.exportParties(eventId, { attendingOnly, sort });
    const headers = ['guest_name', 'email', 'phone', 'response', 'party_size', 'side', 'table_name', 'meal_selections', 'checked_in', 'checked_in_at', 'check_in_method', 'notes'];
    const csvContent = generateCSV(headers, rows, (item) => [
      item.guest_name, item.email, item.phone, item.response, item.party_size, item.side,
      item.table_name, item.meal_selections, item.checked_in, item.checked_in_at, item.check_in_method, item.notes,
    ]);

    const csvName = `event-${eventId}-${attendingOnly ? 'attending' : 'rsvps'}${sort ? '-by-' + sort : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${csvName}`);
    // Signal partial exports so the client can warn the organizer their file is capped.
    if (meta?.truncated) res.setHeader('X-Export-Truncated', String(meta.limit));
    return res.send(csvContent);
  } catch (err) {
    next(err);
  }
};

/**
 * Exports RSVPs dataset to a downloadable Excel (.xlsx) file.
 * GET /api/v1/events/:eventId/rsvps/export-excel
 */
const exportGuestsExcel = async (req, res, next) => {
  const { eventId } = req.params;
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    // exportParties returns { rows, meta } — the row array plus a truncation flag.
    const { rows, meta } = await guestService.exportParties(eventId, { attendingOnly, sort });

    const { data: tables, error: tablesError } = await supabase.from('tables').select('*').eq('event_id', eventId);
    if (tablesError) throw tablesError;

    // Live arrivals only. Undone check-ins are retained as evidence (soft
    // delete, migration 20260814000000) but must never appear in the Check-in
    // Log sheet as though the guest attended.
    const { data: checkins, error: checkinsError } = await supabase
      .from('check_ins').select('*, rsvp_parties(label)').eq('event_id', eventId).is('deleted_at', null);
    if (checkinsError) throw checkinsError;

    // Shape rows the way generateExcelExport expects (mirrors the pre-rebuild rsvp shape).
    const guestRows = rows.map((r) => ({
      guest_name: r.guest_name, email: r.email, phone: r.phone, response: r.response,
      party_size: r.party_size, notes: r.notes, side: r.side,
      rsvp_guests: (r.guests || []).map((g) => ({ meal_selection: g.meal_selection, is_primary: g.is_primary_contact })),
      seating_assignments: r.table_name ? [{ tables: { table_name: r.table_name } }] : [],
    }));

    const { generateExcelExport } = require('../utils/excelHelper');
    const excelBuffer = await generateExcelExport(guestRows, tables || [], checkins || []);

    const xlsxName = `event-${eventId}-${attendingOnly ? 'attending' : 'rsvps'}${sort ? '-by-' + sort : ''}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${xlsxName}`);
    // Signal partial exports so the client can warn the organizer their file is capped.
    if (meta?.truncated) res.setHeader('X-Export-Truncated', String(meta.limit));
    return res.send(excelBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a single party and its related data.
 * DELETE /api/v1/events/:eventId/rsvps/:rsvpId
 */
const deleteRSVP = async (req, res, next) => {
  try {
    const { eventId, partyId } = req.params;
    await guestService.deleteParty(eventId, partyId);
    return sendOk(res, { message: 'RSVP deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates a single party record (organizer edit).
 * PATCH /api/v1/events/:eventId/rsvps/:rsvpId
 */
const updateRSVP = async (req, res, next) => {
  const { eventId, partyId } = req.params;
  const { guestName, email, phone, response, partySize, notes, primaryGuestMeal, additionalGuests, side, category, companionMealCounts } = req.body;

  try {
    if (response !== undefined && !['yes', 'no', 'maybe', 'pending', 'waitlist'].includes(response)) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'response must be yes, no, maybe, pending, or waitlist.' });
    }
    if (partySize !== undefined) {
      const size = parseInt(partySize);
      if (isNaN(size) || size < 1 || size > 20) {
        return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 20.' });
      }
    }
    if (phone !== undefined && phone && String(phone).trim() && !normalizeToE164(phone)) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).' });
    }
    if (email !== undefined && email && String(email).trim() && !EMAIL_RE.test(String(email).trim())) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid email address.' });
    }
    if (side !== undefined && side !== null && side !== '' && !['partner1', 'partner2'].includes(side)) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'side must be partner1 or partner2.' });
    }
    if (Array.isArray(additionalGuests)) {
      for (let idx = 0; idx < additionalGuests.length; idx++) {
        const g = additionalGuests[idx];
        if (g && g.email !== undefined && g.email && String(g.email).trim() && !EMAIL_RE.test(String(g.email).trim())) {
          return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `Guest #${idx + 2} must have a valid email address.` });
        }
        if (g && g.phone !== undefined && g.phone && String(g.phone).trim() && !normalizeToE164(g.phone)) {
          return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `Guest #${idx + 2} must have a valid phone number.` });
        }
      }
    }

    // Two members of the SAME party given one address. guestService's conflict
    // check only looks at OTHER parties, so this would otherwise reach the
    // unique index and come back as a 500 with nothing naming the two rows
    // that collided.
    const seenEmails = new Map();
    const emailEntries = [
      ['the main guest', email],
      ...(Array.isArray(additionalGuests) ? additionalGuests.map((g, idx) => [`Guest #${idx + 2}`, g?.email]) : []),
    ];
    for (const [who, raw] of emailEntries) {
      const normalized = normalizeEmail(raw);
      if (!normalized) continue;
      if (seenEmails.has(normalized)) {
        return sendFail(res, {
          status: 400, error: 'VALIDATION_ERROR',
          message: `${seenEmails.get(normalized)} and ${who} were both given ${normalized}. Each guest needs their own email address, or leave one blank.`,
        });
      }
      seenEmails.set(normalized, who);
    }

    const party = await guestService.updateParty(eventId, partyId, {
      guestName, email, phone, response, partySize, notes, primaryMeal: primaryGuestMeal, additionalGuests, side, category,
      companionMealCounts,
      // Lets an organizer confirm consent for a guest they added or imported
      // before ticking it. Still cannot override a guest's own decision.
      smsConsentAttested: req.body?.smsConsentAttested === true || req.body?.smsConsentAttested === 'true',
      actorUserId: req.user?.id || null,
    });
    if (!party) return sendFail(res, { status: 404, error: 'RSVP_NOT_FOUND' });
    // A-16 item 6: the category is a fixed enum, so an unrecognised value is a
    // client bug rather than something to silently coerce to 'standard' — that
    // would quietly downgrade a VIP.
    if (party.error === 'INVALID_CATEGORY') {
      return sendFail(res, {
        status: 400, error: 'VALIDATION_ERROR',
        message: `category must be one of: ${guestService.GUEST_CATEGORIES.join(', ')}.`,
      });
    }
    // Contact details are unique per event at the DB level. Without this the
    // unique-index violation reached the organizer as a bare 500 ("An
    // unexpected error occurred on the server") with nothing naming the field,
    // let alone the guest already holding it.
    if (party.error === 'DUPLICATE_EMAIL' || party.error === 'DUPLICATE_PHONE') {
      const isEmail = party.error === 'DUPLICATE_EMAIL';
      const what = isEmail ? 'email address' : 'phone number';
      const who = party.conflictWith ? `${party.conflictWith} already uses` : 'Another guest on this event already uses';
      return sendFail(res, {
        status: 409,
        error: party.error,
        message: `${who} this ${what}. Each guest needs their own${isEmail ? '' : ' — companions can share a number, but the main contact cannot'}.`,
      });
    }

    broadcast(eventId, 'rsvp_updated', { partyId, guestName: party.label, response: party.response });
    return sendOk(res, { message: 'RSVP updated successfully.', rsvp: party });
  } catch (err) {
    next(err);
  }
};

/**
 * Manually adds a guest record from the organizer dashboard.
 * POST /api/v1/events/:eventId/rsvps
 */
const addGuestManually = async (req, res, next) => {
  const { eventId } = req.params;
  const { guestName, email, phone, response, partyId, partySize, notes, side, primaryGuestMeal, smsConsentAttested } = req.body;

  if (!guestName || !guestName.trim()) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'guestName is required.' });
  }
  if (email !== undefined && email && String(email).trim() && !EMAIL_RE.test(String(email).trim())) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid email address.' });
  }
  if (phone !== undefined && phone && String(phone).trim() && !normalizeToE164(phone)) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).' });
  }
  const guestResponse = response && ['yes', 'no', 'maybe', 'pending', 'waitlist'].includes(response) ? response : 'pending';
  const guestSide = ['partner1', 'partner2'].includes(side) ? side : null;
  const normalizedEmail = normalizeEmail(email);
  const resolvedPartySize = partySize ? parseInt(partySize, 10) : 1;

  try {
    // TCPA/CTIA + Terms §5: an organizer adding someone else's number may attest
    // that they already hold that guest's consent to be texted about the event.
    // Optional — an unattested number is stored for the guest list and simply
    // never messaged. Only meaningful alongside a phone number.
    const attested = smsConsentAttested === true || smsConsentAttested === 'true';

    const result = await guestService.addGuest({
      eventId, actorUserId: req.user?.id, fullName: guestName.trim(),
      phone: phone ? normalizeToE164(phone) : null, email: normalizedEmail, partyId, response: guestResponse,
      partySize: resolvedPartySize, notes: notes ? String(notes).trim() : null, side: guestSide,
      primaryMeal: primaryGuestMeal ? String(primaryGuestMeal).trim() : null,
      smsConsentAttested: attested, consentSource: 'host_manual_add',
    });

    if (!result || result.success === false) return sendRpcFailure(res, result);

    broadcast(eventId, 'rsvp_submitted', { partyId: result.party_id, guestName: guestName.trim(), response: guestResponse });

    // Best-effort: an organizer-added guest has no other way to discover their
    // event page, so a manually-added guest with an email on file gets their
    // invitation immediately instead of the organizer having to separately
    // remember to send one. A delivery failure (or an event that isn't
    // paid/live yet) must not fail the add-guest request itself.
    const invitation = { attempted: false, sent: false, email: normalizedEmail || null, reason: null };
    if (normalizedEmail) {
      invitation.attempted = true;
      try {
        const { event: liveEvent, code: liveEventCode } = await invitationService.resolveLiveEvent(eventId);
        if (liveEvent) {
          const inviteResult = await invitationService.sendEmailInvite(liveEvent, {
            id: result.party_id, label: guestName.trim(), primaryEmail: normalizedEmail, partySize: resolvedPartySize,
          });
          invitation.sent = !!inviteResult.sent;
          if (!inviteResult.sent) invitation.reason = inviteResult.reason || 'DELIVERY_FAILED';
        } else {
          invitation.reason = liveEventCode || 'EVENT_NOT_LIVE';
        }
      } catch (inviteErr) {
        logger.error({ err: inviteErr, eventId, partyId: result.party_id }, 'addGuestManually: invitation email failed');
        invitation.reason = 'DELIVERY_FAILED';
      }
    }

    return sendOk(res, { message: 'Guest added successfully.', partyId: result.party_id, guestId: result.guest_id, invitation }, { status: 201 });
  } catch (err) {
    if (isGuestLimitError(err)) {
      return sendFail(res, { status: 409, error: 'GUEST_LIMIT_REACHED', message: 'This event has reached its plan\'s guest limit. Upgrade the plan to add more guests.' });
    }
    next(err);
  }
};

/**
 * Verifies a guest by exact name + last 4 phone digits and returns ONLY their
 * own seating map. Replaces the old name-search, which returned every party
 * matching a name (and a usable id), letting anyone browse strangers' tables
 * and companion lists. A non-match returns `{ verified: false }` with 200 — we
 * never reveal whether the name exists or which factor failed.
 * POST /api/v1/public/events/:slug/seating/verify
 */
const verifyPublicSeating = async (req, res, next) => {
  const { slug } = req.params;
  const { name, phoneLast4 } = req.body;

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, is_paid, status, event_date').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    // Organizer-added guests bypass the 24h reveal window, so the lock check
    // now depends on the specific party's own flag — meaning we have to look
    // the party up FIRST rather than short-circuiting on event date alone.
    // A locked (not-yet-revealed, non-organizer-added) match still responds
    // identically to "no match" (verified: false) — never confirming a real
    // guest exists during the wait, same anti-enumeration guarantee as before.
    const seating = await guestService.verifyGuestSeating(event.id, name, phoneLast4);
    if (!seating) return sendOk(res, { verified: false });
    if (!seating.createdByOrganizer && !guestService.isSeatingRevealed(event.event_date)) {
      return sendOk(res, { locked: true, revealAt: guestService.seatingRevealAtISO(event.event_date), verified: false });
    }

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id).order('sort_order', { ascending: true });
    if (tablesError) throw tablesError;

    return sendOk(res, {
      verified: true,
      guest: { id: seating.party.id, guest_name: seating.party.label, party_size: seating.party.partySize, response: seating.party.response },
      myTableId: seating.myTableId, myTableName: seating.myTableName,
      party: seating.companions, tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns a single guest's personal seating view: venue layout + own table +
 * own party's companions. Never exposes other parties.
 * GET /api/v1/public/events/:slug/seating/guest/:guestId
 */
const getGuestSeatingMap = async (req, res, next) => {
  const { slug, guestId: partyId } = req.params;

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, is_paid, status, event_date').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const seating = await guestService.getPartySeatingMap(event.id, partyId);
    if (!seating) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });

    // Organizer-added guests bypass the 24h reveal window — checked per-party
    // now rather than purely on event date, so the lookup above has to run
    // before we can decide whether to reveal.
    if (!seating.createdByOrganizer && !guestService.isSeatingRevealed(event.event_date)) {
      return sendOk(res, {
        locked: true, revealAt: guestService.seatingRevealAtISO(event.event_date),
        myTableId: null, myTableName: null, party: [], tables: [],
      });
    }

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id).order('sort_order', { ascending: true });
    if (tablesError) throw tablesError;

    return sendOk(res, {
      guest: { id: seating.party.id, guest_name: seating.party.label, party_size: seating.party.partySize, response: seating.party.response },
      myTableId: seating.myTableId, myTableName: seating.myTableName,
      party: seating.companions, tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a signed QR check-in ticket into the guest's OWN seating view —
 * the self-scan counterpart to the staff-facing checkinController.scanCheckIn.
 * The QR image emailed to a seated party now encodes a link to this page (see
 * routes/publicRoutes.js `/qr/:token.png`) instead of a bare token, so a guest
 * scanning their own ticket with their phone's camera sees their table +
 * companions on the real venue map, never anyone else's. Read-only — never
 * checks anyone in.
 * GET /api/v1/public/ticket/:token
 */
const getTicketSeatingView = async (req, res, next) => {
  const { token } = req.params;

  let decoded;
  try {
    decoded = tokenService.verifyQrTicket(token);
  } catch {
    return sendFail(res, { status: 401, error: 'INVALID_TICKET', message: 'This ticket is invalid or has expired.' });
  }

  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, slug, title, event_date, location_name, location_address, is_paid, status, custom_colors, custom_fonts, cover_image_url')
      .eq('id', decoded.eventId)
      .single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests(event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const seating = await guestService.getPartySeatingMap(event.id, decoded.partyId);
    if (!seating) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });

    const eventBrief = {
      title: event.title, slug: event.slug, event_date: event.event_date,
      location_name: event.location_name, location_address: event.location_address,
      custom_colors: event.custom_colors, custom_fonts: event.custom_fonts, cover_image_url: event.cover_image_url,
    };
    const guestBrief = { id: seating.party.id, guest_name: seating.party.label, party_size: seating.party.partySize, response: seating.party.response };

    // Same 24h reveal-window rule as getGuestSeatingMap — a ticket is only ever
    // emailed after seating, but the map itself can still be embargoed.
    if (!seating.createdByOrganizer && !guestService.isSeatingRevealed(event.event_date)) {
      return sendOk(res, {
        event: eventBrief, guest: guestBrief,
        locked: true, revealAt: guestService.seatingRevealAtISO(event.event_date),
        myTableId: null, myTableName: null, party: [], tables: [],
      });
    }

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id).order('sort_order', { ascending: true });
    if (tablesError) throw tablesError;

    return sendOk(res, {
      event: eventBrief, guest: guestBrief,
      myTableId: seating.myTableId, myTableName: seating.myTableName,
      party: seating.companions, tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Emails a short-lived link that lets the owner of an address edit the RSVP
 * registered to it.
 * POST /api/v1/public/events/:slug/rsvp/claim  { email }
 *
 * Reached from the "This email is already registered" card, after a submission
 * matched a party that has already answered. It replaces the old "That's me —
 * update my response" button, which merged into that party on a click alone —
 * explicit, but proof of nothing.
 *
 * THE RESPONSE IS IDENTICAL WHETHER OR NOT ANYTHING MATCHED, and deliberately
 * so. Anything that varied — a different code, a different message, even a
 * measurably different latency class — would turn this into an oracle for "is
 * this person on the guest list", which is exactly the leak the 409's
 * name-nobody wording exists to prevent. The only observable difference is
 * whether an email arrives, and only its owner can observe that.
 */
const claimRsvpByEmail = async (req, res, next) => {
  const { slug } = req.params;
  const normalizedEmail = normalizeEmail(req.body?.email);

  // One body for every outcome: matched, not matched, not editable, no event.
  const sameAnswer = () => sendOk(res, {
    message: 'If that email is registered for this event, we have sent a link to update the response.',
  });

  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid email address.' });
  }

  try {
    const { data: event } = await supabase
      .from('events')
      .select('id, slug, title, is_paid, status, allow_guest_edits, rsvp_deadline')
      .eq('slug', slug)
      .maybeSingle();

    if (!event || !isEventLiveForGuests(event)) return sameAnswer();
    // Nothing to claim if the host doesn't allow changes, or the window closed.
    if (!event.allow_guest_edits) return sameAnswer();
    if (event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) return sameAnswer();

    // Primary contacts only: the address has to be the one that owns the party,
    // not a companion's. Companions have no email at all any more, so this is
    // belt-and-braces for parties that predate that change.
    const { data: match } = await supabase
      .from('guests')
      .select('full_name, party_id, rsvp_parties!inner(id, label, response, event_id)')
      .eq('event_id', event.id)
      .eq('is_primary_contact', true)
      .ilike('email', escapeLikePattern(normalizedEmail))
      .limit(1)
      .maybeSingle();

    const party = match?.rsvp_parties;
    if (!party) return sameAnswer();

    const claimToken = tokenService.signRsvpClaim({ partyId: party.id, eventId: event.id });
    const claimUrl = `${getPublicBaseUrl()}/rsvp?token=${encodeURIComponent(claimToken)}`;
    const lang = String(req.body?.lang || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    const html = getRsvpClaimTemplate(party.label || match.full_name, event, claimUrl, lang);
    const subject = lang === 'ar' ? `تعديل ردّك على ${event.title}` : `Update your RSVP for ${event.title}`;

    // NOT awaited, and that is the point. Awaiting it made the matched path
    // measurably slower than the unmatched one — a Brevo round trip is hundreds
    // of milliseconds — which is a timing oracle for "is this address on the
    // guest list", the exact leak the identical body is here to prevent.
    // Firing it off keeps both paths the same shape; a delivery failure is
    // logged and never reaches the caller, who could do nothing with it anyway.
    notificationService.sendEmailViaBrevo(normalizedEmail, subject, html)
      .catch((mailErr) => logger.error({ err: mailErr, eventId: event.id, partyId: party.id }, 'RSVP claim email failed'));
    return sameAnswer();
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a signed invitation token into the guest + event context that
 * powers the public RSVP confirmation page. Read-only — does not record a
 * response, so email-link pre-fetching by security scanners is harmless.
 * GET /api/v1/public/rsvp/invite?token=...
 *
 * Accepts an rsvp_claim token as well as an rsvp_invite one. Both grant exactly
 * the same capability — resolve THIS party so its own guest can fill the form
 * in — so the claim link reuses the entry point the invitation emails already
 * use (`/rsvp?token=…`) rather than needing a second resolver on the client.
 * They stay separate purposes because they are minted for different reasons and
 * live for very different lengths of time (30 days vs 30 minutes).
 */
const getRsvpInvite = async (req, res, next) => {
  const { token } = req.query;
  if (!token) return sendFail(res, { status: 400, error: 'TOKEN_REQUIRED' });

  let payload;
  try {
    payload = tokenService.verifyRsvpInvite(token);
  } catch {
    try {
      payload = tokenService.verifyRsvpClaim(token);
    } catch {
      return sendFail(res, { status: 401, error: 'INVALID_TOKEN', message: 'This invitation link is invalid or has expired.' });
    }
  }

  try {
    const { data: party, error } = await supabase
      .from('rsvp_parties')
      .select(`id, label, response, created_by_organizer, guests(id, full_name, is_primary_contact, email, meal_selection, dietary_notes, phone),
        events!inner(id, title, description, event_date, event_end_date, slug, location_name, location_address,
          is_paid, status, rsvp_deadline, template_type, event_type, template_data, cover_image_url,
          custom_colors, custom_fonts, allow_guest_edits, track_guest_side,
          reveal_enabled, reveal_replay, access_password, custom_form_fields(*))`)
      .eq('id', payload.partyId)
      .eq('event_id', payload.eventId)
      .single();

    if (error || !party) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });

    const event = party.events;
    if (!isEventLiveForGuests(event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const deadlinePassed = !!event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline);

    const allGuests = party.guests || [];
    // Companions already on file pre-fill the confirmation form instead of asking the
    // responder to retype every member of their own party from a blank field.
    const companions = allGuests.filter((g) => !g.is_primary_contact);
    const primary = allGuests.find((g) => g.is_primary_contact);
    const partySize = allGuests.length || 1;

    const qrToken = tokenService.signQrTicketForResponse({
      response: party.response, partyId: party.id, eventId: event.id,
      tableName: null, partySize, eventDate: event.event_date,
    });

    return sendOk(res, {
      intendedResponse: payload.response ? tokenService.mapIntentToResponse(payload.response) : null,
      deadlinePassed,
      guest: {
        id: party.id, guest_name: party.label, party_size: partySize, response: party.response,
        // Previously omitted here (email wasn't even selected, and phone was
        // fetched only for companions) — the full-wizard prefill effect
        // (RsvpWizard.js) needs both to pre-fill the primary guest's own
        // contact fields, same as the ?party_id= link already does.
        email: primary?.email || null, phone: primary?.phone || null,
        primary_meal: primary?.meal_selection || null,
        primary_dietary_notes: primary?.dietary_notes || null,
        createdByOrganizer: party.created_by_organizer === true,
        qrToken,
        additionalGuests: companions.map((g) => ({
          id: g.id,
          fullName: g.full_name || '',
          mealSelection: g.meal_selection || '',
          dietaryNotes: g.dietary_notes || '',
          phone: g.phone || '',
        })),
      },
      // Spread the full event (minus the password hash) rather than a hand-picked
      // subset — the full RsvpWizard reached via this token entry point needs the
      // same shape resolveSlug's getPublicEventBySlug provides (custom_form_fields
      // for the meal picker/custom questions, track_guest_side, event_type, fonts/
      // colors, etc.), or those features silently fail to render even though the
      // backend still enforces them (e.g. a required meal selection with no UI to
      // satisfy it).
      event: (() => {
        const { access_password, ...publicEvent } = event;
        return { ...publicEvent, location: event.location_name || event.location_address || null };
      })(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Records a guest's RSVP response from a signed invitation token (the
 * one-click email flow). Delegates the lock + write to update_party_response
 * (see GuestService); this handler only resolves the token, fires the
 * confirmation/decline email, and broadcasts.
 * POST /api/v1/public/rsvp/respond
 */
const respondViaToken = async (req, res, next) => {
  const { token, response: bodyResponse, partySize, additionalGuests } = req.body || {};
  if (!token) return sendFail(res, { status: 400, error: 'TOKEN_REQUIRED' });

  let payload;
  try {
    payload = tokenService.verifyRsvpInvite(token);
  } catch {
    return sendFail(res, { status: 401, error: 'INVALID_TOKEN', message: 'This invitation link is invalid or has expired.' });
  }

  const mapped = tokenService.mapIntentToResponse(bodyResponse || payload.response);
  if (!mapped) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'A valid response (accepted, declined, or maybe) is required.' });
  }

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, title, event_date, slug, is_paid, status, rsvp_deadline, notification_preferences, allow_guest_edits, template_data, event_type, organizations(email, phone)')
      .eq('id', payload.eventId).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    if (!isEventLiveForGuests(event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });
    if (event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
      return sendFail(res, { status: 400, error: 'DEADLINE_PASSED', message: 'The RSVP deadline for this event has passed.' });
    }

    // Defense in depth — same rule as submitPublicRSVP: block an edit to an
    // already-answered party when the organizer has turned edits off. A
    // first-time response (still 'pending') is never blocked.
    const { data: existingParty } = await supabase
      .from('rsvp_parties').select('response').eq('id', payload.partyId).maybeSingle();
    if (existingParty && ['yes', 'no', 'maybe'].includes(existingParty.response) && !event.allow_guest_edits) {
      return sendFail(res, {
        status: 403,
        error: 'RESPONSE_EDITS_DISABLED',
        message: 'The organizer has disabled changes to RSVPs after submission. Please contact them directly to update your response.',
      });
    }

    let computedPartySize;
    let sanitizedAdditional;
    if (mapped === 'yes') {
      const size = parseInt(partySize);
      computedPartySize = (!isNaN(size) && size >= 1 && size <= 20) ? size : undefined;
      // Name-only (no email/phone/meal) — QuickConfirm is deliberately a
      // minimal one-click surface, unlike the full public wizard.
      sanitizedAdditional = Array.isArray(additionalGuests)
        ? additionalGuests.slice(0, 19).map((g) => ({ fullName: g && g.fullName ? String(g.fullName).trim().slice(0, 200) : '' }))
        : [];
    }

    const result = await guestService.respondToInvite({
      eventId: event.id, partyId: payload.partyId, response: mapped, partySize: computedPartySize,
      additionalGuests: sanitizedAdditional, actor: 'guest', source: 'email',
    });

    if (!result || result.success === false) return sendRpcFailure(res, result, 409);

    const { data: party } = await supabase
      .from('rsvp_parties').select('id, label, side, guests(is_primary_contact, email)').eq('id', payload.partyId).single();
    const primaryEmail = (party?.guests || []).find((g) => g.is_primary_contact)?.email || null;
    const guestName = party?.label;

    broadcast(event.id, 'rsvp_updated', { partyId: payload.partyId, guestName, response: mapped, partySize: computedPartySize });

    if (primaryEmail) {
      // Same rule as submitPublicRSVP: 'maybe' is acknowledged, not ignored.
      if (mapped === 'yes' || mapped === 'maybe') {
        notificationService.sendConfirmationEmail(event.id, payload.partyId).catch((err) => logger.error({ err }, 'Confirmation email error'));
      } else if (mapped === 'no') {
        const declineHtml = getDeclineConfirmationTemplate({ guest_name: guestName, id: payload.partyId }, event);
        notificationService.sendEmailViaBrevo(primaryEmail, `Thank You – ${escapeHtml(event.title)}`, declineHtml)
          .catch((err) => logger.error({ err }, 'Decline email error'));
      }
    } else {
      // The one-click path never collects an address, so an organizer-imported
      // party with no email on file silently gets nothing back. Make it visible.
      logger.warn({ partyId: payload.partyId, eventId: event.id, response: mapped },
        'Token RSVP recorded without a primary-contact email — no guest email sent');
    }

    // Notify organizer + groom/bride of the new RSVP (best-effort). Unlike
    // submitPublicRSVP, this one-click token path never notified the organizer
    // at all — closing that gap here too, same toggle/template as the direct-
    // submit path (just without `side`/guest `email`, which aren't cheaply
    // available on this path without another join).
    try {
      const prefs = event.notification_preferences;
      const isEmailPref = !prefs || prefs.email !== false;
      const td = event.template_data || {};
      const recipients = [
        { email: event.organizations?.email, role: 'organizer' },
        { email: td.partner1_email, role: 'partner' },
        { email: td.partner2_email, role: 'partner' },
      ];
      if (isEmailPref) {
        for (const { email: recipientEmail, role } of recipients) {
          if (recipientEmail && EMAIL_RE.test(String(recipientEmail).trim())) {
            const html = getNewRsvpOrganizerTemplate({
              eventTitle: event.title, guestName, response: mapped, partySize: computedPartySize,
              recipientRole: role, eventSlug: event.slug,
              side: party?.side || null, eventType: event.event_type,
              partner1Name: td.partner1, partner2Name: td.partner2,
            });
            notificationService.sendEmailViaBrevo(recipientEmail.trim(), `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(event.title)}`, html)
              .catch((err) => logger.error({ err, role }, 'Failed to notify RSVP recipient via email'));
          }
        }
      }
    } catch (notifyErr) {
      logger.error({ err: notifyErr }, 'Organizer/partner notification error');
    }

    return sendOk(res, { message: 'Your response has been recorded.', response: mapped, guestName, eventSlug: event.slug, partyId: payload.partyId });
  } catch (err) {
    if (isGuestLimitError(err)) {
      return sendFail(res, { status: 409, error: 'GUEST_LIMIT_REACHED', message: 'This event has reached its plan\'s guest limit. Contact the organizer.' });
    }
    next(err);
  }
};

/**
 * Returns aggregated RSVP statistics for the organizer dashboard cards.
 * GET /api/v1/events/:eventId/rsvps/stats
 */
const getRsvpStats = async (req, res, next) => {
  const { eventId } = req.params;
  try {
    const stats = await guestService.getStats(eventId);
    return sendOk(res, { stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  getRsvpInvite,
  claimRsvpByEmail,
  respondViaToken,
  getRsvpStats,
  exportGuestsCSV,
  exportGuestsExcel,
  searchPublicGuests,
  getGuestById,
  deleteRSVP,
  updateRSVP,
  addGuestManually,
  verifyPublicSeating,
  getGuestSeatingMap,
  getTicketSeatingView,
  // Exported for unit testing of the ILIKE-injection escaping.
  escapeLikePattern,
};
