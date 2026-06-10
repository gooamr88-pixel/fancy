'use client';

import { useState } from 'react';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Templates', 'Integrations'],
  Company: ['About', 'Blog', 'Careers', 'Press'],
  Support: ['Help Center', 'Contact', 'Privacy', 'Terms'],
};

function FooterLink({ text }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        color: hovered ? '#B8944F' : 'rgba(255, 255, 255, 0.6)',
        textDecoration: 'none',
        transition: 'color 0.25s ease',
        lineHeight: '2.2',
        display: 'block',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {text}
    </a>
  );
}

function SocialIcon({ children, label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      aria-label={label}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: `1px solid ${hovered ? '#B8944F' : 'rgba(255, 255, 255, 0.15)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.25s ease',
        background: hovered ? 'rgba(184, 148, 79, 0.1)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={hovered ? '#B8944F' : 'rgba(255, 255, 255, 0.5)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke 0.25s ease' }}
      >
        {children}
      </svg>
    </a>
  );
}

export default function FooterSection() {
  const [emailValue, setEmailValue] = useState('');
  const [btnHovered, setBtnHovered] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  return (
    <footer
      style={{
        background: '#191B1E',
        padding: '0',
      }}
    >
      {/* Gold shimmer divider */}
      <div className="gold-shimmer-line" />

      {/* Main footer content */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '72px 24px 0',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.5fr',
            gap: '40px',
          }}
        >
          {/* Brand column */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '16px',
                lineHeight: '1',
              }}
            >
              <span style={{ color: '#B8944F' }}>Fancy</span>
              <span style={{ color: '#FFFFFF' }}> RSVP</span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
                lineHeight: '1.7',
                maxWidth: '240px',
              }}
            >
              Premium RSVP branding for weddings and elegant events.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.35)',
                  marginBottom: '20px',
                }}
              >
                {category}
              </h4>
              {links.map((link) => (
                <FooterLink key={link} text={link} />
              ))}
            </div>
          ))}

          {/* Newsletter column */}
          <div>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.35)',
                marginBottom: '20px',
              }}
            >
              Newsletter
            </h4>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}
            >
              Get tips on event planning and product updates.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                type="email"
                placeholder="Enter your email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${emailFocused ? '#B8944F' : 'rgba(255, 255, 255, 0.12)'}`,
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color 0.25s ease',
                  minWidth: '0',
                }}
              />
              <button
                onMouseEnter={() => setBtnHovered(true)}
                onMouseLeave={() => setBtnHovered(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: btnHovered
                    ? 'linear-gradient(135deg, #a07f3f 0%, #c9a85e 100%)'
                    : 'linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  whiteSpace: 'nowrap',
                  boxShadow: btnHovered
                    ? '0 4px 14px rgba(184, 148, 79, 0.35)'
                    : '0 2px 8px rgba(184, 148, 79, 0.2)',
                }}
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: '60px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '28px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.35)',
            }}
          >
            © 2025 Fancy RSVP. All rights reserved.
          </p>

          {/* Social icons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Twitter / X */}
            <SocialIcon label="Twitter">
              <path d="M22 4s-1.3.8-3 1.2A4.8 4.8 0 0 0 12 8v1A10.5 10.5 0 0 1 3 4s-4 9 5 13a11.6 11.6 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.1-.9A7.7 7.7 0 0 0 22 4Z" />
            </SocialIcon>

            {/* Instagram */}
            <SocialIcon label="Instagram">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </SocialIcon>

            {/* LinkedIn */}
            <SocialIcon label="LinkedIn">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </SocialIcon>

            {/* Facebook */}
            <SocialIcon label="Facebook">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />
            </SocialIcon>
          </div>
        </div>
      </div>

      <style jsx>{`
        input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
        @media (max-width: 900px) {
          footer > div:nth-child(2) > div:first-child {
            grid-template-columns: 1fr 1fr !important;
            gap: 40px 32px !important;
          }
        }
        @media (max-width: 560px) {
          footer > div:nth-child(2) > div:first-child {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </footer>
  );
}
