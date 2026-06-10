"use client";

import React from "react";

// --- Custom SVGs for Feature Icons ---
const FeatureIcon = ({ name, className = "w-7 h-7 text-brand-green" }) => {
  switch (name) {
    case "personalization":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-personalization">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122l.18-.362a6.03 6.03 0 012.438-2.438l.362-.18a6.03 6.03 0 002.438-2.438l.18-.362m-9.028 5.776L3 19.5m0 0l.5-2.236m-.5 2.236l2.236-.5m10.764-10.764l1.196-1.196a1.875 1.875 0 112.652 2.652L17.29 8.79M13.25 5.697l2.236-2.236a1.875 1.875 0 012.652 0l2.651 2.651a1.875 1.875 0 010 2.652l-2.236 2.236m-13.5 10.5l12.62-12.62" />
        </svg>
      );
    case "guest-list":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-guest-list">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h1" />
        </svg>
      );
    case "messaging":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-messaging">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9s.25 0 .25.25v5.003c0 .25-.25.25-.25.25h-9s-.25 0-.25-.25V8.5c0-.25.25-.25.25-.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48L4.5 19.5l3.375-.75A8.96 8.96 0 0012 20.25z" />
        </svg>
      );
    case "address":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-address">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      );
    case "track-rsvps":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-track">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h3.75a2.25 2.25 0 012.25 2.25v15a2.25 2.25 0 01-2.25 2.25h-3.75a2.25 2.25 0 01-2.25-2.25v-15a2.25 2.25 0 012.25-2.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 6h1.5m-1.5 3h1.5m-1.5 3h1.5m-1.5 3h1.5m-1.5 3h1.5" />
        </svg>
      );
    case "survey":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-survey">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      );
    case "updates":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-updates">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      );
    case "reminders":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-reminders">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return null;
  }
};

const FeaturesSection = React.memo(function FeaturesSection() {
  return (
    <section 
      id="features" 
      className="w-full py-28 bg-sec-bg/20 border-b border-card-border/40"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Full Host Toolkit</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-foreground">
            Powerful Features to Customize &amp; Track
          </h2>
          <div className="w-12 h-0.5 bg-brand-green mx-auto rounded-full mt-4"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {[
            {
              id: "personalization",
              title: "Personalization Studio",
              desc: "Select layout structure, background textures, envelope designs, liners, wax seals, and font styles to perfectly fit your vibe.",
            },
            {
              id: "guest-list",
              title: "Address Book Import",
              desc: "Quickly import lists from Excel, Google Sheets, or CSV, or select contacts from your Fancy RSVP history.",
            },
            {
              id: "messaging",
              title: "Instant Guest Messages",
              desc: "Broadcast notifications or alerts to your entire guest list, selected tables, or only attendees who haven't RSVP'd yet.",
            },
            {
              id: "address",
              title: "Address Validation",
              desc: "Our automated delivery checker flags incorrect domain configurations or typos before sending, guaranteeing clean delivery.",
            },
            {
              id: "track-rsvps",
              title: "Real-Time Tracking",
              desc: "Get instantaneous live metrics as guests open their invitations, accept or decline, and submit questionnaire details.",
            },
            {
              id: "survey",
              title: "Custom Survey Queries",
              desc: "Add queries like 'Meal Choice?' or 'Song Requests?' to capture the critical details you need for your seating charts.",
            },
            {
              id: "updates",
              title: "Daily Summaries",
              desc: "Subscribe to receive daily or weekly digest summaries directly to your email, without needing to sign into the dashboard.",
            },
            {
              id: "reminders",
              title: "Automated Reminders",
              desc: "Schedule polite automatic follow-up emails targeting guests who haven't opened or responded to invitations yet.",
            },
          ].map((feat, index) => (
            <div 
              key={feat.id} 
              className="flex flex-col items-center text-center p-6 rounded-2xl border border-card-border/50 bg-card-bg hover:border-brand-green/30 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group cursor-pointer"
              id={`feature-card-${feat.id}`}
            >
              <div className="w-14 h-14 bg-brand-green/5 dark:bg-brand-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-115 transition-transform duration-350 shadow-sm border border-brand-green/10">
                <FeatureIcon name={feat.id} className="w-7 h-7 text-brand-green" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-3 tracking-wide">
                {feat.title}
              </h3>
              <p className="text-muted-text text-sm leading-relaxed font-light">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default FeaturesSection;
