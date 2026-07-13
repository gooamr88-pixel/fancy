'use client';

import { useTestimonials } from '../../utils/useTestimonials';

/**
 * Real, admin-managed testimonials only — previously this section hard-coded
 * three fabricated reviews (fake names, fake quotes, fake event
 * attributions) directly in this file. Now it fetches real rows from
 * GET /public/testimonials (managed at /admin/cms), each with a genuine
 * customer photo or initials avatar, a real star rating, and an optional
 * "Verified Review" link back to the original review — nothing here is
 * invented. If no testimonials have been published yet, the section renders
 * nothing rather than show empty/placeholder cards.
 */

function StarIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill={filled ? '#B8944F' : 'none'}
      stroke="#B8944F"
      strokeWidth={filled ? 0 : 1}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 0.5L9.79 5.81L15.5 6.19L11.09 9.94L12.54 15.5L8 12.4L3.46 15.5L4.91 9.94L0.5 6.19L6.21 5.81L8 0.5Z" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function TestimonialCard({ name, role, initials, photo_url, quote, rating, verify_url }) {
  const displayInitials = initials || (name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const stars = Math.min(5, Math.max(0, rating || 5));

  return (
    <div className="testimonial-card">
      <div className="card-top">
        <span className="quote-mark">{'“'}</span>
        <p className="quote-text">{quote}</p>
      </div>
      <div className="card-bottom">
        <div className="divider" />
        <div className="reviewer-row">
          {photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo_url} alt={name} className="avatar-photo" />
          ) : (
            <div className="avatar">{displayInitials}</div>
          )}
          <div className="reviewer-info">
            <span className="reviewer-name">{name}</span>
            {role && <span className="reviewer-role">{role}</span>}
          </div>
        </div>
        <div className="stars-row">
          {[1, 2, 3, 4, 5].map((i) => (
            <StarIcon key={i} filled={i <= stars} />
          ))}
          {verify_url && (
            <a href={verify_url} target="_blank" rel="noopener noreferrer" className="verify-link">
              <VerifiedIcon /> Verified Review
            </a>
          )}
        </div>
      </div>

      <style jsx>{`
        .testimonial-card {
          background: #ffffff;
          border: 1px solid #E8E2D6;
          border-radius: 16px;
          padding: 36px 28px;
          min-height: 280px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .testimonial-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(184, 148, 79, 0.08);
        }
        .card-top {
          flex: 1;
        }
        .quote-mark {
          display: block;
          font-family: var(--font-serif);
          font-size: 64px;
          color: rgba(184, 148, 79, 0.2);
          line-height: 1;
          margin-bottom: -8px;
          user-select: none;
        }
        .quote-text {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 400;
          color: #4A4A4A;
          line-height: 1.75;
          font-style: italic;
          margin: 0;
        }
        .card-bottom {
          margin-top: auto;
        }
        .divider {
          width: 40px;
          height: 2px;
          background: #D7BE80;
          margin: 20px 0;
        }
        .reviewer-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .avatar {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #B8944F, #D7BE80);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 700;
        }
        .avatar-photo {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid #E8E2D6;
        }
        .reviewer-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .reviewer-name {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 700;
          color: #191B1E;
          overflow-wrap: break-word;
        }
        .reviewer-role {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 400;
          color: #77736A;
          overflow-wrap: break-word;
        }
        .stars-row {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .verify-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 10px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          color: #B8944F;
          text-decoration: none;
        }
        .verify-link:hover,
        .verify-link:focus-visible {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

export default function TestimonialsSection() {
  const { testimonials } = useTestimonials();

  // Still loading (null) or nothing published yet — render nothing rather
  // than a fake/empty section. This section sits below the fold (after
  // Hero/SocialProof/RSVPFlow/Features/DashboardPreview on the landing
  // page), so a late pop-in once real data loads causes no meaningful
  // layout shift to above-fold content.
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="testimonials-section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">TESTIMONIALS</span>
          <h2 className="heading">Loved by Event Planners Everywhere</h2>
          <p className="subtext">
            Real reviews from real hosts — click &quot;Verified Review&quot; on any card to see the original.
          </p>
        </div>

        <div className="cards-grid">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} {...t} />
          ))}
        </div>
      </div>

      <style jsx>{`
        .testimonials-section {
          background: #F8F4EC;
          width: 100%;
        }
        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 100px 48px;
        }
        .section-header {
          text-align: center;
          margin-bottom: 56px;
        }
        .eyebrow {
          display: block;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #B8944F;
          margin-bottom: 16px;
        }
        .heading {
          font-family: var(--font-serif);
          font-weight: 600;
          color: #191B1E;
          font-size: 42px;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }
        .subtext {
          font-family: var(--font-sans);
          font-size: 17px;
          font-weight: 300;
          color: #77736A;
          max-width: 560px;
          margin: 0 auto;
          line-height: 1.65;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }

        @media (max-width: 1024px) {
          .cards-grid {
            grid-template-columns: 1fr;
            max-width: 560px;
            margin: 0 auto;
          }
          .heading {
            font-size: 36px;
          }
        }

        @media (max-width: 640px) {
          .container {
            padding: 64px 24px;
          }
          .heading {
            font-size: 30px;
          }
          .subtext {
            font-size: 15px;
          }
        }
      `}</style>
    </section>
  );
}
