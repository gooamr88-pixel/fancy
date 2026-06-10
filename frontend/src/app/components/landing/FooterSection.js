"use client";

import React from "react";

const FooterSection = React.memo(function FooterSection() {
  return (
    <footer className="w-full py-12 px-6 bg-[#0c0a09] dark:bg-[#080706] text-stone-400 text-center border-t border-stone-850 dark:border-stone-900 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <span className="font-sans font-bold tracking-[0.2em] text-white">
          FANCY<span className="text-stone-700">|</span>RSVP
        </span>
        <p className="font-light text-stone-500">
          © {new Date().getFullYear()} Fancy RSVP project. Crafted with care for premium celebrations.
        </p>
      </div>
    </footer>
  );
});

export default FooterSection;
