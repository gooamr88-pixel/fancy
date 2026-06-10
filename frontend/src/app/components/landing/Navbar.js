"use client";

import React, { useEffect } from "react";
import Link from "next/link";

const Navbar = React.memo(function Navbar({ darkMode, toggleDarkMode, activeSection, setActiveSection, subHeaderSticky, setSubHeaderSticky }) {
  // Scroll Spy using IntersectionObserver
  useEffect(() => {
    const sectionIds = ["overview", "customizer", "features", "simulator", "designs", "pricing", "nature"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [setActiveSection]);

  // Sticky sub-header detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setSubHeaderSticky(true);
      } else {
        setSubHeaderSticky(false);
      }
    };
    
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setSubHeaderSticky]);

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      const offsetTop = el.offsetTop - 110;
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
      setActiveSection(sectionId);
    }
  };

  return (
    <>
      {/* --- Main Header / Navigation --- */}
      <header className="w-full bg-nav-bg border-b border-card-border/40 py-5 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50 transition-all duration-300 backdrop-blur-md">
        <div className="flex items-center gap-1 z-10">
          <span className="font-sans text-xl md:text-2xl font-bold tracking-[0.3em] text-brand-green hover:opacity-90 transition-all cursor-pointer flex items-center">
            FANCY<span className="font-light text-amber-500/75 mx-1.5">|</span>RSVP
          </span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8 z-10">
          {/* Theme switcher */}
          <button 
            onClick={toggleDarkMode}
            className="p-2.5 rounded-full hover:bg-card-border/20 transition-all cursor-pointer text-foreground hover:scale-105 active:scale-95"
            aria-label="Toggle Dark Mode"
            id="theme-toggle"
          >
            {darkMode ? (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <Link href="/login" className="text-muted-text hover:text-brand-green font-medium text-sm md:text-base transition-colors">
            Log In
          </Link>
          <Link href="/register" className="text-muted-text hover:text-brand-green font-medium text-sm md:text-base transition-colors">
            Sign Up
          </Link>
          <button 
            onClick={() => scrollToSection("customizer")}
            className="bg-brand-green hover:bg-brand-green-hover text-white px-5.5 py-2.5 rounded-md font-semibold text-sm md:text-base transition-all shadow-md hover:shadow-lg active:scale-[0.98] border-b-2 border-emerald-700 cursor-pointer"
            id="header-cta"
          >
            Design Live
          </button>
        </div>
      </header>

      {/* --- Sticky Sub-Navigation Bar --- */}
      <div 
        className={`w-full bg-card-bg border-y border-card-border/40 transition-all duration-300 z-40 ${
          subHeaderSticky ? "fixed top-[71px] left-0 shadow-md" : "relative"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center h-16">
          <nav className="flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: "overview", label: "Overview" },
              { id: "customizer", label: "Design Deck" },
              { id: "features", label: "Features" },
              { id: "simulator", label: "RSVP Simulator" },
              { id: "designs", label: "Suites" },
              { id: "pricing", label: "Pricing" },
              { id: "nature", label: "Nature" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className={`h-16 flex items-center border-b-2 font-semibold text-sm md:text-base tracking-wide transition-all px-1 shrink-0 cursor-pointer ${
                  activeSection === tab.id
                    ? "border-brand-green text-brand-green font-bold"
                    : "border-transparent text-muted-text hover:text-foreground"
                }`}
                id={`nav-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          
          {subHeaderSticky && (
            <button 
              onClick={() => scrollToSection("customizer")}
              className="bg-brand-green hover:bg-brand-green-hover text-white px-4.5 py-2 rounded-md font-semibold text-xs md:text-sm transition-all shadow active:scale-[0.98] border-b border-emerald-700 cursor-pointer"
              id="sticky-cta"
            >
              Design Suite
            </button>
          )}
        </div>
      </div>
    </>
  );
});

export default Navbar;
