'use client';

const testimonials = [
  {
    name: 'Sarah & Michael Torres',
    role: 'Wedding · June 2025',
    initials: 'ST',
    quote:
      'Fancy RSVP transformed our wedding planning. The seating chart alone saved us hours of work, and our guests loved how easy it was to RSVP. The real-time tracking gave us peace of mind.',
  },
  {
    name: 'David Chen',
    role: 'Corporate Gala · March 2025',
    initials: 'DC',
    quote:
      'Managing 400 corporate guests used to be a nightmare. With Fancy RSVP, we had real-time check-ins, dietary tracking, and SMS reminders all in one place. Absolutely indispensable.',
  },
  {
    name: 'Amira & James Okafor',
    role: 'Engagement Party · January 2025',
    initials: 'AO',
    quote:
      'The invitation designs were stunning — our guests kept complimenting them! The custom questionnaire feature helped us plan the perfect menu. Worth every penny.',
  },
];

function StarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="#B8944F"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 0.5L9.79 5.81L15.5 6.19L11.09 9.94L12.54 15.5L8 12.4L3.46 15.5L4.91 9.94L0.5 6.19L6.21 5.81L8 0.5Z" />
    </svg>
  );
}

function TestimonialCard({ name, role, initials, quote }) {
  return (
    <div className="testimonial-card">
      <div className="card-top">
        <span className="quote-mark">{'\u201C'}</span>
        <p className="quote-text">{quote}</p>
      </div>
      <div className="card-bottom">
        <div className="divider" />
        <div className="reviewer-row">
          <div className="avatar">{initials}</div>
          <div className="reviewer-info">
            <span className="reviewer-name">{name}</span>
            <span className="reviewer-role">{role}</span>
          </div>
        </div>
        <div className="stars-row">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} />
          ))}
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
        .reviewer-info {
          display: flex;
          flex-direction: column;
        }
        .reviewer-name {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 700;
          color: #191B1E;
        }
        .reviewer-role {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 400;
          color: #77736A;
        }
        .stars-row {
          display: flex;
          gap: 3px;
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section className="testimonials-section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">TESTIMONIALS</span>
          <h2 className="heading">Loved by Event Planners Everywhere</h2>
          <p className="subtext">
            See why thousands of hosts trust Fancy RSVP for their most important
            celebrations.
          </p>
        </div>

        <div className="cards-grid">
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} {...t} />
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
