"use client";

import React, { useState } from "react";

const FAQSection = React.memo(function FAQSection() {
  const [openFaq, setOpenFaq] = useState(null);

  const faqItems = [
    {
      q: "Does Fancy RSVP support custom background music?",
      a: "Yes! Our premium packages let you upload custom mp3/wav audio loops or select from our catalog. You can also embed personal Vimeo or YouTube video links that display instantly on the guest landing card."
    },
    {
      q: "Can I import guest contact lists from Excel or Sheets?",
      a: "Absolutely. You can import contacts instantly using a CSV template or plain copy-paste from Excel or Google Sheets. The system validates syntax immediately and flags duplicates."
    },
    {
      q: "How does real-time RSVP updates work?",
      a: "The instant a guest clicks accept/decline on their invitation, your dashboard compiles the response. Counters, meal preferences, and custom questions update dynamically without needing page reloads."
    },
    {
      q: "Is there a completely ad-free guarantee?",
      a: "Yes. Fancy RSVP is a premium host platform. We guarantee 100% ad-free presentation decks and invitation pages. We never display third-party advertisements or share contact listings."
    },
    {
      q: "How does the automated email delivery system guard against bouncebacks?",
      a: "Prior to broadcasting, our delivery checker verifies domain structures. If a contact email appears formatted incorrectly or contains spelling errors (e.g. 'gnail.com' instead of 'gmail.com'), it will flag it for your review."
    }
  ];

  return (
    <section className="w-full py-28 bg-card-bg">
      <div className="max-w-4xl mx-auto px-6">
        
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Common Questions</span>
          <h2 className="font-serif text-3xl font-normal tracking-tight mt-2 text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="w-12 h-0.5 bg-brand-green mx-auto rounded-full mt-4"></div>
        </div>

        <div className="flex flex-col gap-4">
          {faqItems.map((item, idx) => (
            <div 
              key={idx}
              className="border border-card-border rounded-xl bg-sec-bg/10 hover:border-brand-green/20 transition-all overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full px-6 py-4 flex justify-between items-center text-left text-foreground font-semibold text-sm md:text-base cursor-pointer"
                aria-expanded={openFaq === idx}
                id={`faq-btn-${idx}`}
              >
                <span>{item.q}</span>
                <span className="text-brand-green text-lg font-bold">{openFaq === idx ? "−" : "+"}</span>
              </button>
              
              <div 
                className={`px-6 overflow-hidden transition-all duration-300 ${
                  openFaq === idx ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              >
                <p className="text-muted-text font-light text-xs md:text-sm leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
});

export default FAQSection;
