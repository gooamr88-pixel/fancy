"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EnvelopeAnimation from "./EnvelopeAnimation";
import RSVPBottomSheet from "./RSVPBottomSheet";

export default function MobilePreview({ template }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCardOpened, setIsCardOpened] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [rsvpData, setRsvpData] = useState(null);
  const scrollContainerRef = useRef(null);

  // Reset states when template changes to simulate a fresh load
  useEffect(() => {
    setIsLoading(true);
    setIsCardOpened(false);
    setIsBottomSheetOpen(false);
    setRsvpData(null);

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [template]);

  const handleCardOpenComplete = () => {
    setIsCardOpened(true);
    
    // Auto-scroll down slightly to reveal the RSVP details after the card slides up
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: 150,
          behavior: "smooth"
        });
      }
    }, 600);
  };

  const handleRsvpSubmit = (data) => {
    console.log("RSVP Data Submitted:", data);
    setRsvpData(data);
  };

  const accentColor = template?.accent || "#B8944F";

  return (
    <div className="w-full max-w-[340px] min-h-[580px] max-h-[630px] border-[10px] border-stone-850 dark:border-stone-800 rounded-[2.5rem] bg-stone-900 shadow-2xl relative overflow-hidden flex flex-col select-none aspect-[9/18.5]">
      
      {/* Phone Notch & Camera Mock */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-stone-850 dark:bg-stone-800 rounded-full flex items-center justify-center gap-1.5 px-3 z-50">
        <div className="w-1 h-1 bg-stone-700 dark:bg-stone-600 rounded-full" />
        <div className="w-6 h-0.5 bg-stone-750 dark:bg-stone-700 rounded-full" />
        <div className="w-1.5 h-1.5 bg-indigo-950 dark:bg-indigo-900 rounded-full border border-indigo-900/50" />
      </div>

      {/* Screen Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden relative rounded-[2rem]">
        
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
              /* Phase 2: Envelope unboxing & RSVP Page */
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
                {/* 3D Envelope Container */}
                <div className="w-full shrink-0 flex items-center justify-center py-6 min-h-[380px]">
                  <EnvelopeAnimation 
                    template={template} 
                    onOpenComplete={handleCardOpenComplete} 
                  />
                </div>

                {/* RSVP Details - Fades in once card slides open */}
                <AnimatePresence>
                  {isCardOpened && (
                    <motion.div
                      className="w-full px-4 pb-12 shrink-0 flex flex-col gap-4"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      {/* Gold Divider Ornament */}
                      <div className="flex items-center justify-center gap-3 py-2">
                        <div className="flex-1 h-[0.5px] bg-gradient-to-r from-transparent to-[#D7BE80]" />
                        <svg className="w-3.5 h-3.5 text-[#B8944F]/60" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
                        </svg>
                        <div className="flex-1 h-[0.5px] bg-gradient-to-r from-[#D7BE80] to-transparent" />
                      </div>

                      {/* Guest Info & Action Card */}
                      <div className="bg-white/92 backdrop-blur-md border border-stone-200/50 p-5 rounded-2xl shadow-xl text-center text-stone-800 font-sans">
                        <span className="text-[10px] uppercase tracking-[3px] text-[#B8944F] font-bold block mb-1">WELCOME GUEST</span>
                        <h2 className="font-serif text-xl font-bold text-stone-900 leading-tight">To: جميل الموسم</h2>
                        
                        <div className="h-[1px] bg-stone-100 my-4" />

                        {rsvpData ? (
                          /* RSVP Submitted View */
                          <div className="bg-stone-50 border border-stone-200/50 rounded-xl p-3.5 mb-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100/50 mb-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Response Submitted
                            </span>
                            
                            <p className="text-xs font-bold text-stone-850">
                              {rsvpData.attending ? (
                                `Attending (${rsvpData.adults} ${rsvpData.adults > 1 ? "Adults" : "Adult"}${
                                  rsvpData.children > 0 ? `, ${rsvpData.children} ${rsvpData.children > 1 ? "Children" : "Child"}` : ""
                                })`
                              ) : (
                                "Declined Invitation"
                              )}
                            </p>
                            {rsvpData.message && (
                              <p className="text-[11px] text-stone-500 italic mt-2 border-t border-stone-200/50 pt-2 max-w-[90%] mx-auto leading-relaxed">
                                &ldquo;{rsvpData.message}&rdquo;
                              </p>
                            )}
                          </div>
                        ) : (
                          /* Pending RSVP View */
                          <div className="mb-4">
                            <p className="text-xs text-stone-500 max-w-[85%] mx-auto leading-relaxed">
                              You are cordially invited to celebrate this special day. Please confirm your attendance.
                            </p>
                          </div>
                        )}

                        {/* Interactive RSVP Action Button */}
                        <button
                          onClick={() => setIsBottomSheetOpen(true)}
                          className="w-full text-white py-2.5 rounded-xl font-bold font-sans text-xs shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                          style={{ backgroundColor: accentColor }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {rsvpData ? "Update Response" : "You are attending (RSVP)"}
                        </button>

                        {/* Message Host secondary trigger */}
                        <button
                          onClick={() => setIsBottomSheetOpen(true)}
                          className="w-full bg-stone-100 hover:bg-stone-200/60 text-stone-600 py-2.5 rounded-xl font-bold font-sans text-xs active:scale-[0.98] transition-all cursor-pointer mt-2.5 flex items-center justify-center gap-2 border border-stone-200/30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Message Host
                        </button>

                        {/* RSVP Deadline date info */}
                        <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>RSVP Deadline: June 30, 2026</span>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
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
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-stone-750 dark:bg-stone-700 rounded-full z-50 pointer-events-none opacity-80" />

    </div>
  );
}
