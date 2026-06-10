"use client";

import React, { useState } from "react";

const RSVPSimulator = React.memo(function RSVPSimulator() {
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

  return (
    <section 
      id="simulator" 
      className="w-full py-28 bg-card-bg border-b border-card-border/40 relative"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Simulate Live Flow</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight mt-2 text-foreground">
            Experience Guest RSVP &amp; Host Dashboard Side-by-Side
          </h2>
          <p className="text-muted-text font-light text-sm md:text-base mt-2">
            Fill out the guest form on the left, click submit, and watch the host organizer&apos;s dashboard on the right update instantly in real time!
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
                    Thank you! Your response has been securely saved. The organizer&apos;s live dashboard has been updated.
                  </p>
                  <span className="text-[10px] text-brand-green font-semibold mt-4">Resetting simulator...</span>
                </div>
              ) : (
                <form onSubmit={handleSimulatedRSVP} className="flex-1 flex flex-col justify-between gap-4 mt-6">
                  <div>
                    <div className="border-b border-card-border pb-2 mb-3 text-center">
                      <span className="font-serif italic text-[10.5px] text-brand-green uppercase tracking-wide">Aria &amp; Julian&apos;s Wedding</span>
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
                  <h4 className="font-serif font-normal text-lg text-foreground">Aria &amp; Julian&apos;s Wedding</h4>
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
  );
});

export default RSVPSimulator;
