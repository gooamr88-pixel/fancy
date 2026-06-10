"use client";

import React from "react";

const OverviewSection = React.memo(function OverviewSection() {
  return (
    <section 
      id="overview" 
      className="w-full py-28 bg-sec-bg/30 border-b border-card-border/40"
    >
      <div className="max-w-4xl mx-auto px-6 text-center flex flex-col gap-6 reveal-on-scroll">
        <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">The Digital Invite Re-Imagined</span>
        <h2 className="font-serif text-3xl sm:text-4xl md:text-5.5xl font-normal leading-tight tracking-tight max-w-3xl mx-auto text-foreground">
          Premium Digital Invitations with 3D Envelopes, Real-Time RSVP Tracking & Ambient Music
        </h2>
        <p className="text-base sm:text-lg text-muted-text leading-relaxed max-w-3xl mx-auto font-light">
          Fancy RSVP invitations arrive with a signature animated envelope opening—complete with customizable liners, seals, stamps, and a background score that sets the mood. Send via custom link, email, or text, collect meal choices or song requests, and manage it all inside an ad-free host dashboard. Zero paper waste, infinite style.
        </p>
      </div>
    </section>
  );
});

export default OverviewSection;
