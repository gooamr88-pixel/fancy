"use client";

import React, { useState, useEffect, useRef } from "react";

// --- Custom SVGs for Feature Icons ---
const FeatureIcon = ({ name, className = "w-8 h-8 text-brand-green" }) => {
  switch (name) {
    case "personalization":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122l.18-.362a6.03 6.03 0 012.438-2.438l.362-.18a6.03 6.03 0 002.438-2.438l.18-.362m-9.028 5.776L3 19.5m0 0l.5-2.236m-.5 2.236l2.236-.5m10.764-10.764l1.196-1.196a1.875 1.875 0 112.652 2.652L17.29 8.79M13.25 5.697l2.236-2.236a1.875 1.875 0 012.652 0l2.651 2.651a1.875 1.875 0 010 2.652l-2.236 2.236m-13.5 10.5l12.62-12.62" />
        </svg>
      );
    case "guest-list":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h1" />
        </svg>
      );
    case "messaging":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9s.25 0 .25.25v5.003c0 .25-.25.25-.25.25h-9s-.25 0-.25-.25V8.5c0-.25.25-.25.25-.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48L4.5 19.5l3.375-.75A8.96 8.96 0 0012 20.25z" />
        </svg>
      );
    case "address":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      );
    case "track-rsvps":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h3.75a2.25 2.25 0 012.25 2.25v15a2.25 2.25 0 01-2.25 2.25h-3.75a2.25 2.25 0 01-2.25-2.25v-15a2.25 2.25 0 012.25-2.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 6h1.5m-1.5 3h1.5m-1.5 3h1.5m-1.5 3h1.5m-1.5 3h1.5" />
        </svg>
      );
    case "survey":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      );
    case "updates":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      );
    case "reminders":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return null;
  }
};

