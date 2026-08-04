/**
 * Shared SMS dispatch primitives — the single source of truth for audience
 * resolution, personalization, segment-accurate atomic credit billing, and the
 * actual Twilio send. Used by BOTH the synchronous controller path (small sends)
 * and the asynchronous worker (large queued campaigns) so the safety guarantees
 * are identical everywhere.
 */
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { buildGuestRsvpUrl } = require('../utils/emailTemplates');
const { computeSmsSegments, renderTemplate } = require('../utils/smsSegments');
const { normalizeToE164 } = require('../utils/phone');

// GSM-7-safe separator (an em-dash forces UCS-2 → 70-char segments → triple cost).
const BRANDING = ' - Fancy RSVP';
// CTIA/Twilio toll-free: every outbound message must identify the sender and
// carry opt-out/help language and the rates disclosure. Appended to EVERY body
// (frontend/src/app/dashboard/campaigns/page.js mirrors this string exactly for
// its segment-cost estimate — keep the two in sync). All-ASCII → stays GSM-7.
const COMPLIANCE_FOOTER = `${BRANDING}. Msg&data rates may apply. Reply STOP to opt out, HELP for help.`;

// Stored response values are yes/no/maybe/pending; aliases tolerated defensively.
const AUDIENCE_RESPONSES = {
  pending: ['pending'],
  attending: ['yes', 'accepted', 'attending'],
  maybe: ['maybe'],
  declined: ['no', 'declined'],
};
const VALID_AUDIENCES = ['pending', 'attending', 'maybe', 'declined', 'all'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const normalizePhone = (p) => String(p || '').replace(/[\s\-().]/g, '');
const isValidPhone = (p) => /^\+?[1-9]\d{6,14}$/.test(p);
const isUndefinedFunction = (error) =>
  !!error && (error.code === '42883' || error.code === 'PGRST202' ||
    /Could not find the function|does not exist/i.test(error.message || ''));

/** Normalize the requested audience(s) into a clean array of valid segment keys. */
function normalizeAudiences(input) {
  let list = [];
  if (Array.isArray(input)) list = input;
  else if (typeof input === 'string' && input.trim()) list = input.split(/[+,]/);
  list = list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const valid = list.filter((s) => VALID_AUDIENCES.includes(s));
  if (valid.includes('all')) return ['all'];
  return [...new Set(valid)];
}

/** Build the UNION of response values for the selected segments (null = no filter / all). */
function resolveResponses(audiences) {
  if (!audiences.length || audiences.includes('all')) return null;
  const set = new Set();
  for (const a of audiences) (AUDIENCE_RESPONSES[a] || []).forEach((r) => set.add(r));
  return [...set];
}

/**
 * Fetch phone-bearing recipients for the chosen audience or an explicit
 * party-id list. SMS targets a party's primary contact, mirroring how email
 * invitations target the primary contact's email — `id`/`guest_name` below
 * are the party id and label (the historical "rsvp"/"guest" naming downstream
 * in this file is kept as-is; only the underlying query changed).
 *
 * EXPRESS-CONSENT GATE (TCPA / Twilio TFV rejection 30475). A party is a valid
 * SMS recipient only when `sms_consent = true` — i.e. the guest personally
 * ticked the optional, unbundled consent checkbox on an RSVP form or on
 * /sms-opt-in. Nothing else qualifies:
 *
 *   sms_consent = true                       → guest opted in. Send.
 *   sms_consent = false, sms_consent_at SET  → asked and DECLINED. Never send.
 *   sms_consent = false, sms_consent_at NULL → never asked (CSV import, manual
 *       add, or any pre-2026-08-04 row). Never send. Absence of a consent
 *       record is not consent, and historical rows are deliberately NOT
 *       migrated into consent.
 *
 * Until 2026-08-04 the NULL-timestamp case was treated as sendable under an
 * organizer "host consent" attestation (Terms §5), so imported numbers could be
 * texted without the guest ever opting in. That is withdrawn: it made the
 * platform the party relying on someone else's unverifiable consent, and it
 * contradicted the public /sms-opt-in page, which tells reviewers that only
 * guests who ticked the box are ever messaged. Organizers who import numbers
 * must now invite those guests by email and let them opt in themselves.
 *
 * Do NOT loosen this back to an `.or()`. The organizer attestation is retained
 * as an additional gate on campaign launch, never as a substitute for consent.
 */
async function fetchRecipients(eventId, { audiences = ['pending'], guestIds = null, limit = 100000 } = {}) {
  let query = supabase
    .from('rsvp_parties')
    .select('id, label, response, guests!inner(is_primary_contact, phone)')
    .eq('event_id', eventId)
    .eq('sms_consent', true)
    .eq('guests.is_primary_contact', true)
    .not('guests.phone', 'is', null);

  if (Array.isArray(guestIds) && guestIds.length > 0) {
    query = query.in('id', guestIds);
  } else {
    const responses = resolveResponses(audiences);
    if (responses) query = query.in('response', responses);
  }
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return (data || []).map((p) => {
    const primary = Array.isArray(p.guests) ? p.guests[0] : p.guests;
    return { id: p.id, guest_name: p.label, phone: primary?.phone, response: p.response };
  });
}

/** party_id → assigned table name, for the {table_number} tag (best-effort, never fatal). */
async function getTableMap(eventId) {
  const map = {};
  try {
    const { data: seats } = await supabase
      .from('seating_assignments')
      .select('party_id, tables(table_name)')
      .eq('event_id', eventId);
    for (const s of (seats || [])) {
      const name = s.tables && s.tables.table_name;
      if (s.party_id && name) map[s.party_id] = name;
    }
  } catch (e) {
    logger.warn({ err: e, eventId }, 'getTableMap failed; {table_number} will render empty.');
  }
  return map;
}

/** Personalize + measure one message (segments are computed on the FINAL body). */
function personalize(template, { slug, guestName, rsvpId, tableName, eventTitle }) {
  // INV-3: SMS taps land directly on the RSVP form (`/{slug}/rsvp?g={rsvpId}`) — no
  // landing-page detour and no resolver redirect.
  const url = buildGuestRsvpUrl(slug, rsvpId);
  const values = {
    name: guestName || 'Guest',
    url, rsvp_link: url,
    table_number: tableName || '', table: tableName || '',
    event: eventTitle || '', event_name: eventTitle || '',
  };
  let body = renderTemplate(template, values);
  // A template ending in the bare brand suffix (the pre-compliance-footer
  // convention) would otherwise render "…- Fancy RSVP - Fancy RSVP. Msg&data…".
  if (body.endsWith(BRANDING)) body = body.slice(0, -BRANDING.length);
  if (!body.endsWith(COMPLIANCE_FOOTER)) body = `${body}${COMPLIANCE_FOOTER}`;
  const seg = computeSmsSegments(body);
  return { body, segments: seg.segments };
}

/* ─── Opt-out suppression (sms_opt_outs, written by the inbound STOP webhook) ─── */

const isUndefinedTable = (error) =>
  !!error && (error.code === '42P01' ||
    /relation .* does not exist|Could not find the table/i.test(error.message || ''));

/**
 * The suppression table stores Twilio's `From` — always +E.164 — so lookups
 * must compare in that exact form. normalizeToE164 also repairs legacy rows
 * stored without the leading + (a bare 10-digit US number becomes +1XXX…),
 * which plain formatting-stripping would fail to match.
 */
const canonicalPhone = (p) => normalizeToE164(p) || normalizePhone(p) || null;

/**
 * Return the subset of `phones` (any format; canonicalized internally) that are
 * currently opted out, keyed by canonical +E.164. Fails OPEN with a loud warning
 * if the suppression table has not been migrated yet — same missing-schema
 * tolerance as the credit RPCs.
 */
async function getOptedOutSet(phones) {
  const out = new Set();
  const unique = [...new Set((phones || []).map(canonicalPhone).filter(Boolean))];
  for (const part of chunk(unique, 500)) {
    const { data, error } = await supabase
      .from('sms_opt_outs').select('phone').is('opted_back_in_at', null).in('phone', part);
    if (error) {
      if (isUndefinedTable(error)) {
        logger.warn('sms_opt_outs missing — apply 20260809000000_sms_compliance.sql (opt-outs are NOT being enforced).');
        return out;
      }
      throw error;
    }
    for (const row of (data || [])) out.add(row.phone);
  }
  return out;
}

/** True when this single number is on the suppression list. */
async function isOptedOut(phone) {
  const canonical = canonicalPhone(phone);
  if (!canonical) return false;
  const set = await getOptedOutSet([phone]);
  return set.has(canonical);
}

/* ─── Express-consent verification (Twilio TFV 30475 / TCPA) ─── */

/**
 * Every phone number on this event whose owner personally opted in
 * (rsvp_parties.sms_consent = true). Returned canonicalized to +E.164 so it can
 * be compared against numbers stored in any format.
 *
 * The whole event's consented set is fetched rather than filtering by the
 * candidate numbers: stored numbers are not guaranteed canonical, so an `.in()`
 * on raw values would miss legitimate matches. The set is bounded by event size.
 *
 * Unlike the opt-out lookup — which fails OPEN so a missing suppression table
 * cannot silently block all sending — this fails CLOSED. Absence of proof of
 * consent is not consent, so any error here must stop the send, not permit it.
 *
 * That fail-closed direction is exactly why the row cap is explicit and loud: a
 * silently truncated set does not over-send, it under-sends, dropping consenting
 * guests with a per-message "NO_SMS_CONSENT" that looks indistinguishable from a
 * genuine refusal. Matches the ceiling fetchRecipients uses, so any audience it
 * can produce fits.
 */
const CONSENT_SET_MAX = 100000;

async function getConsentedPhoneSet(eventId) {
  const out = new Set();
  const { data, error } = await supabase
    .from('rsvp_parties')
    .select('guests!inner(phone, is_primary_contact)')
    .eq('event_id', eventId)
    .eq('sms_consent', true)
    .eq('guests.is_primary_contact', true)
    .not('guests.phone', 'is', null)
    .limit(CONSENT_SET_MAX);
  if (error) throw error;
  const rows = data || [];
  if (rows.length >= CONSENT_SET_MAX) {
    // Never degrade quietly: throwing routes into sendRecipient's fail-closed
    // branch, which stops the send instead of mislabelling consenting guests as
    // non-consenting.
    logger.error({ eventId, cap: CONSENT_SET_MAX }, 'SMS consent set hit its row cap — refusing to send on a possibly truncated set.');
    throw new Error('CONSENT_SET_TRUNCATED');
  }
  for (const row of rows) {
    const primary = Array.isArray(row.guests) ? row.guests[0] : row.guests;
    const canonical = canonicalPhone(primary?.phone);
    if (canonical) out.add(canonical);
  }
  return out;
}

/** True only when this number has an affirmative consent record on this event. */
async function hasSmsConsent(eventId, phone) {
  const canonical = canonicalPhone(phone);
  if (!canonical) return false;
  const set = await getConsentedPhoneSet(eventId);
  return set.has(canonical);
}

/* ─── Atomic credit billing (segment-accurate, with single-credit fallback) ─── */
let multiCreditUnavailable = false;

async function deductCredits(eventId, count, phone, idemKey) {
  if (!multiCreditUnavailable) {
    const { data, error } = await supabase.rpc('deduct_sms_credits_atomic', {
      p_event_id: eventId, p_count: count, p_phone: phone, p_idempotency_key: idemKey,
    });
    if (error) {
      if (isUndefinedFunction(error)) {
        multiCreditUnavailable = true;
        logger.warn('deduct_sms_credits_atomic missing — falling back to single-credit billing. Apply 20260626000000_sms_multi_credit.sql for per-segment charging.');
      } else {
        return { ok: false, error: error.message || 'DEDUCT_FAILED' };
      }
    } else if (data && data.success) {
      return { ok: true, walletId: data.wallet_id, ledgerId: data.ledger_id, idempotent: !!data.idempotent, credits: count };
    } else {
      return { ok: false, error: (data && data.error) || 'DEDUCT_FAILED' };
    }
  }
  const { data, error } = await supabase.rpc('deduct_sms_credit_atomic', {
    p_event_id: eventId, p_phone: phone, p_idempotency_key: idemKey,
  });
  if (error) return { ok: false, error: error.message || 'DEDUCT_FAILED' };
  if (data && data.success) {
    return { ok: true, walletId: data.wallet_id, ledgerId: data.ledger_id, idempotent: !!data.idempotent, credits: 1 };
  }
  return { ok: false, error: (data && data.error) || 'DEDUCT_FAILED' };
}

async function refundCredits(walletId, eventId, ledgerId, count) {
  try {
    if (!multiCreditUnavailable) {
      const { error } = await supabase.rpc('refund_sms_credits_atomic', {
        p_wallet_id: walletId, p_event_id: eventId, p_ledger_id: ledgerId, p_count: count,
      });
      if (!error || !isUndefinedFunction(error)) {
        if (error) logger.error({ err: error }, 'SMS multi-credit refund failed');
        return;
      }
    }
    await supabase.rpc('refund_sms_credit_atomic', {
      p_wallet_id: walletId, p_event_id: eventId, p_ledger_id: ledgerId,
    });
  } catch (e) {
    logger.error({ err: e }, 'SMS credit refund failed (manual reconciliation may be needed)');
  }
}

/**
 * Send to ONE recipient: atomic debit → send → stamp ledger (refund on failure).
 * Pure & reusable; callers aggregate the returned result.
 * @returns {{kind:'sent'|'failed'|'skipped', credits?:number, ledgerId?:string, sid?:string, error?:string}}
 */
async function sendRecipient({ eventId, phone, body, segments, idemKey, twilio, fromNumber, optedOut = null, consented = null }) {
  const norm = normalizePhone(phone);
  if (!isValidPhone(norm)) return { kind: 'failed', error: 'INVALID_PHONE' };

  const canonicalTarget = canonicalPhone(norm);

  // TCPA / Twilio TFV 30475: no message is created without an affirmative,
  // guest-given consent record. Re-verified HERE, per message, rather than
  // trusting the audience query that produced this recipient — a campaign
  // queued days ago must not send to someone who has since had their consent
  // record removed, and any future caller of sendRecipient inherits the gate
  // automatically. Callers that dispatch in batches pass a preloaded
  // `consented` Set (one query per batch); the per-message lookup is the
  // fallback. Fails CLOSED: a lookup error skips the send rather than
  // permitting it, and the number is never billed.
  try {
    const permitted = consented instanceof Set
      ? (canonicalTarget != null && consented.has(canonicalTarget))
      : await hasSmsConsent(eventId, norm);
    if (!permitted) return { kind: 'skipped', error: 'NO_SMS_CONSENT' };
  } catch (e) {
    logger.error({ err: e, eventId }, 'SMS consent verification failed — send blocked (failing closed).');
    return { kind: 'skipped', error: 'CONSENT_CHECK_FAILED' };
  }

  // TCPA/CTIA: an opted-out number is never messaged, from any path (sync
  // controller, async worker, or any future caller), and never billed. Checked
  // here — the final choke point — so a STOP received after a campaign was
  // queued still suppresses the queued send. Callers that dispatch in batches
  // pass a preloaded `optedOut` Set (one query per batch instead of one per
  // message); the per-message lookup remains the fallback.
  const suppressed = optedOut instanceof Set
    ? (canonicalTarget != null && optedOut.has(canonicalTarget))
    : await isOptedOut(norm);
  if (suppressed) return { kind: 'skipped', error: 'OPTED_OUT' };

  const deduct = await deductCredits(eventId, segments, norm, idemKey);
  if (!deduct.ok) return { kind: 'failed', error: deduct.error };
  if (deduct.idempotent) return { kind: 'skipped', ledgerId: deduct.ledgerId };

  if (!twilio) {
    const mockSid = `mock-sid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('sms_credit_ledger').update({ sms_sid: mockSid }).eq('id', deduct.ledgerId);
    logger.info(`[MOCK SMS] → ${norm} (${segments} seg): ${body}`);
    return { kind: 'sent', credits: deduct.credits, ledgerId: deduct.ledgerId, sid: mockSid };
  }

  try {
    const createParams = { body, from: fromNumber, to: norm };
    // Ask Twilio to POST delivery receipts so undelivered/failed messages can be
    // reconciled and auto-refunded (see reconcile_sms_delivery / the status webhook).
    const callbackUrl = process.env.SMS_STATUS_CALLBACK_URL;
    if (callbackUrl) createParams.statusCallback = callbackUrl;
    const msg = await twilio.messages.create(createParams);
    await supabase.from('sms_credit_ledger').update({ sms_sid: msg.sid }).eq('id', deduct.ledgerId);
    return { kind: 'sent', credits: deduct.credits, ledgerId: deduct.ledgerId, sid: msg.sid };
  } catch (smsErr) {
    await refundCredits(deduct.walletId, eventId, deduct.ledgerId, deduct.credits);
    return { kind: 'failed', error: smsErr.message || 'SMS_SEND_FAILED' };
  }
}

module.exports = {
  BRANDING,
  COMPLIANCE_FOOTER,
  canonicalPhone,
  getOptedOutSet,
  isOptedOut,
  getConsentedPhoneSet,
  hasSmsConsent,
  VALID_AUDIENCES,
  AUDIENCE_RESPONSES,
  sleep,
  chunk,
  normalizePhone,
  isValidPhone,
  normalizeAudiences,
  resolveResponses,
  fetchRecipients,
  getTableMap,
  personalize,
  deductCredits,
  refundCredits,
  sendRecipient,
};
