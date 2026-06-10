"use client";

import React from "react";

const PricingSection = React.memo(function PricingSection() {
  return (
    <section 
      id="pricing" 
      className="w-full py-28 bg-sec-bg/10 border-b border-card-border/40 text-center"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col items-center gap-6">
        <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Simple Tier Pricing</span>
        <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
          Simple, Flat Rate Pricing Packages
        </h2>
        <p className="text-muted-text leading-relaxed max-w-xl font-light text-sm md:text-base">
          No subscription loops. Pay only for the specific events you construct. Every package includes full 3D customizers, stamps, and music tools.
        </p>
        
        <div className="mt-8 flex flex-wrap justify-center gap-6 w-full max-w-5xl">
          {[
            { title: "Single Celebration", price: "19", limit: "Up to 50 guests", desc: "Perfect for intimate birthdays, baby showers, or dinner dinner parties.", color: "border-card-border bg-card-bg" },
            { title: "Grand Premier", price: "49", limit: "Up to 250 guests", desc: "Our most popular tier. Designed for weddings, reunions, and anniversary dinners.", color: "border-brand-green bg-card-bg shadow-lg relative" },
            { title: "Enterprise Suite", price: "199", limit: "Unlimited guests", desc: "Designed for premium corporations, non-profits, and large-scale charity galas.", color: "border-card-border bg-card-bg" }
          ].map((pkg) => (
            <div 
              key={pkg.title} 
              className={`p-8 rounded-2xl border hover:-translate-y-2 hover:shadow-xl transition-all duration-300 w-full md:w-80 text-center flex flex-col justify-between ${pkg.color}`}
              id={`price-card-${pkg.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {pkg.title === "Grand Premier" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-green text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                  Most Popular
                </span>
              )}
              <div>
                <h4 className="font-bold text-xs uppercase text-muted-text tracking-widest">{pkg.title}</h4>
                <p className="font-serif text-4xl font-semibold mt-4 text-foreground">${pkg.price}</p>
                <span className="text-[10px] text-brand-green font-bold block mt-1">{pkg.limit}</span>
                <p className="text-xs text-muted-text mt-3 leading-relaxed font-light">{pkg.desc}</p>
              </div>
              <button className="mt-8 w-full border border-card-border bg-card-bg hover:border-brand-green hover:bg-brand-green hover:text-white py-2.5 rounded-lg font-bold text-xs transition-all duration-200 cursor-pointer shadow-sm active:scale-98" id={`btn-choose-${pkg.title.toLowerCase().replace(/\s+/g, '-')}`}>
                Choose Package
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default PricingSection;
