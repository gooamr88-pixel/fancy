'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

/**
 * Shared 6-box auto-advancing OTP input (digit-per-box, paste-splitting,
 * backspace-to-previous) — previously implemented once inline in
 * register/page.js while forgot-password/page.js used a single plain input
 * for the same kind of code, two different experiences for the same concept.
 *
 * Controlled as a single string (e.g. "123456"), matching how callers already
 * pass the code to the verify/reset API, rather than an array of characters.
 *
 * Exposes `focusFirst()` via ref for callers that need to refocus after a
 * failed verify or a resend (mirrors the pattern register.js already used).
 */
const OtpBoxes = forwardRef(function OtpBoxes({
  length = 6, value, onChange, disabled = false, hasError = false,
  ariaLabel = '6-digit verification code', autoFocus = false,
}, ref) {
  const inputRefs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useImperativeHandle(ref, () => ({
    focusFirst: () => inputRefs.current[0]?.focus(),
  }));

  useEffect(() => {
    if (!autoFocus) return undefined;
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 100);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const handleChange = (index, raw) => {
    if (!/^\d*$/.test(raw)) return;
    const next = digits.slice();
    next[index] = raw.slice(-1);
    onChange(next.join(''));
    if (raw && index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="otp-boxes-row" role="group" aria-label={ariaLabel}>
      {digits.map((val, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={hasError || undefined}
          className={`otp-boxes-input${val ? ' otp-boxes-filled' : ''}${hasError ? ' otp-boxes-error' : ''}`}
        />
      ))}

      <style jsx>{`
        .otp-boxes-row {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin: 28px 0;
        }
        .otp-boxes-input {
          width: 52px;
          height: 60px;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          font-family: monospace;
          border: 2px solid #E8E2D6;
          border-radius: 12px;
          background: #FAFAF8;
          color: #191B1E;
          outline: none;
          transition: all 0.3s ease;
        }
        .otp-boxes-input:focus {
          border-color: #B8944F;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(184, 148, 79, 0.12);
        }
        .otp-boxes-filled {
          border-color: #B8944F;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(184, 148, 79, 0.08);
        }
        .otp-boxes-error {
          border-color: #DC2626;
        }
        @media (max-width: 640px) {
          .otp-boxes-input {
            width: 44px;
            height: 52px;
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
});

export default OtpBoxes;
