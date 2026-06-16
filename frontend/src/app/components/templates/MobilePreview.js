"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EnvelopeAnimation from "./EnvelopeAnimation";
import RSVPBottomSheet from "./RSVPBottomSheet";

export default function MobilePreview({ template, theme, guestName, isBare = false }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCardOpened, setIsCardOpened] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [rsvpData, setRsvpData] = useState(null);
  const scrollContainerRef = useRef(null);

  // Reset states when template changes to simulate a fresh URL loading experience (snappier transition)
  useEffect(() => {
    setIsLoading(true);
    setIsCardOpened(false);
    setIsBottomSheetOpen(false);
    setRsvpData(null); // Clear previous RSVP simulation to let them test the new template

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [template?.pattern]);

  const handleCardOpenComplete = () => {
    setIsCardOpened(true);
    
    // Auto-scroll down slightly to reveal the RSVP details after the card slides up
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    }, 600);
  };

  const handleRsvpSubmit = (data) => {
    console.log("RSVP Data Submitted:", data);
    setRsvpData(data);
  };

  const accentColor = theme?.accent || template?.accent || "#B8944F";

  return (
    <div className={isBare ? "w-full h-full relative overflow-hidden flex flex-col select-none bg-white" : "w-[315px] h-[630px] bg-stone-950 p-[8px] rounded-[44px] relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5),_inset_0_0_2px_2px_rgba(255,255,255,0.15)] ring-1 ring-white/10 select-none flex flex-col aspect-[9/18]"}>
      
      {/* Glossy Screen Glass Reflection */}
      {!isBare && (
        <div 
          className="absolute inset-[8px] pointer-events-none z-50 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-60 mix-blend-overlay rounded-[36px] overflow-hidden" 
          style={{ transform: "skewY(-30deg) scale(2.2)", transformOrigin: "center" }} 
        />
      )}

      {/* Screen Area */}
      <div className={isBare ? "flex-1 flex flex-col bg-white overflow-hidden relative" : "flex-1 flex flex-col bg-white overflow-hidden relative rounded-[36px] border border-black/10"}>
        
        {/* iOS style Status Bar */}
        {!isBare && (
          <div className="flex justify-between items-center px-6 pt-3.5 pb-1 bg-white text-stone-900 font-sans z-50 shrink-0 select-none">
            {/* Time */}
            <span className="text-[9.5px] font-bold tracking-tight text-stone-800">9:41</span>
            
            {/* Dynamic Island Notch */}
            <div className="w-[72px] h-[16px] bg-black rounded-full flex items-center justify-center gap-1.5 px-2 relative -top-0.5">
              <div className="w-1.5 h-1.5 bg-stone-900 rounded-full" />
              <div className="w-5 h-0.5 bg-stone-900 rounded-full" />
              <div className="w-1 h-1 bg-indigo-950 rounded-full border border-indigo-900/30" />
            </div>

            {/* Icons */}
            <div className="flex items-center gap-1 text-stone-800">
              <svg className="w-3.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 18h2v-2H2v2zm4 0h2v-4H6v4zm4 0h2V9h-2v9zm4 0h2V5h-2v13zm4 0h2V1h-2v17z" />
              </svg>
              <svg className="w-3 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21l-12-12c2.5-2.5 6-4 10-4s7.5 1.5 10 4l-8 12z" />
              </svg>
              <div className="w-4.5 h-2.5 border border-stone-800 rounded-[3px] p-[0.7px] flex items-center">
                <div className="h-full w-full bg-stone-850 rounded-[1px]" />
              </div>
            </div>
          </div>
        )}

        {/* Simulated Browser URL Header */}
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5 bg-stone-50 border-b border-stone-150 text-stone-500 font-sans z-40 shrink-0 text-[10px]">
          {/* Back Icon */}
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          
          {/* URL bar */}
          <div className="flex-1 bg-stone-200/50 rounded-lg py-1 px-2.5 flex items-center justify-between text-stone-600 text-[9.5px]">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <svg className="w-2.5 h-2.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              <span className="truncate text-stone-550 tracking-wide font-medium">fancyrsvp.com/invite/jamil</span>
            </div>
            {/* Reload Icon */}
            <svg className="w-2.5 h-2.5 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        </div>

        {/* Inner Content Screen */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-white">
          <AnimatePresence mode="wait">
            {isLoading ? (
              /* Phase 1: Entry Point Loading Simulation */
              <motion.div
                key="loading"
                className="absolute inset-0 bg-white flex flex-col items-center justify-center z-40 text-center"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                  className="font-serif text-3xl font-light tracking-[8px] text-stone-900 select-none uppercase mb-4"
                  initial={{ letterSpacing: "1px", opacity: 0 }}
                  animate={{ letterSpacing: "8px", opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  Fancy
                </motion.div>
                <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-850 rounded-full animate-spin" />
              </motion.div>
            ) : (
              <>
              {/* Phase 2: Envelope unboxing & RSVP Page */}
              <motion.div
                key="content"
                ref={scrollContainerRef}
                className="absolute inset-0 overflow-y-auto no-scrollbar flex flex-col bg-stone-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{
                  backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.15)), url('/images/wood_texture.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                {/* Soft vignette for depth on the wood surface */}
                <div
                  className="pointer-events-none absolute inset-0 z-0"
                  style={{ background: "radial-gradient(120% 80% at 50% 38%, transparent 40%, rgba(20,14,8,0.28) 100%)" }}
                />

                {/* 3D Envelope Container with remounting key constraint */}
                <motion.div
                  className="w-full shrink-0 flex items-center justify-center py-4 relative z-10"
                  animate={{ minHeight: isCardOpened ? 470 : 400 }}
                  transition={{ type: "spring", stiffness: 85, damping: 18, delay: 0.1 }}
                >
                  <EnvelopeAnimation 
                    key={`${template.name}_${theme?.id || "gold"}`}
                    template={template} 
                    theme={theme}
                    onOpenComplete={handleCardOpenComplete} 
                    guestName={guestName}
                  />
                </motion.div>

              </motion.div>
              
              {/* Bottom scrim — turns the floating buttons into a premium CTA bar instead of dead wood */}
              <AnimatePresence>
                {isCardOpened && (
                  <motion.div
                    key="cta-scrim"
                    className="absolute bottom-0 left-0 right-0 h-44 z-30 pointer-events-none"
                    style={{ background: "linear-gradient(to top, rgba(28,20,12,0.92) 0%, rgba(28,20,12,0.65) 45%, rgba(28,20,12,0) 100%)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  />
                )}
              </AnimatePresence>

              {/* Floating RSVP Button overlaying the card */}
              <AnimatePresence>
                {isCardOpened && (
                  <motion.div
                    className="absolute bottom-7 left-0 right-0 px-6 z-40 flex flex-col gap-3 items-center"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                  >
                    <button
                      onClick={() => setIsBottomSheetOpen(true)}
                      className="w-full max-w-[240px] text-[#191B1E] py-3 rounded-full font-bold font-sans text-xs active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-[2px] bg-gradient-to-r from-[#B8944F] via-[#D7BE80] to-[#B8944F] border border-[#B8944F]/50 shadow-[0_6px_20px_rgba(184,148,79,0.35)] hover:brightness-105 hover:shadow-[0_8px_25px_rgba(184,148,79,0.5)] transition-all duration-300"
                    >
                      <svg className="w-4 h-4 text-[#191B1E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-sans font-bold">{rsvpData ? "Update RSVP" : "Confirm RSVP"}</span>
                    </button>

                    <button
                      onClick={() => setIsBottomSheetOpen(true)}
                      className="text-[#B8944F] hover:text-[#191B1E] font-bold font-sans text-[10px] uppercase tracking-[1.5px] flex items-center gap-1.5 active:scale-[0.97] transition-all cursor-pointer bg-[#FAF9F6] px-4.5 py-1.5 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[#B8944F]/30 hover:bg-[#B8944F] hover:text-[#FAF9F6] hover:border-transparent transition-all duration-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Message Host
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              </>
            )}
          </AnimatePresence>

          {/* Modal Bottom Sheet component */}
          <RSVPBottomSheet
            isOpen={isBottomSheetOpen}
            onClose={() => setIsBottomSheetOpen(false)}
            onSubmit={handleRsvpSubmit}
            template={template}
          />
        </div>

      </div>

      {/* Phone Home Indicator Bar */}
      {!isBare && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-stone-750 dark:bg-stone-700 rounded-full z-50 pointer-events-none opacity-80" />
      )}

    </div>
  );
}
