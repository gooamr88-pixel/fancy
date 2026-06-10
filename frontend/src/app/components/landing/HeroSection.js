"use client";

import React, { useState, useMemo } from "react";
import { startSynth, stopSynth } from "../../utils/synth";

// --- Animated Audio Wave Visualizer ---
const AudioWaveform = ({ isPlaying }) => {
  return (
    <div className="flex items-end gap-[3px] h-5 w-9 px-1">
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-2.5 ${isPlaying ? "animate-wave-1" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-4 ${isPlaying ? "animate-wave-2" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-5 ${isPlaying ? "animate-wave-3" : "h-1.5"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-3 ${isPlaying ? "animate-wave-4" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-2.5 ${isPlaying ? "animate-wave-5" : "h-1"}`}></div>
    </div>
  );
};

const HeroSection = React.memo(function HeroSection({ darkMode, scrollToSection }) {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Audio Playback states
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioGenre, setAudioGenre] = useState("romantic");

  // 3D Envelope state
  const [envelopeOpen, setEnvelopeOpen] = useState(false);

  // Customizer state
  const [customizer, setCustomizer] = useState({
    title: "Aria & Julian",
    subtitle: "WE ARE GETTING MARRIED",
    date: "Saturday, August 15, 2026",
    time: "5:00 PM EST",
    venue: "The Glass Greenhouse, Brooklyn",
    theme: "sage-watercolor", // sage-watercolor, midnight-star, gold-foil, modern-minimal
    linerPattern: "gold-glitter", // gold-glitter, solid, striped
    envelopeColor: "#8ba897", // Preset natural envelope color
  });

  const confettiParticles = useMemo(() => {
    const trigger = isSubmitted;
    const colors = ["bg-amber-400", "bg-emerald-500", "bg-indigo-400", "bg-rose-400", "bg-yellow-400", "bg-teal-400"];
    return [...Array(20)].map((_, i) => {
      const color = colors[(i * 7) % colors.length];
      const leftOffset = `${(i * 19) % 100}%`;
      const animDelay = `${((i * 3) % 15) / 10}s`;
      const size = (i % 2 === 0) ? "w-2.5 h-2.5" : "w-1.5 h-3.5";
      return {
        id: i,
        color,
        leftOffset,
        animDelay,
        size,
        trigger
      };
    });
  }, [isSubmitted]);

  // Music Synth toggle
  const handleToggleMusic = (genre = audioGenre) => {
    if (isPlayingAudio) {
      stopSynth();
      setIsPlayingAudio(false);
    } else {
      setAudioGenre(genre);
      startSynth(genre);
      setIsPlayingAudio(true);
    }
  };

  const handleGenreChange = (newGenre) => {
    setAudioGenre(newGenre);
    if (isPlayingAudio) {
      stopSynth();
      startSynth(newGenre);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (email.trim() && email.includes("@")) {
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setEmail("");
      }, 5000);
    }
  };

  // Preset envelope color presets
  const ENVELOPE_COLORS = [
    { name: "Sage Forest", hex: "#8ba897", theme: "sage-watercolor" },
    { name: "Obsidian Black", hex: "#1a1a1c", theme: "modern-minimal" },
    { name: "Imperial Gold", hex: "#d8c7b0", theme: "gold-foil" },
    { name: "Midnight Purple", hex: "#2b233a", theme: "midnight-star" },
  ];

  const handleThemeChange = (colorPreset) => {
    setCustomizer(prev => ({
      ...prev,
      theme: colorPreset.theme,
      envelopeColor: colorPreset.hex
    }));
  };

  return (
    <>
      {/* --- Hero Section --- */}
      <section className="relative w-full max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center z-10">
        
        {/* Left Side: Hero Content & Email Capture */}
        <div className="lg:col-span-7 flex flex-col gap-8 text-center lg:text-left relative">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs font-bold self-center lg:self-start w-fit">
            <span>✨ Introducing: 3D Envelope Customizer & Web Audio Synth Scores</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6.5xl font-normal leading-[1.12] tracking-tight text-stone-900 dark:text-stone-50">
            Make &amp; Send Your <span className="italic font-light">Online Invitation</span> In Minutes. 
            <span className="block text-brand-green font-sans font-semibold mt-4 text-3xl sm:text-4xl lg:text-5xl tracking-normal uppercase">Real-Time RSVP Tracking.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-text leading-relaxed max-w-2xl mx-auto lg:mx-0 font-light">
            Enjoy premium designer suites, animated opening envelopes, custom survey questions, and immersive local soundscapes. Crafted beautifully for wedding events, corporate galas, and fine celebrations.
          </p>

          {/* Email Capture Form with Confetti Particles */}
          <div className="w-full max-w-md mx-auto lg:mx-0 relative">
            
            {isSubmitted && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30 h-48">
                {confettiParticles.map((particle) => (
                  <div 
                    key={particle.id} 
                    className={`absolute ${particle.size} ${particle.color} rounded-sm animate-confetti`}
                    style={{
                      left: particle.leftOffset,
                      animationDelay: particle.animDelay,
                      top: 0
                    }}
                  ></div>
                ))}
              </div>
            )}

            {!isSubmitted ? (
              <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your Email Address"
                  className="flex-1 px-5 py-4 border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-card-bg text-foreground placeholder-muted-text/70 font-medium shadow-sm transition-all"
                  id="hero-email-input"
                />
                <button
                  type="submit"
                  className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-4 rounded-xl font-bold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer border-b-2 border-emerald-700"
                  id="hero-email-submit"
                >
                  Create Card
                </button>
              </form>
            ) : (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-800 dark:text-emerald-300 text-left flex items-start gap-3 animate-fade-in shadow-inner">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-bold text-emerald-950 dark:text-emerald-200">Awesome, let&apos;s get started!</h4>
                  <p className="text-sm mt-0.5">Scroll down to customize your invitation directly on our design deck.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2.5 text-muted-text mt-4 text-sm font-semibold tracking-wide animate-bounce cursor-pointer" onClick={() => scrollToSection("customizer")}>
            <span>Try the interactive editor below</span>
            <svg className="w-4 h-4 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Right Side: Mock Tablet & Premium 3D Envelope */}
        <div className="lg:col-span-5 flex justify-center items-center w-full relative">
          
          <div className="relative z-10 w-full max-w-md aspect-[4/3] bg-[#1a191d] dark:bg-zinc-800 rounded-[2.2rem] p-3.5 shadow-[0_24px_50px_rgba(0,0,0,0.25)] border-[4px] border-zinc-700/85 flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-[1.01]">
            <div className="absolute top-1/2 left-2 w-1.5 h-1.5 bg-zinc-650 rounded-full -translate-y-1/2"></div>
            <div className="absolute top-1/2 right-2 w-1.5 h-1.5 bg-zinc-650 rounded-full -translate-y-1/2"></div>
            
            {/* Tablet Screen */}
            <div className="w-full h-full bg-[#f4f2eb] dark:bg-zinc-900 rounded-[1.8rem] overflow-hidden relative flex flex-col items-center justify-center p-6 select-none border border-stone-200/20">
              
              {/* Envelope Container */}
              <div className="relative w-full max-w-[270px] aspect-[1.3/1] perspective-1000 mt-2">
                <div className="w-full h-full relative transform-style-3d">
                  
                  {/* Envelope Back / Liner */}
                  <div className="absolute inset-0 bg-[#fbfaf7] dark:bg-[#1a191d] rounded-lg shadow-inner z-10 overflow-hidden border border-stone-200/10">
                    {customizer.linerPattern === "gold-glitter" && (
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-transparent opacity-35 dark:opacity-20"></div>
                    )}
                    {customizer.linerPattern === "striped" && (
                      <div className="absolute inset-0 opacity-10 bg-repeating-linear-gradient from-transparent via-transparent to-stone-500 dark:to-stone-400 rotate-45" style={{ backgroundSize: "20px 20px" }}></div>
                    )}
                  </div>
                  
                  {/* 3D Envelope Flap */}
                  <div className={`envelope-flap absolute top-0 left-0 w-full h-[55%] origin-top transition-all duration-750 ${
                    envelopeOpen ? "is-open" : "is-closed"
                  }`}>
                    {/* Flap Front (Color) */}
                    <div className="absolute inset-0 backface-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", backgroundColor: customizer.envelopeColor }}>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-black/10 rounded-full blur-sm"></div>
                    </div>
                    {/* Flap Back Liner */}
                    <div className="absolute inset-0 backface-hidden rotate-x-180 bg-[#e5e3db] dark:bg-[#25242a]">
                      <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", backgroundColor: "#dedcd4" }}></div>
                      {customizer.linerPattern === "gold-glitter" && (
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-transparent opacity-25 dark:opacity-10" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}></div>
                      )}
                    </div>
                  </div>
                  
                  {/* Sliding Invitation Card */}
                  <div className={`absolute left-[6%] w-[88%] aspect-[1.28/1] bg-card-bg shadow-2xl rounded-sm border border-card-border/60 transition-all duration-750 ease-out z-15 ${
                    envelopeOpen ? "-translate-y-[55%] scale-[1.04]" : "translate-y-0 scale-100 opacity-90"
                  }`}>
                    
                    {/* Double Gold Foil Border Frame & paper texture */}
                    <div className="w-full h-full flex flex-col items-center justify-between text-center relative overflow-hidden bg-paper p-4 border-double border-4 border-amber-300/35 m-0 shadow-inner">
                      
                      {customizer.theme === "sage-watercolor" && (
                        <div className="absolute inset-0 opacity-15 pointer-events-none">
                          <div className="absolute -top-6 -left-6 w-16 h-16 bg-emerald-300 rounded-full filter blur-xl"></div>
                          <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-amber-200 rounded-full filter blur-xl"></div>
                        </div>
                      )}
                      {customizer.theme === "midnight-star" && (
                        <div className="absolute inset-0 bg-[#0f172a] text-slate-100 pointer-events-none">
                          <div className="absolute top-2 left-4 w-0.5 h-0.5 bg-white rounded-full"></div>
                          <div className="absolute top-6 right-8 w-1 h-1 bg-yellow-200 rounded-full animate-pulse"></div>
                        </div>
                      )}
                      
                      {/* Invitation Text */}
                      <div className={`relative z-10 flex flex-col items-center justify-center h-full w-full gap-1 ${
                        customizer.theme === "midnight-star" ? "text-slate-100" : "text-stone-850 dark:text-stone-900"
                      }`}>
                        <span className="font-serif italic text-[7.5px] uppercase tracking-wider text-muted-text/80">{customizer.subtitle}</span>
                        <h3 className="font-serif text-sm font-bold uppercase tracking-widest my-0.5 border-y border-amber-300/30 py-0.5 px-3">
                          {customizer.title}
                        </h3>
                        <span className="text-[7.5px] uppercase tracking-widest font-bold">{customizer.date}</span>
                        <span className="text-[6.5px] text-muted-text/80 tracking-widest">{customizer.time}</span>
                        <div className="w-5 h-[0.5px] bg-amber-400/60 my-0.5"></div>
                        <span className="text-[6.5px] tracking-widest uppercase font-semibold text-center leading-none">{customizer.venue}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Envelope Front Overlay (Pocket) */}
                  <div className="absolute bottom-0 left-0 w-full h-[55%] z-20 rounded-b-lg border-t border-stone-200/10 shadow-lg" style={{ backgroundColor: customizer.envelopeColor, clipPath: "polygon(0 0, 0 100%, 100% 100%, 100% 0, 50% 40%)" }}>
                    <div className="absolute inset-0 bg-black/5" style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%, 100% 0, 50% 40%)" }}></div>
                  </div>
                  
                  {/* Gold Wax Seal Open Trigger */}
                  <button 
                    onClick={() => setEnvelopeOpen(true)}
                    className={`absolute left-1/2 w-10 h-10 -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 shadow-[0_4px_12px_rgba(180,135,40,0.4)] border border-yellow-300 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center ${
                      envelopeOpen ? "bottom-[42%] scale-0 opacity-0 z-5" : "bottom-[42%] z-30"
                    }`}
                    style={{ transition: "all 0.5s ease" }}
                    aria-label="Open Invitation Envelope"
                    id="envelope-seal"
                  >
                    {/* Exquisite SVG Emblem inside seal */}
                    <svg className="w-4 h-4 text-amber-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 10h3l-4 4-4-4h3V8h2v4z"/>
                    </svg>
                  </button>

                  {/* Close Invitation Button */}
                  {envelopeOpen && (
                    <button 
                      onClick={() => setEnvelopeOpen(false)}
                      className="absolute top-0 right-[-30px] z-40 bg-card-bg hover:bg-stone-100 text-zinc-600 hover:text-brand-green p-1.5 rounded-full border border-card-border shadow-md transition-colors text-xs font-semibold cursor-pointer"
                      title="Close invitation"
                      id="envelope-close"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Music Player Indicator Widget */}
              <button 
                onClick={() => handleToggleMusic()}
                className="mt-6 bg-card-bg border border-card-border/60 px-4 py-2 rounded-full shadow-sm flex items-center gap-2 text-xs text-muted-text hover:text-brand-green transition-all hover:shadow cursor-pointer z-30"
                id="music-preview-btn"
              >
                <span className="font-semibold text-[9.5px] uppercase tracking-wider">
                  {isPlayingAudio ? `${audioGenre} score active` : "preview score music"}
                </span>
                <AudioWaveform isPlaying={isPlayingAudio} />
              </button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full opacity-60"></div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Overview Section --- */}
      <section 
        id="overview" 
        className="w-full py-28 bg-sec-bg/30 border-b border-card-border/40"
      >
        <div className="max-w-4xl mx-auto px-6 text-center flex flex-col gap-6 reveal-on-scroll">
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">The Digital Invite Re-Imagined</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5.5xl font-normal leading-tight tracking-tight max-w-3xl mx-auto text-foreground">
            Premium Digital Invitations with 3D Envelopes, Real-Time RSVP Tracking & Ambient Music
          </h2>
          <p className="text-base sm:text-lg text-muted-text leading-relaxed max-w-3xl mx-auto font-light">
            Fancy RSVP invitations arrive with a signature animated envelope opening—complete with customizable liners, seals, stamps, and a background score that sets the mood. Send via custom link, email, or text, collect meal choices or song requests, and manage it all inside an ad-free host dashboard. Zero paper waste, infinite style.
          </p>
        </div>
      </section>

      {/* --- LIVE DESIGN CUSTOMIZER STUDIO --- */}
      <section 
        id="customizer" 
        className="w-full py-28 bg-card-bg border-b border-card-border/40"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Interactive Design Studio</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-foreground">
              Try It Live: Design Your Invitation
            </h2>
            <p className="text-muted-text font-light text-sm md:text-base mt-2">
              Modify the wording, choose a curated color preset, select liner details, and play local synth tracks. Watch your envelope update in real time.
            </p>
            <div className="w-12 h-0.5 bg-brand-green mx-auto rounded-full mt-4"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Customizer Controls (Left Column) */}
            <div className="lg:col-span-6 flex flex-col gap-8 bg-sec-bg/40 dark:bg-zinc-900/30 border border-card-border/70 p-8 rounded-2xl shadow-sm">
              <div>
                <h4 className="font-serif text-lg font-normal tracking-wide text-foreground mb-4 border-b border-card-border/40 pb-2">1. Wording & Typography</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="custom-title" className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Event Title / Names</label>
                    <input 
                      id="custom-title"
                      type="text" 
                      value={customizer.title}
                      onChange={(e) => setCustomizer({...customizer, title: e.target.value})}
                      className="px-3.5 py-2.5 border border-card-border rounded-lg bg-card-bg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="custom-subtitle" className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Subtitle Tag</label>
                    <input 
                      id="custom-subtitle"
                      type="text" 
                      value={customizer.subtitle}
                      onChange={(e) => setCustomizer({...customizer, subtitle: e.target.value})}
                      className="px-3.5 py-2.5 border border-card-border rounded-lg bg-card-bg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="custom-date" className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Event Date</label>
                    <input 
                      id="custom-date"
                      type="text" 
                      value={customizer.date}
                      onChange={(e) => setCustomizer({...customizer, date: e.target.value})}
                      className="px-3.5 py-2.5 border border-card-border rounded-lg bg-card-bg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="custom-venue" className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Venue Location</label>
                    <input 
                      id="custom-venue"
                      type="text" 
                      value={customizer.venue}
                      onChange={(e) => setCustomizer({...customizer, venue: e.target.value})}
                      className="px-3.5 py-2.5 border border-card-border rounded-lg bg-card-bg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-serif text-lg font-normal tracking-wide text-foreground mb-4 border-b border-card-border/40 pb-2">2. Color Theme Preset</h4>
                <div className="flex flex-wrap gap-3">
                  {ENVELOPE_COLORS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleThemeChange(preset)}
                      className={`px-4 py-2 border rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:shadow-sm ${
                        customizer.theme === preset.theme 
                          ? "border-brand-green bg-brand-green/10 text-brand-green font-bold shadow-sm" 
                          : "border-card-border bg-card-bg text-muted-text hover:border-card-border/80"
                      }`}
                      id={`theme-btn-${preset.theme}`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-stone-200/50 shadow-inner" style={{ backgroundColor: preset.hex }}></span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-serif text-lg font-normal tracking-wide text-foreground mb-4 border-b border-card-border/40 pb-2">3. Envelope Liner Pattern</h4>
                <div className="flex gap-4">
                  {[
                    { id: "gold-glitter", label: "Golden Sparkle" },
                    { id: "striped", label: "Classic Stripes" },
                    { id: "solid", label: "Solid Interior" },
                  ].map((patt) => (
                    <button
                      key={patt.id}
                      onClick={() => setCustomizer({...customizer, linerPattern: patt.id})}
                      className={`flex-1 py-2.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        customizer.linerPattern === patt.id 
                          ? "border-brand-green bg-brand-green/10 text-brand-green shadow-sm" 
                          : "border-card-border bg-card-bg text-muted-text hover:bg-card-bg/50"
                      }`}
                      id={`liner-btn-${patt.id}`}
                    >
                      {patt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-serif text-lg font-normal tracking-wide text-foreground mb-3 border-b border-card-border/40 pb-2">4. Ambient Melodic Score</h4>
                <p className="text-[11px] text-muted-text mb-3">Pick an instrument style. Our local MIDI synth engine synthesizes soft arpeggios using Web Audio.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { id: "romantic", label: "Romantic Plucks" },
                    { id: "classical", label: "Classical Piano" },
                    { id: "jazz", label: "Sunset Jazz" },
                    { id: "cinematic", label: "Cinematic Pad" }
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleGenreChange(g.id)}
                      className={`py-2 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        audioGenre === g.id 
                          ? "border-brand-green bg-brand-green/10 text-brand-green font-bold shadow-sm" 
                          : "border-card-border bg-card-bg text-muted-text hover:bg-card-bg/50"
                      }`}
                      id={`genre-btn-${g.id}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 flex items-center gap-3 bg-card-bg border border-card-border/70 p-3.5 rounded-xl shadow-sm">
                  <button
                    onClick={() => handleToggleMusic()}
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center gap-2 ${
                      isPlayingAudio 
                        ? "bg-red-500 hover:bg-red-600 text-white border-red-600" 
                        : "bg-brand-green hover:bg-brand-green-hover text-white border-emerald-700"
                    }`}
                    id="synth-play-toggle"
                  >
                    {isPlayingAudio ? (
                      <>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        Mute Score
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        Play Score
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-muted-text italic">
                    {isPlayingAudio ? `Now playing: ${audioGenre} synthesizers...` : `Audio muted. Click to hear sound.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Customizer Preview Screen (Right Column) */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
              <span className="text-xs font-bold text-muted-text/80 uppercase tracking-widest mb-3">Studio Presentation Deck</span>
              
              <div className="w-full max-w-md aspect-[1.28/1] bg-[#f2efe6] dark:bg-zinc-800/80 border border-card-border rounded-2xl shadow-xl flex items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-60"></div>
                
                {/* 3D Envelope */}
                <div className="relative w-full max-w-[280px] aspect-[1.3/1] perspective-1000 z-10">
                  <div className="w-full h-full relative transform-style-3d">
                    
                    {/* Envelope Back / Liner */}
                    <div className="absolute inset-0 bg-[#faf9f4] dark:bg-[#1a191d] rounded-lg shadow-inner z-10 overflow-hidden border border-stone-200/10">
                      {customizer.linerPattern === "gold-glitter" && (
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-transparent opacity-35 dark:opacity-20"></div>
                      )}
                      {customizer.linerPattern === "striped" && (
                        <div className="absolute inset-0 opacity-10 bg-repeating-linear-gradient from-transparent via-transparent to-stone-500 dark:to-stone-400 rotate-45" style={{ backgroundSize: "20px 20px" }}></div>
                      )}
                    </div>
                    
                    {/* 3D Envelope Flap */}
                    <div className={`envelope-flap absolute top-0 left-0 w-full h-[55%] origin-top transition-all duration-750 ${
                      envelopeOpen ? "is-open" : "is-closed"
                    }`}>
                      {/* Flap Front (Color) */}
                      <div className="absolute inset-0 backface-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", backgroundColor: customizer.envelopeColor }}>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-black/10 rounded-full blur-sm"></div>
                      </div>
                      {/* Flap Back Liner */}
                      <div className="absolute inset-0 backface-hidden rotate-x-180 bg-[#e5e3db] dark:bg-[#25242a]">
                        <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", backgroundColor: "#dedcd4" }}></div>
                        {customizer.linerPattern === "gold-glitter" && (
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200 via-yellow-600 to-transparent opacity-25 dark:opacity-10" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}></div>
                        )}
                      </div>
                    </div>
                    
                    {/* Sliding Invitation Card */}
                    <div className={`absolute left-[6%] w-[88%] aspect-[1.28/1] bg-card-bg shadow-2xl rounded-sm transition-all duration-750 ease-out z-15 ${
                      envelopeOpen ? "-translate-y-[55%] scale-[1.04]" : "translate-y-0 scale-100 opacity-90"
                    }`}>
                      
                      {/* Elegant double gold frame and paper overlay */}
                      <div className="w-full h-full flex flex-col items-center justify-between text-center relative overflow-hidden bg-paper p-4 border-double border-4 border-amber-300/35 m-0 shadow-inner">
                        {customizer.theme === "sage-watercolor" && (
                          <div className="absolute inset-0 opacity-15 pointer-events-none">
                            <div className="absolute -top-6 -left-6 w-16 h-16 bg-emerald-300 rounded-full filter blur-xl"></div>
                            <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-amber-200 rounded-full filter blur-xl"></div>
                          </div>
                        )}
                        {customizer.theme === "midnight-star" && (
                          <div className="absolute inset-0 bg-[#0f172a] text-slate-100 pointer-events-none">
                            <div className="absolute top-2 left-4 w-0.5 h-0.5 bg-white rounded-full"></div>
                            <div className="absolute top-6 right-8 w-1 h-1 bg-yellow-200 rounded-full animate-pulse"></div>
                          </div>
                        )}
                        {customizer.theme === "gold-foil" && (
                          <div className="absolute inset-0 bg-stone-50 border-[2px] border-amber-300/30 m-0.5 pointer-events-none">
                            <div className="absolute top-0 bottom-0 left-1 w-[1px] bg-amber-450/25"></div>
                            <div className="absolute top-0 bottom-0 right-1 w-[1px] bg-amber-450/25"></div>
                          </div>
                        )}
                        
                        {/* Wording text */}
                        <div className={`relative z-10 flex flex-col items-center justify-center h-full w-full gap-1.5 ${
                          customizer.theme === "midnight-star" ? "text-slate-100" : "text-stone-850 dark:text-stone-900"
                        }`}>
                          <span className="font-serif italic text-[7.5px] uppercase tracking-wider text-muted-text/80">{customizer.subtitle}</span>
                          <h3 className="font-serif text-sm font-bold uppercase tracking-widest my-0.5 border-y border-amber-300/30 py-0.5 px-3">
                            {customizer.title}
                          </h3>
                          <span className="text-[7.5px] uppercase tracking-widest font-bold">{customizer.date}</span>
                          <span className="text-[7px] text-muted-text/80 tracking-widest">{customizer.time}</span>
                          <div className="w-5 h-[0.5px] bg-amber-400 my-0.5"></div>
                          <span className="text-[7px] tracking-widest uppercase font-semibold text-center leading-none">{customizer.venue}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Envelope Front Overlay (Pocket) */}
                    <div className="absolute bottom-0 left-0 w-full h-[55%] z-20 rounded-b-lg border-t border-stone-200/10 shadow-lg" style={{ backgroundColor: customizer.envelopeColor, clipPath: "polygon(0 0, 0 100%, 100% 100%, 100% 0, 50% 40%)" }}>
                      <div className="absolute inset-0 bg-black/5" style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%, 100% 0, 50% 40%)" }}></div>
                    </div>
                    
                    {/* Gold Wax Seal Button */}
                    <button 
                      onClick={() => setEnvelopeOpen(true)}
                      className={`absolute left-1/2 w-11 h-11 -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-800 shadow-[0_6px_16px_rgba(180,135,40,0.4)] border border-amber-300/40 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center ${
                        envelopeOpen ? "bottom-[42%] scale-0 opacity-0 z-5" : "bottom-[42%] z-30"
                      }`}
                      style={{ transition: "all 0.5s ease" }}
                      aria-label="Open Custom Invitation"
                      id="customizer-open-seal"
                    >
                      <svg className="w-5 h-5 text-amber-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 10h3l-4 4-4-4h3V8h2v4z"/>
                      </svg>
                    </button>
                    
                    {/* Close Invitation Button */}
                    {envelopeOpen && (
                      <button 
                        onClick={() => setEnvelopeOpen(false)}
                        className="absolute top-0 right-[-32px] z-40 bg-card-bg hover:bg-stone-100 text-zinc-650 hover:text-brand-green p-1.5 rounded-full border border-card-border shadow-md transition-colors text-xs font-semibold cursor-pointer"
                        title="Close invitation"
                        id="customizer-close-btn"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setEnvelopeOpen(true)}
                  className={`px-5 py-2.5 border rounded-full text-xs font-bold transition-all cursor-pointer ${
                    envelopeOpen ? "bg-card-border/50 text-muted-text border-transparent" : "bg-brand-green hover:bg-brand-green-hover text-white border-emerald-700 shadow-sm"
                  }`}
                  id="preview-open-envelope-btn"
                >
                  Open Envelope
                </button>
                <button
                  onClick={() => setEnvelopeOpen(false)}
                  className={`px-5 py-2.5 border rounded-full text-xs font-bold transition-all cursor-pointer ${
                    !envelopeOpen ? "bg-card-border/50 text-muted-text border-transparent" : "bg-card-bg hover:bg-stone-50 border-card-border text-foreground shadow-sm"
                  }`}
                  id="preview-close-envelope-btn"
                >
                  Close &amp; Tuck
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
});

export default HeroSection;
