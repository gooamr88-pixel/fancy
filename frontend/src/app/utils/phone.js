/**
 * Client-side phone normalization to E.164, United States (+1) default.
 *
 * Mirrors backend/utils/phone.js so the UI can validate/format before submit
 * and the server can re-validate authoritatively. SMS (Twilio) requires E.164:
 * leading `+`, country code, 8–15 digits total, no leading zero. A bare 10-digit
 * number is assumed US and gets `+1`.
 *
 *   normalizeToE164('(555) 123-4567') -> '+15551234567'
 *   normalizeToE164('01001234567')    -> null   (local format, leading zero)
 */

export const DEFAULT_COUNTRY = 'US';

/** True if `value` is already a well-formed E.164 number. */
export function isValidE164(value) {
  return typeof value === 'string' && /^\+[1-9]\d{6,14}$/.test(value);
}

/** Normalize a raw, human-entered phone string to E.164 (US default), or null. */
export function normalizeToE164(raw, defaultCountry = DEFAULT_COUNTRY) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const hasPlus = s.startsWith('+');
  const is00 = s.startsWith('00');
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  if (hasPlus) return isValidE164('+' + digits) ? '+' + digits : null;
  if (is00) {
    digits = digits.replace(/^0+/, '');
    return isValidE164('+' + digits) ? '+' + digits : null;
  }

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

  const e164 = '+' + digits;
  return isValidE164(e164) ? e164 : null;
}

/** Convenience: is `raw` a phone we can normalize and send to? */
export function isSendablePhone(raw, defaultCountry = DEFAULT_COUNTRY) {
  return normalizeToE164(raw, defaultCountry) !== null;
}
