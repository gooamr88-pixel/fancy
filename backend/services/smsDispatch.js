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

// GSM-7-safe separator (an em-dash forces UCS-2 → 70-char segments → triple cost).
const BRANDING = ' - Fancy RSVP';

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
 */
async function fetchRecipients(eventId, { audiences = ['pending'], guestIds = null, limit = 100000 } = {}) {
  let query = supabase
    .from('rsvp_parties')
    .select('id, label, response, guests!inner(is_primary_contact, phone)')
    .eq('event_id', eventId)
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
  if (!body.endsWith(BRANDING)) body = `${body}${BRANDING}`;
  const seg = computeSmsSegments(body);
  return { body, segments: seg.segments };
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
async function sendRecipient({ eventId, phone, body, segments, idemKey, twilio, fromNumber }) {
  const norm = normalizePhone(phone);
  if (!isValidPhone(norm)) return { kind: 'failed', error: 'INVALID_PHONE' };

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
