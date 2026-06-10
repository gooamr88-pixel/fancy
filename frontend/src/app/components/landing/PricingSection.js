'use client';

import { useState } from 'react';

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    priceSuffix: '',
    recommended: false,
    features: [
      '1 Event',
      'Up to 50 guests',
      'Basic RSVP form',
      'Email notifications',
    ],
    buttonText: 'Get Started',
    buttonVariant: 'outline',
  },
  {
    name: 'Premium',
    price: '$29',
    priceSuffix: '/event',
    recommended: true,
    features: [
      'Unlimited events',
      'Up to 500 guests',
      'Custom themes & branding',
      'Meal preferences',
      'Seating charts',
      'QR code check-in',
      'Priority support',
    ],
    buttonText: 'Get Started',
    buttonVariant: 'filled',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceSuffix: '',
    recommended: false,
    features: [
      'Unlimited everything',
      'Dedicated account manager',
      'Custom integrations',
      'White-label branding',
      'API access',
      'SLA & support',
    ],
    buttonText: 'Contact Sales',
    buttonVariant: 'outline',
  },
];

function PricingCard({ plan, isHovered, onMouseEnter, onMouseLeave }) {
  const [btnHovered, setBtnHovered] = useState(false);

  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: '16px',
    border: plan.recommended ? 'none' : '1px solid #E8E2D6',
    padding: plan.recommended ? '0' : '40px 32px',
    flex: '1 1 0',
    minWidth: '280px',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
    boxShadow: plan.recommended
      ? isHovered
        ? '0 20px 48px rgba(184, 148, 79, 0.18), 0 8px 24px rgba(184, 148, 79, 0.10)'
        : '0 12px 36px rgba(184, 148, 79, 0.12), 0 4px 16px rgba(184, 148, 79, 0.06)'
      : isHovered
        ? '0 16px 40px rgba(0, 0, 0, 0.10)'
        : '0 2px 12px rgba(0, 0, 0, 0.04)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'default',
    overflow: 'hidden',
  };

  const innerStyle = plan.recommended
    ? { padding: '40px 32px', borderTop: '3px solid #B8944F' }
    : {};

  const badgeStyle = {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)',
    color: '#FFFFFF',
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    padding: '6px 16px',
    borderRadius: '100px',
    marginBottom: '16px',
  };

  const nameStyle = {
    fontFamily: 'var(--font-serif)',
    fontSize: '22px',
    fontWeight: '600',
    color: '#191B1E',
    marginBottom: '12px',
  };

  const priceStyle = {
    fontFamily: 'var(--font-serif)',
    fontSize: '48px',
    fontWeight: '700',
    color: '#191B1E',
    lineHeight: '1',
    marginBottom: '8px',
  };

  const suffixStyle = {
    fontFamily: 'var(--font-sans)',
    fontSize: '16px',
    fontWeight: '400',
    color: '#77736A',
  };

  const dividerStyle = {
    width: '100%',
    height: '1px',
    background: '#E8E2D6',
    margin: '24px 0',
  };

  const featureStyle = {
    fontFamily: 'var(--font-sans)',
    fontSize: '15px',
    color: '#4A4A4A',
    lineHeight: '1.6',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  };

  const checkColor = plan.recommended ? '#B8944F' : '#77736A';

  const buttonBase = {
    width: '100%',
    padding: '14px 24px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    marginTop: 'auto',
    letterSpacing: '0.3px',
  };

  const buttonStyle =
    plan.buttonVariant === 'filled'
      ? {
          ...buttonBase,
          background: btnHovered
            ? 'linear-gradient(135deg, #a07f3f 0%, #c9a85e 100%)'
            : 'linear-gradient(135deg, #B8944F 0%, #D7BE80 100%)',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: btnHovered
            ? '0 6px 20px rgba(184, 148, 79, 0.35)'
            : '0 4px 14px rgba(184, 148, 79, 0.25)',
        }
      : {
          ...buttonBase,
          background: btnHovered ? 'rgba(184, 148, 79, 0.06)' : 'transparent',
          color: '#B8944F',
          border: '1.5px solid #B8944F',
        };

  return (
    <div
      style={cardStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={innerStyle}>
        {plan.recommended && <div style={badgeStyle}>Most Popular</div>}
        <div style={nameStyle}>{plan.name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px' }}>
          <span style={priceStyle}>{plan.price}</span>
          {plan.priceSuffix && <span style={suffixStyle}>{plan.priceSuffix}</span>}
        </div>
        <div style={dividerStyle} />
        <div style={{ marginBottom: '32px' }}>
          {plan.features.map((feature, i) => (
            <div key={i} style={featureStyle}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <circle cx="9" cy="9" r="9" fill={checkColor} opacity="0.12" />
                <path
                  d="M5.5 9.2L7.8 11.5L12.5 6.5"
                  stroke={checkColor}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {feature}
            </div>
          ))}
        </div>
        <button
          style={buttonStyle}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
        >
          {plan.buttonText}
        </button>
      </div>
    </div>
  );
}

export default function PricingSection() {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <section
      id="pricing"
      style={{
        background: '#F8F4EC',
        padding: '100px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: '700',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: '#B8944F',
              marginBottom: '16px',
            }}
          >
            Simple Pricing
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: '600',
              color: '#191B1E',
              lineHeight: '1.3',
              maxWidth: '520px',
              margin: '0 auto',
            }}
          >
            Choose the perfect plan for your event.
          </h2>
        </div>

        {/* Cards */}
        <div
          style={{
            display: 'flex',
            gap: '28px',
            justifyContent: 'center',
            alignItems: 'stretch',
            flexWrap: 'wrap',
          }}
        >
          {plans.map((plan, index) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              isHovered={hoveredIndex === index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          section > div > div:last-child {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>
    </section>
  );
}