// --- Animated Audio Wave Visualizer ---
const AudioWaveform = ({ isPlaying }) => {
  return (
    <div className="flex items-end gap-[3px] h-6 w-9 px-1">
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-3 ${isPlaying ? "animate-wave-1" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-5 ${isPlaying ? "animate-wave-2" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-6 ${isPlaying ? "animate-wave-3" : "h-2"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-4 ${isPlaying ? "animate-wave-4" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-3 ${isPlaying ? "animate-wave-5" : "h-1"}`}></div>
    </div>
  );
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [subHeaderSticky, setSubHeaderSticky] = useState(false);

  // Audio Playback Simulation States
  const [isPlayingHeroAudio, setIsPlayingHeroAudio] = useState(false);
  const [playingCarouselAudio, setPlayingCarouselAudio] = useState(null);

  // Carousel & Design States
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Card Theme States
  const [chicStripesColor, setChicStripesColor] = useState("navy");
  const [fireworksColor, setFireworksColor] = useState("red");
  const [remembranceColor, setRemembranceColor] = useState("white");

  // Card Flip States (flipped = back side showing)
  const [flippedCards, setFlippedCards] = useState({
    chic: false,
    fireworks: false,
    remembrance: false,
  });

  const subHeaderRef = useRef(null);
  const sectionRefs = {
    overview: useRef(null),
    features: useRef(null),
    designs: useRef(null),
    pricing: useRef(null),
    nature: useRef(null),
  };

  // Scroll Spy and Sticky Sub-Nav Logic
  useEffect(() => {
    const handleScroll = () => {
      // Handle subheader stickiness
      if (subHeaderRef.current) {
        const offset = subHeaderRef.current.offsetTop;
        if (window.scrollY >= offset - 80) {
          setSubHeaderSticky(true);
        } else {
          setSubHeaderSticky(false);
        }
      }

      // Scroll Spy - Highlight active section link
      const scrollPosition = window.scrollY + 250; 
      for (const section in sectionRefs) {
        const ref = sectionRefs[section].current;
        if (ref) {
          const top = ref.offsetTop;
          const height = ref.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const scrollToSection = (sectionId) => {
    const ref = sectionRefs[sectionId]?.current;
    if (ref) {
      const offsetTop = ref.offsetTop - 120; // accounting for sticky header
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
      setActiveSection(sectionId);
    }
  };

  const toggleFlip = (cardKey) => {
    setFlippedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  // Carousel Navigation
  const handlePrevSlide = () => {
    setCarouselIndex((prev) => (prev === 0 ? 1 : 0));
  };
  const handleNextSlide = () => {
    setCarouselIndex((prev) => (prev === 1 ? 0 : 1));
  };

  // Audio Toggle Helpers
  const toggleHeroAudio = () => {
    setIsPlayingHeroAudio(!isPlayingHeroAudio);
  };
  const toggleCarouselAudio = (cardId) => {
    setPlayingCarouselAudio((prev) => (prev === cardId ? null : cardId));
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-800 font-sans selection:bg-brand-green/20 selection:text-brand-green">
      
      {/* --- Main Header / Navigation (Logo + Login/Register) --- */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-zinc-100 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50 transition-all duration-300">
        <div className="flex items-center gap-1">
          <span className="font-sans text-xl md:text-2xl font-bold tracking-[0.25em] text-brand-green hover:opacity-90 transition-all cursor-pointer flex items-center">
            FANCY<span className="font-light text-amber-500 mx-1">|</span>RSVP
          </span>
        </div>
        
        <div className="flex items-center gap-6 md:gap-8">
          <a href="#login" className="text-zinc-600 hover:text-brand-green font-medium text-sm md:text-base transition-colors">
            Log In
          </a>
          <button 
            onClick={() => scrollToSection("overview")}
            className="bg-brand-green hover:bg-brand-green-hover text-white px-5 py-2.5 rounded-md font-medium text-sm md:text-base transition-all shadow-md hover:shadow-lg active:scale-[0.98] border-b-2 border-emerald-700"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* --- Hero Section --- */}
      <section className="relative w-full max-w-7xl mx-auto px-6 md:px-12 pt-12 pb-24 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        
        {/* Left Side: Mock Tablet & Animation */}
        <div className="lg:col-span-6 flex justify-center items-center w-full relative">
          
          {/* Subtle decorative backing behind tablet */}
          <div className="absolute w-[80%] h-[80%] bg-gradient-to-tr from-emerald-50 to-amber-50 rounded-full filter blur-3xl opacity-60 z-0"></div>
          
          <div className="relative z-10 w-full max-w-lg aspect-[4/3] bg-zinc-900 rounded-[2.5rem] p-4 shadow-2xl border-[5px] border-zinc-800 flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-[1.01] hover:shadow-emerald-900/10">
            {/* Tablet Camera & Bezel Details */}
            <div className="absolute top-1/2 left-3 w-1.5 h-1.5 bg-zinc-700 rounded-full -translate-y-1/2"></div>
            <div className="absolute top-1/2 right-3 w-1.5 h-1.5 bg-zinc-700 rounded-full -translate-y-1/2"></div>
            
            {/* Tablet Screen */}
            <div className="w-full h-full bg-[#f6f6f3] rounded-[1.8rem] overflow-hidden relative flex flex-col items-center justify-center p-6 md:p-8 select-none">
              
              {/* Audio visualizer bar inside tablet */}
              <button 
                onClick={toggleHeroAudio}
                className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-zinc-200/60 shadow-sm flex items-center gap-1.5 text-xs text-zinc-600 hover:text-brand-green transition-colors z-30 cursor-pointer"
              >
                <span className="font-semibold text-[10px] uppercase tracking-wider">
                  {isPlayingHeroAudio ? "Music On" : "Preview Music"}
                </span>
                <AudioWaveform isPlaying={isPlayingHeroAudio} />
              </button>

              {/* Envelope Container Mock */}
              <div className="relative w-full max-w-[280px] md:max-w-[320px] aspect-[1.4/1] flex flex-col items-center justify-end group">
                
                {/* Envelope Back / Golden Foil Inner Liner */}
                <div className="absolute bottom-0 w-[95%] h-[80%] bg-[#b8cfc2] rounded-t-md shadow-inner border-t border-amber-300">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400 via-amber-600 to-transparent"></div>
                </div>
                
                {/* Emerging Invitation Card */}
                <div className="absolute bottom-4 w-[85%] aspect-[1.5/1] bg-[#faf8f5] shadow-xl rounded-sm p-4 flex flex-col items-center justify-center border-t-2 border-amber-400 border-x border-b border-zinc-100 transition-transform duration-[800ms] cubic-bezier(0.16, 1, 0.3, 1) group-hover:-translate-y-14 cursor-pointer">
                  {/* Card Art Shapes (Abstract watercolor brushstrokes) */}
                  <div className="absolute inset-0 opacity-15 overflow-hidden rounded-sm">
                    <div className="absolute -top-4 -left-4 w-24 h-24 bg-rose-300 rounded-full filter blur-xl"></div>
                    <div className="absolute top-8 -right-8 w-28 h-28 bg-[#31a673] rounded-full filter blur-xl"></div>
                    <div className="absolute -bottom-8 left-12 w-20 h-20 bg-amber-200 rounded-full filter blur-lg"></div>
                  </div>
                  
                  {/* Card Content */}
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <span className="font-serif italic text-[0.7rem] md:text-xs text-zinc-500 tracking-wider mb-0.5">please join us for</span>
                    <span className="font-serif text-lg md:text-2xl font-semibold text-zinc-800 tracking-widest uppercase border-y border-amber-200 py-1.5 px-4 mb-1">
                      COCKTAILS
                    </span>
                    <span className="font-sans text-[0.55rem] md:text-[0.65rem] text-zinc-400 uppercase tracking-widest font-semibold">FANCY RSVP PREVIEW</span>
                  </div>
                </div>

                {/* Envelope Front Overlay (Sage Cover with Shadow) */}
                <div className="absolute bottom-0 w-full h-[55%] bg-[#a5c0b1] rounded-b-md shadow-lg z-20 flex items-center justify-center border-t border-[#b6cfc1]">
                  {/* Mock Gold Wax Seal with metallic gradient shine */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 shadow-md flex items-center justify-center border border-yellow-300 active:scale-95 transition-transform cursor-pointer">
                    <span className="text-white text-[11px] font-bold text-shadow-premium">F</span>
                  </div>
                </div>
              </div>
              
              {/* Device Home Indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-zinc-300 rounded-full opacity-60"></div>
            </div>
          </div>
        </div>

        {/* Right Side: Hero Content & Email Capture */}
        <div className="lg:col-span-6 flex flex-col gap-6 text-center lg:text-left relative">
          
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-5xl font-semibold leading-[1.15] text-zinc-900 tracking-tight">
            Make & Send Your Online Invitation In Minutes. <span className="text-brand-green">Easy, Real-Time RSVP Tracking.</span>
          </h1>
          <p className="text-lg text-zinc-600 leading-relaxed max-w-xl mx-auto lg:mx-0 font-light">
            Enjoy One-of-a-kind Designs, RSVP Tracking, & More. Custom creations crafted for weddings, birthdays, baby showers, and premium corporate events.
          </p>

          {/* Email Capture Form with Confetti Particles */}
          <div className="w-full max-w-md mx-auto lg:mx-0 mt-2 relative">
            
            {/* Confetti Particle Generator */}
            {isSubmitted && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30 h-48">
                {[...Array(20)].map((_, i) => {
                  const colors = ["bg-amber-400", "bg-emerald-500", "bg-indigo-400", "bg-rose-400", "bg-yellow-400", "bg-teal-400"];
                  const randomColor = colors[Math.floor(Math.random() * colors.length)];
                  const leftOffset = `${Math.random() * 100}%`;
                  const animDelay = `${Math.random() * 1.5}s`;
                  const size = Math.random() > 0.5 ? "w-2.5 h-2.5" : "w-1.5 h-3.5";
                  return (
                    <div 
                      key={i} 
                      className={`absolute ${size} ${randomColor} rounded-sm animate-confetti`}
                      style={{
                        left: leftOffset,
                        animationDelay: animDelay,
                        top: 0
                      }}
                    ></div>
                  );
                })}
              </div>
            )}

            {!isSubmitted ? (
              <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.value || e.target.value)}
                  placeholder="Your Email Address"
                  className="flex-1 px-5 py-4 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green bg-zinc-50/50 hover:bg-zinc-50 transition-colors text-zinc-800 placeholder-zinc-400 shadow-sm font-medium"
                />
                <button
                  type="submit"
                  className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-4 rounded-lg font-semibold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer border-b-2 border-emerald-700"
                >
                  Let's Go!
                </button>
              </form>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-left flex items-start gap-3 animate-fade-in shadow-inner">
                <svg className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-bold text-emerald-950">Awesome, let's get started!</h4>
                  <p className="text-sm mt-0.5">We've saved your interest. Redirecting you to draft your card...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2 text-zinc-400 mt-6 text-sm font-medium animate-bounce">
            <span>Scroll to explore what sets Fancy RSVP apart</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* --- Sticky Sub-Navigation Bar --- */}
      <div 
        ref={subHeaderRef}
        className={`w-full bg-white border-y border-zinc-100 transition-all duration-300 z-40 ${
          subHeaderSticky ? "fixed top-[73px] left-0 shadow-md" : "relative"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center h-16">
          <nav className="flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: "overview", label: "Overview" },
              { id: "features", label: "Features" },
              { id: "designs", label: "Designs" },
              { id: "pricing", label: "Pricing" },
              { id: "nature", label: "Protecting Nature" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className={`h-16 flex items-center border-b-2 font-medium text-sm md:text-base tracking-wide transition-all px-1 shrink-0 ${
                  activeSection === tab.id
                    ? "border-brand-green text-brand-green font-bold"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab.label === "Overview" && tab.id === "overview" && (
                  <span className="mr-1 text-[10px] uppercase font-bold text-zinc-300">Invitations ▾</span>
                )}
                {tab.label}
              </button>
            ))}
          </nav>
          
          {subHeaderSticky && (
            <button 
              onClick={() => scrollToSection("overview")}
              className="bg-brand-green hover:bg-brand-green-hover text-white px-4 py-2 rounded-md font-medium text-xs md:text-sm transition-all shadow active:scale-[0.98]"
            >
              Get Started
            </button>
          )}
        </div>
      </div>

      {/* --- Overview Section --- */}
      <section 
        id="overview" 
        ref={sectionRefs.overview}
        className="w-full py-24 bg-[#fcfcfb] border-b border-zinc-100"
      >
        <div className="max-w-4xl mx-auto px-6 text-center flex flex-col gap-6 reveal-on-scroll">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight text-zinc-900 tracking-tight max-w-3xl mx-auto">
            Premium Digital Invitations with Animated Envelopes, Built-In RSVP Tracking & Background Music
          </h2>
          <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-4xl mx-auto font-light">
            Fancy RSVP invitations arrive with a signature animated envelope opening - complete with a personalized liner, stamp, and background music that sets the tone before guests even read a word. Upload your own design or customize one of our exclusive designer suites, then send via email or text with built-in RSVP tracking and real-time guest list management. From weddings and baby showers to corporate events, every detail is handled on an ad-free platform with zero paper waste.
          </p>
        </div>
      </section>

      {/* --- Features Section --- */}
      <section 
        id="features" 
        ref={sectionRefs.features}
        className="w-full py-24 bg-white border-b border-zinc-100"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight mb-4">
              Powerful Features to Fully Customize Your Online Cards and Invitations
            </h2>
            <div className="w-16 h-1 bg-brand-green mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {[
              {
                id: "personalization",
                title: "Personalization",
                desc: "Select a design curated from our community of indie designers, then update font, color, photos, layout, and more to make it your own.",
              },
              {
                id: "guest-list",
                title: "Importing Guest List",
                desc: "Easily import contacts from a spreadsheet, directly from your email, or by using your Fancy RSVP address book.",
              },
              {
                id: "messaging",
                title: "Messaging",
                desc: "Stay connected with your guests through easy-to-use messaging that is perfect for last-minute updates and check-ins.",
              },
              {
                id: "address",
                title: "Address Validation",
                desc: "Prior to being sent, each email address will be automatically verified to ensure optimal delivery and minimize bouncebacks.",
              },
              {
                id: "track-rsvps",
                title: "Track RSVPs",
                desc: "View 'Yes' and 'No' responses, track guest counts, and see who has viewed your invitation in real-time.",
              },
              {
                id: "survey",
                title: "Survey Questions",
                desc: "“Chicken or fish?” “Do you have a song request?” Ask custom questions to collect the details you need.",
              },
              {
                id: "updates",
                title: "Daily Updates",
                desc: "Opt to receive emails with the latest RSVPs so you can stay updated without logging in.",
              },
              {
                id: "reminders",
                title: "Auto-Reminders",
                desc: "Schedule and send reminders to guests who haven't opened your invitation or RSVP'd yet.",
              },
            ].map((feat, index) => (
              <div 
                key={feat.id} 
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-transparent hover:border-zinc-100 hover:bg-zinc-50/70 hover:shadow-xl hover:shadow-emerald-950/[0.02] hover:-translate-y-2.5 transition-all group duration-500 cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-16 h-16 bg-[#eefaf4] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-brand-green/10">
                  <FeatureIcon name={feat.id} className="w-8 h-8 text-brand-green" />
                </div>
                <h3 className="font-semibold text-lg text-zinc-950 mb-3 tracking-wide">
                  {feat.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-light">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Designs Carousel Section --- */}
      <section 
        id="designs" 
        ref={sectionRefs.designs}
        className="w-full py-24 bg-[#fafaf8]"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left: Designs Text Column */}
          <div className="lg:col-span-4 flex flex-col gap-6 text-center lg:text-left">
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-4xl font-semibold leading-tight text-zinc-900 tracking-tight">
              Thoughtfully Designed, Sustainably Crafted
            </h2>
            <p className="text-zinc-500 leading-relaxed text-sm md:text-base font-light">
              Our in-house team partners with a global community of independent illustrators, calligraphers, and artists to create exclusive, contemporary designs that reflect your unique style — without the waste. Every digital invite is a beautiful, eco-conscious choice that helps protect nature while celebrating what matters. Celebrate beautifully. Invite sustainably.
            </p>
            <div className="pt-2">
              <button className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-3.5 rounded-md font-semibold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer border-b-2 border-emerald-700">
                See All Designs
              </button>
            </div>
          </div>

          {/* Right: Carousel of Envelope Invitations */}
          <div className="lg:col-span-8 w-full relative flex flex-col items-center">
            
            {/* Carousel Main Container */}
            <div className="w-full flex items-center justify-between gap-2 md:gap-4">
              
              {/* Left Arrow Button */}
              <button 
                onClick={handlePrevSlide}
                className="w-10 h-10 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-all z-10 shrink-0 cursor-pointer hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Envelope Cards Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden py-8 px-2">
                
                {/* --- CARD 1: Chic Stripes --- */}
                {carouselIndex === 0 ? (
                  <div className="flex flex-col items-center w-full">
                    {/* 3D Envelope Wrapper */}
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] perspective-1000 group">
                      
                      {/* Flippable Envelope Box */}
                      <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${
                        flippedCards.chic ? "rotate-y-180" : ""
                      }`}>
                        
                        {/* FRONT FACE (Envelope + Slide out card) */}
                        <div className="absolute inset-0 w-full h-full backface-hidden flex flex-col justify-end">
                          
                          {/* Outer Envelope Boundary (Click area) */}
                          <div className="relative w-full h-[80%] flex flex-col justify-end overflow-visible select-none">
                            
                            {/* Soundwave hover player button */}
                            <button
                              onClick={() => toggleCarouselAudio("chic")}
                              className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm p-1 rounded-full border border-zinc-200/50 shadow-sm hover:text-brand-green z-30 transition-transform cursor-pointer"
                              title="Music Preview"
                            >
                              <AudioWaveform isPlaying={playingCarouselAudio === "chic"} />
                            </button>

                            {/* Envelope Back / Gold glitter liner */}
                            <div className={`absolute bottom-0 w-[95%] h-[85%] rounded-t-md shadow-inner transition-colors duration-500 ${
                              chicStripesColor === "navy" ? "bg-amber-100/80 border-t border-amber-300" :
                              chicStripesColor === "emerald" ? "bg-amber-100/80 border-t border-amber-300" :
                              chicStripesColor === "burgundy" ? "bg-amber-100/80 border-t border-amber-300" :
                              chicStripesColor === "black" ? "bg-slate-200 border-t border-slate-300" :
                              chicStripesColor === "pink" ? "bg-rose-100/90 border-t border-rose-200" :
                              "bg-gradient-to-r from-red-100 via-amber-100 to-emerald-100"
                            }`}>
                              {/* Sparkling gold liner pattern */}
                              <div className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400 via-yellow-600 to-transparent"></div>
                            </div>

                            {/* Sliding Invitation Card */}
                            <div className="absolute bottom-2 left-[7.5%] w-[85%] aspect-[0.72/1] bg-white shadow-xl rounded-sm p-3 border-t-2 border-amber-300 border-x border-b border-zinc-100 flex flex-col items-center justify-between transition-transform duration-500 ease-out group-hover:-translate-y-20 z-10">
                              {/* Chic Stripes Card Content */}
                              <div className="w-full h-full flex flex-col items-center justify-between py-1 relative">
                                {/* Side stripes */}
                                <div className="absolute left-0 top-0 bottom-0 w-3 flex flex-col justify-between">
                                  {[...Array(8)].map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-full h-1.5 transition-colors duration-500 ${
                                        chicStripesColor === "navy" ? "bg-blue-900" :
                                        chicStripesColor === "emerald" ? "bg-emerald-800" :
                                        chicStripesColor === "burgundy" ? "bg-red-950" :
                                        chicStripesColor === "black" ? "bg-black" :
                                        chicStripesColor === "pink" ? "bg-rose-400" :
                                        "bg-indigo-600"
                                      }`}
                                    ></div>
                                  ))}
                                </div>
                                <div className="absolute right-0 top-0 bottom-0 w-3 flex flex-col justify-between">
                                  {[...Array(8)].map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-full h-1.5 transition-colors duration-500 ${
                                        chicStripesColor === "navy" ? "bg-blue-900" :
                                        chicStripesColor === "emerald" ? "bg-emerald-800" :
                                        chicStripesColor === "burgundy" ? "bg-red-950" :
                                        chicStripesColor === "black" ? "bg-black" :
                                        chicStripesColor === "pink" ? "bg-rose-400" :
                                        "bg-pink-600"
                                      }`}
                                    ></div>
                                  ))}
                                </div>

                                {/* Typography */}
                                <div className="px-3 text-center flex flex-col items-center justify-center h-full gap-1">
                                  <span className="font-serif italic text-[8px] text-zinc-400">please join us at</span>
                                  <h4 className="font-serif text-[10px] md:text-[11px] font-bold text-zinc-800 uppercase tracking-wider leading-none text-center">
                                    HEART GALA & AUCTION
                                  </h4>
                                  <div className="w-8 h-[1px] bg-amber-400 my-0.5"></div>
                                  <span className="text-[6px] text-zinc-500 uppercase tracking-widest leading-none font-bold">CYPRESS SPRINGS GRILLE</span>
                                </div>
                              </div>
                            </div>

                            {/* Envelope Front Layer */}
                            <div className="absolute bottom-0 w-full h-[55%] bg-zinc-300 rounded-b-md shadow-lg z-20 border-t border-zinc-200">
                              {/* Diagonal flap fold line mock */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-b-md"></div>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE (Details + RSVP Info) */}
                        <div className="absolute inset-0 w-full h-full bg-[#faf9f6] border border-zinc-200 rounded-xl p-4 shadow-xl rotate-y-180 backface-hidden flex flex-col justify-between text-center select-none">
                          <div>
                            <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">Event details</span>
                            <h4 className="font-serif text-sm font-semibold text-zinc-800 mt-1">Heart Gala 2026</h4>
                            <p className="text-[9px] text-zinc-500 mt-2 font-light leading-relaxed">
                              Join us for our annual fundraising dinner. Enjoy a lovely evening of charity, fine food, and silent auctions.
                            </p>
                          </div>
                          
                          <div className="border-t border-zinc-100 pt-2 flex flex-col gap-1.5">
                            <span className="text-[9px] text-zinc-700 font-bold">Dress Code: Black Tie</span>
                            <button className="bg-brand-green text-white text-[10px] font-bold py-1.5 rounded hover:bg-brand-green-hover transition-colors shadow-sm">
                              RSVP Now
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Top Flip Icon Button */}
                      <button 
                        onClick={() => toggleFlip("chic")}
                        className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white shadow-md border border-zinc-100 hover:border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand-green transition-all hover:scale-105 active:scale-95 z-30 cursor-pointer"
                        title="Flip Invitation"
                      >
                        <svg className="w-4 h-4 transform group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12c0-1.23.16-2.42.47-3.56L6.5 12h-2zm10.5-3.56c.31 1.14.47 2.33.47 3.56h-2l1.53-3.56zM6.5 12c0 2.22 1.21 4.15 3 5.19L8.03 15.5H6.5v1.69z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0 1.23-.16 2.42-.47 3.56L17.5 12h2zm-10.5 3.56c-.31-1.14-.47-2.33-.47-3.56h2l-1.53 3.56zM17.5 12c0-2.22-1.21-4.15-3-5.19l1.47 1.69h1.53V6.31z" />
                        </svg>
                      </button>
                    </div>

                    {/* Metadata Labels */}
                    <div className="text-center mt-4 flex flex-col items-center">
                      <h4 className="font-medium text-sm text-zinc-900 tracking-wide">Chic Stripes</h4>
                      <p className="text-zinc-400 italic text-xs mt-0.5">Jessica Williams</p>

                      {/* Color Selector Dots */}
                      <div className="flex gap-1.5 mt-3">
                        {[
                          { id: "navy", color: "bg-blue-900 ring-blue-900/30" },
                          { id: "emerald", color: "bg-emerald-800 ring-emerald-800/30" },
                          { id: "burgundy", color: "bg-red-950 ring-red-950/30" },
                          { id: "black", color: "bg-black ring-black/30" },
                          { id: "pink", color: "bg-rose-400 ring-rose-400/30" },
                        ].map((dot) => (
                          <button
                            key={dot.id}
                            onClick={() => setChicStripesColor(dot.id)}
                            className={`w-3.5 h-3.5 rounded-full transition-all border border-white hover:scale-110 cursor-pointer ${
                              chicStripesColor === dot.id ? `ring-2 ring-offset-1 ${dot.color}` : dot.color.split(" ")[0]
                            }`}
                          ></button>
                        ))}
                        <button 
                          onClick={() => setChicStripesColor("rainbow")}
                          className={`w-3.5 h-3.5 rounded-full transition-all border border-white hover:scale-110 bg-gradient-to-tr from-rose-400 via-amber-300 to-indigo-500 cursor-pointer ${
                            chicStripesColor === "rainbow" ? "ring-2 ring-offset-1 ring-zinc-400" : ""
                          }`}
                        ></button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    {/* Placeholder for design slide page 2 - Autumn / Cozy Theme */}
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] bg-amber-50/45 rounded-xl border border-zinc-200/60 p-4 flex flex-col justify-between shadow-md hover:shadow-lg transition-all">
                      <div className="aspect-[1.5/1] bg-amber-100 rounded-lg flex items-center justify-center text-amber-800 font-serif text-[10px] tracking-widest uppercase shadow-inner border-t border-amber-300">
                        Harvest Invite
                      </div>
                      <div className="text-center mt-2">
                        <h4 className="font-semibold text-xs text-zinc-800">Autumn Leaves</h4>
                        <p className="text-zinc-400 italic text-[10px] mt-0.5">By Grace Harlow</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- CARD 2: Classic Fireworks --- */}
                {carouselIndex === 0 ? (
                  <div className="flex flex-col items-center w-full">
                    {/* 3D Envelope Wrapper */}
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] perspective-1000 group">
                      
                      {/* Flippable Envelope Box */}
                      <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${
                        flippedCards.fireworks ? "rotate-y-180" : ""
                      }`}>
                        
                        {/* FRONT FACE (Envelope + Slide out card) */}
                        <div className="absolute inset-0 w-full h-full backface-hidden flex flex-col justify-end">
                          
                          {/* Outer Envelope Boundary (Click area) */}
                          <div className="relative w-full h-[80%] flex flex-col justify-end overflow-visible select-none">
                            
                            {/* Soundwave hover player button */}
                            <button
                              onClick={() => toggleCarouselAudio("fireworks")}
                              className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm p-1 rounded-full border border-zinc-200/50 shadow-sm hover:text-brand-green z-30 transition-transform cursor-pointer"
                              title="Music Preview"
                            >
                              <AudioWaveform isPlaying={playingCarouselAudio === "fireworks"} />
                            </button>

                            {/* Envelope Back / Inner glitter liner */}
                            <div className={`absolute bottom-0 w-[95%] h-[85%] rounded-t-md shadow-inner transition-colors duration-500 ${
                              fireworksColor === "red" ? "bg-red-950/90 border-t border-red-800" :
                              fireworksColor === "blue" ? "bg-blue-950/90 border-t border-blue-900" :
                              "bg-zinc-900 border-t border-zinc-800"
                            }`}>
                              {/* Sparkling silver flakes liner */}
                              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-400 via-zinc-800 to-transparent"></div>
                            </div>

                            {/* Sliding Invitation Card */}
                            <div className="absolute bottom-2 left-[7.5%] w-[85%] aspect-[0.72/1] bg-zinc-950 shadow-xl rounded-sm p-3 border border-zinc-800 flex flex-col items-center justify-between transition-transform duration-500 ease-out group-hover:-translate-y-20 z-10 overflow-hidden">
                              {/* Fireworks card design background */}
                              <div className="absolute inset-0 bg-black">
                                {/* Firework lines */}
                                <div className="absolute top-4 left-6 w-16 h-16 opacity-30 border border-dashed border-red-500 rounded-full animate-ping"></div>
                                <div className="absolute top-2 right-4 w-12 h-12 opacity-30 border border-dashed border-yellow-400 rounded-full animate-ping duration-1000"></div>
                              </div>

                              {/* Typography */}
                              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-1.5 py-2">
                                <h4 className="font-serif italic text-2xl text-yellow-100 font-medium tracking-normal leading-none">
                                  July 4th
                                </h4>
                                <span className="font-serif text-[13px] text-white tracking-widest uppercase font-bold leading-none">
                                  PARTY
                                  <div className="h-[1px] bg-red-500 w-12 mx-auto mt-1"></div>
                                </span>
                                <span className="text-[6px] text-zinc-400 uppercase tracking-widest mt-1 font-semibold">FOOD, FRIENDS, & FIREWORKS</span>
                              </div>
                            </div>

                            {/* Envelope Front Layer */}
                            <div className={`absolute bottom-0 w-full h-[55%] rounded-b-md shadow-lg z-20 transition-colors duration-500 border-t ${
                              fireworksColor === "red" ? "bg-red-800 border-red-700" :
                              fireworksColor === "blue" ? "bg-blue-800 border-blue-700" :
                              "bg-zinc-800 border-zinc-700"
                            }`}>
                              {/* Diagonal flap fold line mock */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-b-md"></div>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE (Details + RSVP Info) */}
                        <div className="absolute inset-0 w-full h-full bg-[#faf9f6] border border-zinc-200 rounded-xl p-4 shadow-xl rotate-y-180 backface-hidden flex flex-col justify-between text-center select-none">
                          <div>
                            <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">Party Schedule</span>
                            <h4 className="font-serif text-sm font-semibold text-zinc-800 mt-1">July 4th Barbecue</h4>
                            <p className="text-[9px] text-zinc-500 mt-2 font-light leading-relaxed">
                              Celebrate Independence Day with burgers, cold beers, yard games, and a private fireworks view at the lakeside!
                            </p>
                          </div>
                          
                          <div className="border-t border-zinc-100 pt-2 flex flex-col gap-1.5">
                            <span className="text-[9px] text-zinc-700 font-bold">Starts: 4:00 PM</span>
                            <button className="bg-brand-green text-white text-[10px] font-bold py-1.5 rounded hover:bg-brand-green-hover transition-colors shadow-sm">
                              Confirm Attendance
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Top Flip Icon Button */}
                      <button 
                        onClick={() => toggleFlip("fireworks")}
                        className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white shadow-md border border-zinc-100 hover:border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand-green transition-all hover:scale-105 active:scale-95 z-30 cursor-pointer"
                        title="Flip Invitation"
                      >
                        <svg className="w-4 h-4 transform group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12c0-1.23.16-2.42.47-3.56L6.5 12h-2zm10.5-3.56c.31 1.14.47 2.33.47 3.56h-2l1.53-3.56zM6.5 12c0 2.22 1.21 4.15 3 5.19L8.03 15.5H6.5v1.69z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0 1.23-.16 2.42-.47 3.56L17.5 12h2zm-10.5 3.56c-.31-1.14-.47-2.33-.47-3.56h2l-1.53 3.56zM17.5 12c0-2.22-1.21-4.15-3-5.19l1.47 1.69h1.53V6.31z" />
                        </svg>
                      </button>
                    </div>

                    {/* Metadata Labels */}
                    <div className="text-center mt-4 flex flex-col items-center">
                      <h4 className="font-medium text-sm text-zinc-900 tracking-wide">Classic Fireworks</h4>
                      <p className="text-zinc-400 italic text-xs mt-0.5">Laura Bolter Design</p>

                      {/* Color Selector Dots */}
                      <div className="flex gap-1.5 mt-3">
                        {[
                          { id: "red", color: "bg-red-700 ring-red-700/30" },
                          { id: "blue", color: "bg-blue-700 ring-blue-700/30" },
                          { id: "black", color: "bg-zinc-800 ring-zinc-800/30" },
                        ].map((dot) => (
                          <button
                            key={dot.id}
                            onClick={() => setFireworksColor(dot.id)}
                            className={`w-3.5 h-3.5 rounded-full transition-all border border-white hover:scale-110 cursor-pointer ${
                              fireworksColor === dot.id ? `ring-2 ring-offset-1 ${dot.color}` : dot.color.split(" ")[0]
                            }`}
                          ></button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    {/* Placeholder for slide page 2 - Winter / Elegant Theme */}
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] bg-sky-50/45 rounded-xl border border-zinc-200/60 p-4 flex flex-col justify-between shadow-md hover:shadow-lg transition-all">
                      <div className="aspect-[1.5/1] bg-sky-100 rounded-lg flex items-center justify-center text-sky-800 font-serif text-[10px] tracking-widest uppercase shadow-inner border-t border-sky-300">
                        Gala Invite
                      </div>
                      <div className="text-center mt-2">
                        <h4 className="font-semibold text-xs text-zinc-800">Snowy Night</h4>
                        <p className="text-zinc-400 italic text-[10px] mt-0.5">By Ethan Pierce</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- CARD 3: Remembrance --- */}
                {carouselIndex === 0 ? (
                  <div className="flex flex-col items-center w-full">
                    {/* 3D Envelope Wrapper */}
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] perspective-1000 group">
                      
                      {/* Flippable Envelope Box */}
                      <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${
                        flippedCards.remembrance ? "rotate-y-180" : ""
                      }`}>
                        
                        {/* FRONT FACE (Envelope + Slide out card) */}
                        <div className="absolute inset-0 w-full h-full backface-hidden flex flex-col justify-end">
                          
                          {/* Outer Envelope Boundary (Click area) */}
                          <div className="relative w-full h-[80%] flex flex-col justify-end overflow-visible select-none">
                            
                            {/* Soundwave hover player button */}
                            <button
                              onClick={() => toggleCarouselAudio("remembrance")}
                              className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm p-1 rounded-full border border-zinc-200/50 shadow-sm hover:text-brand-green z-30 transition-transform cursor-pointer"
                              title="Music Preview"
                            >
                              <AudioWaveform isPlaying={playingCarouselAudio === "remembrance"} />
                            </button>

                            {/* Envelope Back / Inner liner */}
                            <div className="absolute bottom-0 w-[95%] h-[85%] bg-zinc-100 rounded-t-md border-t border-zinc-200 shadow-inner"></div>

                            {/* Sliding Invitation Card */}
                            <div className="absolute bottom-2 left-[7.5%] w-[85%] aspect-[0.72/1] bg-[#fafafa] shadow-xl rounded-sm p-2.5 border-t border-zinc-200 border-x border-b flex flex-col items-center justify-between transition-transform duration-500 ease-out group-hover:-translate-y-20 z-10">
                              {/* Photo style card */}
                              <div className="w-full flex-1 relative bg-zinc-200 rounded-sm mb-2 overflow-hidden flex items-center justify-center">
                                {/* Simulated B&W Photograph */}
                                <div className={`absolute inset-0 bg-gradient-to-br from-zinc-400 to-zinc-600 flex flex-col items-center justify-center text-white/90 p-2 text-center transition-all ${
                                  remembranceColor === "sepia" ? "sepia saturate-150" :
                                  remembranceColor === "cool" ? "hue-rotate-15" : ""
                                }`}>
                                  <svg className="w-8 h-8 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                  </svg>
                                </div>
                              </div>

                              {/* Typography */}
                              <div className="w-full text-center flex flex-col items-center gap-0.5">
                                <span className="font-serif italic text-[6px] text-zinc-400">in remembrance of</span>
                                <h4 className="font-serif text-[9px] font-bold text-zinc-800 tracking-wide uppercase leading-none">
                                  Deborah Wilson
                                </h4>
                              </div>
                            </div>

                            {/* Envelope Front Layer */}
                            <div className={`absolute bottom-0 w-full h-[55%] rounded-b-md shadow-lg z-20 transition-colors duration-500 border-t ${
                              remembranceColor === "white" ? "bg-zinc-200 border-zinc-300" :
                              remembranceColor === "sage" ? "bg-[#b8cfc2] border-[#a5c0b1]" :
                              remembranceColor === "navy" ? "bg-slate-700 border-slate-600" :
                              remembranceColor === "grey" ? "bg-zinc-300 border-zinc-200" :
                              "bg-red-950 border-red-900"
                            }`}>
                              {/* Diagonal flap fold line mock */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-b-md"></div>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE (Details + RSVP Info) */}
                        <div className="absolute inset-0 w-full h-full bg-[#faf9f6] border border-zinc-200 rounded-xl p-4 shadow-xl rotate-y-180 backface-hidden flex flex-col justify-between text-center select-none">
                          <div>
                            <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">Memorial Service</span>
                            <h4 className="font-serif text-sm font-semibold text-zinc-800 mt-1">Celebrating Deborah</h4>
                            <p className="text-[9px] text-zinc-500 mt-2 font-light leading-relaxed">
                              Join us to share stories, honor memory, and celebrate the beautiful life of Deborah. Reception to follow at the family residence.
                            </p>
                          </div>
                          
                          <div className="border-t border-zinc-100 pt-2 flex flex-col gap-1.5">
                            <span className="text-[9px] text-zinc-700 font-bold">June 15 at 1:00 PM</span>
                            <button className="bg-brand-green text-white text-[10px] font-bold py-1.5 rounded hover:bg-brand-green-hover transition-colors shadow-sm">
                              Send Memory
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Top Flip Icon Button */}
                      <button 
                        onClick={() => toggleFlip("remembrance")}
                        className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white shadow-md border border-zinc-100 hover:border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-brand-green transition-all hover:scale-105 active:scale-95 z-30 cursor-pointer"
                        title="Flip Invitation"
                      >
                        <svg className="w-4 h-4 transform group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12c0-1.23.16-2.42.47-3.56L6.5 12h-2zm10.5-3.56c.31 1.14.47 2.33.47 3.56h-2l1.53-3.56zM6.5 12c0 2.22 1.21 4.15 3 5.19L8.03 15.5H6.5v1.69z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0 1.23-.16 2.42-.47 3.56L17.5 12h2zm-10.5 3.56c-.31-1.14-.47-2.33-.47-3.56h2l-1.53 3.56zM17.5 12c0-2.22-1.21-4.15-3-5.19l1.47 1.69h1.53V6.31z" />
                        </svg>
                      </button>
                    </div>

                    {/* Metadata Labels */}
                    <div className="text-center mt-4 flex flex-col items-center">
                      <h4 className="font-medium text-sm text-zinc-900 tracking-wide">Remembrance</h4>
                      <p className="text-zinc-400 italic text-xs mt-0.5">Ann Gardner Creative</p>

                      {/* Color Selector Dots */}
                      <div className="flex gap-1.5 mt-3">
                        {[
                          { id: "white", color: "bg-white border-zinc-300 ring-zinc-300/40" },
                          { id: "sage", color: "bg-[#b8cfc2] ring-[#b8cfc2]/40" },
                          { id: "navy", color: "bg-slate-700 ring-slate-700/40" },
                          { id: "grey", color: "bg-zinc-300 ring-zinc-300/40" },
                          { id: "burgundy", color: "bg-red-950 ring-red-950/40" },
                        ].map((dot) => (
                          <button
                            key={dot.id}
                            onClick={() => setRemembranceColor(dot.id)}
                            className={`w-3.5 h-3.5 rounded-full transition-all border hover:scale-110 cursor-pointer ${
                              remembranceColor === dot.id ? `ring-2 ring-offset-1 ${dot.color}` : dot.color.split(" ")[0]
                            }`}
                          ></button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    {/* Placeholder for slide page 2 - Summer / Kids Theme */}
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] bg-yellow-50/45 rounded-xl border border-zinc-200/60 p-4 flex flex-col justify-between shadow-md hover:shadow-lg transition-all">
                      <div className="aspect-[1.5/1] bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-800 font-serif text-[10px] tracking-widest uppercase shadow-inner border-t border-yellow-300">
                        Birthday Invite
                      </div>
                      <div className="text-center mt-2">
                        <h4 className="font-semibold text-xs text-zinc-800">Circus Party</h4>
                        <p className="text-zinc-400 italic text-[10px] mt-0.5">By Mason Vance</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Arrow Button */}
              <button 
                onClick={handleNextSlide}
                className="w-10 h-10 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-all z-10 shrink-0 cursor-pointer hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

            </div>

            {/* Carousel Dot Indicators */}
            <div className="flex gap-2 mt-8">
              {[0, 1].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    carouselIndex === idx ? "w-6 bg-brand-green" : "bg-zinc-300 hover:bg-zinc-400"
                  }`}
                ></button>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* --- Pricing Section Placeholder (To make scroll-spy full) --- */}
      <section 
        id="pricing" 
        ref={sectionRefs.pricing}
        className="w-full py-24 bg-white border-b border-zinc-100 text-center"
      >
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight">
            Simple, Transparent Pricing Packages
          </h2>
          <p className="text-zinc-500 leading-relaxed max-w-xl font-light text-sm md:text-base">
            No hidden costs. Pay only for the volume of guests you invite. Every package includes full personalization, animation, stamps, and music tools.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            {["Single Event", "Membership", "Corporate Suite"].map((pkg, i) => (
              <div key={pkg} className="p-8 rounded-2xl border border-zinc-100 hover:border-brand-green/20 hover:shadow-lg transition-all duration-300 w-64 text-center flex flex-col justify-between bg-zinc-50/30">
                <div>
                  <h4 className="font-semibold text-base uppercase text-zinc-400 tracking-widest">{pkg}</h4>
                  <p className="font-serif text-3xl font-semibold mt-4 text-zinc-950">${i === 0 ? "19" : i === 1 ? "49" : "199"}</p>
                  <p className="text-xs text-zinc-400 mt-1">Starting package rate</p>
                </div>
                <button className="mt-8 w-full border border-zinc-200 hover:border-brand-green hover:bg-brand-green hover:text-white py-2 rounded font-semibold text-sm transition-all duration-200 cursor-pointer">
                  Choose Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Protecting Nature Section Placeholder --- */}
      <section 
        id="nature" 
        ref={sectionRefs.nature}
        className="w-full py-24 bg-[#eefaf4] text-center"
      >
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-brand-green/10 flex items-center justify-center mb-2">
            <svg className="w-6 h-6 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-zinc-950 tracking-tight">
            Over 1.5 Million Trees Saved Since Inception
          </h2>
          <p className="text-emerald-800/80 leading-relaxed font-light text-sm md:text-base max-w-xl">
            By shifting to digital invites, Fancy RSVP users protect forests, conserve water, and eliminate waste. A portion of every transaction is donated directly to forest preservation initiatives around the globe.
          </p>
          <button className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-3.5 rounded-md font-semibold tracking-wide transition-all shadow-md hover:shadow-lg mt-2 cursor-pointer">
            Read Our Eco-Pledge
          </button>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="w-full py-12 px-6 bg-zinc-950 text-zinc-400 text-center border-t border-zinc-900 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-sans font-bold tracking-[0.2em] text-white">
            FANCY<span className="text-zinc-700">|</span>RSVP
          </span>
          <p className="font-light">
            © {new Date().getFullYear()} Fancy RSVP Validation project. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
