"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function EnvelopeAnimation({ template, theme, onOpenComplete, guestName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCardOut, setIsCardOut] = useState(false);
  const [showTapIndicator, setShowTapIndicator] = useState(true);
  const [isCardForeground, setIsCardForeground] = useState(false);

  const accentColor = theme?.primary || "#B8944F";

  // Reset envelope state when template changes
  useEffect(() => {
    setIsOpen(false);
    setIsCardOut(false);
    setShowTapIndicator(true);
    setIsCardForeground(false);
  }, [template?.pattern]);

  const handleOpen = () => {
    if (isOpen) return;
    setIsOpen(true);
    setShowTapIndicator(false);
    
    // Step 2: Slide card up after flap animation starts to finish
    setTimeout(() => {
      setIsCardOut(true);
    }, 600);

    // Swap z-index to foreground when the card is about halfway out (approx 950ms)
    setTimeout(() => {
      setIsCardForeground(true);
    }, 950);

    // Step 3: Trigger callback once animation completes
    setTimeout(() => {
      if (onOpenComplete) onOpenComplete();
    }, 1500);
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
            
            <div className="flex flex-col items-center my-auto text-center gap-2">
              <span className="text-[7.5px] tracking-[2.5px] font-sans font-light uppercase text-stone-500">Request the honor of your presence</span>
              <span className="font-script text-3xl leading-tight px-1" style={{ color: accentColor }}>Aria &amp; Julian</span>
              <div className="w-8 h-px" style={{ backgroundColor: `${accentColor}55` }} />
              <span className="text-[9px] font-bold tracking-[1px]" style={{ color: lightAccentColor }}>SATURDAY, OCTOBER 24, 2026</span>
              <span className="text-[8px] tracking-wide leading-relaxed font-sans text-stone-500 max-w-[92%]">
                At 4 o&apos;clock in the afternoon<br/>
                <strong className="text-stone-800 font-semibold">The Grand Ballroom</strong>, Plaza Hotel
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
      
      case "geo": // Modern - Urban Edge (Conference Pass)
        return (
          <div
            className="w-full h-full p-4 flex flex-col justify-between bg-white text-[#0F172A] font-sans select-none relative overflow-hidden rounded border border-slate-200"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)' }}
          >
            {/* Top accent bar + faint geometry */}
            <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: accentColor }} />
            <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full" style={{ border: `1px solid ${accentColor}1A` }} />

            {/* Header */}
            <div className="flex items-center justify-between pt-2.5">
              <span className="text-[7px] font-bold tracking-[2px] uppercase text-slate-400">Annual Conference</span>
              <span className="text-[7px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: accentColor }}>NYC &apos;26</span>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] tracking-[3px] uppercase font-bold" style={{ color: accentColor }}>Shaping the future</span>
              <h4 className="text-lg font-extrabold leading-[1.1] tracking-tight text-slate-900">
                Technology &amp;<br/>Innovation Summit
              </h4>
              <span className="text-[8.5px] font-semibold text-slate-500">Saturday · October 24, 2026</span>
            </div>

            {/* Agenda */}
            <div className="flex flex-col gap-1.5 rounded-lg p-2.5" style={{ background: `${accentColor}0A`, border: `1px solid ${accentColor}1F` }}>
              {[['09:00', 'Opening Keynote'], ['11:30', 'AI & Cloud Panel'], ['14:30', 'Hands-on Workshops']].map(([time, label]) => (
                <div key={time} className="flex items-center justify-between text-[7.5px]">
                  <span className="font-mono text-slate-400">{time}</span>
                  <span className="font-semibold text-slate-700">{label}</span>
                </div>
              ))}
            </div>

            {/* Attendee footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
              <div className="flex flex-col">
                <span className="text-[6px] uppercase tracking-[1.5px] text-slate-400">Attendee Pass</span>
                <span className="text-[10px] font-bold text-slate-900">{guestName || "Sarah & John"}</span>
              </div>
              <span className="text-[8px] font-mono text-slate-300">#SUM-2026</span>
            </div>
          </div>
        );

      case "organic": // Rustic - Woodland Romance (Botanical)
        return (
          <div
            className="w-full h-full p-4 flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
            style={{ background: 'linear-gradient(170deg,#F8F4EB 0%,#F2ECDD 100%)', border: `1.5px solid ${accentColor}40`, color: accentColor }}
          >
            {/* Botanical sprig — top */}
            <svg className="absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-9 opacity-40 pointer-events-none" viewBox="0 0 120 50" fill="none" stroke={accentColor} strokeWidth="1.2">
              <path d="M60 50 V14" />
              <path d="M60 30 C50 26 44 18 44 10 C54 12 60 20 60 28" />
              <path d="M60 30 C70 26 76 18 76 10 C66 12 60 20 60 28" />
              <path d="M60 20 C53 18 49 12 49 6 C56 8 60 14 60 19" />
              <path d="M60 20 C67 18 71 12 71 6 C64 8 60 14 60 19" />
            </svg>

            <div className="text-[7.5px] uppercase tracking-[3px] font-sans font-semibold text-stone-500 mt-5">Together with their families</div>

            <div className="flex flex-col items-center text-center my-auto">
              <span className="text-[7.5px] tracking-[2px] uppercase font-sans text-stone-400">We invite you to the wedding of</span>
              <span className="font-script text-3xl leading-tight my-1.5" style={{ color: accentColor }}>Mia &amp; Noah</span>
              <div className="w-8 h-px my-1" style={{ backgroundColor: `${accentColor}55` }} />
              <span className="text-[8.5px] font-bold tracking-[1px] text-stone-600">OCTOBER 24, 2026 · 4 PM</span>
              <span className="text-[8px] italic text-stone-500 mt-0.5">Pine Valley Cabin · Catskills, NY</span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[7px] uppercase tracking-[1.5px] font-sans text-stone-400">We&apos;d love for you to join</span>
              <span className="font-script text-lg" style={{ color: accentColor }}>{guestName || "Sarah & John"}</span>
            </div>

            <div className="text-[7.5px] uppercase tracking-[2px] font-sans text-stone-400">Celebrate under the pines</div>
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
            
            <div className="text-[7.5px] uppercase tracking-[4px] font-sans font-semibold mt-1 text-center" style={{ color: lightAccentColor }}>
              The Engagement Of
            </div>

            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-serif font-light text-2xl tracking-wide text-transparent bg-clip-text"
                style={{ backgroundImage: `linear-gradient(100deg, #FBF6E9, ${lightAccentColor}, #FBF6E9)` }}>
                Sophia &amp; Thomas
              </span>
              <div className="flex items-center gap-1.5 my-2.5">
                <span className="w-5 h-px" style={{ background: `${lightAccentColor}80` }} />
                <span className="text-[6px]" style={{ color: lightAccentColor }}>◆</span>
                <span className="w-5 h-px" style={{ background: `${lightAccentColor}80` }} />
              </div>
              <span className="text-[8px] tracking-[2px] font-sans uppercase" style={{ color: lightAccentColor }}>October 24, 2026</span>
              <span className="text-[8px] font-sans font-light text-slate-300 max-w-[88%] leading-relaxed mt-2">
                An evening of champagne &amp; celebration<br/>
                <strong className="text-white font-medium">The Penthouse Pavilion</strong>
              </span>
            </div>

            {/* Guest Personalization */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, zIndex: 10 }}>
              <span style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sans)' }}>Reserved For</span>
              <span className="font-serif italic text-[13px] tracking-wide" style={{ color: lightAccentColor }}>{guestName || "Sarah & John"}</span>
            </div>

            <div className="text-[7.5px] uppercase tracking-[3px] font-sans font-bold opacity-70" style={{ color: lightAccentColor }}>Black Tie</div>
          </div>
        );

      case "minimal": // Minimal - Pure & Simple (Editorial Gala)
        return (
          <div
            className="w-full h-full flex flex-col justify-between bg-[#FBFAF7] text-[#1A1A1A] font-sans select-none relative rounded border"
            style={{ borderColor: '#ECE6DC', padding: 22 }}
          >
            {/* Header rule */}
            <div className="flex justify-between items-center">
              <span className="text-[7.5px] font-bold tracking-[3px] text-stone-400 uppercase">The Annual Gala</span>
              <span className="text-[7px] text-stone-400 font-mono">№ 024</span>
            </div>

            <div className="my-auto flex flex-col text-left">
              <span className="text-[8px] tracking-[5px] uppercase text-stone-400 font-light">An Evening Of</span>
              <span className="font-serif text-3xl font-light tracking-tight text-[#111] leading-[1.05] mt-2">
                Art &amp;<br/>Philanthropy
              </span>
              <div className="w-10 h-px bg-stone-300 my-3.5" />
              <span className="text-[8px] text-stone-500 font-light uppercase tracking-[2px]">The Metropolitan · New York</span>
              <span className="text-[8px] text-stone-500 font-light uppercase tracking-[2px] mt-0.5">October 24 · 7:00 PM</span>
            </div>

            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[6px] uppercase tracking-[1.5px] text-stone-400">Admit</span>
                <span className="font-serif text-[12px] italic text-[#111]">{guestName || "Sarah & John"}</span>
              </div>
              <span className="text-[7.5px] font-bold tracking-[2px] uppercase px-2 py-0.5 border" style={{ color: lightAccentColor, borderColor: `${lightAccentColor}55` }}>GALA</span>
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
            
            <div className="text-[7.5px] uppercase tracking-[3px] font-sans font-semibold text-center text-stone-500">You&apos;re invited to a</div>

            <div className="flex flex-col items-center text-center my-auto">
              <span className="font-script text-4xl leading-none" style={{ color: accentColor }}>Garden Party</span>
              <span className="text-[8px] tracking-[2px] uppercase font-sans text-stone-500 mt-1.5">In celebration of Lucy&apos;s 30th</span>
              <div className="flex items-center gap-1.5 my-2">
                <span className="w-5 h-px" style={{ background: `${accentColor}55` }} />
                <span className="text-[7px]" style={{ color: accentColor }}>❀</span>
                <span className="w-5 h-px" style={{ background: `${accentColor}55` }} />
              </div>
              <span className="text-[9px] font-bold tracking-[1px] text-stone-600">SATURDAY · OCTOBER 24, 2026</span>
              <span className="text-[8px] italic text-stone-500 mt-0.5">The Rose Terrace · Plaza Hotel</span>
            </div>

            {/* Guest Invitation */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.38)', fontFamily: 'var(--font-sans)' }}>Reserved for</span>
              <span className="font-script text-lg" style={{ color: accentColor }}>{guestName || "Sarah & John"}</span>
            </div>

            <div className="text-[7.5px] font-sans font-bold uppercase tracking-[2px]" style={{ color: lightAccentColor }}>Kindly reply by Sept 15</div>
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
      animate={{ height: isCardOut ? 478 : 360 }}
      transition={{ type: "spring", stiffness: 85, damping: 18, delay: 0.1 }}
    >
      
      {/* 3D Envelope Body Container */}
      <motion.div 
        className="relative w-full h-[200px] mt-[130px] cursor-pointer perspective-1000 transform-style-3d"
        onClick={handleOpen}
        animate={{
          y: isCardOut ? -70 : 0
        }}
        transition={{
          type: "spring",
          stiffness: 85,
          damping: 18,
          delay: 0.1
        }}
      >
        
        {/* Layer 1: Envelope Back — fades away once the card is out so no empty pocket lingers */}
        <motion.div
          className="absolute inset-0 bg-[#F4EFE6] rounded-b-2xl border border-amber-900/10 shadow-lg"
          style={{
            zIndex: 10,
            transformStyle: "preserve-3d"
          }}
          animate={{ opacity: isCardOut ? 0 : 1 }}
          transition={{ duration: 0.45, delay: isCardOut ? 0.45 : 0 }}
        >
          {/* Inner back lining color coordinate - visible inside envelope behind the card */}
          <div
            className="absolute inset-2 top-0 bg-gradient-to-b from-[#DFD3C3] via-[#FAF9F6] to-[#FAF9F6] rounded-b-xl"
            style={{ transform: "translateZ(1px)" }}
          />
        </motion.div>
 
        {/* Layer 2: The Invitation Card */}
        <motion.div
          className="absolute left-3 right-3 rounded-lg shadow-xl cursor-default"
          style={{ 
            transformOrigin: "bottom center",
            zIndex: isCardForeground ? 40 : 20 // Pops to the front once it clears the pocket
          }}
          initial={{ top: "10px", height: 185, y: 0, scale: 0.95 }}
          animate={{
            height: isCardOut ? 366 : 185,
            y: isCardOut ? -214 : 0,
            scale: isCardOut ? 1.05 : 0.95,
            rotate: isCardOut ? [0, -8, -2, 0] : 0
          }}
          transition={{
            y: { type: "spring", stiffness: 90, damping: 18 },
            height: { type: "spring", stiffness: 90, damping: 18 },
            scale: { type: "spring", stiffness: 90, damping: 18, delay: 0.05 },
            rotate: { duration: 0.9, ease: "easeInOut" }
          }}
        >
          {renderCardContent()}
        </motion.div>
 
        {/* Layer 3: Envelope Front Flaps (Bottom and Sides) — fade with the back */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 30 }}
          animate={{ opacity: isCardOut ? 0 : 1 }}
          transition={{ duration: 0.45, delay: isCardOut ? 0.45 : 0 }}
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
 
        {/* Layer 4: Envelope Flap (Top Folding Flap) */}
        <motion.div
          className="absolute top-0 left-0 w-full h-[85px] transform-style-3d"
          style={{ transformOrigin: "top", originY: 0 }}
          initial={{ rotateX: 0, zIndex: 31 }}
          animate={{
            rotateX: isOpen ? 180 : 0,
            zIndex: isOpen ? 5 : 31,
            opacity: isCardOut ? 0 : 1
          }}
          transition={{
            rotateX: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
            zIndex: { delay: isOpen ? 0.35 : 0 },
            opacity: { duration: 0.45, delay: isCardOut ? 0.45 : 0 }
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
