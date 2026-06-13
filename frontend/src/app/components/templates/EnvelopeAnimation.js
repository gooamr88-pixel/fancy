"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function EnvelopeAnimation({ template, theme, onOpenComplete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardOut, setIsCardOut] = useState(false);
  const [showTapIndicator, setShowTapIndicator] = useState(true);

  const accentColor = theme?.primary || "#B8944F";

  // Reset envelope state when template or theme changes
  useEffect(() => {
    setIsOpen(false);
    setIsCardOut(false);
    setShowTapIndicator(true);
  }, [template, theme]);

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

  // Card Content & Styles based on Template (layout) and Theme (colors)
  const renderCardContent = () => {
    const { name, pattern } = template;
    const lightAccentColor = theme?.secondary || "#D7BE80";
    
    switch (pattern) {
      case "serif": // Classic - Timeless Elegance
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-[3px] rounded bg-[#FCFAF6] font-serif select-none relative overflow-hidden"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            {/* Elegant inner theme color border */}
            <div 
              className="absolute inset-1 border pointer-events-none" 
              style={{ borderColor: `${accentColor}50` }}
            />
            <div className="text-[9px] uppercase tracking-[3px] mt-1 text-center font-semibold">THE HONOR OF YOUR PRESENCE</div>
            
            <div className="flex flex-col items-center my-auto text-center">
              <span className="font-script text-3.5xl leading-none mb-1" style={{ color: accentColor }}>Aria & Julian</span>
              <span className="text-[10px] tracking-[2px] font-sans font-light my-1 uppercase text-stone-500">ARE GETTING MARRIED</span>
              <span className="text-[9px] italic" style={{ color: lightAccentColor }}>Saturday, Oct 24, 2026</span>
              <span className="text-[9px] tracking-wide text-center mt-2.5 max-w-[90%] leading-relaxed font-sans text-stone-500">
                At 4 o&apos;clock in the afternoon<br/>
                <strong className="text-stone-750">The Plaza Hotel</strong>, New York
              </span>
            </div>
            
            <div className="w-6 h-0.5 mb-1" style={{ backgroundColor: accentColor }} />
          </div>
        );
      
      case "geo": // Modern - Urban Edge
        return (
          <div 
            className="w-full h-full p-4 flex flex-col justify-between border rounded bg-[#1A252F] text-white font-sans select-none relative overflow-hidden"
            style={{ borderColor: `${accentColor}50` }}
          >
            {/* Dynamic theme color geometric lines */}
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full border-2 opacity-25" style={{ borderColor: accentColor }} />
            <div className="absolute -bottom-16 -left-16 w-32 h-32 rotate-45 border-t border-r opacity-25" style={{ borderColor: accentColor }} />
            
            <div className="flex justify-between items-start">
              <span className="text-[8.5px] font-bold tracking-[2px] uppercase" style={{ color: lightAccentColor }}>JOIN US // 10.24.26</span>
              <span className="text-[7.5px] opacity-40">NYC</span>
            </div>
            
            <div className="my-auto flex flex-col gap-1">
              <span className="text-[9px] tracking-[4px] uppercase font-light text-stone-300">CELEBRATION OF LIFE</span>
              <h4 className="text-2.5xl font-black tracking-tight leading-tight uppercase font-sans text-white">
                MARC&apos;S<br/>
                <span style={{ color: lightAccentColor }}>30TH BIRTHDAY</span>
              </h4>
              <p className="text-[8.5px] leading-relaxed text-stone-300 font-light max-w-[95%] mt-1">
                Cocktails, dinner, and dancing to follow starting at 9 PM. Dress to impress.
              </p>
            </div>
            
            <div className="text-[8px] tracking-[1.5px] uppercase font-bold text-right" style={{ color: lightAccentColor }}>
              RSVP LIVE // FANCY
            </div>
          </div>
        );

      case "organic": // Rustic - Woodland Romance
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-2 rounded bg-[#F5E6D3] select-none relative overflow-hidden"
            style={{ borderColor: `${accentColor}60`, color: accentColor }}
          >
            {/* Foliage decoration color coordinate */}
            <div className="absolute top-2 right-2 opacity-15">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
            </div>
            
            <div className="text-[9px] uppercase tracking-[1.5px] font-sans font-bold text-center opacity-85">50 YEARS OF LOVE</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-script text-3.5xl leading-none" style={{ color: accentColor }}>Sarah & Tom</span>
              <span className="text-[9px] font-sans font-medium tracking-[1px] my-1 uppercase text-stone-600">GOLDEN ANNIVERSARY CELEBRATION</span>
              <span className="text-[9.5px] mt-1.5 font-bold uppercase" style={{ color: lightAccentColor }}>OCTOBER 24, 2026</span>
              <span className="text-[8.5px] italic text-stone-500 mt-0.5">At the Barn at Plaza Gardens, NY</span>
            </div>
            
            <div className="text-[8px] font-sans italic opacity-75">Join us for cocktails and memories</div>
          </div>
        );

      case "luxury": // Luxury - Grand Affair
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border rounded bg-gradient-to-br from-[#111625] to-[#1D263B] text-white font-serif select-none relative overflow-hidden"
            style={{ borderColor: `${lightAccentColor}50` }}
          >
            {/* Elegant Corner Ornaments in Theme Color */}
            <div className="absolute top-1.5 left-1.5 w-6 h-6 border-t border-l" style={{ borderColor: `${lightAccentColor}80` }} />
            <div className="absolute top-1.5 right-1.5 w-6 h-6 border-t border-r" style={{ borderColor: `${lightAccentColor}80` }} />
            <div className="absolute bottom-1.5 left-1.5 w-6 h-6 border-b border-l" style={{ borderColor: `${lightAccentColor}80` }} />
            <div className="absolute bottom-1.5 right-1.5 w-6 h-6 border-b border-r" style={{ borderColor: `${lightAccentColor}80` }} />
            
            <div className="text-[7.5px] uppercase tracking-[4px] font-sans font-bold mt-1 text-center" style={{ color: lightAccentColor }}>
              THE HONOR OF YOUR PRESENCE IS REQUESTED
            </div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="text-[8px] tracking-[3px] uppercase font-sans font-light text-stone-300">ANNUAL CHARITY FUNDRAISER</span>
              <span 
                className="font-serif font-semibold text-2.5xl tracking-wide my-1 text-transparent bg-clip-text"
                style={{ backgroundImage: `linear-gradient(to right, #FAF9F6, ${lightAccentColor}, #FAF9F6)` }}
              >
                THE GRAND GALA
              </span>
              <span className="text-[8.5px] tracking-widest font-sans uppercase my-0.5" style={{ color: lightAccentColor }}>OCTOBER 24, 2026</span>
              <span className="text-[8.5px] font-sans font-light text-stone-300 max-w-[85%] leading-relaxed mt-2">
                Four o&apos;clock in the afternoon<br/>
                <strong className="text-white font-semibold">The Grand Ballroom, Plaza Hotel</strong>
              </span>
            </div>
            
            <div className="text-[8px] uppercase tracking-[2px] font-bold" style={{ color: lightAccentColor }}>Black Tie Required</div>
          </div>
        );

      case "minimal": // Minimal - Pure & Simple
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border rounded bg-white text-[#111] font-sans select-none relative"
            style={{ borderColor: `${lightAccentColor}60` }}
          >
            <div className="text-[8.5px] font-bold tracking-[3px] text-stone-400 mt-1 uppercase">EXHIBIT // L. VANCE</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-serif text-2.2xl font-light tracking-wide text-stone-850">Leon Vance</span>
              <span className="text-[9.5px] my-1 font-light text-stone-400">RETROSPECTIVE SHOW</span>
              <span className="font-serif text-2.2xl font-light tracking-wide text-stone-850">Art Exhibition</span>
              
              <span className="text-[9px] tracking-[2px] uppercase mt-4 font-bold" style={{ color: accentColor }}>10 . 24 . 26</span>
              <span className="text-[8.5px] text-stone-500 font-light mt-1 uppercase">Plaza Gallery, New York</span>
            </div>
            
            <div className="text-[8px] font-bold tracking-[1.5px] uppercase" style={{ color: lightAccentColor }}>RSVP BY SEPTEMBER 15</div>
          </div>
        );

      case "floral": // Floral - Garden Party
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-2 rounded bg-gradient-to-tr from-[#FFF5F6] to-[#FFF0F2] font-serif select-none relative overflow-hidden"
            style={{ borderColor: `${accentColor}30`, color: accentColor }}
          >
            {/* Soft theme color decorative circles in the background */}
            <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full filter blur-md opacity-25" style={{ backgroundColor: lightAccentColor }} />
            <div className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full filter blur-md opacity-25" style={{ backgroundColor: accentColor }} />
            
            <div className="text-[9px] uppercase tracking-[2px] font-sans font-bold text-center opacity-85">SWEETEST CELEBRATION</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-script text-3.5xl leading-none mb-0.5" style={{ color: accentColor }}>Lily &amp; Oliver</span>
              <span className="text-[9px] tracking-[1.5px] uppercase font-sans font-light my-0.5 text-stone-600">BRIDAL SHOWER IN THE GARDEN</span>
              <span className="text-[9.5px] font-bold mt-1.5" style={{ color: lightAccentColor }}>Saturday, October 24, 2026</span>
              <span className="text-[8.5px] italic text-stone-500">At the Rose Terrace, Plaza Hotel</span>
            </div>
            
            <div className="text-[8px] tracking-wide font-sans font-bold" style={{ color: lightAccentColor }}>Join us under the stars</div>
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
          {/* Inner back lining color coordinate - visible inside envelope behind the card */}
          <div 
            className="absolute inset-2 top-0 bg-gradient-to-b from-[#DFD3C3] via-[#FAF9F6] to-[#FAF9F6] rounded-b-xl"
            style={{ transform: "translateZ(1px)" }}
          />
        </div>

        {/* Layer 2: The Invitation Card */}
        <motion.div
          className="absolute left-3.5 right-3.5 h-[230px] rounded-lg shadow-xl cursor-default"
          style={{ 
            bottom: "8px", 
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
            zIndex: { delay: isCardOut ? 0.9 : 0 }
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
            zIndex: isOpen ? 5 : 31
          }}
        >
          {/* Flap Outer (faces us when closed) */}
          <div className="absolute inset-0 backface-hidden" style={{ zIndex: 32 }}>
            <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 45" preserveAspectRatio="none">
              <polygon points="0,0 50,45 100,0" fill="#FAF9F6" stroke="#DFD3C3" strokeWidth="0.3" />
            </svg>
          </div>

          {/* Flap Inner (reflects theme lining when opened) */}
          <div 
            className="absolute inset-0 backface-hidden" 
            style={{ 
              transform: "rotateX(180deg)",
              zIndex: 31
            }}
          >
            <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 45" preserveAspectRatio="none">
              <polygon points="0,0 50,45 100,0" fill="#FAF9F6" />
              
              {/* Dynamic Theme Lining Inset */}
              <polygon points="4,1 50,41 96,1" fill={`url(#${theme?.liningGradId || "goldGrad"})`} />
              
              <defs>
                {/* 1. Royale Gold lining gradient */}
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C5A059" />
                  <stop offset="20%" stopColor="#FDF0CD" />
                  <stop offset="40%" stopColor="#D4AF37" />
                  <stop offset="60%" stopColor="#F3E5AB" />
                  <stop offset="80%" stopColor="#AA7A1E" />
                  <stop offset="100%" stopColor="#D4AF37" />
                </linearGradient>
                
                {/* 2. Emerald lining gradient */}
                <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#043A1D" />
                  <stop offset="20%" stopColor="#A3D5A5" />
                  <stop offset="40%" stopColor="#0D6D3A" />
                  <stop offset="60%" stopColor="#BEE5BF" />
                  <stop offset="80%" stopColor="#032A15" />
                  <stop offset="100%" stopColor="#0D6D3A" />
                </linearGradient>
                
                {/* 3. Burgundy lining gradient */}
                <linearGradient id="burgundyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4A0E17" />
                  <stop offset="20%" stopColor="#F2C9D0" />
                  <stop offset="40%" stopColor="#800020" />
                  <stop offset="60%" stopColor="#E89FB0" />
                  <stop offset="80%" stopColor="#3A080F" />
                  <stop offset="100%" stopColor="#800020" />
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
          <div className="relative flex items-center justify-center mt-32">
            <span 
              className="animate-ping absolute inline-flex h-14 w-14 rounded-full opacity-35"
              style={{ backgroundColor: accentColor }}
            />
            <span 
              className="relative inline-flex rounded-full h-10 w-10 items-center justify-center shadow-lg text-white"
              style={{ backgroundColor: accentColor }}
            >
              <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
