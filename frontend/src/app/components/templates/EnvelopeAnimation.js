"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function EnvelopeAnimation({ template, onOpenComplete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardOut, setIsCardOut] = useState(false);
  const [showTapIndicator, setShowTapIndicator] = useState(true);

  // Reset envelope state when template changes
  useEffect(() => {
    setIsOpen(false);
    setIsCardOut(false);
    setShowTapIndicator(true);
  }, [template]);

  const handleOpen = () => {
    if (isOpen) return;
    setIsOpen(true);
    setShowTapIndicator(false);
    
    // Step 2: Slide card up after flap animation starts to finish
    setTimeout(() => {
      setIsCardOut(true);
    }, 600);

    // Step 3: Trigger callback once animation completes
    setTimeout(() => {
      if (onOpenComplete) onOpenComplete();
    }, 1600);
  };

  // Card Content & Styles based on Template
  const renderCardContent = () => {
    const { name, accent, pattern } = template;
    
    switch (pattern) {
      case "serif": // Classic - Timeless Elegance
        return (
          <div className="w-full h-full p-4 flex flex-col items-center justify-between border-[3px] border-[#D4C4A0] rounded bg-[#FCFAF6] text-[#4A3B2C] font-serif select-none relative overflow-hidden">
            {/* Elegant inner gold border */}
            <div className="absolute inset-1 border border-[#D4C4A0]/60 pointer-events-none" />
            <div className="text-[9px] uppercase tracking-[3px] text-[#8B7355] mt-1 text-center">THE HONOR OF YOUR PRESENCE</div>
            
            <div className="flex flex-col items-center my-auto text-center">
              <span className="font-script text-3xl text-[#8B7355] leading-none mb-1">Aria & Julian</span>
              <span className="text-[10px] tracking-[2px] font-sans font-light my-1 uppercase text-[#5E5A52]">ARE GETTING MARRIED</span>
              <span className="text-[9px] text-[#8B7355]/85 italic">Saturday, Oct 24, 2026</span>
              <span className="text-[9px] tracking-wide text-center mt-2 max-w-[90%] leading-relaxed font-sans text-[#5E5A52]">
                At 4 o&apos;clock in the afternoon<br/>
                <strong>The Plaza Hotel</strong>, New York
              </span>
            </div>
            
            <div className="w-6 h-0.5 bg-[#8B7355] mb-1" />
          </div>
        );
      
      case "geo": // Modern - Urban Edge
        return (
          <div className="w-full h-full p-4 flex flex-col justify-between border border-[#34495E]/50 rounded bg-[#1A252F] text-white font-sans select-none relative overflow-hidden">
            {/* Neon geometric lines */}
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full border-2 border-[#1ABC9C]/10" />
            <div className="absolute -bottom-16 -left-16 w-32 h-32 rotate-45 border-t border-r border-[#1ABC9C]/15" />
            
            <div className="flex justify-between items-start">
              <span className="text-[8px] font-bold tracking-[2px] text-[#1ABC9C] uppercase">JOIN US // 10.24.26</span>
              <span className="text-[7px] opacity-40">NYC</span>
            </div>
            
            <div className="my-auto flex flex-col gap-1">
              <span className="text-[9px] tracking-[4px] uppercase text-[#1ABC9C]/90 font-light">WEDDING OF</span>
              <h4 className="text-2xl font-black tracking-tight leading-tight uppercase font-sans text-white">ARIA<br/>&amp; JULIAN</h4>
              <p className="text-[8.5px] leading-relaxed text-gray-350 font-light max-w-[95%] mt-1">
                A modern celebration of love. Cocktails, dinner, and dancing to follow at <strong>The Plaza</strong>.
              </p>
            </div>
            
            <div className="text-[8px] tracking-[1.5px] uppercase font-bold text-right text-[#1ABC9C]">
              RSVP LIVE // FANCY
            </div>
          </div>
        );

      case "organic": // Rustic - Woodland Romance
        return (
          <div className="w-full h-full p-4 flex flex-col items-center justify-between border-2 border-[#8B6914]/30 rounded bg-[#F5E6D3] text-[#5C4033] font-serif select-none relative overflow-hidden">
            <div className="text-[9px] uppercase tracking-[1.5px] text-[#6B4226]/80 font-sans font-bold text-center">JOIN IN OUR STORY</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="text-[#8B5A2B] font-script text-3.5xl leading-none">Aria & Julian</span>
              <span className="text-[9px] font-sans font-medium tracking-[1px] my-1 uppercase text-[#6B4226]/90">ARE TYING THE KNOT</span>
              <span className="text-[9px] mt-1.5 font-bold text-[#6B4226]">OCTOBER 24, 2026</span>
              <span className="text-[8.5px] italic text-[#6B4226]/75 mt-0.5">At the Barn at Plaza Gardens, NY</span>
            </div>
            
            <div className="text-[8px] font-sans italic opacity-75">Dress code: Rustic elegance</div>
          </div>
        );

      case "luxury": // Luxury - Grand Affair
        return (
          <div className="w-full h-full p-4 flex flex-col items-center justify-between border border-[#E6C200]/40 rounded bg-gradient-to-br from-[#111625] to-[#1D263B] text-white font-serif select-none relative overflow-hidden">
            {/* Elegant Gold Corner Ornaments */}
            <div className="absolute top-1.5 left-1.5 w-6 h-6 border-t border-l border-[#E6C200]/60" />
            <div className="absolute top-1.5 right-1.5 w-6 h-6 border-t border-r border-[#E6C200]/60" />
            <div className="absolute bottom-1.5 left-1.5 w-6 h-6 border-b border-l border-[#E6C200]/60" />
            <div className="absolute bottom-1.5 right-1.5 w-6 h-6 border-b border-r border-[#E6C200]/60" />
            
            <div className="text-[7.5px] uppercase tracking-[4px] text-[#E6C200] font-sans font-semibold mt-1 text-center font-bold">THE HONOR OF YOUR PRESENCE</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="text-[8px] tracking-[3px] uppercase text-[#E6C200]/70 font-sans font-light">WEDDING CELEBRATION OF</span>
              <span className="font-serif font-semibold text-2.5xl tracking-wide my-1 text-transparent bg-clip-text bg-gradient-to-r from-[#F3E7C9] via-[#E6C200] to-[#F3E7C9]">
                ARIA & JULIAN
              </span>
              <span className="text-[8.5px] tracking-widest text-[#E6C200]/90 font-sans uppercase my-0.5">OCTOBER 24, 2026</span>
              <span className="text-[8.5px] font-sans font-light text-gray-300 max-w-[85%] leading-relaxed mt-2">
                Four o&apos;clock in the afternoon<br/>
                <strong className="text-white font-semibold">The Grand Ballroom, Plaza Hotel</strong>
              </span>
            </div>
            
            <div className="text-[8px] uppercase tracking-[2px] text-[#E6C200] font-bold">Black Tie Requested</div>
          </div>
        );

      case "minimal": // Minimal - Pure & Simple
        return (
          <div className="w-full h-full p-4 flex flex-col items-center justify-between border border-gray-200 rounded bg-white text-[#111] font-sans select-none relative">
            <div className="text-[8px] font-bold tracking-[3px] text-gray-400 mt-1 uppercase">A & J</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-serif text-2xl font-light tracking-wide text-gray-900">Aria Sterling</span>
              <span className="text-[10px] text-gray-450 my-1 font-light">&amp;</span>
              <span className="font-serif text-2xl font-light tracking-wide text-gray-900">Julian Bennett</span>
              
              <span className="text-[9px] tracking-[2px] text-gray-550 uppercase mt-4 font-bold">10 . 24 . 26</span>
              <span className="text-[8.5px] text-gray-500 font-light mt-1 uppercase">Plaza Hotel, New York</span>
            </div>
            
            <div className="text-[8px] font-light text-gray-400">RSVP BY SEPTEMBER 15</div>
          </div>
        );

      case "floral": // Floral - Garden Party
        return (
          <div className="w-full h-full p-4 flex flex-col items-center justify-between border-2 border-[#D4A0A7]/20 rounded bg-gradient-to-tr from-[#FFF5F6] to-[#FFF0F2] text-[#6E4B4F] font-serif select-none relative overflow-hidden">
            {/* Botanical decorative leaves */}
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-[#E8B4B8]/15 rounded-full filter blur-sm" />
            <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-[#F3D1DC]/25 rounded-full filter blur-sm" />
            
            <div className="text-[9px] uppercase tracking-[2px] text-[#8B4A6B]/85 font-sans font-bold text-center">WE ARE SO EXCITED TO CELEBRATE WITH YOU</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-script text-3.5xl text-[#8B4A6B] leading-none mb-0.5">Aria & Julian</span>
              <span className="text-[9px] tracking-[1.5px] uppercase font-sans font-light my-0.5 text-gray-650">Invite you to their garden wedding</span>
              <span className="text-[9.5px] font-bold text-[#8B4A6B] mt-1.5">Saturday, October 24, 2026</span>
              <span className="text-[8.5px] italic text-gray-500">At the Rose Terrace, Plaza Hotel</span>
            </div>
            
            <div className="text-[8px] text-[#8B4A6B]/70 tracking-wide font-sans font-bold">Join us under the stars</div>
          </div>
        );
        
      default:
        return (
          <div className="w-full h-full p-4 flex flex-col items-center justify-center bg-white border rounded">
            <h4>You are Invited</h4>
            <p>Aria & Julian</p>
          </div>
        );
    }
  };

  return (
    <div className="relative w-full max-w-[300px] h-[360px] flex items-center justify-center mx-auto mt-6 z-10 select-none">
      
      {/* 3D Envelope Body Container */}
      <div 
        className="relative w-full h-[180px] mt-[90px] cursor-pointer perspective-1000 transform-style-3d"
        onClick={handleOpen}
      >
        
        {/* Layer 1: Envelope Back */}
        <div 
          className="absolute inset-0 bg-[#F4EFE6] rounded-b-2xl border border-amber-900/10 shadow-lg"
          style={{ 
            zIndex: 10,
            transformStyle: "preserve-3d"
          }}
        >
          {/* Inner back gold lining color - visible inside envelope behind the card */}
          <div 
            className="absolute inset-2 top-0 bg-gradient-to-b from-[#DFD3C3] via-[#FAF9F6] to-[#FAF9F6] rounded-b-xl"
            style={{ transform: "translateZ(1px)" }}
          />
        </div>

        {/* Layer 2: The Invitation Card */}
        <motion.div
          className="absolute left-3.5 right-3.5 h-[230px] rounded-lg shadow-xl cursor-default"
          style={{ 
            bottom: "8px", // tucked slightly
            transformOrigin: "bottom center"
          }}
          initial={{ y: 0, scale: 0.94, zIndex: 20 }}
          animate={{
            y: isCardOut ? -135 : 0,
            scale: isCardOut ? 1.06 : 0.94,
            zIndex: isCardOut ? 40 : 20
          }}
          transition={{
            y: { type: "spring", stiffness: 100, damping: 20, delay: 0.75 },
            scale: { type: "spring", stiffness: 100, damping: 20, delay: 0.8 },
            zIndex: { delay: isCardOut ? 0.9 : 0 } // pop to front in sync with slide-up
          }}
        >
          {renderCardContent()}
        </motion.div>

        {/* Layer 3: Envelope Front Flaps (Bottom and Sides) */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 30 }}
        >
          <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 70" preserveAspectRatio="none">
            {/* Side Flaps */}
            <path d="M 0,0 L 46,38 L 0,70 Z" fill="#EADBC8" stroke="#DFD3C3" strokeWidth="0.3" />
            <path d="M 100,0 L 54,38 L 100,70 Z" fill="#EADBC8" stroke="#DFD3C3" strokeWidth="0.3" />
            {/* Bottom Flap */}
            <path d="M 0,70 L 50,34 L 100,70 Z" fill="#F5EFE6" stroke="#E5D8C6" strokeWidth="0.3" />
          </svg>
        </div>

        {/* Layer 4: Envelope Flap (Top Folding Flap) */}
        <motion.div
          className="absolute top-0 left-0 w-full h-[85px] origin-top transform-style-3d z-35"
          initial={{ rotateX: 0 }}
          animate={{ rotateX: isOpen ? 180 : 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          style={{
            zIndex: isOpen ? 5 : 31 // Drop zIndex once open so card slides in front
          }}
        >
          {/* Flap Outer (faces us when closed) */}
          <div className="absolute inset-0 backface-hidden" style={{ zIndex: 32 }}>
            <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 45" preserveAspectRatio="none">
              <polygon points="0,0 50,45 100,0" fill="#FAF9F6" stroke="#DFD3C3" strokeWidth="0.3" />
            </svg>
          </div>

          {/* Flap Inner (reflects gold lining when opened) */}
          <div 
            className="absolute inset-0 backface-hidden" 
            style={{ 
              transform: "rotateX(180deg)",
              zIndex: 31
            }}
          >
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 45" preserveAspectRatio="none">
              <polygon points="0,0 50,45 100,0" fill="#FAF9F6" />
              {/* Gold Lining Inset */}
              <polygon points="4,1 50,41 96,1" fill="url(#goldGrad)" />
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C5A059" />
                  <stop offset="20%" stopColor="#FDF0CD" />
                  <stop offset="40%" stopColor="#D4AF37" />
                  <stop offset="60%" stopColor="#F3E5AB" />
                  <stop offset="80%" stopColor="#AA7A1E" />
                  <stop offset="100%" stopColor="#D4AF37" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.div>

      </div>

      {/* Pulsing Tap Indicator */}
      {showTapIndicator && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer pointer-events-none"
          style={{ zIndex: 50 }}
        >
          {/* Centered pulsing ring */}
          <div className="relative flex items-center justify-center mt-32">
            <span className="animate-ping absolute inline-flex h-14 w-14 rounded-full bg-[#B8944F] opacity-35"></span>
            <span className="relative inline-flex rounded-full h-10 w-10 bg-[#B8944F] items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </span>
          </div>
          <span className="text-xs font-bold text-stone-650 uppercase tracking-widest mt-3 bg-white/80 backdrop-blur-sm py-1 px-3.5 rounded-full border border-stone-200/50 shadow-sm animate-pulse">
            Tap to Open
          </span>
        </div>
      )}

    </div>
  );
}
