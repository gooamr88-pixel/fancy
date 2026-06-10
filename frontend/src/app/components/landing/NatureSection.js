"use client";

import React from "react";

const NatureSection = React.memo(function NatureSection() {
  return (
    <section 
      id="nature" 
      className="w-full py-28 bg-emerald-50/50 dark:bg-emerald-950/20 text-center border-b border-card-border/40"
    >
      <div className="max-w-3xl mx-auto px-6 flex flex-col items-center gap-6">
        <div className="w-12 h-12 rounded-full bg-brand-green/10 flex items-center justify-center mb-2 border border-brand-green/10">
          <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Our Green Commitment</span>
        <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
          Over 1.5 Million Trees Saved Since Inception
        </h2>
        <p className="text-emerald-800/80 dark:text-emerald-350/80 leading-relaxed font-light text-sm md:text-base max-w-xl">
          By shifting invitations online, Fancy RSVP hosts preserve natural forests, reduce water use, and prevent tons of waste. We pledge 1% of every transaction to global tree reforestation networks.
        </p>
        <button className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-3.5 rounded-md font-bold tracking-wide transition-all shadow-md hover:shadow-lg mt-2 cursor-pointer border-b-2 border-emerald-700" id="read-eco-pledge">
          Read Our Eco Pledge
        </button>
      </div>
    </section>
  );
});

export default NatureSection;
