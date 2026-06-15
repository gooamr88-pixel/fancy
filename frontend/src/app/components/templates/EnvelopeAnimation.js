"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function EnvelopeAnimation({ template, theme, onOpenComplete, guestName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardOut, setIsCardOut] = useState(false);
  const [showTapIndicator, setShowTapIndicator] = useState(true);
  const [isEnvelopeHidden, setIsEnvelopeHidden] = useState(false);

  const accentColor = theme?.primary || "#B8944F";

  // Reset envelope state when template changes
  useEffect(() => {
    setIsOpen(false);
    setIsCardOut(false);
    setShowTapIndicator(true);
    setIsEnvelopeHidden(false);
  }, [template?.pattern]);

  const handleOpen = () => {
    if (isOpen) return;
    setIsOpen(true);
    setShowTapIndicator(false);
    
    // Step 2: Slide card up after flap animation starts to finish
    setTimeout(() => {
      setIsCardOut(true);
    }, 600);

    // Hide envelope body after fade-out transition completes (600ms start + 600ms duration = 1200ms)
    setTimeout(() => {
      setIsEnvelopeHidden(true);
    }, 1200);

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
      case "serif": // Classic - Timeless Elegance (Royale Wedding)
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-[3px] rounded bg-[#FCFAF6] font-serif select-none relative overflow-hidden"
            style={{ borderColor: accentColor, color: accentColor, boxShadow: 'inset 0 0 15px rgba(184,148,79,0.08)' }}
          >
            {/* Elegant double border */}
            <div className="absolute inset-1 border pointer-events-none" style={{ borderColor: `${accentColor}50` }} />
            <div className="absolute inset-2 border pointer-events-none" style={{ borderColor: `${accentColor}25` }} />
            
            {/* Monogram crest */}
            <div className="text-[8px] uppercase tracking-[3px] mt-1 font-semibold flex flex-col items-center gap-1">
              <span className="font-sans" style={{ border: `1px solid ${accentColor}`, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>A&J</span>
              <span>The Marriage Celebration</span>
            </div>
            
            <div className="flex flex-col items-center my-auto text-center">
              <span className="font-script text-4.2xl leading-none mb-1" style={{ color: accentColor }}>Aria & Julian</span>
              <span className="text-[8px] tracking-[2px] font-sans font-light my-1 uppercase text-stone-500">REQUEST THE HONOR OF YOUR PRESENCE</span>
              <span className="text-[9px] font-bold" style={{ color: lightAccentColor }}>SATURDAY, OCTOBER 24, 2026</span>
              <span className="text-[8px] tracking-wide text-center mt-1.5 max-w-[90%] leading-relaxed font-sans text-stone-500">
                At 4 o&apos;clock in the afternoon<br/>
                <strong className="text-stone-850 font-bold">The Grand Ballroom</strong>, Plaza Hotel
              </span>
            </div>
            
            {/* Guest Personalisation */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 10 }}>
              <span style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Invite Issued To:</span>
              <span className="font-script text-2.2xl leading-none" style={{ color: accentColor }}>{guestName || "Sarah & John"}</span>
            </div>
            
            <div className="w-10 h-0.5" style={{ backgroundColor: `${accentColor}60` }} />
          </div>
        );
      
      case "geo": // Modern - Urban Edge (Summit Pro)
        return (
          <div 
            className="w-full h-full p-4 flex flex-col justify-between border rounded bg-[#FAFBFD] text-[#111] font-sans select-none relative overflow-hidden"
            style={{ borderColor: 'rgba(59,130,246,0.15)', boxShadow: '0 8px 30px rgba(59,130,246,0.03)' }}
          >
            {/* Tech background lines */}
            <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full border border-blue-500/10" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 border border-blue-500/5 rotate-45" />
            
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-gray-150 pb-2">
              <div className="flex flex-col">
                <span className="text-[6px] uppercase tracking-wider text-gray-400">ANNUAL EVENT</span>
                <span className="text-[9px] font-black tracking-[1.5px] uppercase" style={{ color: accentColor }}>SUMMIT PRO 2026</span>
              </div>
              <span className="text-[7.5px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">NYC</span>
            </div>
            
            {/* Body schedule */}
            <div className="my-auto flex flex-col gap-1.5">
              <span className="text-[8px] tracking-[2px] uppercase font-bold text-gray-400">SHAPING THE FUTURE</span>
              <h4 className="text-xl font-bold tracking-tight leading-tight text-gray-900">
                Technology &amp;<br/>Innovation Summit
              </h4>
              
              {/* Agenda mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'rgba(59,130,246,0.03)', padding: 6, borderRadius: 6, border: '1px solid rgba(59,130,246,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#444' }}>
                  <span>09:00 AM — Keynote</span>
                  <span className="font-semibold" style={{ color: accentColor }}>A.I. Panel</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#444' }}>
                  <span>02:30 PM — Workshop</span>
                  <span className="font-semibold" style={{ color: accentColor }}>DevOps</span>
                </div>
              </div>
            </div>
            
            {/* Attendee details */}
            <div style={{ borderTop: '1px solid #ECEFF1', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 6, textTransform: 'uppercase', color: '#888' }}>Attendee Pass:</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#111' }}>{guestName || "Sarah & John"}</span>
              </div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.5 }}>#SUM-2026</div>
            </div>
          </div>
        );

      case "organic": // Rustic - Woodland Romance (Custom Canvas)
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-2 rounded bg-[#FAF6EE] select-none relative overflow-hidden"
            style={{ borderColor: `${accentColor}50`, color: accentColor, boxShadow: 'inset 0 0 10px rgba(139,115,85,0.06)' }}
          >
            {/* SVG leaf ornament */}
            <div className="absolute -top-4 -left-4 w-12 h-12 opacity-25 pointer-events-none rotate-45">
              <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
            </div>
            
            <div className="text-[8.5px] uppercase tracking-[2px] font-sans font-bold text-center opacity-70">CUSTOM CELEBRATION</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-script text-3.5xl leading-none my-1" style={{ color: accentColor }}>Woodland Romance</span>
              <span className="text-[8px] font-sans font-medium tracking-[1.5px] my-1 uppercase text-stone-600">YOU ARE CORDIALLY INVITED</span>
              <span className="text-[9.5px] mt-1 font-bold uppercase" style={{ color: lightAccentColor }}>OCTOBER 24, 2026</span>
              <span className="text-[8.5px] italic text-stone-500">At the Pine Valley Cabin, NY</span>
            </div>
            
            {/* Dynamic Guest Name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 7, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-sans)', tracking: '0.1em' }}>Invite Prepared For:</span>
              <span className="font-sans text-[11px] font-bold" style={{ color: accentColor }}>{guestName || "Sarah & John"}</span>
            </div>
            
            <div className="text-[8px] font-sans italic opacity-75">Celebrate with us in the wild</div>
          </div>
        );

      case "luxury": // Luxury - Grand Affair (Eternal Love)
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-[2px] rounded bg-gradient-to-br from-[#0B0F19] via-[#151B26] to-[#0D121F] text-white font-serif select-none relative overflow-hidden"
            style={{ borderColor: `${lightAccentColor}60` }}
          >
            {/* Luxury Art Deco Corner Borders */}
            <div className="absolute top-2 left-2 w-5 h-5 border-t border-l" style={{ borderColor: lightAccentColor, opacity: 0.8 }} />
            <div className="absolute top-2 right-2 w-5 h-5 border-t border-r" style={{ borderColor: lightAccentColor, opacity: 0.8 }} />
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l" style={{ borderColor: lightAccentColor, opacity: 0.8 }} />
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r" style={{ borderColor: lightAccentColor, opacity: 0.8 }} />
            
            <div className="text-[8px] uppercase tracking-[3px] font-sans font-bold mt-1 text-center" style={{ color: lightAccentColor }}>
              CELEBRATE THE ENGAGEMENT OF
            </div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-serif font-light text-2.5xl tracking-wide my-1 text-transparent bg-clip-text"
                style={{ backgroundImage: `linear-gradient(to right, #FAF9F6, ${lightAccentColor}, #FAF9F6)` }}>
                Sarah & Tom
              </span>
              <span className="text-[8px] tracking-widest font-sans uppercase my-1" style={{ color: lightAccentColor }}>OCTOBER 24, 2026</span>
              <span className="text-[8.5px] font-sans font-light text-stone-300 max-w-[85%] leading-relaxed mt-2">
                Join us for champagne, dinner,<br/>
                and cocktails under the stars<br/>
                <strong className="text-white font-semibold">The Penthouse Pavilion</strong>
              </span>
            </div>
            
            {/* Guest Personalization */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 10 }}>
              <span style={{ fontSize: 7, textTransform: 'uppercase', tracking: '0.1em', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sans)' }}>Reserved For:</span>
              <span className="font-sans text-[11px] font-bold tracking-wide" style={{ color: lightAccentColor }}>{guestName || "Sarah & John"}</span>
            </div>
            
            <div className="text-[8px] uppercase tracking-[2px] font-bold opacity-60" style={{ color: lightAccentColor }}>Formal Attire</div>
          </div>
        );

      case "minimal": // Minimal - Pure & Simple (Black Tie Gala)
        return (
          <div 
            className="w-full h-full p-4 flex flex-col justify-between border rounded bg-[#FAF9F5] text-[#1A1A1A] font-sans select-none relative"
            style={{ borderColor: '#DFD3C3', padding: 20 }}
          >
            {/* Minimal line details */}
            <div className="absolute top-4 left-4 right-4 h-[0.5px] bg-[#E5D8C6]" />
            <div className="absolute bottom-4 left-4 right-4 h-[0.5px] bg-[#E5D8C6]" />
            
            <div className="flex justify-between items-start mt-2">
              <span className="text-[8px] font-bold tracking-[3px] text-[#A69B8F] uppercase">EXHIBIT // L. VANCE</span>
              <span className="text-[7.5px] text-[#A69B8F] font-mono">№ 402</span>
            </div>
            
            <div className="my-auto flex flex-col text-left">
              <span className="text-[9px] tracking-[4px] uppercase text-stone-400 font-light mb-1">RETROSPECTIVE SHOW</span>
              <span className="font-serif text-3xl font-light tracking-tight text-[#111] leading-tight">
                Leon<br/>Vance
              </span>
              <span className="text-[8.5px] text-[#A69B8F] font-light mt-2 uppercase tracking-[2px]">Plaza Gallery, New York</span>
              <span className="text-[8.5px] text-[#A69B8F] font-light uppercase tracking-[2px]">OCTOBER 24 - NOVEMBER 10</span>
            </div>
            
            <div className="flex justify-between items-end mb-2">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 6, textTransform: 'uppercase', color: '#A69B8F', tracking: '0.1em' }}>Invited Guest:</span>
                <span className="font-serif text-[11px] italic font-semibold text-[#111]">{guestName || "Sarah & John"}</span>
              </div>
              <span className="text-[8px] font-bold tracking-[1px] uppercase border border-[#A69B8F]/30 px-2 py-0.5" style={{ color: lightAccentColor }}>GALA PASS</span>
            </div>
          </div>
        );

      case "floral": // Floral - Garden Party (Milestone Party)
        return (
          <div 
            className="w-full h-full p-4 flex flex-col items-center justify-between border-2 rounded bg-gradient-to-tr from-[#FFF7F8] to-[#FFF3F5] font-serif select-none relative overflow-hidden"
            style={{ borderColor: `${accentColor}40`, color: accentColor, boxShadow: 'inset 0 0 20px rgba(232,143,172,0.05)' }}
          >
            {/* SVG Floral corners */}
            <div className="absolute top-0 right-0 w-12 h-12 opacity-30 pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" stroke={accentColor} strokeWidth="2.5">
                <path d="M100,0 C80,10 60,30 50,50 C40,30 20,10 0,0" />
                <circle cx="50" cy="50" r="4" fill={accentColor} />
                <path d="M100,50 C85,55 70,70 65,85" />
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 w-12 h-12 opacity-30 pointer-events-none rotate-180">
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" stroke={accentColor} strokeWidth="2.5">
                <path d="M100,0 C80,10 60,30 50,50 C40,30 20,10 0,0" />
                <circle cx="50" cy="50" r="4" fill={accentColor} />
              </svg>
            </div>
            
            <div className="text-[8.5px] uppercase tracking-[2.5px] font-sans font-bold text-center opacity-85">SWEETEST CELEBRATION</div>
            
            <div className="flex flex-col items-center text-center my-auto">
              <span className="text-[9px] tracking-[1.5px] uppercase font-sans font-light text-stone-500">LUCY&apos;S</span>
              <span className="font-script text-4xl leading-none my-1" style={{ color: accentColor }}>Garden Party</span>
              <span className="text-[9px] font-sans font-medium tracking-[1.5px] uppercase text-stone-600">IN HONOR OF HER 30TH BIRTHDAY</span>
              <span className="text-[9.5px] font-bold mt-2" style={{ color: lightAccentColor }}>SATURDAY, OCTOBER 24, 2026</span>
              <span className="text-[8.5px] italic text-stone-500">At the Rose Terrace, Plaza Hotel</span>
            </div>
            
            {/* Guest Invitation */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 7, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-sans)' }}>Invitation for:</span>
              <span className="font-script text-lg" style={{ color: accentColor }}>{guestName || "Sarah & John"}</span>
            </div>
            
            <div className="text-[8px] font-sans font-bold opacity-75" style={{ color: lightAccentColor }}>Kindly RSVP by September 15</div>
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
    <motion.div 
      className="relative w-full max-w-[270px] flex items-center justify-center mx-auto mt-2 z-10 select-none"
      animate={{ height: isCardOut ? 480 : 380 }}
      transition={{ type: "spring", stiffness: 85, damping: 18, delay: 0.1 }}
    >
      
      {/* 3D Envelope Body Container */}
      <motion.div 
        className="relative w-full h-[200px] mt-[130px] cursor-pointer perspective-1000 transform-style-3d"
        onClick={handleOpen}
        animate={{
          y: isCardOut ? -100 : 0
        }}
        transition={{
          type: "spring",
          stiffness: 85,
          damping: 18,
          delay: 0.1
        }}
      >
        
        {/* Layer 1: Envelope Back */}
        {!isEnvelopeHidden && (
          <motion.div 
            className="absolute inset-0 bg-[#F4EFE6] rounded-b-2xl border border-amber-900/10 shadow-lg"
            style={{ 
              zIndex: 10,
              transformStyle: "preserve-3d"
            }}
            animate={{ opacity: isCardOut ? 0 : 1 }}
            transition={{ duration: 0.6, ease: "easeInOut", delay: 0.3 }}
          >
            {/* Inner back lining color coordinate - visible inside envelope behind the card */}
            <div 
              className="absolute inset-2 top-0 bg-gradient-to-b from-[#DFD3C3] via-[#FAF9F6] to-[#FAF9F6] rounded-b-xl"
              style={{ transform: "translateZ(1px)" }}
            />
          </motion.div>
        )}
 
        {/* Layer 2: The Invitation Card */}
        <motion.div
          className="absolute left-3 right-3 rounded-lg shadow-xl cursor-default"
          style={{ 
            transformOrigin: "bottom center",
            zIndex: 20 // Fixed z-index so it slides out of the pocket naturally behind front flaps!
          }}
          initial={{ bottom: "6px", height: 190, y: 0, scale: 0.94 }}
          animate={{
            bottom: isCardOut ? "-250px" : "6px",
            height: isCardOut ? 430 : 190,
            scale: isCardOut ? 1.08 : 0.94,
            rotate: isCardOut ? [0, -10, -3, 0] : 0
          }}
          transition={{
            bottom: { type: "spring", stiffness: 90, damping: 18 },
            height: { type: "spring", stiffness: 90, damping: 18 },
            scale: { type: "spring", stiffness: 90, damping: 18, delay: 0.05 },
            rotate: { duration: 0.9, ease: "easeInOut" }
          }}
        >
          {renderCardContent()}
        </motion.div>
 
        {/* Layer 3: Envelope Front Flaps (Bottom and Sides) */}
        {!isEnvelopeHidden && (
          <motion.div 
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 30 }}
            animate={{ opacity: isCardOut ? 0 : 1 }}
            transition={{ duration: 0.6, ease: "easeInOut", delay: 0.3 }}
          >
            <svg className="w-full h-full filter drop-shadow-md" viewBox="0 0 100 70" preserveAspectRatio="none">
              <defs>
                <filter id="flapShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#5C4D3C" floodOpacity="0.22" />
                </filter>
              </defs>
              {/* Side Flaps */}
              <path d="M 0,0 L 46,38 L 0,70 Z" fill="#EADBC8" stroke="#DFD3C3" strokeWidth="0.3" filter="url(#flapShadow)" />
              <path d="M 100,0 L 54,38 L 100,70 Z" fill="#EADBC8" stroke="#DFD3C3" strokeWidth="0.3" filter="url(#flapShadow)" />
              {/* Bottom Flap */}
              <path d="M 0,70 L 50,34 L 100,70 Z" fill="#F5EFE6" stroke="#E5D8C6" strokeWidth="0.3" filter="url(#flapShadow)" />
            </svg>
          </motion.div>
        )}
 
        {/* Layer 4: Envelope Flap (Top Folding Flap) */}
        {!isEnvelopeHidden && (
          <motion.div
            className="absolute top-0 left-0 w-full h-[85px] transform-style-3d"
            style={{ transformOrigin: "top", originY: 0 }}
            initial={{ rotateX: 0, zIndex: 31, opacity: 1 }}
            animate={{ 
              rotateX: isOpen ? 180 : 0,
              zIndex: isOpen ? 5 : 31,
              opacity: isCardOut ? 0 : 1
            }}
            transition={{
              rotateX: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
              zIndex: { delay: isOpen ? 0.35 : 0 },
              opacity: { duration: 0.6, ease: "easeInOut", delay: 0.3 }
            }}
          >
            {/* Flap Outer (faces us when closed) */}
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
   
            {/* Flap Inner (reflects theme lining when opened) */}
            <div 
              className="absolute inset-0 backface-hidden" 
              style={{ 
                transform: "rotateY(180deg)",
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
        )}
 
      </motion.div>
 
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
 
    </motion.div>
  );
}
