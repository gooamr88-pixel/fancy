/**
 * Phone number normalization to E.164, with the United States (+1) as the
 * platform default country.
 *
 * Why a shared helper: SMS delivery (Twilio) requires E.164 — a leading `+`,
 * country code, then the national number, 8–15 digits total, no leading zero.
 * Guests/organizers usually type local US numbers ("(555) 123-4567" or
 * "5551234567"), so a bare 10-digit number is assumed US and gets a `+1`.
 *
 *   normalizeToE164('(555) 123-4567')  -> '+15551234567'
 *   normalizeToE164('5551234567')      -> '+15551234567'
 *   normalizeToE164('+44 7911 123456') -> '+447911123456'
 *   normalizeToE164('01001234567')     -> null   (local format, leading zero)
 *   normalizeToE164('')                -> null
 *
 * Returns the clean E.164 string, or null when the input can't be a valid
 * sendable number.
 */

const DEFAULT_COUNTRY = 'US';

/** True if `value` is already a well-formed E.164 number. */
function isValidE164(value) {
  return typeof value === 'string' && /^\+[1-9]\d{6,14}$/.test(value);
}

/**
 * Normalize a raw, human-entered phone string to E.164 (US default), or null.
 * @param {string} raw
 * @param {string} [defaultCountry='US']
 * @returns {string|null}
 */
function normalizeToE164(raw, defaultCountry = DEFAULT_COUNTRY) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const hasPlus = s.startsWith('+');
  const is00 = s.startsWith('00'); // common international dialing prefix
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  // Explicit international forms keep their country code as typed.
  if (hasPlus) return isValidE164('+' + digits) ? '+' + digits : null;
  if (is00) {
    digits = digits.replace(/^0+/, '');
    return isValidE164('+' + digits) ? '+' + digits : null;
  }

  // No country code given → apply the default country's rules.
  if (defaultCountry === 'US') {
    if (digits.length === 10) {
      const e164 = '+1' + digits;
      return isValidE164(e164) ? e164 : null;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      const e164 = '+' + digits;
      return isValidE164(e164) ? e164 : null;
    }
  }

  // Otherwise treat a plausibly-complete international number (no leading zero)
  // as already carrying its country code.
  const e164 = '+' + digits;
  return isValidE164(e164) ? e164 : null;
}

/** Convenience: is `raw` a phone we can normalize and send to? */
function isSendablePhone(raw, defaultCountry = DEFAULT_COUNTRY) {
  return normalizeToE164(raw, defaultCountry) !== null;
}

module.exports = { normalizeToE164, isValidE164, isSendablePhone, DEFAULT_COUNTRY };
