"use client";

import React from "react";

/* ═══════════════════════════════════════════════════════════════
   InvitationCard — pure presentational invitation artwork.

   Extracted from the old EnvelopeAnimation so the *same* card art can
   be rendered in two stable places without duplication or flicker:
     1. peeking inside the closed envelope (teaser)
     2. the full, scrollable opened-invitation view

   It renders ONLY content — no animation, no fixed height. The parent
   controls the box it lives in, which is what keeps the preview stable.
   ═══════════════════════════════════════════════════════════════ */
const FONT_CLASS = { serif: "font-serif", sans: "font-sans", script: "font-script" };

export default function InvitationCard({ template, theme, guestName, config }) {
  const accentColor = theme?.primary || "#B8944F";
  const lightAccentColor = theme?.secondary || "#D7BE80";
  const pattern = template?.pattern;
  const name = guestName || "Sarah & John";

  switch (pattern) {
    case "custom": { // Guided Custom builder — driven entirely by `config`
      const cfg = config || {};
      const headingClass = FONT_CLASS[cfg.headingFont] || "font-serif";
      return (
        <div
          className="w-full h-full flex flex-col select-none relative overflow-hidden rounded border"
          style={{ background: cfg.background || "#FAF8F5", borderColor: `${accentColor}40`, color: accentColor }}
        >
          {/* Optional cover image banner */}
          {cfg.coverImageUrl ? (
            <div className="w-full h-[34%] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.coverImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${cfg.background || "#FAF8F5"} 4%, transparent 70%)` }} />
            </div>
          ) : (
            <div className="w-full h-1.5 shrink-0" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor})` }} />
          )}

          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-1.5">
            <span className="text-[7.5px] uppercase tracking-[3px] font-sans font-semibold" style={{ color: lightAccentColor }}>You are invited</span>
            <span className={`${headingClass} leading-tight`} style={{ color: accentColor, fontSize: cfg.headingFont === "script" ? 32 : 22 }}>
              {cfg.headline || "You’re Invited"}
            </span>
            <div className="w-8 h-px my-0.5" style={{ backgroundColor: `${accentColor}55` }} />
            <span className="text-[8.5px] font-bold tracking-[1px]" style={{ color: lightAccentColor }}>SATURDAY · OCTOBER 24, 2026</span>
            <span className="text-[8px] italic text-stone-500">The Grand Ballroom · New York</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 pb-3 shrink-0">
            <span className="text-[7px] uppercase tracking-[1.5px] font-sans" style={{ color: `${accentColor}99` }}>Reserved for</span>
            <span className={`${headingClass} text-lg`} style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );
    }

    case "serif": // Classic — Timeless Elegance (Royale Wedding)
      return (
        <div
          className="w-full h-full p-4 flex flex-col items-center justify-between border-[3px] rounded bg-[#FCFAF6] font-serif select-none relative overflow-hidden"
          style={{ borderColor: accentColor, color: accentColor, boxShadow: "inset 0 0 15px rgba(184,148,79,0.08)" }}
        >
          <div className="absolute inset-1 border pointer-events-none" style={{ borderColor: `${accentColor}50` }} />
          <div className="absolute inset-2 border pointer-events-none" style={{ borderColor: `${accentColor}25` }} />

          <div className="text-[8px] uppercase tracking-[3px] mt-1 font-semibold flex flex-col items-center gap-1">
            <span className="font-sans" style={{ border: `1px solid ${accentColor}`, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>A&J</span>
            <span>The Marriage Celebration</span>
          </div>

          <div className="flex flex-col items-center my-auto text-center gap-2">
            <span className="text-[7.5px] tracking-[2.5px] font-sans font-light uppercase text-stone-500">Request the honor of your presence</span>
            <span className="font-script text-3xl leading-tight px-1" style={{ color: accentColor }}>Aria &amp; Julian</span>
            <div className="w-8 h-px" style={{ backgroundColor: `${accentColor}55` }} />
            <span className="text-[9px] font-bold tracking-[1px]" style={{ color: lightAccentColor }}>SATURDAY, OCTOBER 24, 2026</span>
            <span className="text-[8px] tracking-wide leading-relaxed font-sans text-stone-500 max-w-[92%]">
              At 4 o&apos;clock in the afternoon<br />
              <strong className="text-stone-800 font-semibold">The Grand Ballroom</strong>, Plaza Hotel
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, zIndex: 10 }}>
            <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6, fontFamily: "var(--font-sans)", fontWeight: 600 }}>Invite Issued To:</span>
            <span className="font-script text-2.2xl leading-none" style={{ color: accentColor }}>{name}</span>
          </div>

          <div className="w-10 h-0.5" style={{ backgroundColor: `${accentColor}60` }} />
        </div>
      );

    case "geo": // Modern — Urban Edge (Conference Pass)
      return (
        <div
          className="w-full h-full p-4 flex flex-col justify-between bg-white text-[#0F172A] font-sans select-none relative overflow-hidden rounded border border-slate-200"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6)" }}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: accentColor }} />
          <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full" style={{ border: `1px solid ${accentColor}1A` }} />

          <div className="flex items-center justify-between pt-2.5">
            <span className="text-[7px] font-bold tracking-[2px] uppercase text-slate-400">Annual Conference</span>
            <span className="text-[7px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: accentColor }}>NYC &apos;26</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[8px] tracking-[3px] uppercase font-bold" style={{ color: accentColor }}>Shaping the future</span>
            <h4 className="text-lg font-extrabold leading-[1.1] tracking-tight text-slate-900">
              Technology &amp;<br />Innovation Summit
            </h4>
            <span className="text-[8.5px] font-semibold text-slate-500">Saturday · October 24, 2026</span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg p-2.5" style={{ background: `${accentColor}0A`, border: `1px solid ${accentColor}1F` }}>
            {[["09:00", "Opening Keynote"], ["11:30", "AI & Cloud Panel"], ["14:30", "Hands-on Workshops"]].map(([time, label]) => (
              <div key={time} className="flex items-center justify-between text-[7.5px]">
                <span className="font-mono text-slate-400">{time}</span>
                <span className="font-semibold text-slate-700">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <div className="flex flex-col">
              <span className="text-[6px] uppercase tracking-[1.5px] text-slate-400">Attendee Pass</span>
              <span className="text-[10px] font-bold text-slate-900">{name}</span>
            </div>
            <span className="text-[8px] font-mono text-slate-300">#SUM-2026</span>
          </div>
        </div>
      );

    case "organic": // Rustic — Woodland Romance (Botanical)
      return (
        <div
          className="w-full h-full p-4 flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{ background: "linear-gradient(170deg,#F8F4EB 0%,#F2ECDD 100%)", border: `1.5px solid ${accentColor}40`, color: accentColor }}
        >
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
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>

          <div className="text-[7.5px] uppercase tracking-[2px] font-sans text-stone-400">Celebrate under the pines</div>
        </div>
      );

    case "luxury": // Luxury — Grand Affair (Eternal Love)
      return (
        <div
          className="w-full h-full p-4 flex flex-col items-center justify-between border-[2px] rounded bg-gradient-to-br from-[#0B0F19] via-[#151B26] to-[#0D121F] text-white font-serif select-none relative overflow-hidden"
          style={{ borderColor: `${lightAccentColor}60` }}
        >
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
              An evening of champagne &amp; celebration<br />
              <strong className="text-white font-medium">The Penthouse Pavilion</strong>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, zIndex: 10 }}>
            <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-sans)" }}>Reserved For</span>
            <span className="font-serif italic text-[13px] tracking-wide" style={{ color: lightAccentColor }}>{name}</span>
          </div>

          <div className="text-[7.5px] uppercase tracking-[3px] font-sans font-bold opacity-70" style={{ color: lightAccentColor }}>Black Tie</div>
        </div>
      );

    case "minimal": // Minimal — Pure & Simple (Editorial Gala)
      return (
        <div
          className="w-full h-full flex flex-col justify-between bg-[#FBFAF7] text-[#1A1A1A] font-sans select-none relative rounded border"
          style={{ borderColor: "#ECE6DC", padding: 22 }}
        >
          <div className="flex justify-between items-center">
            <span className="text-[7.5px] font-bold tracking-[3px] text-stone-400 uppercase">The Annual Gala</span>
            <span className="text-[7px] text-stone-400 font-mono">№ 024</span>
          </div>

          <div className="my-auto flex flex-col text-left">
            <span className="text-[8px] tracking-[5px] uppercase text-stone-400 font-light">An Evening Of</span>
            <span className="font-serif text-3xl font-light tracking-tight text-[#111] leading-[1.05] mt-2">
              Art &amp;<br />Philanthropy
            </span>
            <div className="w-10 h-px bg-stone-300 my-3.5" />
            <span className="text-[8px] text-stone-500 font-light uppercase tracking-[2px]">The Metropolitan · New York</span>
            <span className="text-[8px] text-stone-500 font-light uppercase tracking-[2px] mt-0.5">October 24 · 7:00 PM</span>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[6px] uppercase tracking-[1.5px] text-stone-400">Admit</span>
              <span className="font-serif text-[12px] italic text-[#111]">{name}</span>
            </div>
            <span className="text-[7.5px] font-bold tracking-[2px] uppercase px-2 py-0.5 border" style={{ color: lightAccentColor, borderColor: `${lightAccentColor}55` }}>GALA</span>
          </div>
        </div>
      );

    case "floral": // Floral — Garden Party (Milestone Party)
      return (
        <div
          className="w-full h-full p-4 flex flex-col items-center justify-between border-2 rounded bg-gradient-to-tr from-[#FFF7F8] to-[#FFF3F5] font-serif select-none relative overflow-hidden"
          style={{ borderColor: `${accentColor}40`, color: accentColor, boxShadow: "inset 0 0 20px rgba(232,143,172,0.05)" }}
        >
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

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(0,0,0,0.38)", fontFamily: "var(--font-sans)" }}>Reserved for</span>
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>

          <div className="text-[7.5px] font-sans font-bold uppercase tracking-[2px]" style={{ color: lightAccentColor }}>Kindly reply by Sept 15</div>
        </div>
      );

    default:
      return (
        <div className="w-full h-full p-4 flex flex-col items-center justify-center bg-white border rounded font-serif select-none" style={{ borderColor: `${accentColor}40`, color: accentColor }}>
          <span className="text-[8px] uppercase tracking-[3px] font-sans text-stone-400">You are invited</span>
          <span className="font-script text-3xl my-1" style={{ color: accentColor }}>Aria &amp; Julian</span>
          <span className="text-[8px] font-sans text-stone-500">October 24, 2026</span>
          <span className="font-script text-lg mt-2" style={{ color: accentColor }}>{name}</span>
        </div>
      );
  }
}
