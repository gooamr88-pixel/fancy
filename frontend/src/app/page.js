"use client";

import React, { useState, useEffect, useRef } from "react";
import { startSynth, stopSynth } from "./utils/synth";

// --- Custom SVGs for Feature Icons ---
const FeatureIcon = ({ name, className = "w-7 h-7 text-brand-green" }) => {
  switch (name) {
    case "personalization":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-personalization">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122l.18-.362a6.03 6.03 0 012.438-2.438l.362-.18a6.03 6.03 0 002.438-2.438l.18-.362m-9.028 5.776L3 19.5m0 0l.5-2.236m-.5 2.236l2.236-.5m10.764-10.764l1.196-1.196a1.875 1.875 0 112.652 2.652L17.29 8.79M13.25 5.697l2.236-2.236a1.875 1.875 0 012.652 0l2.651 2.651a1.875 1.875 0 010 2.652l-2.236 2.236m-13.5 10.5l12.62-12.62" />
        </svg>
      );
    case "guest-list":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-guest-list">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h1" />
        </svg>
      );
    case "messaging":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-messaging">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9s.25 0 .25.25v5.003c0 .25-.25.25-.25.25h-9s-.25 0-.25-.25V8.5c0-.25.25-.25.25-.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48L4.5 19.5l3.375-.75A8.96 8.96 0 0012 20.25z" />
        </svg>
      );
    case "address":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-address">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      );
    case "track-rsvps":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-track">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h3.75a2.25 2.25 0 012.25 2.25v15a2.25 2.25 0 01-2.25 2.25h-3.75a2.25 2.25 0 01-2.25-2.25v-15a2.25 2.25 0 012.25-2.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 6h1.5m-1.5 3h1.5m-1.5 3h1.5m-1.5 3h1.5m-1.5 3h1.5" />
        </svg>
      );
    case "survey":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-survey">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      );
    case "updates":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-updates">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      );
    case "reminders":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} id="icon-reminders">
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
    <div className="flex items-end gap-[3px] h-5 w-9 px-1">
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-2.5 ${isPlaying ? "animate-wave-1" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-4 ${isPlaying ? "animate-wave-2" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-5 ${isPlaying ? "animate-wave-3" : "h-1.5"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-3 ${isPlaying ? "animate-wave-4" : "h-1"}`}></div>
      <div className={`w-[3px] bg-brand-green rounded-full origin-bottom h-2.5 ${isPlaying ? "animate-wave-5" : "h-1"}`}></div>
    </div>
  );
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [subHeaderSticky, setSubHeaderSticky] = useState(false);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);

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

  // Carousel & Design States
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Testimonial slider state
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  // Accordion FAQ state
  const [openFaq, setOpenFaq] = useState(null);

  // RSVP Simulator Guest State
  const [guests, setGuests] = useState([
    { id: 1, name: "Marcus Sterling", status: "Accepted", meal: "Filet Mignon", diet: "Gluten-Free", plusOne: "Elena Sterling", timestamp: "5m ago" },
    { id: 2, name: "Dr. Clara Barton", status: "Accepted", meal: "Truffle Risotto", diet: "Vegan", plusOne: "None", timestamp: "45m ago" },
    { id: 3, name: "Vikram Sen", status: "Declined", meal: "None", diet: "None", plusOne: "None", timestamp: "2h ago" },
    { id: 4, name: "Natalie Dupont", status: "Accepted", meal: "Herb Crusted Salmon", diet: "Nut-Free", plusOne: "None", timestamp: "5h ago" }
  ]);

  const [guestForm, setGuestForm] = useState({
    name: "",
    status: "Accepted",
    meal: "Herb Crusted Salmon",
    diet: [],
    plusOneToggle: false,
    plusOneName: "",
  });

  const [simulatedRSVPSubmitted, setSimulatedRSVPSubmitted] = useState(false);

  // Card theme states for secondary carousel
  const [chicStripesColor, setChicStripesColor] = useState("navy");
  const [fireworksColor, setFireworksColor] = useState("red");
  const [remembranceColor, setRemembranceColor] = useState("white");

  // Flip states for secondary cards
  const [flippedCards, setFlippedCards] = useState({
    chic: false,
    fireworks: false,
    remembrance: false,
  });

  const subHeaderRef = useRef(null);
  const sectionRefs = {
    overview: useRef(null),
    customizer: useRef(null),
    features: useRef(null),
    simulator: useRef(null),
    designs: useRef(null),
    pricing: useRef(null),
    nature: useRef(null),
  };

  // Dark Mode Initializer
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDark = localStorage.getItem("darkMode") === "true" ||
                        (!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDarkMode(savedDark);
      if (savedDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", String(nextDark));
      if (nextDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  // Scroll Spy and Sticky Sub-Nav
  useEffect(() => {
    const handleScroll = () => {
      if (subHeaderRef.current) {
        const offset = subHeaderRef.current.offsetTop;
        if (window.scrollY >= offset - 80) {
          setSubHeaderSticky(true);
        } else {
          setSubHeaderSticky(false);
        }
      }

      const scrollPosition = window.scrollY + 280;
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

  const scrollToSection = (sectionId) => {
    const ref = sectionRefs[sectionId]?.current;
    if (ref) {
      const offsetTop = ref.offsetTop - 110;
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

  // Guest RSVP submission simulation
  const handleSimulatedRSVP = (e) => {
    e.preventDefault();
    if (!guestForm.name.trim()) return;

    const newGuest = {
      id: Date.now(),
      name: guestForm.name,
      status: guestForm.status,
      meal: guestForm.status === "Accepted" ? guestForm.meal : "None",
      diet: guestForm.diet.length > 0 ? guestForm.diet.join(", ") : "None",
      plusOne: guestForm.plusOneToggle ? (guestForm.plusOneName || "Guest") : "None",
      timestamp: "Just now"
    };

    setGuests([newGuest, ...guests]);
    setSimulatedRSVPSubmitted(true);

    // Reset Form (keep name empty for next guest)
    setTimeout(() => {
      setSimulatedRSVPSubmitted(false);
      setGuestForm({
        name: "",
        status: "Accepted",
        meal: "Herb Crusted Salmon",
        diet: [],
        plusOneToggle: false,
        plusOneName: "",
      });
    }, 4000);
  };

  const handleDietToggle = (dietVal) => {
    setGuestForm(prev => {
      const currentDiets = [...prev.diet];
      if (currentDiets.includes(dietVal)) {
        return { ...prev, diet: currentDiets.filter(d => d !== dietVal) };
      } else {
        return { ...prev, diet: [...currentDiets, dietVal] };
      }
    });
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

  // Testimonials list
  const testimonials = [
    {
      quote: "Fancy RSVP was a complete game-changer for our wedding. The opening envelope visual set such an elegant, exclusive tone, and the Web Audio background synthesizer arpeggios had everyone talking before they even clicked attend!",
      author: "Eleanor & James Vance",
      tag: "Wedding Suite"
    },
    {
      quote: "The automated address validation saved us countless bouncebacks. Having all dietary preferences and meal options updated in a real-time graph made event catering planning completely stress-free.",
      author: "Marcus Chen, Creative Lead",
      tag: "Corporate Charity Gala"
    },
    {
      quote: "Finally, a way to invite guests sustainably without sacrificing design aesthetics. Our baby shower invitations felt incredibly personal, high-end, and saved trees while doing it.",
      author: "Sienna & Lucas Keller",
      tag: "Baby Shower Suite"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-brand-green/20 selection:text-brand-green transition-colors duration-300 relative overflow-x-hidden">
      
      {/* Floating Organic Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[8%] left-[-12%] w-[40rem] h-[40rem] rounded-full bg-emerald-100/30 dark:bg-emerald-950/15 filter blur-3xl animate-float-1"></div>
        <div className="absolute top-[35%] right-[-10%] w-[45rem] h-[45rem] rounded-full bg-amber-100/20 dark:bg-amber-900/10 filter blur-3xl animate-float-2"></div>
        <div className="absolute bottom-[8%] left-[8%] w-[32rem] h-[32rem] rounded-full bg-teal-100/15 dark:bg-teal-900/10 filter blur-3xl animate-float-3"></div>
      </div>

      {/* --- Main Header / Navigation --- */}
      <header className="w-full bg-nav-bg border-b border-card-border/40 py-5 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50 transition-all duration-300 backdrop-blur-md">
        <div className="flex items-center gap-1 z-10">
          <span className="font-sans text-xl md:text-2xl font-bold tracking-[0.3em] text-brand-green hover:opacity-90 transition-all cursor-pointer flex items-center">
            FANCY<span className="font-light text-amber-500/75 mx-1.5">|</span>RSVP
          </span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8 z-10">
          {/* Theme switcher */}
          <button 
            onClick={toggleDarkMode}
            className="p-2.5 rounded-full hover:bg-card-border/20 transition-all cursor-pointer text-foreground hover:scale-105 active:scale-95"
            aria-label="Toggle Dark Mode"
            id="theme-toggle"
          >
            {darkMode ? (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <a href="#login" className="text-muted-text hover:text-brand-green font-medium text-sm md:text-base transition-colors">
            Log In
          </a>
          <button 
            onClick={() => scrollToSection("customizer")}
            className="bg-brand-green hover:bg-brand-green-hover text-white px-5.5 py-2.5 rounded-md font-semibold text-sm md:text-base transition-all shadow-md hover:shadow-lg active:scale-[0.98] border-b-2 border-emerald-700 cursor-pointer"
            id="header-cta"
          >
            Design Live
          </button>
        </div>
      </header>

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
                  <h4 className="font-bold text-emerald-950 dark:text-emerald-200">Awesome, let's get started!</h4>
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

      {/* --- Sticky Sub-Navigation Bar --- */}
      <div 
        ref={subHeaderRef}
        className={`w-full bg-card-bg border-y border-card-border/40 transition-all duration-300 z-40 ${
          subHeaderSticky ? "fixed top-[71px] left-0 shadow-md" : "relative"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center h-16">
          <nav className="flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar scroll-smooth">
            {[
              { id: "overview", label: "Overview" },
              { id: "customizer", label: "Design Deck" },
              { id: "features", label: "Features" },
              { id: "simulator", label: "RSVP Simulator" },
              { id: "designs", label: "Suites" },
              { id: "pricing", label: "Pricing" },
              { id: "nature", label: "Nature" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className={`h-16 flex items-center border-b-2 font-semibold text-sm md:text-base tracking-wide transition-all px-1 shrink-0 cursor-pointer ${
                  activeSection === tab.id
                    ? "border-brand-green text-brand-green font-bold"
                    : "border-transparent text-muted-text hover:text-foreground"
                }`}
                id={`nav-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          
          {subHeaderSticky && (
            <button 
              onClick={() => scrollToSection("customizer")}
              className="bg-brand-green hover:bg-brand-green-hover text-white px-4.5 py-2 rounded-md font-semibold text-xs md:text-sm transition-all shadow active:scale-[0.98] border-b border-emerald-700 cursor-pointer"
              id="sticky-cta"
            >
              Design Suite
            </button>
          )}
        </div>
      </div>

      {/* --- Overview Section --- */}
      <section 
        id="overview" 
        ref={sectionRefs.overview}
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
        ref={sectionRefs.customizer}
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

      {/* --- Features Section --- */}
      <section 
        id="features" 
        ref={sectionRefs.features}
        className="w-full py-28 bg-sec-bg/20 border-b border-card-border/40"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Full Host Toolkit</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-foreground">
              Powerful Features to Customize &amp; Track
            </h2>
            <div className="w-12 h-0.5 bg-brand-green mx-auto rounded-full mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {[
              {
                id: "personalization",
                title: "Personalization Studio",
                desc: "Select layout structure, background textures, envelope designs, liners, wax seals, and font styles to perfectly fit your vibe.",
              },
              {
                id: "guest-list",
                title: "Address Book Import",
                desc: "Quickly import lists from Excel, Google Sheets, or CSV, or select contacts from your Fancy RSVP history.",
              },
              {
                id: "messaging",
                title: "Instant Guest Messages",
                desc: "Broadcast notifications or alerts to your entire guest list, selected tables, or only attendees who haven't RSVP'd yet.",
              },
              {
                id: "address",
                title: "Address Validation",
                desc: "Our automated delivery checker flags incorrect domain configurations or typos before sending, guaranteeing clean delivery.",
              },
              {
                id: "track-rsvps",
                title: "Real-Time Tracking",
                desc: "Get instantaneous live metrics as guests open their invitations, accept or decline, and submit questionnaire details.",
              },
              {
                id: "survey",
                title: "Custom Survey Queries",
                desc: "Add queries like 'Meal Choice?' or 'Song Requests?' to capture the critical details you need for your seating charts.",
              },
              {
                id: "updates",
                title: "Daily Summaries",
                desc: "Subscribe to receive daily or weekly digest summaries directly to your email, without needing to sign into the dashboard.",
              },
              {
                id: "reminders",
                title: "Automated Reminders",
                desc: "Schedule polite automatic follow-up emails targeting guests who haven't opened or responded to invitations yet.",
              },
            ].map((feat, index) => (
              <div 
                key={feat.id} 
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-card-border/50 bg-card-bg hover:border-brand-green/30 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group cursor-pointer"
                id={`feature-card-${feat.id}`}
              >
                <div className="w-14 h-14 bg-brand-green/5 dark:bg-brand-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-115 transition-transform duration-350 shadow-sm border border-brand-green/10">
                  <FeatureIcon name={feat.id} className="w-7 h-7 text-brand-green" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-3 tracking-wide">
                  {feat.title}
                </h3>
                <p className="text-muted-text text-sm leading-relaxed font-light">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- GUEST VS HOST EXPERIENCE SIMULATOR --- */}
      <section 
        id="simulator" 
        ref={sectionRefs.simulator}
        className="w-full py-28 bg-card-bg border-b border-card-border/40 relative"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Simulate Live Flow</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-foreground">
              Experience Guest RSVP &amp; Host Dashboard Side-by-Side
            </h2>
            <p className="text-muted-text font-light text-sm md:text-base mt-2">
              Fill out the guest form on the left, click submit, and watch the host organizer's dashboard on the right update instantly in real time!
            </p>
            <div className="w-12 h-0.5 bg-brand-green mx-auto rounded-full mt-4"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-stretch">
            
            {/* Guest Perspective - Left Column (Simulated Phone) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <span className="text-xs font-bold text-muted-text/80 uppercase tracking-widest mb-3">📱 Guest View (Mobile)</span>
              
              <div className="w-full max-w-[340px] border-[8px] border-zinc-800 dark:border-zinc-700 rounded-[2.5rem] bg-card-bg shadow-2xl p-6 relative flex flex-col justify-between overflow-hidden" style={{ minHeight: "530px" }}>
                {/* Speaker & camera mock */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-850 dark:bg-zinc-800 rounded-full flex items-center justify-center gap-1.5 px-3 z-30">
                  <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></div>
                  <div className="w-8 h-1 bg-zinc-650 rounded-full"></div>
                </div>

                {simulatedRSVPSubmitted ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in p-4 mt-4">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mb-4 text-brand-green border border-brand-green/20">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="font-serif text-lg font-bold text-foreground">RSVP Saved!</h4>
                    <p className="text-xs text-muted-text mt-2">
                      Thank you! Your response has been securely saved. The organizer's live dashboard has been updated.
                    </p>
                    <span className="text-[10px] text-brand-green font-semibold mt-4">Resetting simulator...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSimulatedRSVP} className="flex-1 flex flex-col justify-between gap-4 mt-6">
                    <div>
                      <div className="border-b border-card-border pb-2 mb-3 text-center">
                        <span className="font-serif italic text-[10.5px] text-brand-green uppercase tracking-wide">Aria &amp; Julian's Wedding</span>
                        <h4 className="text-xs font-semibold text-foreground mt-1">Guest RSVP Form</h4>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label htmlFor="sim-name" className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Full Name</label>
                          <input 
                            id="sim-name"
                            required
                            type="text" 
                            placeholder="e.g. Samuel Finch"
                            value={guestForm.name}
                            onChange={(e) => setGuestForm({...guestForm, name: e.target.value})}
                            className="px-3 py-2 border border-card-border rounded-lg bg-sec-bg/30 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-brand-green"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-1">Will You Attend?</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setGuestForm({...guestForm, status: "Accepted"})}
                              className={`py-2 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                                guestForm.status === "Accepted" 
                                  ? "bg-brand-green/10 border-brand-green text-brand-green font-bold shadow-sm" 
                                  : "border-card-border bg-card-bg text-muted-text"
                              }`}
                              id="sim-attend-yes"
                            >
                              Accepts
                            </button>
                            <button
                              type="button"
                              onClick={() => setGuestForm({...guestForm, status: "Declined"})}
                              className={`py-2 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                                guestForm.status === "Declined" 
                                  ? "bg-red-500/10 border-red-500 text-red-550 font-bold shadow-sm" 
                                  : "border-card-border bg-card-bg text-muted-text"
                              }`}
                              id="sim-attend-no"
                            >
                              Declines
                            </button>
                          </div>
                        </div>

                        {guestForm.status === "Accepted" && (
                          <div className="flex flex-col gap-3 animate-fade-in">
                            <div className="flex flex-col gap-1">
                              <label htmlFor="sim-meal" className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Meal Choice</label>
                              <select 
                                id="sim-meal"
                                value={guestForm.meal}
                                onChange={(e) => setGuestForm({...guestForm, meal: e.target.value})}
                                className="px-2.5 py-2 border border-card-border rounded-lg bg-card-bg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-brand-green cursor-pointer"
                              >
                                <option>Herb Crusted Salmon</option>
                                <option>Filet Mignon</option>
                                <option>Truffle Risotto</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1.5 border border-card-border/50 p-2.5 rounded-lg bg-sec-bg/25">
                              <div className="flex items-center justify-between">
                                <label htmlFor="sim-plusone-toggle" className="text-[10px] font-bold text-muted-text uppercase tracking-wider cursor-pointer">Register a Plus One?</label>
                                <input 
                                  id="sim-plusone-toggle"
                                  type="checkbox"
                                  checked={guestForm.plusOneToggle}
                                  onChange={(e) => setGuestForm({...guestForm, plusOneToggle: e.target.checked})}
                                  className="w-3.5 h-3.5 accent-brand-green cursor-pointer"
                                />
                              </div>
                              {guestForm.plusOneToggle && (
                                <input 
                                  required
                                  type="text" 
                                  placeholder="Plus One Full Name"
                                  value={guestForm.plusOneName}
                                  onChange={(e) => setGuestForm({...guestForm, plusOneName: e.target.value})}
                                  className="px-2.5 py-1.5 border border-card-border rounded-lg bg-card-bg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-brand-green mt-1.5 animate-fade-in"
                                  id="sim-plusone-name"
                                />
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Dietary Requirements</span>
                              <div className="flex flex-wrap gap-2">
                                {["Gluten-Free", "Vegan", "Nut-Free"].map((diet) => (
                                  <button
                                    key={diet}
                                    type="button"
                                    onClick={() => handleDietToggle(diet)}
                                    className={`px-3 py-1 border rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                                      guestForm.diet.includes(diet) 
                                        ? "bg-brand-green text-white border-brand-green shadow-sm" 
                                        : "border-card-border bg-card-bg text-muted-text"
                                    }`}
                                    id={`sim-diet-${diet}`}
                                  >
                                    {diet}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-brand-green hover:bg-brand-green-hover text-white py-2.5 rounded-lg font-bold text-xs shadow-md active:scale-98 transition-all border-b-2 border-emerald-700 cursor-pointer"
                      id="sim-submit-rsvp"
                    >
                      Submit Response
                    </button>
                  </form>
                )}
                
                {/* Home Indicator */}
                <div className="w-16 h-1 bg-zinc-350 dark:bg-zinc-700 rounded-full mx-auto mt-4 opacity-50 shrink-0"></div>
              </div>
            </div>

            {/* Host Perspective - Right Column (Simulated Admin Panel) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <span className="text-xs font-bold text-muted-text/80 uppercase tracking-widest mb-3">💻 Host Dashboard (Desktop)</span>
              
              <div className="w-full border border-card-border rounded-2xl bg-card-bg shadow-2xl p-6 flex flex-col gap-6" style={{ minHeight: "530px" }}>
                
                {/* Header info */}
                <div className="flex justify-between items-center border-b border-card-border/60 pb-3">
                  <div>
                    <h4 className="font-serif font-normal text-lg text-foreground">Aria &amp; Julian's Wedding</h4>
                    <p className="text-[10px] text-muted-text">Live RSVP Organizer Analytics Dashboard</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-brand-green text-[10px] font-bold border border-emerald-100/50 dark:border-emerald-900/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
                    Live Syncing
                  </span>
                </div>

                {/* Counters Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total RSVPs", count: guests.length, color: "text-foreground" },
                    { label: "Attending", count: guests.filter(g => g.status === "Accepted").length, color: "text-brand-green" },
                    { label: "Declines", count: guests.filter(g => g.status === "Declined").length, color: "text-red-500" }
                  ].map((counter) => (
                    <div key={counter.label} className="p-3 bg-sec-bg/25 border border-card-border/50 rounded-xl text-center shadow-sm">
                      <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">{counter.label}</span>
                      <span className={`text-2xl font-semibold ${counter.color} block mt-1`}>{counter.count}</span>
                    </div>
                  ))}
                </div>

                {/* Analytics Detail Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Meal Breakdown Charts */}
                  <div className="flex flex-col gap-3">
                    <h5 className="text-[10px] font-bold text-muted-text uppercase tracking-wider border-b border-card-border/40 pb-1">Meal Splits</h5>
                    
                    <div className="flex flex-col gap-3.5 mt-1">
                      {[
                        { name: "Filet Mignon", count: guests.filter(g => g.meal === "Filet Mignon").length },
                        { name: "Herb Crusted Salmon", count: guests.filter(g => g.meal === "Herb Crusted Salmon").length },
                        { name: "Truffle Risotto", count: guests.filter(g => g.meal === "Truffle Risotto").length }
                      ].map((meal) => {
                        const totalAccepted = guests.filter(g => g.status === "Accepted").length;
                        const percentage = totalAccepted > 0 ? (meal.count / totalAccepted) * 100 : 0;
                        return (
                          <div key={meal.name} className="flex flex-col gap-1 text-xs">
                            <div className="flex justify-between font-medium text-foreground">
                              <span>{meal.name}</span>
                              <span className="font-bold">{meal.count} <span className="text-[10px] text-muted-text font-normal">({Math.round(percentage)}%)</span></span>
                            </div>
                            <div className="w-full h-2 bg-sec-bg rounded-full overflow-hidden border border-card-border/20">
                              <div 
                                className="h-full bg-brand-green rounded-full transition-all duration-750" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dietary Requirements Summary */}
                  <div className="flex flex-col gap-3">
                    <h5 className="text-[10px] font-bold text-muted-text uppercase tracking-wider border-b border-card-border/40 pb-1">Dietary Requirements</h5>
                    
                    <div className="flex flex-wrap gap-2 mt-1">
                      {["Gluten-Free", "Vegan", "Nut-Free"].map((diet) => {
                        const count = guests.filter(g => g.diet.includes(diet)).length;
                        return (
                          <div 
                            key={diet}
                            className="px-3 py-2 bg-sec-bg/40 border border-card-border/40 rounded-xl flex items-center justify-between gap-4 text-xs flex-1 min-w-[100px] shadow-sm"
                          >
                            <span className="font-medium text-foreground">{diet}</span>
                            <span className="w-5 h-5 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green font-bold flex items-center justify-center text-[10px]">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 p-3.5 bg-brand-green/5 border border-brand-green/10 rounded-xl text-[11px] text-brand-green leading-relaxed">
                      💡 <strong>Organizer Summary:</strong> {guests.filter(g => g.plusOne !== "None").length} Plus Ones registered. Total guest seating count is {guests.filter(g => g.status === "Accepted").length + guests.filter(g => g.status === "Accepted" && g.plusOne !== "None").length} seats.
                    </div>
                  </div>
                </div>

                {/* Real-time Guest Feed */}
                <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                  <h5 className="text-[10px] font-bold text-muted-text uppercase tracking-wider border-b border-card-border/40 pb-1">Live Feed</h5>
                  
                  <div className="overflow-y-auto no-scrollbar flex flex-col gap-2 max-h-[140px] pr-1">
                    {guests.map((g) => (
                      <div 
                        key={g.id} 
                        className="p-2 border border-card-border/50 bg-sec-bg/15 rounded-xl flex justify-between items-center text-xs animate-fade-in"
                      >
                        <div className="flex items-center gap-2.5">
                          {/* Circular monogram avatar */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            g.status === "Accepted" ? "bg-emerald-100 text-brand-green" : "bg-red-100 text-red-550"
                          }`}>
                            {g.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-foreground">{g.name}</span>
                            <span className="text-[10px] text-muted-text block leading-none mt-1">
                              {g.status === "Accepted" ? `Meal: ${g.meal} | Plus One: ${g.plusOne}` : "Declined invitation"}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-text font-medium">{g.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- Designs Carousel Section --- */}
      <section 
        id="designs" 
        ref={sectionRefs.designs}
        className="w-full py-28 bg-sec-bg/30 border-b border-card-border/40"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left: Designs Text Column */}
          <div className="lg:col-span-4 flex flex-col gap-6 text-center lg:text-left">
            <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Curated Designer Suites</span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-4.5xl font-normal leading-tight tracking-tight text-stone-900 dark:text-stone-50">
              Thoughtfully Designed, Sustainably Crafted
            </h2>
            <p className="text-muted-text leading-relaxed text-sm md:text-base font-light">
              Our in-house design lab partners with a global network of indie illustrators, calligraphers, and visual artists to curate elegant suites—without the waste. Click the flip button to view the back cover details of each invitation card.
            </p>
            <div className="pt-2">
              <button className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-3.5 rounded-xl font-bold tracking-wide transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer border-b-2 border-emerald-700" id="explore-designs-btn">
                See All Suites (50+)
              </button>
            </div>
          </div>

          {/* Right: Carousel of Envelope Invitations */}
          <div className="lg:col-span-8 w-full relative flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between gap-2 md:gap-4">
              
              {/* Left Arrow */}
              <button 
                onClick={() => setCarouselIndex(prev => prev === 0 ? 1 : 0)}
                className="w-10 h-10 rounded-full border border-card-border bg-card-bg hover:bg-sec-bg shadow-sm flex items-center justify-center text-muted-text hover:text-foreground transition-all z-10 shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                aria-label="Previous Slide"
                id="carousel-prev"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Envelope Cards Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden py-8 px-2">
                
                {/* --- CARD 1: Chic Stripes --- */}
                {carouselIndex === 0 ? (
                  <div className="flex flex-col items-center w-full" id="card-chic-stripes">
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] perspective-1000 group">
                      
                      <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${
                        flippedCards.chic ? "rotate-y-180" : ""
                      }`}>
                        
                        {/* FRONT FACE */}
                        <div className="absolute inset-0 w-full h-full backface-hidden flex flex-col justify-end">
                          <div className="relative w-full h-[80%] flex flex-col justify-end overflow-visible select-none">
                            
                            {/* Envelope Back / liner */}
                            <div className={`absolute bottom-0 w-[95%] h-[85%] rounded-t-md shadow-inner transition-colors duration-500 ${
                              chicStripesColor === "navy" ? "bg-blue-900/10 border-t border-blue-300" :
                              chicStripesColor === "emerald" ? "bg-emerald-900/10 border-t border-emerald-350" :
                              "bg-rose-955/15 border-t border-red-300"
                            }`}>
                              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400 via-yellow-600 to-transparent"></div>
                            </div>

                            {/* Sliding Invitation Card */}
                            <div className="absolute bottom-2 left-[7.5%] w-[85%] aspect-[0.72/1] bg-card-bg shadow-xl rounded-sm p-3 border-t-2 border-amber-300 border-x border-b border-card-border flex flex-col items-center justify-between transition-transform duration-500 ease-out group-hover:-translate-y-20 z-15 bg-paper border-double border-4 border-amber-300/35 shadow-inner">
                              <div className="w-full h-full flex flex-col items-center justify-between py-1 relative">
                                <div className="absolute left-0 top-0 bottom-0 w-2.5 flex flex-col justify-between">
                                  {[...Array(6)].map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-full h-1.5 transition-colors duration-500 ${
                                        chicStripesColor === "navy" ? "bg-blue-900" :
                                        chicStripesColor === "emerald" ? "bg-emerald-800" :
                                        "bg-red-900"
                                      }`}
                                    ></div>
                                  ))}
                                </div>
                                <div className="absolute right-0 top-0 bottom-0 w-2.5 flex flex-col justify-between">
                                  {[...Array(6)].map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-full h-1.5 transition-colors duration-500 ${
                                        chicStripesColor === "navy" ? "bg-blue-900" :
                                        chicStripesColor === "emerald" ? "bg-emerald-800" :
                                        "bg-red-900"
                                      }`}
                                    ></div>
                                  ))}
                                </div>

                                <div className="px-3 text-center flex flex-col items-center justify-center h-full gap-0.5">
                                  <span className="font-serif italic text-[7px] text-muted-text">please join us at</span>
                                  <h4 className="font-serif text-[9px] font-bold text-foreground uppercase tracking-wider leading-none text-center">
                                    HEART GALA &amp; AUCTION
                                  </h4>
                                  <div className="w-6 h-[0.5px] bg-amber-400 my-0.5"></div>
                                  <span className="text-[5.5px] text-muted-text uppercase tracking-widest leading-none font-bold">CYPRESS SPRINGS GRILLE</span>
                                </div>
                              </div>
                            </div>

                            {/* Envelope Front Cover */}
                            <div className="absolute bottom-0 w-full h-[55%] bg-stone-350 dark:bg-stone-750 rounded-b-md shadow-lg z-20 border-t border-stone-200/30">
                              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-b-md"></div>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE */}
                        <div className="absolute inset-0 w-full h-full bg-[#faf9f6] dark:bg-zinc-900 border border-card-border rounded-xl p-4 shadow-xl rotate-y-180 backface-hidden flex flex-col justify-between text-center select-none">
                          <div>
                            <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">Event Details</span>
                            <h4 className="font-serif text-xs font-semibold text-foreground mt-1">Heart Gala 2026</h4>
                            <p className="text-[8.5px] text-muted-text mt-2 font-light leading-relaxed">
                              Join us for our annual fundraising dinner. Enjoy a lovely evening of charity, fine food, and silent auctions.
                            </p>
                          </div>
                          <div className="border-t border-card-border pt-2 flex flex-col gap-1.5">
                            <span className="text-[8.5px] text-foreground font-bold">Dress Code: Black Tie</span>
                            <button className="bg-brand-green text-white text-[9px] font-bold py-1 rounded-lg hover:bg-brand-green-hover transition-colors shadow-sm">
                              Preview RSVP Info
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Flip button */}
                      <button 
                        onClick={() => toggleFlip("chic")}
                        className="absolute top-0 right-0 w-7 h-7 rounded-full bg-card-bg shadow-md border border-card-border hover:border-brand-green flex items-center justify-center text-muted-text hover:text-brand-green transition-all hover:scale-105 active:scale-95 z-30 cursor-pointer"
                        title="Flip Invitation"
                        id="flip-chic"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12c0-1.23.16-2.42.47-3.56L6.5 12h-2zm10.5-3.56c.31 1.14.47 2.33.47 3.56h-2l1.53-3.56z" />
                        </svg>
                      </button>
                    </div>

                    <div className="text-center mt-4 flex flex-col items-center">
                      <h4 className="font-medium text-sm text-foreground tracking-wide">Chic Stripes</h4>
                      <p className="text-muted-text italic text-xs mt-0.5">Jessica Williams Suite</p>

                      <div className="flex gap-1.5 mt-3">
                        {[
                          { id: "navy", color: "bg-blue-900 ring-blue-900/30" },
                          { id: "emerald", color: "bg-emerald-800 ring-emerald-800/30" },
                          { id: "burgundy", color: "bg-red-955 ring-red-950/30" },
                        ].map((dot) => (
                          <button
                            key={dot.id}
                            onClick={() => setChicStripesColor(dot.id)}
                            className={`w-3 h-3 rounded-full transition-all border border-white hover:scale-110 cursor-pointer ${
                              chicStripesColor === dot.id ? `ring-2 ring-offset-1 ${dot.color}` : dot.color.split(" ")[0]
                            }`}
                            id={`chic-color-${dot.id}`}
                          ></button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full" id="card-autumn-leaves">
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] bg-amber-50/20 border border-card-border p-4 flex flex-col justify-between shadow-md hover:shadow-lg rounded-xl transition-all">
                      <div className="aspect-[1.4/1] bg-amber-100 dark:bg-amber-950/40 rounded-lg flex items-center justify-center text-amber-800 dark:text-amber-300 font-serif text-[9px] tracking-widest uppercase shadow-inner border border-amber-300/20">
                        Harvest Invite
                      </div>
                      <div className="text-center mt-2">
                        <h4 className="font-semibold text-xs text-foreground">Autumn Leaves</h4>
                        <p className="text-muted-text italic text-[10px] mt-0.5">Grace Harlow Suite</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- CARD 2: Classic Fireworks --- */}
                {carouselIndex === 0 ? (
                  <div className="flex flex-col items-center w-full" id="card-classic-fireworks">
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] perspective-1000 group">
                      
                      <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${
                        flippedCards.fireworks ? "rotate-y-180" : ""
                      }`}>
                        
                        {/* FRONT FACE */}
                        <div className="absolute inset-0 w-full h-full backface-hidden flex flex-col justify-end">
                          <div className="relative w-full h-[80%] flex flex-col justify-end overflow-visible select-none">
                            
                            {/* Envelope Back / Liner */}
                            <div className={`absolute bottom-0 w-[95%] h-[85%] rounded-t-md shadow-inner transition-colors duration-500 ${
                              fireworksColor === "red" ? "bg-red-950/20 border-t border-red-900" :
                              "bg-blue-955/20 border-t border-blue-900"
                            }`}>
                              <div className="absolute inset-0 opacity-35 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-400 via-zinc-800 to-transparent"></div>
                            </div>

                            {/* Sliding Invitation Card */}
                            <div className="absolute bottom-2 left-[7.5%] w-[85%] aspect-[0.72/1] bg-[#09090b] shadow-xl rounded-sm p-3 border border-zinc-850 flex flex-col items-center justify-between transition-transform duration-500 ease-out group-hover:-translate-y-20 z-15 overflow-hidden border-double border-4 border-amber-300/35 shadow-inner">
                              <div className="absolute inset-0 bg-black pointer-events-none opacity-40">
                                <div className="absolute top-2 left-6 w-12 h-12 border border-dashed border-red-500/20 rounded-full animate-ping"></div>
                                <div className="absolute top-3 right-4 w-10 h-10 border border-dashed border-yellow-500/25 rounded-full animate-ping duration-1000"></div>
                              </div>

                              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-0.5 py-1 text-slate-100">
                                <h4 className="font-serif italic text-base text-yellow-300 leading-none">Midnight</h4>
                                <span className="text-[6px] tracking-widest font-sans uppercase">NYE Celebration</span>
                                <div className="w-5 h-[0.5px] bg-red-550 my-0.5"></div>
                                <span className="text-[5px] text-slate-400 tracking-widest leading-none">8:00 PM EST</span>
                              </div>
                            </div>

                            {/* Envelope Front Cover */}
                            <div className="absolute bottom-0 w-full h-[55%] bg-stone-300 dark:bg-stone-700 rounded-b-md shadow-lg z-20 border-t border-stone-200/30">
                              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-b-md"></div>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE */}
                        <div className="absolute inset-0 w-full h-full bg-[#faf9f6] dark:bg-zinc-900 border border-card-border rounded-xl p-4 shadow-xl rotate-y-180 backface-hidden flex flex-col justify-between text-center select-none">
                          <div>
                            <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">New Year's Eve</span>
                            <h4 className="font-serif text-xs font-semibold text-foreground mt-1">NYE Toast 2026</h4>
                            <p className="text-[8.5px] text-muted-text mt-2 font-light leading-relaxed">
                              Ring in the new year with premium bubbles, dynamic firework viewings, and midnight toasts. RSVP needed by Dec 15.
                            </p>
                          </div>
                          <div className="border-t border-card-border pt-2 flex flex-col gap-1.5">
                            <span className="text-[8.5px] text-foreground font-bold">Midnight Champagne toast</span>
                            <button className="bg-brand-green text-white text-[9px] font-bold py-1 rounded-lg hover:bg-brand-green-hover transition-colors shadow-sm">
                              Reserve Spot
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Flip button */}
                      <button 
                        onClick={() => toggleFlip("fireworks")}
                        className="absolute top-0 right-0 w-7 h-7 rounded-full bg-card-bg shadow-md border border-card-border hover:border-brand-green flex items-center justify-center text-muted-text hover:text-brand-green transition-all hover:scale-105 active:scale-95 z-30 cursor-pointer"
                        title="Flip Invitation"
                        id="flip-fireworks"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12c0-1.23.16-2.42.47-3.56L6.5 12h-2zm10.5-3.56c.31 1.14.47 2.33.47 3.56h-2l1.53-3.56z" />
                        </svg>
                      </button>
                    </div>

                    <div className="text-center mt-4 flex flex-col items-center">
                      <h4 className="font-medium text-sm text-foreground tracking-wide">Classic Fireworks</h4>
                      <p className="text-muted-text italic text-xs mt-0.5">Laura Bolter Suite</p>

                      <div className="flex gap-1.5 mt-3">
                        {[
                          { id: "red", color: "bg-red-700 ring-red-700/30" },
                          { id: "blue", color: "bg-blue-700 ring-blue-700/30" },
                        ].map((dot) => (
                          <button
                            key={dot.id}
                            onClick={() => setFireworksColor(dot.id)}
                            className={`w-3 h-3 rounded-full transition-all border border-white hover:scale-110 cursor-pointer ${
                              fireworksColor === dot.id ? `ring-2 ring-offset-1 ${dot.color}` : dot.color.split(" ")[0]
                            }`}
                            id={`firework-color-${dot.id}`}
                          ></button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full" id="card-snowy-night">
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] bg-sky-50/20 border border-card-border p-4 flex flex-col justify-between shadow-md hover:shadow-lg rounded-xl transition-all">
                      <div className="aspect-[1.4/1] bg-sky-100 dark:bg-sky-950/45 rounded-lg flex items-center justify-center text-sky-800 dark:text-sky-300 font-serif text-[9px] tracking-widest uppercase shadow-inner border border-sky-300/20">
                        Winter Gala
                      </div>
                      <div className="text-center mt-2">
                        <h4 className="font-semibold text-xs text-foreground">Snowy Night</h4>
                        <p className="text-muted-text italic text-[10px] mt-0.5">Ethan Pierce Suite</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- CARD 3: Remembrance --- */}
                {carouselIndex === 0 ? (
                  <div className="flex flex-col items-center w-full" id="card-remembrance">
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] perspective-1000 group">
                      
                      <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${
                        flippedCards.remembrance ? "rotate-y-180" : ""
                      }`}>
                        
                        {/* FRONT FACE */}
                        <div className="absolute inset-0 w-full h-full backface-hidden flex flex-col justify-end">
                          <div className="relative w-full h-[80%] flex flex-col justify-end overflow-visible select-none">
                            
                            {/* Envelope Back */}
                            <div className="absolute bottom-0 w-[95%] h-[85%] bg-stone-100 dark:bg-stone-850 rounded-t-md border-t border-stone-200 dark:border-stone-700 shadow-inner"></div>

                            {/* Sliding Invitation Card */}
                            <div className="absolute bottom-2 left-[7.5%] w-[85%] aspect-[0.72/1] bg-[#fafafa] dark:bg-zinc-800 shadow-xl rounded-sm p-2 border border-stone-200 dark:border-zinc-700 flex flex-col items-center justify-between transition-transform duration-500 ease-out group-hover:-translate-y-20 z-15 bg-paper border-double border-4 border-amber-300/35 shadow-inner">
                              <div className="w-full flex-1 relative bg-zinc-200 dark:bg-zinc-700 rounded-sm mb-1.5 overflow-hidden flex items-center justify-center">
                                <div className={`absolute inset-0 bg-gradient-to-br from-zinc-400 to-zinc-550 flex flex-col items-center justify-center text-white/90 p-1 text-center transition-all ${
                                  remembranceColor === "sepia" ? "sepia saturate-120" :
                                  remembranceColor === "cool" ? "hue-rotate-15" : ""
                                }`}>
                                  <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159" />
                                  </svg>
                                </div>
                              </div>

                              <div className="w-full text-center flex flex-col items-center gap-0.5">
                                <span className="font-serif italic text-[6.5px] text-muted-text">in remembrance of</span>
                                <h4 className="font-serif text-[8.5px] font-bold text-foreground tracking-wide uppercase leading-none">
                                  Deborah Wilson
                                </h4>
                              </div>
                            </div>

                            {/* Envelope Front Cover */}
                            <div className={`absolute bottom-0 w-full h-[55%] rounded-b-md shadow-lg z-20 border-t ${
                              remembranceColor === "white" ? "bg-stone-200 dark:bg-zinc-700 border-stone-300 dark:border-zinc-650" :
                              remembranceColor === "sage" ? "bg-[#b8cfc2] border-[#a5c0b1]" :
                              "bg-slate-700 border-slate-650"
                            }`}>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-b-md"></div>
                            </div>
                          </div>
                        </div>

                        {/* BACK FACE */}
                        <div className="absolute inset-0 w-full h-full bg-[#faf9f6] dark:bg-zinc-900 border border-card-border rounded-xl p-4 shadow-xl rotate-y-180 backface-hidden flex flex-col justify-between text-center select-none">
                          <div>
                            <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">Memorial Service</span>
                            <h4 className="font-serif text-xs font-semibold text-foreground mt-1">Celebrating Deborah</h4>
                            <p className="text-[8.5px] text-muted-text mt-2 font-light leading-relaxed">
                              Join us to share stories, honor memory, and celebrate the beautiful life of Deborah. Reception at the family residence.
                            </p>
                          </div>
                          <div className="border-t border-card-border pt-2 flex flex-col gap-1.5">
                            <span className="text-[8.5px] text-foreground font-bold">June 15 at 1:00 PM</span>
                            <button className="bg-brand-green text-white text-[9px] font-bold py-1 rounded-lg hover:bg-brand-green-hover transition-colors shadow-sm">
                              Send Memory details
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Flip button */}
                      <button 
                        onClick={() => toggleFlip("remembrance")}
                        className="absolute top-0 right-0 w-7 h-7 rounded-full bg-card-bg shadow-md border border-card-border hover:border-brand-green flex items-center justify-center text-muted-text hover:text-brand-green transition-all hover:scale-105 active:scale-95 z-30 cursor-pointer"
                        title="Flip Invitation"
                        id="flip-remembrance"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12c0-1.23.16-2.42.47-3.56L6.5 12h-2zm10.5-3.56c.31 1.14.47 2.33.47 3.56h-2l1.53-3.56z" />
                        </svg>
                      </button>
                    </div>

                    <div className="text-center mt-4 flex flex-col items-center">
                      <h4 className="font-medium text-sm text-foreground tracking-wide">Remembrance</h4>
                      <p className="text-muted-text italic text-xs mt-0.5">Ann Gardner Suite</p>

                      <div className="flex gap-1.5 mt-3">
                        {[
                          { id: "white", color: "bg-stone-50 border-stone-350 ring-stone-300/40" },
                          { id: "sage", color: "bg-[#b8cfc2] ring-[#b8cfc2]/40" },
                          { id: "navy", color: "bg-slate-700 ring-slate-700/40" },
                        ].map((dot) => (
                          <button
                            key={dot.id}
                            onClick={() => setRemembranceColor(dot.id)}
                            className={`w-3 h-3 rounded-full transition-all border hover:scale-110 cursor-pointer ${
                              remembranceColor === dot.id ? `ring-2 ring-offset-1 ${dot.color}` : dot.color.split(" ")[0]
                            }`}
                            id={`remembrance-color-${dot.id}`}
                          ></button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full" id="card-circus-party">
                    <div className="relative w-full max-w-[200px] aspect-[0.75/1] bg-yellow-50/20 border border-card-border p-4 flex flex-col justify-between shadow-md hover:shadow-lg rounded-xl transition-all">
                      <div className="aspect-[1.4/1] bg-yellow-100 dark:bg-yellow-950/40 rounded-lg flex items-center justify-center text-yellow-800 dark:text-yellow-355 font-serif text-[9px] tracking-widest uppercase shadow-inner border border-yellow-300/20">
                        Birthday Invite
                      </div>
                      <div className="text-center mt-2">
                        <h4 className="font-semibold text-xs text-foreground">Circus Party</h4>
                        <p className="text-muted-text italic text-[10px] mt-0.5">Mason Vance Suite</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Arrow */}
              <button 
                onClick={() => setCarouselIndex(prev => prev === 0 ? 1 : 0)}
                className="w-10 h-10 rounded-full border border-card-border bg-card-bg hover:bg-sec-bg shadow-sm flex items-center justify-center text-muted-text hover:text-foreground transition-all z-10 shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                aria-label="Next Slide"
                id="carousel-next-btn"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

            </div>

            <div className="flex gap-2 mt-8">
              {[0, 1].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    carouselIndex === idx ? "w-6 bg-brand-green" : "bg-card-border hover:bg-muted-text"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                  id={`carousel-dot-${idx}`}
                ></button>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* --- TESTIMONIALS SLIDER SECTION --- */}
      <section className="w-full py-28 bg-card-bg border-b border-card-border/40">
        <div className="max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Customer Stories</span>
          <h2 className="font-serif text-3xl font-normal text-foreground mt-2 mb-12">What Hosts Say</h2>
          
          <div className="w-full min-h-[180px] flex flex-col justify-between items-center relative">
            
            {/* Sliding quote */}
            <div className="animate-fade-in flex flex-col items-center gap-6" key={testimonialIdx}>
              <p className="font-serif text-xl md:text-2xl text-foreground italic leading-relaxed max-w-3xl text-center">
                “{testimonials[testimonialIdx].quote}”
              </p>
              <div>
                <h4 className="font-bold text-sm text-foreground">{testimonials[testimonialIdx].author}</h4>
                <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider mt-1 block">
                  {testimonials[testimonialIdx].tag}
                </span>
              </div>
            </div>
            
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setTestimonialIdx(prev => prev === 0 ? testimonials.length - 1 : prev - 1)}
              className="w-9 h-9 border border-card-border rounded-full hover:bg-sec-bg/50 flex items-center justify-center text-muted-text hover:text-foreground transition-all cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Previous Testimonial"
              id="testimonial-prev"
            >
              ←
            </button>
            <button
              onClick={() => setTestimonialIdx(prev => (prev + 1) % testimonials.length)}
              className="w-9 h-9 border border-card-border rounded-full hover:bg-sec-bg/50 flex items-center justify-center text-muted-text hover:text-foreground transition-all cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Next Testimonial"
              id="testimonial-next"
            >
              →
            </button>
          </div>
        </div>
      </section>

      {/* --- Pricing Section --- */}
      <section 
        id="pricing" 
        ref={sectionRefs.pricing}
        className="w-full py-28 bg-sec-bg/10 border-b border-card-border/40 text-center"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col items-center gap-6">
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Simple Tier Pricing</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
            Simple, Flat Rate Pricing Packages
          </h2>
          <p className="text-muted-text leading-relaxed max-w-xl font-light text-sm md:text-base">
            No subscription loops. Pay only for the specific events you construct. Every package includes full 3D customizers, stamps, and music tools.
          </p>
          
          <div className="mt-8 flex flex-wrap justify-center gap-6 w-full max-w-5xl">
            {[
              { title: "Single Celebration", price: "19", limit: "Up to 50 guests", desc: "Perfect for intimate birthdays, baby showers, or dinner dinner parties.", color: "border-card-border bg-card-bg" },
              { title: "Grand Premier", price: "49", limit: "Up to 250 guests", desc: "Our most popular tier. Designed for weddings, reunions, and anniversary dinners.", color: "border-brand-green bg-card-bg shadow-lg relative" },
              { title: "Enterprise Suite", price: "199", limit: "Unlimited guests", desc: "Designed for premium corporations, non-profits, and large-scale charity galas.", color: "border-card-border bg-card-bg" }
            ].map((pkg) => (
              <div 
                key={pkg.title} 
                className={`p-8 rounded-2xl border hover:-translate-y-2 hover:shadow-xl transition-all duration-300 w-full md:w-80 text-center flex flex-col justify-between ${pkg.color}`}
                id={`price-card-${pkg.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {pkg.title === "Grand Premier" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-green text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                    Most Popular
                  </span>
                )}
                <div>
                  <h4 className="font-bold text-xs uppercase text-muted-text tracking-widest">{pkg.title}</h4>
                  <p className="font-serif text-4xl font-semibold mt-4 text-foreground">${pkg.price}</p>
                  <span className="text-[10px] text-brand-green font-bold block mt-1">{pkg.limit}</span>
                  <p className="text-xs text-muted-text mt-3 leading-relaxed font-light">{pkg.desc}</p>
                </div>
                <button className="mt-8 w-full border border-card-border bg-card-bg hover:border-brand-green hover:bg-brand-green hover:text-white py-2.5 rounded-lg font-bold text-xs transition-all duration-200 cursor-pointer shadow-sm active:scale-98" id={`btn-choose-${pkg.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  Choose Package
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Protecting Nature Section --- */}
      <section 
        id="nature" 
        ref={sectionRefs.nature}
        className="w-full py-28 bg-emerald-50/50 dark:bg-emerald-950/20 text-center border-b border-card-border/40"
      >
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-brand-green/10 flex items-center justify-center mb-2 border border-brand-green/10">
            <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Our Green Commitment</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
            Over 1.5 Million Trees Saved Since Inception
          </h2>
          <p className="text-emerald-800/80 dark:text-emerald-350/80 leading-relaxed font-light text-sm md:text-base max-w-xl">
            By shifting invitations online, Fancy RSVP hosts preserve natural forests, reduce water use, and prevent tons of waste. We pledge 1% of every transaction to global tree reforestation networks.
          </p>
          <button className="bg-brand-green hover:bg-brand-green-hover text-white px-8 py-3.5 rounded-md font-bold tracking-wide transition-all shadow-md hover:shadow-lg mt-2 cursor-pointer border-b-2 border-emerald-700" id="read-eco-pledge">
            Read Our Eco Pledge
          </button>
        </div>
      </section>

      {/* --- FAQ ACCORDION SECTION --- */}
      <section className="w-full py-28 bg-card-bg">
        <div className="max-w-4xl mx-auto px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Common Questions</span>
            <h2 className="font-serif text-3xl font-normal tracking-tight mt-2 text-foreground">
              Frequently Asked Questions
            </h2>
            <div className="w-12 h-0.5 bg-brand-green mx-auto rounded-full mt-4"></div>
          </div>

          <div className="flex flex-col gap-4">
            {[
              {
                q: "Does Fancy RSVP support custom background music?",
                a: "Yes! Our premium packages let you upload custom mp3/wav audio loops or select from our catalog. You can also embed personal Vimeo or YouTube video links that display instantly on the guest landing card."
              },
              {
                q: "Can I import guest contact lists from Excel or Sheets?",
                a: "Absolutely. You can import contacts instantly using a CSV template or plain copy-paste from Excel or Google Sheets. The system validates syntax immediately and flags duplicates."
              },
              {
                q: "How does real-time RSVP updates work?",
                a: "The instant a guest clicks accept/decline on their invitation, your dashboard compiles the response. Counters, meal preferences, and custom questions update dynamically without needing page reloads."
              },
              {
                q: "Is there a completely ad-free guarantee?",
                a: "Yes. Fancy RSVP is a premium host platform. We guarantee 100% ad-free presentation decks and invitation pages. We never display third-party advertisements or share contact listings."
              },
              {
                q: "How does the automated email delivery system guard against bouncebacks?",
                a: "Prior to broadcasting, our delivery checker verifies domain structures. If a contact email appears formatted incorrectly or contains spelling errors (e.g. 'gnail.com' instead of 'gmail.com'), it will flag it for your review."
              }
            ].map((item, idx) => (
              <div 
                key={idx}
                className="border border-card-border rounded-xl bg-sec-bg/10 hover:border-brand-green/20 transition-all overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex justify-between items-center text-left text-foreground font-semibold text-sm md:text-base cursor-pointer"
                  aria-expanded={openFaq === idx}
                  id={`faq-btn-${idx}`}
                >
                  <span>{item.q}</span>
                  <span className="text-brand-green text-lg font-bold">{openFaq === idx ? "−" : "+"}</span>
                </button>
                
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ${
                    openFaq === idx ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                >
                  <p className="text-muted-text font-light text-xs md:text-sm leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="w-full py-12 px-6 bg-[#0c0a09] dark:bg-[#080706] text-stone-400 text-center border-t border-stone-850 dark:border-stone-900 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-sans font-bold tracking-[0.2em] text-white">
            FANCY<span className="text-stone-700">|</span>RSVP
          </span>
          <p className="font-light text-stone-500">
            © {new Date().getFullYear()} Fancy RSVP project. Crafted with care for premium celebrations.
          </p>
        </div>
      </footer>

    </div>
  );
}
