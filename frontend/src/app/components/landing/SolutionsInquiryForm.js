'use client';

import { useState } from 'react';

/**
 * Shared lead-capture form for the /solutions/* B2B audience pages (Planners,
 * Venues, Corporate). Posts to the same `/public/contact` endpoint the
 * generic Contact page uses, but tags the submission with `segment` plus the
 * extra company/phone/guest-volume fields a sales inquiry actually needs —
 * see backend/controllers/marketingController.js.
 */
export default function SolutionsInquiryForm({
  segment,
  heading = 'Talk to our team',
  description = "Tell us about your event and we'll get back to you within one business day.",
  guestVolumeOptions = ['Under 100', '100 – 250', '250 – 500', '500 – 1,000', '1,000+'],
  messagePlaceholder = 'Tell us about your event or organization...',
  accentColor = '#B8944F',
}) {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', phone: '', expectedGuests: '', message: '' });
  const [focusedField, setFocusedField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          segment,
          subject: `${segment.charAt(0).toUpperCase()}${segment.slice(1)} inquiry`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Could not send your message. Please try again.');
      }
      setSubmitted(true);
      setFormData({ name: '', email: '', company: '', phone: '', expectedGuests: '', message: '' });
    } catch (err) {
      setSubmitError(err.message || 'Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%',
    padding: '13px 16px',
    borderRadius: '10px',
    border: `1.5px solid ${focusedField === field ? accentColor : '#E8E2D6'}`,
    fontFamily: 'var(--font-sans)',
    fontSize: '14.5px',
    color: '#191B1E',
    background: '#FFFFFF',
    outline: 'none',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    boxShadow: focusedField === field ? `0 0 0 3px ${accentColor}14` : 'none',
    boxSizing: 'border-box',
  });

  const labelStyle = {
    fontFamily: 'var(--font-sans)',
    fontSize: '12.5px',
    fontWeight: 600,
    color: '#191B1E',
    display: 'block',
    marginBottom: '7px',
    letterSpacing: '0.3px',
  };

  if (submitted) {
    return (
      <div
        style={{
          padding: '40px 32px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: `1px solid ${accentColor}40`,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 16px' }}>
          <circle cx="20" cy="20" r="20" fill={accentColor} />
          <path d="M12 20l6 6L28 14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: '#191B1E', marginBottom: '8px' }}>
          Thanks — we&apos;ve got it
        </h3>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#5E5A52', lineHeight: 1.6, margin: 0 }}>
          Someone from our team will reach out within one business day.
        </p>
      </div>
    );
  }

  return (
    <div
      className="siq-card"
      style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #E8E2D6',
        padding: '36px 32px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
        boxSizing: 'border-box',
      }}
    >
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: '#191B1E', marginBottom: '6px' }}>
        {heading}
      </h3>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#5E5A52', marginBottom: '26px', lineHeight: 1.6 }}>
        {description}
      </p>

      {submitError && (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(196, 94, 94, 0.06)',
            borderRadius: '10px',
            border: '1px solid rgba(196, 94, 94, 0.35)',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: '#C45E5E', fontWeight: 600 }}>
            {submitError}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="siq-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor={`siq-name-${segment}`}>Full Name</label>
            <input
              id={`siq-name-${segment}`} type="text" name="name" autoComplete="name" required
              value={formData.name} onChange={handleChange}
              onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)}
              placeholder="Your full name" style={inputStyle('name')}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor={`siq-email-${segment}`}>Work Email</label>
            <input
              id={`siq-email-${segment}`} type="email" name="email" autoComplete="email" required
              value={formData.email} onChange={handleChange}
              onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
              placeholder="you@company.com" style={inputStyle('email')}
            />
          </div>
        </div>

        <div className="siq-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor={`siq-company-${segment}`}>Company / Organization</label>
            <input
              id={`siq-company-${segment}`} type="text" name="company" autoComplete="organization"
              value={formData.company} onChange={handleChange}
              onFocus={() => setFocusedField('company')} onBlur={() => setFocusedField(null)}
              placeholder="Optional" style={inputStyle('company')}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle} htmlFor={`siq-phone-${segment}`}>Phone</label>
            <input
              id={`siq-phone-${segment}`} type="tel" name="phone" autoComplete="tel"
              value={formData.phone} onChange={handleChange}
              onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)}
              placeholder="Optional" style={inputStyle('phone')}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle} htmlFor={`siq-guests-${segment}`}>Expected Guest Volume</label>
          <select
            id={`siq-guests-${segment}`} name="expectedGuests"
            value={formData.expectedGuests} onChange={handleChange}
            onFocus={() => setFocusedField('expectedGuests')} onBlur={() => setFocusedField(null)}
            style={{
              ...inputStyle('expectedGuests'),
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%235E5A52' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 16px center',
              paddingRight: '40px',
              cursor: 'pointer',
              color: formData.expectedGuests ? '#191B1E' : '#9E9A92',
            }}
          >
            <option value="">Select a range (optional)</option>
            {guestVolumeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle} htmlFor={`siq-message-${segment}`}>Message</label>
          <textarea
            id={`siq-message-${segment}`} name="message" required rows="4"
            value={formData.message} onChange={handleChange}
            onFocus={() => setFocusedField('message')} onBlur={() => setFocusedField(null)}
            placeholder={messagePlaceholder}
            style={{ ...inputStyle('message'), resize: 'vertical', minHeight: '100px', lineHeight: 1.6 }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '14.5px',
            fontWeight: 700,
            borderRadius: '10px',
            letterSpacing: '0.3px',
            border: 'none',
            color: '#FFFFFF',
            background: accentColor,
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? 'default' : 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {submitting ? 'Sending…' : 'Send Inquiry'}
        </button>
      </form>

      <style jsx>{`
        @media (max-width: 480px) {
          .siq-row { flex-direction: column !important; gap: 16px !important; }
          .siq-card { padding: 26px 22px !important; }
        }
      `}</style>
    </div>
  );
}
