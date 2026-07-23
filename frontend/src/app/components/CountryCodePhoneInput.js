'use client';
import React, { useEffect, useRef, useState } from 'react';

const C = { charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', error: '#ef4444', gold: '#B8944F' };

// Calling code -> flag/name, resolved live as the guest types the numeric
// code (there's still no dropdown — see the component doc below for why).
// Weighted toward the Arab world (this platform's other primary audience)
// plus every major global market; ambiguous codes (e.g. "1") show the most
// common country sharing that prefix.
const COUNTRY_BY_CODE = {
  1: { flag: '🇺🇸', name: 'United States' }, 7: { flag: '🇷🇺', name: 'Russia' },
  20: { flag: '🇪🇬', name: 'Egypt' }, 27: { flag: '🇿🇦', name: 'South Africa' },
  30: { flag: '🇬🇷', name: 'Greece' }, 31: { flag: '🇳🇱', name: 'Netherlands' },
  32: { flag: '🇧🇪', name: 'Belgium' }, 33: { flag: '🇫🇷', name: 'France' },
  34: { flag: '🇪🇸', name: 'Spain' }, 39: { flag: '🇮🇹', name: 'Italy' },
  40: { flag: '🇷🇴', name: 'Romania' }, 41: { flag: '🇨🇭', name: 'Switzerland' },
  44: { flag: '🇬🇧', name: 'United Kingdom' }, 45: { flag: '🇩🇰', name: 'Denmark' },
  46: { flag: '🇸🇪', name: 'Sweden' }, 47: { flag: '🇳🇴', name: 'Norway' },
  48: { flag: '🇵🇱', name: 'Poland' }, 49: { flag: '🇩🇪', name: 'Germany' },
  51: { flag: '🇵🇪', name: 'Peru' }, 52: { flag: '🇲🇽', name: 'Mexico' },
  54: { flag: '🇦🇷', name: 'Argentina' }, 55: { flag: '🇧🇷', name: 'Brazil' },
  56: { flag: '🇨🇱', name: 'Chile' }, 57: { flag: '🇨🇴', name: 'Colombia' },
  60: { flag: '🇲🇾', name: 'Malaysia' }, 61: { flag: '🇦🇺', name: 'Australia' },
  62: { flag: '🇮🇩', name: 'Indonesia' }, 63: { flag: '🇵🇭', name: 'Philippines' },
  64: { flag: '🇳🇿', name: 'New Zealand' }, 65: { flag: '🇸🇬', name: 'Singapore' },
  66: { flag: '🇹🇭', name: 'Thailand' }, 81: { flag: '🇯🇵', name: 'Japan' },
  82: { flag: '🇰🇷', name: 'South Korea' }, 86: { flag: '🇨🇳', name: 'China' },
  90: { flag: '🇹🇷', name: 'Turkey' }, 91: { flag: '🇮🇳', name: 'India' },
  92: { flag: '🇵🇰', name: 'Pakistan' }, 93: { flag: '🇦🇫', name: 'Afghanistan' },
  94: { flag: '🇱🇰', name: 'Sri Lanka' }, 95: { flag: '🇲🇲', name: 'Myanmar' },
  98: { flag: '🇮🇷', name: 'Iran' },
  211: { flag: '🇸🇸', name: 'South Sudan' }, 212: { flag: '🇲🇦', name: 'Morocco' },
  213: { flag: '🇩🇿', name: 'Algeria' }, 216: { flag: '🇹🇳', name: 'Tunisia' },
  218: { flag: '🇱🇾', name: 'Libya' }, 220: { flag: '🇬🇲', name: 'Gambia' },
  221: { flag: '🇸🇳', name: 'Senegal' }, 234: { flag: '🇳🇬', name: 'Nigeria' },
  254: { flag: '🇰🇪', name: 'Kenya' }, 351: { flag: '🇵🇹', name: 'Portugal' },
  352: { flag: '🇱🇺', name: 'Luxembourg' }, 353: { flag: '🇮🇪', name: 'Ireland' },
  358: { flag: '🇫🇮', name: 'Finland' }, 359: { flag: '🇧🇬', name: 'Bulgaria' },
  370: { flag: '🇱🇹', name: 'Lithuania' }, 371: { flag: '🇱🇻', name: 'Latvia' },
  372: { flag: '🇪🇪', name: 'Estonia' }, 380: { flag: '🇺🇦', name: 'Ukraine' },
  385: { flag: '🇭🇷', name: 'Croatia' }, 386: { flag: '🇸🇮', name: 'Slovenia' },
  420: { flag: '🇨🇿', name: 'Czech Republic' }, 421: { flag: '🇸🇰', name: 'Slovakia' },
  960: { flag: '🇲🇻', name: 'Maldives' }, 961: { flag: '🇱🇧', name: 'Lebanon' },
  962: { flag: '🇯🇴', name: 'Jordan' }, 963: { flag: '🇸🇾', name: 'Syria' },
  964: { flag: '🇮🇶', name: 'Iraq' }, 965: { flag: '🇰🇼', name: 'Kuwait' },
  966: { flag: '🇸🇦', name: 'Saudi Arabia' }, 967: { flag: '🇾🇪', name: 'Yemen' },
  968: { flag: '🇴🇲', name: 'Oman' }, 970: { flag: '🇵🇸', name: 'Palestine' },
  971: { flag: '🇦🇪', name: 'United Arab Emirates' }, 972: { flag: '🇮🇱', name: 'Israel' },
  973: { flag: '🇧🇭', name: 'Bahrain' }, 974: { flag: '🇶🇦', name: 'Qatar' },
  975: { flag: '🇧🇹', name: 'Bhutan' }, 976: { flag: '🇲🇳', name: 'Mongolia' },
  977: { flag: '🇳🇵', name: 'Nepal' },
};

// Splits an existing "+<code><number>" value back into its two boxes once,
// at mount — after that the boxes are the source of truth, so a parent
// re-render doesn't fight the guest's typing.
function splitInitialValue(value, defaultCode) {
  if (value && value.startsWith('+')) {
    const digits = value.slice(1);
    if (defaultCode && digits.startsWith(defaultCode)) {
      return { code: defaultCode, number: digits.slice(defaultCode.length) };
    }
    if (digits) return { code: '', number: digits };
  }
  return { code: defaultCode, number: '' };
}

/**
 * Plain-number phone input — a numeric country-code box (defaults to "1",
 * USA) next to a numeric local-number box, with a live flag indicator that
 * resolves from COUNTRY_BY_CODE as the guest types. Still no dropdown/
 * select, by original request — the flag is a read-only confirmation of
 * what was typed, not a picker.
 *
 * Composes both boxes into a single "+<code><number>" string via onChange —
 * the same E.164-ish contract PhoneNumberInput's callers already expect
 * (empty string when untouched, so an unfilled optional phone field never
 * gets flagged as invalid just because a default code is pre-filled).
 */
export default function CountryCodePhoneInput({
  value, onChange, placeholder, hasError = false, disabled = false, required = false,
  defaultCountryCode = '1', name, id,
  'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy,
}) {
  const [{ code, number }, setParts] = useState(() => splitInitialValue(value, defaultCountryCode));
  // Tracks the value THIS component itself last emitted, so an external
  // change to `value` (a guest's saved phone number arriving asynchronously
  // after this input already mounted with it blank — the RSVP prefill/draft
  // effects in RsvpWizard.js and RsvpSection.js both do this) can still be
  // synced in, without fighting the guest's own typing (which also flows
  // back in through this same `value` prop via the parent's state).
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setParts(splitInitialValue(value, defaultCountryCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- external-value resync only; defaultCountryCode is static per caller
  }, [value]);

  const emit = (nextCode, nextNumber) => {
    const next = nextNumber ? `+${nextCode}${nextNumber}` : '';
    lastEmittedRef.current = next;
    onChange?.(next);
  };

  const handleCodeChange = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    setParts({ code: digits, number });
    emit(digits, number);
  };

  const handleNumberChange = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 14);
    setParts({ code, number: digits });
    emit(code, digits);
  };

  const country = COUNTRY_BY_CODE[code];

  return (
    <div className={`cc-phone${hasError ? ' cc-phone--error' : ''}`}>
      <span className="cc-phone-prefix" aria-hidden="true">
        <span className="cc-phone-flag">{country ? country.flag : '🌐'}</span>
        <span className="cc-phone-plus">+</span>
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="tel-country-code"
        className="cc-phone-code"
        aria-label={country ? `Country code (${country.name})` : 'Country code'}
        value={code}
        disabled={disabled}
        onChange={(e) => handleCodeChange(e.target.value)}
      />
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="tel-national"
        className="cc-phone-number"
        placeholder={placeholder || 'Phone number'}
        value={number}
        disabled={disabled}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => handleNumberChange(e.target.value)}
      />
      <style jsx>{`
        .cc-phone { display: flex; align-items: stretch; width: 100%; }
        .cc-phone-prefix {
          display: flex; align-items: center; gap: 6px; justify-content: center;
          padding: 0 8px 0 14px; background: ${C.white}; border: 1px solid ${C.border}; border-right: none;
          border-radius: 12px 0 0 12px;
        }
        .cc-phone-flag {
          font-size: 17px; line-height: 1; transition: opacity 0.15s ease;
        }
        .cc-phone-plus {
          color: ${C.stone}; font-size: 16px; font-family: var(--font-sans);
        }
        .cc-phone-code {
          width: 48px; flex-shrink: 0; text-align: center; box-sizing: border-box;
          padding: 14px 4px; background: ${C.white}; border: 1px solid ${C.border}; border-left: none; border-right: none;
          /* 16px, not 14px — below that iOS Safari auto-zooms on focus, and
             this is the phone number field, the single most-tapped input on
             the whole RSVP form. */
          font-size: 16px; color: ${C.charcoal}; font-family: var(--font-sans); outline: none;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .cc-phone-number {
          flex: 1; min-width: 0; box-sizing: border-box; padding: 14px 16px;
          background: ${C.white}; border: 1px solid ${C.border}; border-radius: 0 12px 12px 0;
          font-size: 16px; color: ${C.charcoal}; font-family: var(--font-sans); outline: none;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .cc-phone-code:focus, .cc-phone-number:focus {
          border-color: ${C.gold}; box-shadow: 0 0 0 3px rgba(184,148,79,0.12); position: relative; z-index: 1;
        }
        .cc-phone--error .cc-phone-prefix, .cc-phone--error .cc-phone-code, .cc-phone--error .cc-phone-number {
          border-color: ${C.error};
        }
      `}</style>
    </div>
  );
}
