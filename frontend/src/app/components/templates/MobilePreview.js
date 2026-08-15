"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import GuestExperiencePreview from "./GuestExperiencePreview";
import Icon from "../icons/Icon";

/* ═══════════════════════════════════════════════════════════════
   The guest journey, inside the wizard's phone.

   This used to draw its own invitation: a per-template gradient backdrop,
   decorative particles, and an "Event Details" card filled from a hardcoded
   constant. An organizer could complete every field in Stage 2 and the panel
   beside them would still read "The Grand Ballroom · Plaza Hotel, New York".
   It was labelled "Live Guest Journey".

   None of that is left. The screen now renders GuestExperiencePreview — the
   real opening, the real hero, the real sections, the real RSVP — so there is
   exactly one invitation in this product and this is a window onto it, not a
   drawing of it.

   Two steps remain, and both are honest:

     received  the lock-screen notification. This depicts the DELIVERY, not
               the invitation, so it makes no claim about the page.
     opened    the invitation itself, `playOpening` deciding whether the guest
               is arriving at the cover or already past it.

   The old `attending` / `declined` steps are gone with the mock RSVP sheet
   they drove. The RSVP is real now and sits at the foot of the page, where a
   guest finds it — a simulated one beside it would be the same lie in
   miniature.
   ═══════════════════════════════════════════════════════════════ */

export default function MobilePreview({
  event,
  step: controlledStep,
  onStepChange,
  guestName,
  invitationPattern,
  invitationTheme,
  invitationData,
  /** Shown in the browser bar. The organizer's real URL once they've typed one. */
  slug,
}) {
  const [internalStep, setInternalStep] = React.useState("envelope");
  const isControlled = controlledStep !== undefined;
  const step = isControlled ? controlledStep : internalStep;
  const setStep = (next) => {
    if (isControlled) onStepChange?.(next);
    else setInternalStep(next);
  };

  const accent = invitationTheme?.primary || "#B8944F";
  const secondary = invitationTheme?.secondary || "#D7BE80";

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
      {/* Browser bar — showing the organizer's OWN link once they have one.
          It used to read `fancyrsvp.com/invite/jamil` for everybody, which is
          the same category of mistake as the venue card this replaces. */}
      <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5 bg-stone-50 border-b border-stone-200 text-stone-500 font-sans z-40 shrink-0 text-[10px]">
        <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        <div className="flex-1 bg-stone-200/50 rounded-lg py-1 px-2.5 flex items-center justify-between text-stone-600 text-[9.5px]">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <svg className="w-2.5 h-2.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
            <span className="truncate text-stone-500 tracking-wide font-medium">
              fancyrsvp.com/{slug || "your-event"}
            </span>
          </div>
        </div>
      </div>

      {/* The stage. A fixed flex-1 box with its own overflow, so nothing the
          invitation does can reflow the phone around it. */}
      <div className="flex-1 relative overflow-hidden flex flex-col bg-white">
        <AnimatePresence mode="wait">
          {step === "received" ? (
            <motion.div
              key="received"
              className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-10 px-5"
              style={{ background: `linear-gradient(165deg, #1a1815 0%, #2a2520 45%, #151310 100%)` }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
            >
              <motion.div
                className="w-full max-w-[250px] bg-white/85 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-white/40 cursor-pointer"
                initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
                onClick={() => setStep("envelope")}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})` }}>
                    <Icon name="envelope" size={15} strokeWidth={1.7} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-stone-800 font-sans">Fancy Invitation</span>
                    <span className="text-[9px] text-stone-500 font-sans truncate">You&apos;ve received an invitation — tap to open</span>
                  </div>
                  <span className="text-[8px] text-stone-400 font-sans">now</span>
                </div>
              </motion.div>
              <span className="text-[9px] text-white/70 font-sans mt-3 tracking-wide">Tap the notification to continue</span>
            </motion.div>
          ) : (
            <motion.div
              key="invitation"
              className="absolute inset-0 z-10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            >
              <GuestExperiencePreview
                event={event}
                // Stage 1: nothing has been entered yet, so the sections fill
                // with sample content — otherwise the organizer is choosing
                // between templates by looking at three empty pages.
                showSampleContent
                // "envelope" is the guest arriving; "opened" is the page they
                // land on. One component, one flag — the two are the same
                // experience at two moments, not two renderings.
                playOpening={step === "envelope"}
                invitationPattern={invitationPattern}
                invitationTheme={invitationTheme}
                invitationData={invitationData}
                guestName={guestName}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
