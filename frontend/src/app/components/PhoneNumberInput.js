'use client';
import React from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

const C = { gold: '#B8944F', charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', error: '#ef4444' };

/**
 * Shared international phone input — a flag + dial-code selector wrapping
 * react-international-phone, reskinned to match the app's brand. `onChange`
 * receives a plain E.164 string (e.g. "+15551234567", already normalized by
 * the library), so it drops straight into the same state/validation every
 * call site already used with a bare `<input type="tel">`.
 */
export default function PhoneNumberInput({
  value, onChange, placeholder, hasError = false, disabled = false, required = false,
  defaultCountry = 'us', preferredCountries = ['us', 'eg', 'gb'], name, id,
  'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy,
}) {
  // FormField (GuestUI.js) clones aria-invalid/aria-describedby onto its
  // child once an error is set — this component previously had nowhere to
  // put them, so the error state was shown visually but never announced.
  const inputProps = {
    ...(id ? { id } : {}),
    ...(ariaInvalid !== undefined ? { 'aria-invalid': ariaInvalid } : {}),
    ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
  };
  return (
    <div className={`phone-number-input${hasError ? ' phone-number-input--error' : ''}`}>
      <PhoneInput
        defaultCountry={defaultCountry}
        preferredCountries={preferredCountries}
        value={value || ''}
        onChange={(phone) => onChange?.(phone)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        name={name}
        inputProps={Object.keys(inputProps).length ? inputProps : undefined}
      />
      <style jsx global>{`
        .phone-number-input .react-international-phone-input-container {
          width: 100%;
        }
        .phone-number-input .react-international-phone-country-selector-button {
          background: ${C.white};
          border: 1px solid ${C.border};
          border-right: none;
          border-radius: 8px 0 0 8px;
          padding: 0 8px 0 12px;
        }
        .phone-number-input .react-international-phone-country-selector-button:hover {
          background: ${C.ivory};
        }
        .phone-number-input .react-international-phone-input {
          flex: 1;
          width: 100%;
          background: ${C.white};
          border: 1px solid ${C.border};
          border-radius: 0 8px 8px 0;
          padding: 10px 14px;
          font-size: 14px;
          color: ${C.charcoal};
          font-family: var(--font-sans);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .phone-number-input .react-international-phone-input:focus {
          outline: none;
          border-color: ${C.gold};
          box-shadow: 0 0 0 3px rgba(184,148,79,0.12);
        }
        .phone-number-input--error .react-international-phone-country-selector-button,
        .phone-number-input--error .react-international-phone-input {
          border-color: ${C.error};
        }
        .phone-number-input .react-international-phone-country-selector-dropdown {
          border-radius: 10px;
          border: 1px solid ${C.border};
          box-shadow: 0 8px 28px rgba(0,0,0,0.12);
          font-family: var(--font-sans);
          z-index: 10000;
        }
        .phone-number-input .react-international-phone-country-selector-dropdown__list-item:hover {
          background: ${C.ivory};
        }
        .phone-number-input .react-international-phone-country-selector-dropdown__list-item--selected {
          background: rgba(184,148,79,0.08);
        }
        .phone-number-input .react-international-phone-country-selector-dropdown__list-item-dial-code {
          color: ${C.stone};
        }
      `}</style>
    </div>
  );
}
