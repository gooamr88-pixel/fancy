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
    <div className={isBare ? "w-full h-full relative overflow-hidden flex flex-col select-none bg-white" : "w-full max-w-[340px] min-h-[580px] max-h-[630px] border-[10px] border-stone-850 dark:border-stone-800 rounded-[2.5rem] bg-stone-900 shadow-2xl relative overflow-hidden flex flex-col select-none aspect-[9/18.5]"}>
      
      {/* Phone Notch & Camera Mock */}
      {!isBare && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-stone-850 dark:bg-stone-800 rounded-full flex items-center justify-center gap-1.5 px-3 z-50">
          <div className="w-1 h-1 bg-stone-700 dark:bg-stone-600 rounded-full" />
          <div className="w-6 h-0.5 bg-stone-750 dark:bg-stone-700 rounded-full" />
          <div className="w-1.5 h-1.5 bg-indigo-950 dark:bg-indigo-900 rounded-full border border-indigo-900/50" />
        </div>
      )}

      {/* Screen Area */}
      <div className={isBare ? "flex-1 flex flex-col bg-white overflow-hidden relative" : "flex-1 flex flex-col bg-white overflow-hidden relative rounded-[2rem]"}>
        
        {/* Simulated Browser URL Header */}
        <div className="flex items-center gap-2.5 px-3.5 pt-6 pb-2.5 bg-stone-50 border-b border-stone-150 text-stone-500 font-sans z-40 shrink-0 text-[10px]">
          {/* Back Icon */}
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          
          {/* URL bar */}
          <div className="flex-1 bg-stone-200/55 rounded-lg py-1 px-2.5 flex items-center justify-between text-stone-600 text-[9.5px]">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <svg className="w-2.5 h-2.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              <span className="truncate text-stone-550 tracking-wide">fancyrsvp.com/invite/jamil</span>
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
                {/* 3D Envelope Container with remounting key constraint */}
                <motion.div 
                  className="w-full shrink-0 flex items-center justify-center py-4"
                  animate={{ minHeight: isCardOpened ? 510 : 400 }}
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
              
              {/* Floating RSVP Button overlaying the card */}
              <AnimatePresence>
                {isCardOpened && (
                  <motion.div
                    className="absolute bottom-6 left-0 right-0 px-6 z-40 flex flex-col gap-2.5 items-center animate-subtle-float"
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
