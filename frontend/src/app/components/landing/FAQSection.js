'use client';

import { useState } from 'react';
import Link from 'next/link';

const faqs = [
  {
    question: 'How do I get started with Fancy RSVP?',
    answer:
      'Simply create a free account, choose your event type, and customize your invitation. You can start collecting RSVPs within minutes — no technical setup required.',
  },
  {
    question: 'Can I customize the RSVP form for my event?',
    answer:
      'Absolutely. Add unlimited custom questions, meal selections, dietary preferences, plus-one options, and more. Every field can be required or optional based on your needs.',
  },
  {
    question: 'How does the seating chart feature work?',
    answer:
      'Our drag-and-drop seating manager lets you create round or rectangular tables, set capacities, and assign guests with a click. The system prevents overbooking and tracks remaining seats in real-time.',
  },
  {
    question: 'Is there a limit on the number of guests?',
    answer:
      'Our Starter plan supports up to 50 guests per event. Premium handles up to 300 guests with SMS capabilities, and Enterprise offers unlimited guests with dedicated support.',
  },
  {
    question: 'Can guests update their RSVP after submitting?',
    answer:
      'Yes, guests can return to their RSVP link anytime before your deadline to update their response, party size, or meal selections. You\'ll see changes reflected instantly in your dashboard.',
  },
  {
    question: 'Do you offer refunds if I cancel my event?',
    answer:
      'We offer a full refund within 14 days of purchase if your event hasn\'t gone live. For active events, we provide pro-rated credits that can be applied to future events.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const handleToggle = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <section className="faq-section">
      <div className="faq-container">
        {/* Section Header */}
        <div className="faq-header">
          <span className="faq-eyebrow">FAQ</span>
          <h2 className="faq-heading">Frequently Asked Questions</h2>
          <p className="faq-subtext">
            Everything you need to know about creating your perfect event.
          </p>
        </div>

        {/* Accordion */}
        <div className="faq-accordion">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`faq-item ${index === 0 ? 'faq-item-first' : ''}`}
              >
                <button
                  className="faq-question"
                  onClick={() => handleToggle(index)}
                  aria-expanded={isOpen}
                >
                  <span className="faq-question-text">{faq.question}</span>
                  <span
                    className={`faq-icon ${isOpen ? 'faq-icon-open' : ''}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <line
                        x1="7"
                        y1="0"
                        x2="7"
                        y2="14"
                        stroke="#B8944F"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1="0"
                        y1="7"
                        x2="14"
                        y2="7"
                        stroke="#B8944F"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  className={`faq-answer-wrapper ${isOpen ? 'faq-answer-open' : ''}`}
                >
                  <p className="faq-answer">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="faq-cta">
          <p className="faq-cta-title">Still have questions?</p>
          <p className="faq-cta-subtitle">
            Contact our team — we typically respond within 2 hours.
          </p>
          <Link href="/contact" className="faq-cta-button" style={{ textDecoration: 'none' }}>
            <span>Contact Support</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8H13M13 8L9 4M13 8L9 12"
                stroke="#191B1E"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .faq-section {
          background: #ffffff;
          padding: 100px 48px;
          display: flex;
          justify-content: center;
        }

        .faq-container {
          width: 100%;
          max-width: 800px;
        }

        /* Header */
        .faq-header {
          text-align: center;
          margin-bottom: 56px;
        }

        .faq-eyebrow {
          display: block;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: #b8944f;
          margin-bottom: 16px;
        }

        .faq-heading {
          font-family: var(--font-serif);
          font-weight: 600;
          color: #191b1e;
          font-size: 38px;
          line-height: 1.2;
          margin: 0 0 16px 0;
        }

        .faq-subtext {
          font-family: var(--font-sans);
          font-size: 17px;
          font-weight: 300;
          color: #77736a;
          max-width: 500px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* Accordion */
        .faq-accordion {
          width: 100%;
        }

        .faq-item {
          border-bottom: 1px solid #e8e2d6;
        }

        .faq-item-first {
          border-top: 1px solid #e8e2d6;
        }

        /* Question Button */
        .faq-question {
          width: 100%;
          padding: 24px 0;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          text-align: left;
        }

        .faq-question-text {
          font-family: var(--font-serif);
          font-size: 16px;
          font-weight: 600;
          color: #191b1e;
          line-height: 1.4;
        }

        /* Toggle Icon */
        .faq-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid #e8e2d6;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .faq-icon-open {
          transform: rotate(45deg);
          border-color: #b8944f;
        }

        /* Answer */
        .faq-answer-wrapper {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height 0.4s ease, opacity 0.4s ease, padding-bottom 0.4s ease;
          padding-bottom: 0;
        }

        .faq-answer-open {
          max-height: 300px;
          opacity: 1;
          padding-bottom: 24px;
        }

        .faq-answer {
          font-family: var(--font-sans);
          font-size: 15px;
          font-weight: 400;
          color: #77736a;
          line-height: 1.75;
          margin: 0;
        }

        /* CTA */
        .faq-cta {
          text-align: center;
          margin-top: 48px;
        }

        .faq-cta-title {
          font-family: var(--font-sans);
          font-size: 16px;
          font-weight: 600;
          color: #191b1e;
          margin: 0 0 6px 0;
        }

        .faq-cta-subtitle {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 400;
          color: #77736a;
          margin: 0 0 20px 0;
        }

        .faq-cta-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1.5px solid #191b1e;
          border-radius: 6px;
          padding: 14px 36px;
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 700;
          color: #191b1e;
          cursor: pointer;
          transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
        }

        .faq-cta-button:hover {
          background: #191b1e;
          color: #ffffff;
        }

        .faq-cta-button:hover svg path {
          stroke: #ffffff;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .faq-section {
            padding: 64px 24px;
          }

          .faq-heading {
            font-size: 30px;
          }

          .faq-subtext {
            font-size: 15px;
          }

          .faq-question-text {
            font-size: 15px;
          }
        }
      `}</style>
    </section>
  );
}
