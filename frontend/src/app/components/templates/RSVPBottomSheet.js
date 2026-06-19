"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RSVPBottomSheet({ isOpen, onClose, onSubmit, template, initialAttending = true }) {
  const [attending, setAttending] = useState(initialAttending);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Set default message chips
  const attendingChips = ["Can't wait!", "Looking forward to it!", "So excited for you guys!"];
  const decliningChips = ["Sad to miss it!", "Warmest wishes!", "Cheers to you both!"];
  const currentChips = attending ? attendingChips : decliningChips;

  // No reset effect needed: MobilePreview remounts this sheet via `key={step}`
  // each time it opens, so useState initializers above give a fresh form.

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate backend request
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Submit data callback
      if (onSubmit) {
        onSubmit({
          attending,
          adults: attending ? adults : 0,
          children: attending ? children : 0,
          message
        });
      }

      // Close bottom sheet after success message displays
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 1200);
  };

  const handleChipClick = (chip) => {
    setMessage((prev) => {
      if (!prev) return chip;
      return `${prev} ${chip}`;
    });
  };

  const accentColor = template?.accent || "#B8944F";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-40 rounded-[2rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sliding Bottom Sheet */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-5 z-50 overflow-hidden max-h-[88%] flex flex-col text-stone-800"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
          >
            {/* Top Drag Handle */}
            <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mb-4 shrink-0" />

            {isSuccess ? (
              /* Success Anim Screen */
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border-2"
                  style={{ borderColor: accentColor, backgroundColor: `${accentColor}0a` }}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={3}>
                    <motion.path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: "easeInOut", delay: 0.2 }}
                    />
                  </svg>
                </motion.div>
                <h4 className="font-serif text-lg font-bold text-stone-900">RSVP Submitted!</h4>
                <p className="text-xs text-stone-500 max-w-[80%] mx-auto mt-2 leading-relaxed">
                  Your response has been saved successfully. The host will be notified immediately.
                </p>
              </div>
            ) : (
              /* Main RSVP Form */
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto no-scrollbar gap-4">
                <div className="text-center shrink-0">
                  <h3 className="font-serif text-lg font-bold text-stone-900 leading-tight">Will you attend?</h3>
                  <p className="text-[10px] text-stone-400 font-sans tracking-wide uppercase mt-0.5">Julian & Aria Wedding</p>
                </div>

                {/* RSVP Status Toggle Pill Switch */}
                <div className="bg-stone-100 p-1 rounded-xl grid grid-cols-2 gap-1 relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setAttending(true)}
                    className={`relative py-2.5 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all z-10 ${
                      attending ? "text-white" : "text-stone-500"
                    }`}
                  >
                    {attending && (
                      <motion.div
                        className="absolute inset-0 rounded-lg shadow-sm z-[-1]"
                        style={{ backgroundColor: accentColor }}
                        layoutId="activeRsvpPill"
                      />
                    )}
                    Will Attend
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttending(false)}
                    className={`relative py-2.5 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all z-10 ${
                      !attending ? "text-white" : "text-stone-500"
                    }`}
                  >
                    {!attending && (
                      <motion.div
                        className="absolute inset-0 bg-stone-750 rounded-lg shadow-sm z-[-1]"
                        layoutId="activeRsvpPill"
                      />
                    )}
                    Will Not Attend
                  </button>
                </div>

                {/* Conditional Guest Counter (Attending only) */}
                <AnimatePresence initial={false}>
                  {attending && (
                    <motion.div
                      className="flex flex-col gap-3.5 border border-stone-100 rounded-2xl p-3 bg-stone-50/50 shrink-0"
                      initial={{ height: 0, opacity: 0, scaleY: 0.8 }}
                      animate={{ height: "auto", opacity: 1, scaleY: 1 }}
                      exit={{ height: 0, opacity: 0, scaleY: 0.8 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ originY: 0 }}
                    >
                      {/* Adults Stepper */}
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-stone-800 block">Adults</span>
                          <span className="text-[10px] text-stone-400 block font-light leading-none mt-0.5">Age 12 or above</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setAdults(Math.max(1, adults - 1))}
                            className="w-7 h-7 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-500 font-bold active:scale-90 transition-all cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-4 text-center font-bold font-sans text-stone-800">{adults}</span>
                          <button
                            type="button"
                            onClick={() => setAdults(Math.min(10, adults + 1))}
                            className="w-7 h-7 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-500 font-bold active:scale-90 transition-all cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Children Stepper */}
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-stone-800 block">Children</span>
                          <span className="text-[10px] text-stone-400 block font-light leading-none mt-0.5">Under age 12</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setChildren(Math.max(0, children - 1))}
                            className="w-7 h-7 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-500 font-bold active:scale-90 transition-all cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-4 text-center font-bold font-sans text-stone-800">{children}</span>
                          <button
                            type="button"
                            onClick={() => setChildren(Math.min(10, children + 1))}
                            className="w-7 h-7 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-500 font-bold active:scale-90 transition-all cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message to Host */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <label htmlFor="rsvp-msg" className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Private Message to Host
                  </label>
                  <textarea
                    id="rsvp-msg"
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Leave a warm note for the couple..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50/20 text-xs focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none font-sans text-stone-750"
                  />

                  {/* Message Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {currentChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200/60 rounded-full text-[9px] font-bold text-stone-500 cursor-pointer transition-all"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-auto pt-4 shrink-0">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full text-white py-2.5 rounded-xl font-bold font-sans text-xs shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    style={{ backgroundColor: attending ? accentColor : "#191B1E" }}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      "Submit Response"
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
