'use client';

export default function FeaturesSection() {
  const features = [
    {
      title: 'Real-Time RSVP Tracking',
      description:
        'Monitor responses as they arrive with live dashboards, instant notifications, and detailed guest analytics.',
      icon: (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 3H8a2 2 0 0 0-2 2v16l2-1.5L10 21l2-1.5L14 21l2-1.5L18 21V5a2 2 0 0 0-2-2Z" />
          <path d="M9.5 10.5l1.5 1.5 3.5-3.5" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      title: 'Smart Seating Management',
      description:
        'Drag-and-drop seating charts with capacity validation, party grouping, and instant reassignment.',
      icon: (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <circle cx="6.5" cy="6.5" r="1" />
          <circle cx="17.5" cy="6.5" r="1" />
          <circle cx="6.5" cy="17.5" r="1" />
          <circle cx="17.5" cy="17.5" r="1" />
        </svg>
      ),
    },
    {
      title: 'SMS Campaigns',
      description:
        'Reach every guest instantly with bulk messaging, delivery tracking, and smart credit management.',
      icon: (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          <line x1="9" y1="10" x2="9.01" y2="10" strokeWidth="2" />
          <line x1="12" y1="10" x2="12.01" y2="10" strokeWidth="2" />
          <line x1="15" y1="10" x2="15.01" y2="10" strokeWidth="2" />
        </svg>
      ),
    },
    {
      title: 'Custom RSVP Forms',
      description:
        'Build personalized questionnaires with meal choices, dietary needs, plus-ones, and unlimited custom fields.',
      icon: (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
          <line x1="8" y1="9" x2="11" y2="9" />
        </svg>
      ),
    },
    {
      title: 'QR Check-In',
      description:
        'Streamline arrivals with scannable QR codes, real-time check-in dashboards, and party count tracking.',
      icon: (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="5.5" y="5.5" width="2" height="2" rx="0.4" />
          <rect x="16.5" y="5.5" width="2" height="2" rx="0.4" />
          <rect x="5.5" y="16.5" width="2" height="2" rx="0.4" />
          <line x1="14" y1="14" x2="14" y2="17" />
          <line x1="17" y1="14" x2="21" y2="14" />
          <line x1="21" y1="17" x2="21" y2="21" />
          <line x1="14" y1="21" x2="18" y2="21" />
          <line x1="17" y1="17" x2="17" y2="19" />
        </svg>
      ),
    },
    {
      title: 'Analytics Dashboard',
      description:
        'Comprehensive event insights with trend charts, response breakdowns, and exportable guest reports.',
      icon: (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="20" x2="4" y2="13" />
          <line x1="8.5" y1="20" x2="8.5" y2="9" />
          <line x1="13" y1="20" x2="13" y2="15" />
          <line x1="17.5" y1="20" x2="17.5" y2="7" />
          <polyline points="3 10 8.5 5 13 9 21 3" />
          <polyline points="17 3 21 3 21 7" />
        </svg>
      ),
    },
  ];

  return (
    <section className="features-section">
      <div className="features-container">
        {/* Section Header */}
        <div className="features-header">
          <span className="features-eyebrow">WHY FANCY RSVP</span>
          <h2 className="features-heading">
            Everything You Need for the Perfect Event
          </h2>
          <p className="features-subtext">
            From elegant invitations to real-time analytics, every tool is
            crafted to make your event unforgettable.
          </p>
        </div>

        {/* Features Grid */}
        <div className="features-grid">
          {features.map((feature, index) => (
            <div className="feature-card" key={index}>
              <div className="feature-icon-container">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .features-section {
          background: #ffffff;
          padding: 100px 48px;
        }

        .features-container {
          max-width: 1280px;
          margin: 0 auto;
        }

        .features-header {
          text-align: center;
          margin-bottom: 64px;
        }

        .features-eyebrow {
          display: block;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #b8944f;
          margin-bottom: 16px;
        }

        .features-heading {
          font-family: var(--font-serif);
          font-weight: 600;
          color: #191b1e;
          font-size: 42px;
          line-height: 1.2;
          margin: 0 0 16px 0;
        }

        .features-subtext {
          font-family: var(--font-sans);
          font-size: 17px;
          font-weight: 300;
          color: #77736a;
          line-height: 1.7;
          max-width: 600px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .feature-card {
          background: #ffffff;
          border: 1px solid #e8e2d6;
          border-radius: 16px;
          padding: 36px 28px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default;
        }

        .feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 48px rgba(184, 148, 79, 0.1);
          border-color: #d7be80;
        }

        .feature-icon-container {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(184, 148, 79, 0.08);
          border: 1px solid rgba(184, 148, 79, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #b8944f;
        }

        .feature-title {
          font-family: var(--font-serif);
          font-size: 18px;
          font-weight: 600;
          color: #191b1e;
          margin: 20px 0 0 0;
        }

        .feature-description {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 400;
          color: #77736a;
          line-height: 1.7;
          margin: 8px 0 0 0;
        }

        @media (max-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .features-heading {
            font-size: 36px;
          }
        }

        @media (max-width: 768px) {
          .features-section {
            padding: 80px 32px;
          }

          .features-heading {
            font-size: 32px;
          }

          .features-header {
            margin-bottom: 48px;
          }
        }

        @media (max-width: 640px) {
          .features-section {
            padding: 64px 24px;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .features-heading {
            font-size: 28px;
          }

          .features-subtext {
            font-size: 15px;
          }
        }

        @media (max-width: 480px) {
          .features-heading {
            font-size: 26px;
          }

          .feature-card {
            padding: 28px 22px;
          }
        }
      `}</style>
    </section>
  );
}
