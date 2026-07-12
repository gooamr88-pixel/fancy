'use client';

import { useState } from 'react';
import Link from 'next/link';

const footerLinks = {
  Product: [
    { text: 'Features', href: '/features' },
    { text: 'Pricing', href: '/pricing' },
    { text: 'Templates', href: '/templates' },
    { text: 'Integrations', href: '/integrations' },
  ],
  Company: [
    { text: 'About', href: '/about' },
    { text: 'Blog', href: '/blog' },
    { text: 'Careers', href: '/careers' },
    { text: 'Press', href: '/press' },
  ],
  Support: [
    { text: 'Help Center', href: '/help' },
    { text: 'Contact', href: '/contact' },
    { text: 'Privacy', href: '/privacy' },
    { text: 'Terms', href: '/terms' },
  ],
};

function FooterLink({ text, href }) {
  // Color is inline (not scoped `<style jsx>`) — when this styled a `next/link`
  // via a scoped className, the color rule silently failed to attach in
  // production (Turbopack build), leaving every footer link the same near-
  // black as the background and effectively invisible. Hover/focus state is
  // plain React state for the same reason — no dependency on style scoping
  // that wraps a Link.
  const [active, setActive] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        textDecoration: 'none',
        lineHeight: '2.2',
        display: 'block',
        color: active ? '#B8944F' : 'rgba(255, 255, 255, 0.6)',
        transition: 'color 0.25s ease',
      }}
    >
      {text}
    </Link>
  );
}

function SocialIcon({ children, label, href = '#' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="social-icon"
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        className="social-icon-svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>

      <style jsx>{`
        .social-icon {
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: transparent;
          transition: all 0.25s ease;
        }
        .social-icon:hover,
        .social-icon:focus-visible {
          border-color: #B8944F;
          background: rgba(184, 148, 79, 0.1);
        }
        .social-icon-svg {
          transition: stroke 0.25s ease;
        }
        .social-icon:hover .social-icon-svg,
        .social-icon:focus-visible .social-icon-svg {
          stroke: #B8944F;
        }
      `}</style>
    </a>
  );
}

export default function FooterSection() {
  const [emailValue, setEmailValue] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');

  const handleSubscribe = async () => {
    if (subscribing || subscribed || !emailValue || !emailValue.includes('@')) return;
    setSubscribing(true);
    setSubscribeError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/newsletter-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Subscription failed. Please try again.');
      }
      setSubscribed(true);
      setEmailValue('');
    } catch (err) {
      setSubscribeError(err.message || 'Subscription failed. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

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
            gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr)',
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg
                width="24"
                height="20"
                viewBox="0 0 38 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <rect x="2" y="8" width="34" height="22" rx="2" stroke="#B8944F" strokeWidth="2" fill="none" />
                <path d="M2 10L19 22L36 10" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
                <path d="M4 8L19 0L34 8" stroke="#B8944F" strokeWidth="2" fill="none" strokeLinejoin="round" />
              </svg>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ color: '#B8944F', fontFamily: 'var(--font-script)', fontWeight: 400 }}>Fancy</span>
                <span style={{ color: '#FFFFFF' }}> RSVP</span>
              </div>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.65)',
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
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '20px',
                }}
              >
                {category}
              </h4>
              {links.map((link) => (
                <FooterLink key={link.text} text={link.text} href={link.href} />
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
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '20px',
              }}
            >
              Newsletter
            </h4>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.65)',
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
                autoComplete="email"
                placeholder="Enter your email"
                aria-label="Email address for newsletter"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubscribe(); }}
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
                onClick={handleSubscribe}
                disabled={subscribed || subscribing}
                className={`footer-subscribe-btn${subscribed ? ' footer-subscribe-btn-done' : ''}`}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: (subscribed || subscribing) ? 'default' : 'pointer',
                  opacity: subscribing ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {subscribed ? '✓ Subscribed' : subscribing ? 'Subscribing…' : 'Subscribe'}
              </button>
            </div>
            {subscribeError && (
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: '#E88F8F',
                  marginTop: '8px',
                  marginBottom: 0,
                }}
              >
                {subscribeError}
              </p>
            )}
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
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            © {new Date().getFullYear()} Fancy RSVP. All rights reserved.
          </p>

          {/* Social icons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Twitter / X */}
            <SocialIcon label="Twitter" href="https://twitter.com/fancyrsvp">
              <path d="M22 4s-1.3.8-3 1.2A4.8 4.8 0 0 0 12 8v1A10.5 10.5 0 0 1 3 4s-4 9 5 13a11.6 11.6 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.1-.9A7.7 7.7 0 0 0 22 4Z" />
            </SocialIcon>

            {/* Instagram */}
            <SocialIcon label="Instagram" href="https://instagram.com/fancyrsvp">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </SocialIcon>

            {/* LinkedIn */}
            <SocialIcon label="LinkedIn" href="https://linkedin.com/company/fancyrsvp">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </SocialIcon>

            {/* Facebook */}
            <SocialIcon label="Facebook" href="https://facebook.com/fancyrsvp">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />
            </SocialIcon>
          </div>
        </div>
      </div>

      <style jsx>{`
        input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }
        .footer-subscribe-btn {
          background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
          box-shadow: 0 2px 8px rgba(184, 148, 79, 0.2);
          transition: all 0.25s ease;
        }
        .footer-subscribe-btn:not(:disabled):hover,
        .footer-subscribe-btn:not(:disabled):focus-visible {
          background: linear-gradient(135deg, #a07f3f 0%, #c9a85e 100%);
          box-shadow: 0 4px 14px rgba(184, 148, 79, 0.35);
        }
        .footer-subscribe-btn-done {
          background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
        }
        @media (max-width: 900px) {
          footer > div:nth-child(2) > div:first-child {
            grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important;
            gap: 40px 32px !important;
          }
        }
        @media (max-width: 560px) {
          footer > div:nth-child(2) > div:first-child {
            grid-template-columns: minmax(0,1fr) !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </footer>
  );
}
