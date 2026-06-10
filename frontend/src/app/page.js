"use client";

import React from "react";
import Navbar from "./components/landing/Navbar";
import HeroSection from "./components/landing/HeroSection";
import RSVPFlowSection from "./components/landing/RSVPFlowSection";
import DashboardPreviewSection from "./components/landing/DashboardPreviewSection";
import PricingSection from "./components/landing/PricingSection";
import FooterSection from "./components/landing/FooterSection";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <Navbar />
      <main>
        <HeroSection />
        <RSVPFlowSection />
        <DashboardPreviewSection />
        <PricingSection />
      </main>
      <FooterSection />
    </div>
  );
}
