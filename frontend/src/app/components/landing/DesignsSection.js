"use client";

import React, { useState } from "react";

const DesignsSection = React.memo(function DesignsSection() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [chicStripesColor, setChicStripesColor] = useState("navy");
  const [fireworksColor, setFireworksColor] = useState("red");
  const [remembranceColor, setRemembranceColor] = useState("white");
  const [flippedCards, setFlippedCards] = useState({
    chic: false,
    fireworks: false,
    remembrance: false,
  });

  const toggleFlip = (cardKey) => {
    setFlippedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  return (
    <section 
      id="designs" 
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
                          <span className="text-brand-green font-bold text-[9px] uppercase tracking-wider">New Year&apos;s Eve</span>
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
                    <div className="aspect-[1.4/1] bg-sky-100 dark:bg-sky-955/45 rounded-lg flex items-center justify-center text-sky-800 dark:text-sky-300 font-serif text-[9px] tracking-widest uppercase shadow-inner border border-sky-300/20">
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
  );
});

export default DesignsSection;
