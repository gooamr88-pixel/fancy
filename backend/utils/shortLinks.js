/**
 * SHORT LINKS — because a URL is the most expensive word in a text message.
 *
 * ── Why this exists ──
 *
 * A GSM-7 SMS segment holds 160 characters. The mandatory compliance footer takes
 * 78 of them before the message says anything. The RSVP link —
 * `https://<host>/<slug>/rsvp?g=<uuid>` — is about 89 more, most of it a UUID no
 * human will ever read. Together that is 167 characters of overhead in a
 * 160-character budget, so every message was two segments before the guest's name
 * was even added, and every Arabic message was four.
 *
 * A 32-character short link takes an Arabic message from four segments to three.
 * That is a permanent 25% cut on every Arabic event, bought once, here.
 *
 * It also simply reads better. An 89-character URL wraps across four lines in a
 * message app and looks like phishing; `fancyrsvp.com/i/k7m2xq4p` does not.
 *
 * ── Why codes are 8 characters of this particular alphabet ──
 *
 * A short link exposes exactly what the URL it replaces exposes — so a guessable
 * code is a guessable RSVP link. The alphabet below is 32 symbols, so 8 characters
 * is 32^8 ≈ 1.1 x 10^12 possibilities. Against even a million live links that is
 * roughly a one-in-a-million chance per blind guess, and the redirect route is
 * rate-limited on top.
 *
 * The alphabet deliberately omits `0/O`, `1/l/I` and `u` (which turns innocent
 * strings into words nobody wants printed on a wedding invitation). Codes get read
 * aloud and typed by hand when a link does not survive a copy-paste, and a
 * character set where two symbols look identical converts a support question into
 * a support ticket.
 */

const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const { getPublicBaseUrl } = require('./publicUrl');
const logger = require('./logger');

/** 32 unambiguous, non-word-forming symbols. See the note above before changing. */
const ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789';
const CODE_LENGTH = 8;

/**
 * A random code.
 *
 * crypto.randomBytes, not Math.random: these guard access to a guest's RSVP page,
 * and a predictable PRNG seeded per-process is exactly the kind of thing that
 * looks fine until someone enumerates a whole event's guest list.
 *
 * Rejection-sampling the modulo bias away is cheap here and keeps the
 * distribution genuinely uniform — with 30 symbols in a 256-value byte space,
 * naive `% 30` would make the first 16 symbols ~7% likelier than the rest.
 */
function generateCode(length = CODE_LENGTH) {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length * 2)) {
      if (byte >= max) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Turn a long URL into a short one.
 *
 * IDEMPOTENT per (partyId, kind): re-sending a guest's invitation reuses the code
 * they already have rather than minting a second one at the same destination. A
 * guest who saved the first text and taps it a week later must land somewhere, and
 * link rot inside a single event is not a tradeoff worth any storage saving.
 *
 * NEVER THROWS. A failure here returns the original long URL, so the worst case is
 * an expensive message rather than no message. Refusing to send an invitation
 * because a convenience table was unreachable would be a spectacularly bad trade.
 *
 * @param {string}  targetUrl  the real destination
 * @param {object}  [meta]
 * @param {string}  [meta.eventId]
 * @param {string}  [meta.partyId]
 * @param {string}  [meta.kind]   'rsvp' | 'ticket' | 'event'
 * @returns {Promise<string>} a short URL, or `targetUrl` unchanged on any failure
 */
async function shorten(targetUrl, { eventId = null, partyId = null, kind = null } = {}) {
  const target = String(targetUrl || '').trim();
  if (!target) return target;

  const base = getPublicBaseUrl();
  if (!base) return target;

  try {
    // Reuse before minting. The partial unique index on (party_id, kind) makes
    // this the same lookup the database would enforce anyway.
    if (partyId && kind) {
      const { data: existing } = await supabase
        .from('short_links')
        .select('code, target_url')
        .eq('party_id', partyId)
        .eq('kind', kind)
        .maybeSingle();

      if (existing?.code) {
        // The destination can legitimately move — a slug rename changes every RSVP
        // URL in the event. Repoint the existing code rather than minting a new
        // one, so links already sitting in guests' phones keep working.
        if (existing.target_url !== target) {
          await supabase.from('short_links').update({ target_url: target }).eq('code', existing.code);
        }
        return `${base}/i/${existing.code}`;
      }
    }

    // Collisions are vanishingly unlikely (32^8), but "vanishingly unlikely"
    // across every message this platform will ever send is not "impossible", and
    // the failure mode is a guest opening a stranger's invitation. Retry on the
    // primary-key violation rather than trusting the odds.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      const { error } = await supabase
        .from('short_links')
        .insert({ code, target_url: target, event_id: eventId, party_id: partyId, kind });

      if (!error) return `${base}/i/${code}`;

      // 23505 is a unique violation — either the code collided, or a concurrent
      // request for the same (party, kind) won the race. Both are resolved by
      // looping: the second case will find the winner's row on the next pass.
      if (error.code !== '23505') break;

      if (partyId && kind) {
        const { data: raced } = await supabase
          .from('short_links')
          .select('code')
          .eq('party_id', partyId)
          .eq('kind', kind)
          .maybeSingle();
        if (raced?.code) return `${base}/i/${raced.code}`;
      }
    }
  } catch (err) {
    logger.warn({ err, kind, partyId }, '[short-links] could not shorten; falling back to the full URL');
  }

  // Longer message, higher cost, but it still arrives and it still works.
  return target;
}

/**
 * Resolve a code to its destination, and count the tap.
 *
 * The hit counter is fire-and-forget on purpose: a guest tapping their invitation
 * must not wait on a write, and must not fail to arrive because one did.
 */
async function resolve(code) {
  const clean = String(code || '').trim().toLowerCase();
  if (!clean || clean.length > 32 || !/^[a-z0-9]+$/.test(clean)) return null;

  const { data, error } = await supabase
    .from('short_links')
    .select('code, target_url')
    .eq('code', clean)
    .maybeSingle();

  if (error || !data?.target_url) return null;

  supabase.rpc('bump_short_link', { p_code: clean }).then(
    () => {},
    () => {}, // an unmigrated deployment simply does not count hits
  );

  return data.target_url;
}

module.exports = { shorten, resolve, generateCode, ALPHABET, CODE_LENGTH };
