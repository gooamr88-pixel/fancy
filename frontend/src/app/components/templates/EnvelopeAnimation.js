"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import InvitationCard from "./InvitationCard";

/* ═══════════════════════════════════════════════════════════════
   EnvelopeAnimation — the closed → opening envelope teaser.

   Rewritten to be STABLE:
   • Fills its parent (a fixed-size stage) — it never animates any
     container height, so nothing around it reflows ("jumps").
   • The envelope sits in a fixed-size, centered wrapper. The card
     only lifts WITHIN that wrapper's bounds.
   • When the open animation finishes it calls onOpenComplete; the
     parent (MobilePreview) then cross-fades to the full, scrollable
     opened invitation. This component owns only the teaser.
   ═══════════════════════════════════════════════════════════════ */
export default function EnvelopeAnimation({ template, theme, onOpenComplete, guestName, config }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardOut, setIsCardOut] = useState(false);
  const [showTapIndicator, setShowTapIndicator] = useState(true);

  const accentColor = theme?.primary || "#B8944F";

  // NOTE: a fresh closed envelope is guaranteed by the parent remounting this
  // component via `key={template.pattern}` whenever the layout changes — so no
  // reset effect is needed (and colour-only changes never remount).

  const handleOpen = () => {
    if (isOpen) return;
    setIsOpen(true);
    setShowTapIndicator(false);

    // Slide the card up shortly after the flap begins to open.
    const t1 = setTimeout(() => setIsCardOut(true), 550);
    // Hand off to the parent once the card has cleared the pocket.
    const t2 = setTimeout(() => onOpenComplete && onOpenComplete(), 1350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
      {/* Fixed-size envelope stage — the card lift is bounded by this box */}
      <div className="relative" style={{ width: 230, height: 300, pointerEvents: "auto" }}>

        {/* ─── Envelope body (anchored to the bottom of the stage) ─── */}
        <motion.div
          className="absolute left-0 right-0 bottom-0 cursor-pointer perspective-1000 transform-style-3d"
          style={{ height: 165 }}
          onClick={handleOpen}
        >
          {/* Layer 1: Envelope back pocket */}
          <motion.div
            className="absolute inset-0 bg-[#F4EFE6] rounded-b-2xl border border-amber-900/10 shadow-lg"
            style={{ zIndex: 10, transformStyle: "preserve-3d" }}
            animate={{ opacity: isCardOut ? 0 : 1 }}
            transition={{ duration: 0.4, delay: isCardOut ? 0.4 : 0 }}
          >
            <div className="absolute inset-2 top-0 bg-gradient-to-b from-[#DFD3C3] via-[#FAF9F6] to-[#FAF9F6] rounded-b-xl" style={{ transform: "translateZ(1px)" }} />
          </motion.div>

          {/* Layer 2: The invitation card peeking out */}
          <motion.div
            className="absolute left-3 right-3 rounded-lg shadow-xl overflow-hidden"
            style={{ transformOrigin: "bottom center", zIndex: isCardOut ? 40 : 20, bottom: 8 }}
            initial={{ height: 150, y: 0, scale: 0.95 }}
            animate={{
              height: isCardOut ? 250 : 150,
              y: isCardOut ? -118 : 0,
              scale: isCardOut ? 1 : 0.95,
              rotate: isCardOut ? [0, -5, -1, 0] : 0,
            }}
            transition={{
              y: { type: "spring", stiffness: 90, damping: 18 },
              height: { type: "spring", stiffness: 90, damping: 18 },
              scale: { type: "spring", stiffness: 90, damping: 18, delay: 0.05 },
              rotate: { duration: 0.9, ease: "easeInOut" },
            }}
          >
            <InvitationCard template={template} theme={theme} guestName={guestName} config={config} />
          </motion.div>

          {/* Layer 3: Front flaps */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 30 }}
            animate={{ opacity: isCardOut ? 0 : 1 }}
            transition={{ duration: 0.4, delay: isCardOut ? 0.4 : 0 }}
          >
            <svg className="w-full h-full filter drop-shadow-md" viewBox="0 0 100 70" preserveAspectRatio="none">
              <defs>
                <filter id="flapShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#5C4D3C" floodOpacity="0.22" />
                </filter>
              </defs>
              <path d="M 0,0 L 46,38 L 0,70 Z" fill="#EADBC8" stroke="#DFD3C3" strokeWidth="0.3" filter="url(#flapShadow)" />
              <path d="M 100,0 L 54,38 L 100,70 Z" fill="#EADBC8" stroke="#DFD3C3" strokeWidth="0.3" filter="url(#flapShadow)" />
              <path d="M 0,70 L 50,34 L 100,70 Z" fill="#F5EFE6" stroke="#E5D8C6" strokeWidth="0.3" filter="url(#flapShadow)" />
            </svg>
          </motion.div>

          {/* Layer 4: Top folding flap */}
          <motion.div
            className="absolute top-0 left-0 w-full h-[78px] transform-style-3d"
            style={{ transformOrigin: "top", originY: 0 }}
            initial={{ rotateX: 0, zIndex: 31 }}
            animate={{ rotateX: isOpen ? 180 : 0, zIndex: isOpen ? 5 : 31, opacity: isCardOut ? 0 : 1 }}
            transition={{
              rotateX: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
              zIndex: { delay: isOpen ? 0.35 : 0 },
              opacity: { duration: 0.4, delay: isCardOut ? 0.4 : 0 },
            }}
          >
            <div className="absolute inset-0 backface-hidden" style={{ zIndex: 32 }}>
              <svg className="w-full h-full filter drop-shadow-sm" viewBox="0 0 100 45" preserveAspectRatio="none">
                <defs>
                  <filter id="topFlapShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#5C4D3C" floodOpacity="0.25" />
                  </filter>
                </defs>
                <polygon points="0,0 50,45 100,0" fill="#FAF9F6" stroke="#DFD3C3" strokeWidth="0.3" filter="url(#topFlapShadow)" />
              </svg>
            </div>

            <div className="absolute inset-0 backface-hidden" style={{ transform: "rotateY(180deg)", zIndex: 31 }}>
              <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 45" preserveAspectRatio="none">
                <polygon points="0,0 50,45 100,0" fill="#FAF9F6" />
                <polygon points="4,1 50,41 96,1" fill={`url(#${theme?.liningGradId || "goldGrad"})`} />
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#C5A059" /><stop offset="20%" stopColor="#FDF0CD" />
                    <stop offset="40%" stopColor="#D4AF37" /><stop offset="60%" stopColor="#F3E5AB" />
                    <stop offset="80%" stopColor="#AA7A1E" /><stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                  <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#043A1D" /><stop offset="20%" stopColor="#A3D5A5" />
                    <stop offset="40%" stopColor="#0D6D3A" /><stop offset="60%" stopColor="#BEE5BF" />
                    <stop offset="80%" stopColor="#032A15" /><stop offset="100%" stopColor="#0D6D3A" />
                  </linearGradient>
                  <linearGradient id="burgundyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4A0E17" /><stop offset="20%" stopColor="#F2C9D0" />
                    <stop offset="40%" stopColor="#800020" /><stop offset="60%" stopColor="#E89FB0" />
                    <stop offset="80%" stopColor="#3A080F" /><stop offset="100%" stopColor="#800020" />
                  </linearGradient>
                  <linearGradient id="oliveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3E4A2C" /><stop offset="20%" stopColor="#DCE2C8" />
                    <stop offset="40%" stopColor="#6B7A4F" /><stop offset="60%" stopColor="#C9B896" />
                    <stop offset="80%" stopColor="#2E3720" /><stop offset="100%" stopColor="#6B7A4F" />
                  </linearGradient>
                  <linearGradient id="terracottaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5C3122" /><stop offset="20%" stopColor="#F0DAC4" />
                    <stop offset="40%" stopColor="#A15C3E" /><stop offset="60%" stopColor="#E3C9A8" />
                    <stop offset="80%" stopColor="#422217" /><stop offset="100%" stopColor="#A15C3E" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </motion.div>
        </motion.div>

        {/* Pulsing "Tap to Open" indicator — sits over the envelope body */}
        {showTapIndicator && (
          <div className="absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: 165, zIndex: 50 }}>
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-14 w-14 rounded-full opacity-35" style={{ backgroundColor: accentColor }} />
              <span className="relative inline-flex rounded-full h-10 w-10 items-center justify-center shadow-lg text-white" style={{ backgroundColor: accentColor }}>
                <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
            </div>
            <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mt-3 bg-white/80 backdrop-blur-sm py-1 px-3 rounded-full border border-stone-200/50 shadow-sm animate-pulse">
              Tap to Open
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
