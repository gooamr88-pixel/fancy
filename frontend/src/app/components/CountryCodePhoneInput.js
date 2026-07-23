'use client';
import React, { useEffect, useRef, useState } from 'react';

const C = { charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', error: '#ef4444', gold: '#B8944F' };

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
 * USA) next to a numeric local-number box. No flag/country dropdown, by
 * request: guests type the country code themselves as a number.
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

  return (
    <div className={`cc-phone${hasError ? ' cc-phone--error' : ''}`}>
      <span className="cc-phone-plus" aria-hidden="true">+</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="tel-country-code"
        className="cc-phone-code"
        aria-label="Country code"
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
        .cc-phone-plus {
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px 0 14px; background: ${C.white}; border: 1px solid ${C.border}; border-right: none;
          border-radius: 12px 0 0 12px; color: ${C.stone}; font-size: 14px; font-family: var(--font-sans);
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
        .cc-phone--error .cc-phone-plus, .cc-phone--error .cc-phone-code, .cc-phone--error .cc-phone-number {
          border-color: ${C.error};
        }
      `}</style>
    </div>
  );
}
