"use client";

import React, { useState, useEffect } from "react";
import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import OverviewSection from "./components/landing/OverviewSection";
import FeaturesSection from "./components/landing/FeaturesSection";
import RSVPSimulator from "./components/landing/RSVPSimulator";
import DesignsSection from "./components/landing/DesignsSection";
import PricingSection from "./components/landing/PricingSection";
import NatureSection from "./components/landing/NatureSection";
import FAQSection from "./components/landing/FAQSection";
import FooterSection from "./components/landing/FooterSection";

export default function Home() {
  const [activeSection, setActiveSection] = useState("overview");
  const [subHeaderSticky, setSubHeaderSticky] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Dark Mode Initializer
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDark = localStorage.getItem("darkMode") === "true" ||
                        (!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDarkMode(savedDark);
      if (savedDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", String(nextDark));
      if (nextDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

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
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-brand-green/20 selection:text-brand-green transition-colors duration-300 relative overflow-x-hidden">
      
      {/* Floating Organic Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[8%] left-[-12%] w-[40rem] h-[40rem] rounded-full bg-emerald-100/30 dark:bg-emerald-950/15 filter blur-3xl animate-float-1"></div>
        <div className="absolute top-[35%] right-[-10%] w-[45rem] h-[45rem] rounded-full bg-amber-100/20 dark:bg-amber-900/10 filter blur-3xl animate-float-2"></div>
        <div className="absolute bottom-[8%] left-[8%] w-[32rem] h-[32rem] rounded-full bg-teal-100/15 dark:bg-teal-900/10 filter blur-3xl animate-float-3"></div>
      </div>

      <Navbar 
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        subHeaderSticky={subHeaderSticky}
        setSubHeaderSticky={setSubHeaderSticky}
      />

      <main className="flex-grow">
        <HeroSection 
          darkMode={darkMode}
          scrollToSection={scrollToSection}
        />
        <OverviewSection />
        <FeaturesSection />
        <RSVPSimulator />
        <DesignsSection />
        <PricingSection />
        <NatureSection />
        <FAQSection />
      </main>

      <FooterSection />
    </div>
  );
}
