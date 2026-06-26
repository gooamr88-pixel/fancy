"use client";

import React from "react";

/* ═══════════════════════════════════════════════════════════════
   InvitationCard — pure presentational invitation artwork.

   Each pattern renders a DRAMATICALLY different visual design.
   The cards are displayed at ~230×310px in the mobile preview.
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
          className="w-full h-full flex flex-col select-none relative overflow-hidden rounded"
          style={{ background: cfg.background || "#FAF8F5", border: `1.5px solid ${accentColor}30`, color: accentColor }}
        >
          {/* Subtle corner ornaments */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t border-l" style={{ borderColor: `${accentColor}40` }} />
          <div className="absolute top-2 right-2 w-4 h-4 border-t border-r" style={{ borderColor: `${accentColor}40` }} />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l" style={{ borderColor: `${accentColor}40` }} />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r" style={{ borderColor: `${accentColor}40` }} />

          {cfg.coverImageUrl ? (
            <div className="w-full h-[36%] relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.coverImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${cfg.background || "#FAF8F5"} 8%, transparent 70%)` }} />
            </div>
          ) : (
            <div className="w-full h-2 shrink-0" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor}, ${accentColor})` }} />
          )}

          <div className="flex-1 flex flex-col items-center justify-center text-center px-5 gap-2">
            <span className="text-[7px] uppercase tracking-[3px] font-sans font-semibold" style={{ color: `${accentColor}88` }}>You are invited</span>
            <span className={`${headingClass} leading-tight`} style={{ color: accentColor, fontSize: cfg.headingFont === "script" ? 30 : 20 }}>
              {cfg.headline || "You're Invited"}
            </span>
            {/* Flourish divider */}
            <svg width="60" height="8" viewBox="0 0 60 8" fill="none" style={{ opacity: 0.5 }}>
              <path d="M0 4 Q15 0 30 4 Q45 8 60 4" stroke={accentColor} strokeWidth="0.8" fill="none" />
            </svg>
            <span className="text-[8px] font-bold tracking-[1.5px]" style={{ color: lightAccentColor }}>SATURDAY · OCTOBER 24, 2026</span>
            <span className="text-[7.5px] italic text-stone-500">The Grand Ballroom · New York</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 pb-4 shrink-0">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}80` }}>Reserved for</span>
            <span className={`${headingClass} text-lg`} style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );
    }

    case "serif": // Classic — Timeless Elegance (Royale Wedding)
      return (
        <div
          className="ic-card w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "#FCFAF6",
            border: `2px solid ${accentColor}`,
            color: accentColor,
            boxShadow: `inset 0 0 20px ${accentColor}08`,
            padding: "10px 12px",
          }}
        >
          {/* Damask pattern background */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.03 }}>
            <svg width="100%" height="100%">
              <defs>
                <pattern id="damask" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M20 0 Q25 10 20 20 Q15 10 20 0Z M0 20 Q10 25 20 20 Q10 15 0 20Z M40 20 Q30 25 20 20 Q30 15 40 20Z M20 40 Q25 30 20 20 Q15 30 20 40Z" fill={accentColor} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#damask)" />
            </svg>
          </div>

          {/* Inner border frame */}
          <div className="absolute pointer-events-none" style={{ inset: 5, border: `0.5px solid ${accentColor}35` }} />
          <div className="absolute pointer-events-none" style={{ inset: 8, border: `0.5px solid ${accentColor}18` }} />

          {/* Corner filigree ornaments */}
          {[
            { top: 3, left: 3, rotate: "0deg" },
            { top: 3, right: 3, rotate: "90deg" },
            { bottom: 3, right: 3, rotate: "180deg" },
            { bottom: 3, left: 3, rotate: "270deg" },
          ].map((pos, i) => (
            <svg key={i} width="28" height="28" viewBox="0 0 30 30" className="absolute pointer-events-none" style={{ ...pos, transform: `rotate(${pos.rotate})`, opacity: 0.6 }}>
              <path d="M2 2 Q2 8 5 12 Q8 16 15 18 Q12 14 10 10 Q8 6 2 2Z" fill="none" stroke={accentColor} strokeWidth="0.6" />
              <path d="M2 2 Q8 2 12 5 Q16 8 18 15 Q14 12 10 10 Q6 8 2 2Z" fill="none" stroke={accentColor} strokeWidth="0.6" />
              <circle cx="3" cy="3" r="1" fill={accentColor} opacity="0.5" />
              <path d="M5 2 Q6 4 8 5" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.4" />
              <path d="M2 5 Q4 6 5 8" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.4" />
            </svg>
          ))}

          {/* Monogram circle */}
          <div className="relative z-10 flex flex-col items-center gap-1 mt-1">
            <div
              className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-sans text-[8px] font-bold tracking-wider"
              style={{ border: `1.5px solid ${accentColor}`, color: accentColor }}
            >A&J</div>
            <span className="text-[7px] uppercase tracking-[3px] font-semibold" style={{ color: `${accentColor}90` }}>The Marriage Celebration</span>
          </div>

          {/* Main content */}
          <div className="flex flex-col items-center text-center my-auto relative z-10 gap-1.5 px-1">
            <span className="text-[7px] tracking-[2.5px] font-sans font-light uppercase text-stone-500">Request the honor of your presence</span>
            <span className="font-script text-[28px] leading-tight px-1" style={{ color: accentColor }}>Aria &amp; Julian</span>

            {/* Ornamental flourish divider */}
            <svg width="100" height="14" viewBox="0 0 100 14" className="my-0.5" style={{ opacity: 0.65 }}>
              <path d="M10 7 Q20 2 30 7 Q35 9 40 7 L50 7" fill="none" stroke={accentColor} strokeWidth="0.7" />
              <path d="M90 7 Q80 2 70 7 Q65 9 60 7 L50 7" fill="none" stroke={accentColor} strokeWidth="0.7" />
              <circle cx="50" cy="7" r="2" fill={accentColor} opacity="0.5" />
              <circle cx="50" cy="7" r="1" fill={accentColor} />
              <path d="M20 7 Q25 4 30 7" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.3" />
              <path d="M80 7 Q75 4 70 7" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.3" />
            </svg>

            <span className="text-[8.5px] font-bold tracking-[1.5px]" style={{ color: lightAccentColor }}>SATURDAY, OCTOBER 24, 2026</span>
            <span className="text-[7.5px] tracking-wide leading-relaxed font-sans text-stone-500 max-w-[92%]">
              At 4 o&apos;clock in the afternoon<br />
              <strong className="text-stone-800 font-semibold">The Grand Ballroom</strong>, Plaza Hotel
            </span>
          </div>

          {/* Guest name */}
          <div className="relative z-10 flex flex-col items-center gap-0.5 mb-1">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans font-semibold" style={{ color: `${accentColor}70` }}>Invite Issued To:</span>
            <span className="font-script text-xl leading-none" style={{ color: accentColor }}>{name}</span>
          </div>

          {/* Bottom ornament line */}
          <div className="w-14 h-0.5 relative z-10" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
        </div>
      );

    case "geo": // Modern — Urban Edge (Conference Pass)
      return (
        <div
          className="ic-card w-full h-full flex flex-col justify-between text-[#0F172A] font-sans select-none relative overflow-hidden rounded"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            padding: "14px 14px 12px",
          }}
        >
          {/* Bold accent bar at top */}
          <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor || accentColor})` }} />

          {/* Geometric dot grid background */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`,
              backgroundSize: "18px 18px",
            }} />
          </div>

          {/* Decorative geometric shapes */}
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none" style={{ border: `1.5px solid ${accentColor}12` }} />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full pointer-events-none" style={{ border: `1px solid ${accentColor}08` }} />
          <svg className="absolute top-10 right-3 pointer-events-none" width="20" height="20" viewBox="0 0 20 20" style={{ opacity: 0.12 }}>
            <rect x="2" y="2" width="16" height="16" fill="none" stroke={accentColor} strokeWidth="1.5" transform="rotate(45 10 10)" />
          </svg>

          {/* Header */}
          <div className="flex items-center justify-between pt-3 relative z-10">
            <span className="text-[6.5px] font-bold tracking-[2.5px] uppercase text-slate-400">Annual Conference</span>
            <span className="text-[7px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: accentColor }}>NYC &apos;26</span>
          </div>

          {/* Main content — bold asymmetric layout */}
          <div className="flex flex-col gap-1.5 my-auto relative z-10">
            <span className="text-[7.5px] tracking-[3px] uppercase font-extrabold" style={{ color: accentColor }}>Shaping the future</span>
            <h4 className="text-xl font-extrabold leading-[1.05] tracking-tight text-slate-900">
              Technology &amp;<br />Innovation Summit
            </h4>
            {/* Accent line connector */}
            <div className="flex items-center gap-2 my-1">
              <div className="h-[2px] w-8" style={{ background: accentColor }} />
              <div className="h-[2px] w-3" style={{ background: `${accentColor}40` }} />
            </div>
            <span className="text-[8.5px] font-semibold text-slate-500">Saturday · October 24, 2026</span>
          </div>

          {/* Schedule block */}
          <div className="flex flex-col gap-2 rounded-lg p-3 relative z-10" style={{ background: `${accentColor}06`, border: `1px solid ${accentColor}15` }}>
            {[["09:00", "Opening Keynote"], ["11:30", "AI & Cloud Panel"], ["14:30", "Hands-on Workshops"]].map(([time, label]) => (
              <div key={time} className="flex items-center justify-between text-[7.5px]">
                <span className="font-mono text-slate-400 font-medium">{time}</span>
                <span className="font-semibold text-slate-700">{label}</span>
              </div>
            ))}
          </div>

          {/* Footer — badge style */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 relative z-10">
            <div className="flex flex-col">
              <span className="text-[6px] uppercase tracking-[2px] text-slate-400 font-bold">Attendee Pass</span>
              <span className="text-[10px] font-bold text-slate-900">{name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-slate-300">#SUM-2026</span>
              <div className="w-5 h-5 rounded" style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="w-2 h-2" style={{ background: accentColor, borderRadius: 1 }} />
              </div>
            </div>
          </div>
        </div>
      );

    case "organic": // Rustic — Woodland Romance (Botanical)
      return (
        <div
          className="ic-card w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(170deg, #F8F4EB 0%, #F4EFDF 40%, #F0EADA 60%, #F2ECDD 100%)",
            border: `1.5px solid ${accentColor}35`,
            color: accentColor,
            padding: "12px 14px",
          }}
        >
          {/* Botanical leaf — top-left */}
          <svg className="absolute -top-1 -left-1 pointer-events-none" width="60" height="70" viewBox="0 0 60 70" style={{ opacity: 0.18 }}>
            <path d="M5 65 Q5 35 20 15 Q30 5 45 2 Q35 15 30 30 Q25 45 5 65Z" fill={accentColor} />
            <path d="M5 65 Q15 40 25 25" fill="none" stroke={accentColor} strokeWidth="0.5" />
            <path d="M10 55 Q18 38 28 22" fill="none" stroke={accentColor} strokeWidth="0.3" opacity="0.5" />
            <path d="M25 20 L30 15 M25 28 L32 22 M22 36 L28 30" fill="none" stroke={accentColor} strokeWidth="0.3" opacity="0.4" />
          </svg>

          {/* Botanical leaf — bottom-right */}
          <svg className="absolute -bottom-1 -right-1 pointer-events-none" width="60" height="70" viewBox="0 0 60 70" style={{ opacity: 0.18, transform: "rotate(180deg)" }}>
            <path d="M5 65 Q5 35 20 15 Q30 5 45 2 Q35 15 30 30 Q25 45 5 65Z" fill={accentColor} />
            <path d="M5 65 Q15 40 25 25" fill="none" stroke={accentColor} strokeWidth="0.5" />
            <path d="M25 20 L30 15 M25 28 L32 22" fill="none" stroke={accentColor} strokeWidth="0.3" opacity="0.4" />
          </svg>

          {/* Small fern sprig — top center */}
          <svg className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none" width="50" height="30" viewBox="0 0 50 30" style={{ opacity: 0.25 }}>
            <path d="M25 28 V8" fill="none" stroke={accentColor} strokeWidth="0.8" />
            <path d="M25 20 Q18 16 14 10" fill="none" stroke={accentColor} strokeWidth="0.5" />
            <path d="M25 20 Q32 16 36 10" fill="none" stroke={accentColor} strokeWidth="0.5" />
            <path d="M25 14 Q20 12 17 7" fill="none" stroke={accentColor} strokeWidth="0.4" />
            <path d="M25 14 Q30 12 33 7" fill="none" stroke={accentColor} strokeWidth="0.4" />
            <path d="M25 9 Q22 7 20 4" fill="none" stroke={accentColor} strokeWidth="0.3" />
            <path d="M25 9 Q28 7 30 4" fill="none" stroke={accentColor} strokeWidth="0.3" />
          </svg>

          {/* Watercolor wash border effect */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to right, ${accentColor}08, transparent 15%, transparent 85%, ${accentColor}08), linear-gradient(to bottom, ${accentColor}06, transparent 12%, transparent 88%, ${accentColor}06)`,
          }} />

          <div className="text-[7px] uppercase tracking-[3px] font-sans font-semibold text-stone-500 mt-6 relative z-10">Together with their families</div>

          <div className="flex flex-col items-center text-center my-auto relative z-10">
            <span className="text-[7px] tracking-[2px] uppercase font-sans text-stone-400">We invite you to the wedding of</span>
            <span className="font-script text-[28px] leading-tight my-1.5" style={{ color: accentColor }}>Mia &amp; Noah</span>

            {/* Botanical sprig divider */}
            <svg width="70" height="12" viewBox="0 0 70 12" className="my-1" style={{ opacity: 0.4 }}>
              <path d="M0 6 L25 6" fill="none" stroke={accentColor} strokeWidth="0.5" />
              <path d="M70 6 L45 6" fill="none" stroke={accentColor} strokeWidth="0.5" />
              <path d="M35 2 Q33 4 35 6 Q37 8 35 10" fill="none" stroke={accentColor} strokeWidth="0.6" />
              <path d="M35 4 L32 2" fill="none" stroke={accentColor} strokeWidth="0.4" />
              <path d="M35 4 L38 2" fill="none" stroke={accentColor} strokeWidth="0.4" />
              <path d="M35 8 L32 10" fill="none" stroke={accentColor} strokeWidth="0.4" />
              <path d="M35 8 L38 10" fill="none" stroke={accentColor} strokeWidth="0.4" />
            </svg>

            <span className="text-[8.5px] font-bold tracking-[1px] text-stone-600">OCTOBER 24, 2026 · 4 PM</span>
            <span className="text-[7.5px] italic text-stone-500 mt-0.5">Pine Valley Cabin · Catskills, NY</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 relative z-10">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans text-stone-400">We&apos;d love for you to join</span>
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>

          <div className="text-[7px] uppercase tracking-[2.5px] font-sans text-stone-400 relative z-10">Celebrate under the pines</div>
        </div>
      );

    case "luxury": // Luxury — Grand Affair (Eternal Love)
      return (
        <div
          className="ic-card ic-luxury w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(160deg, #0B0F19 0%, #121827 30%, #0F1420 60%, #0D121F 100%)",
            border: `1.5px solid ${lightAccentColor}35`,
            color: "#fff",
            padding: "12px 14px",
            boxShadow: `inset 0 0 30px rgba(0,0,0,0.3), 0 0 15px ${lightAccentColor}08`,
          }}
        >
          {/* Shimmer sweep overlay */}
          <div className="ic-shimmer absolute inset-0 pointer-events-none z-20" />

          {/* Radial spotlight behind center */}
          <div className="absolute pointer-events-none" style={{
            top: "30%", left: "50%", transform: "translate(-50%, -50%)",
            width: "80%", height: "50%",
            background: `radial-gradient(ellipse, ${lightAccentColor}10 0%, transparent 65%)`,
          }} />

          {/* Art Deco corner ornaments */}
          {[
            { top: 5, left: 5, rotate: "0deg" },
            { top: 5, right: 5, rotate: "90deg" },
            { bottom: 5, right: 5, rotate: "180deg" },
            { bottom: 5, left: 5, rotate: "270deg" },
          ].map((pos, i) => (
            <svg key={i} width="24" height="24" viewBox="0 0 24 24" className="absolute pointer-events-none z-10" style={{ ...pos, transform: `rotate(${pos.rotate})`, opacity: 0.7 }}>
              <path d="M2 2 L2 14" stroke={lightAccentColor} strokeWidth="0.6" fill="none" />
              <path d="M2 2 L14 2" stroke={lightAccentColor} strokeWidth="0.6" fill="none" />
              <path d="M2 2 L8 8" stroke={lightAccentColor} strokeWidth="0.4" fill="none" opacity="0.5" />
              <path d="M4 2 Q4 4 2 4" stroke={lightAccentColor} strokeWidth="0.4" fill="none" opacity="0.4" />
              <path d="M7 2 Q7 7 2 7" stroke={lightAccentColor} strokeWidth="0.3" fill="none" opacity="0.3" />
              <circle cx="2" cy="2" r="1.2" fill={lightAccentColor} opacity="0.4" />
            </svg>
          ))}

          {/* Header */}
          <div className="text-[7px] uppercase tracking-[4px] font-sans font-semibold mt-1 text-center relative z-10" style={{ color: lightAccentColor }}>
            The Engagement Of
          </div>

          {/* Main content */}
          <div className="flex flex-col items-center text-center my-auto relative z-10">
            <span
              className="font-serif font-light text-[22px] tracking-wide text-transparent bg-clip-text"
              style={{ backgroundImage: `linear-gradient(100deg, #FBF6E9, ${lightAccentColor}, #FBF6E9)` }}
            >
              Sophia &amp; Thomas
            </span>

            {/* Diamond motif divider */}
            <div className="flex items-center gap-2 my-3">
              <span className="w-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${lightAccentColor}80)` }} />
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity: 0.8 }}>
                <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="none" stroke={lightAccentColor} strokeWidth="0.6" />
                <path d="M6 2 L10 6 L6 10 L2 6 Z" fill={`${lightAccentColor}20`} stroke={lightAccentColor} strokeWidth="0.3" />
                <circle cx="6" cy="6" r="1" fill={lightAccentColor} opacity="0.6" />
              </svg>
              <span className="w-6 h-px" style={{ background: `linear-gradient(90deg, ${lightAccentColor}80, transparent)` }} />
            </div>

            <span className="text-[7.5px] tracking-[2.5px] font-sans uppercase" style={{ color: lightAccentColor }}>October 24, 2026</span>
            <span className="text-[7.5px] font-sans font-light text-slate-300 max-w-[88%] leading-relaxed mt-2">
              An evening of champagne &amp; celebration<br />
              <strong className="text-white font-medium">The Penthouse Pavilion</strong>
            </span>
          </div>

          {/* Guest name */}
          <div className="flex flex-col items-center gap-1 relative z-10">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: "rgba(255,255,255,0.35)" }}>Reserved For</span>
            <span className="font-serif italic text-[14px] tracking-wide" style={{ color: lightAccentColor }}>{name}</span>
          </div>

          {/* Bottom accent */}
          <div className="text-[7px] uppercase tracking-[3px] font-sans font-bold relative z-10" style={{ color: `${lightAccentColor}80` }}>Black Tie</div>
        </div>
      );

    case "minimal": // Minimal — Pure & Simple (Editorial Gala)
      return (
        <div
          className="ic-card w-full h-full flex flex-col justify-between text-[#1A1A1A] font-sans select-none relative rounded"
          style={{
            background: "#FBFAF7",
            border: "1px solid #E8E2D8",
            padding: "18px 16px",
          }}
        >
          {/* Subtle dot-grid texture */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(circle, #999 0.4px, transparent 0.4px)",
              backgroundSize: "12px 12px",
            }} />
          </div>

          {/* Header */}
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[7px] font-bold tracking-[3.5px] text-stone-400 uppercase">The Annual Gala</span>
            <span className="text-[6.5px] text-stone-400 font-mono">№ 024</span>
          </div>

          {/* Main content — large confident typography */}
          <div className="my-auto flex flex-col text-left relative z-10">
            <span className="text-[7.5px] tracking-[5px] uppercase text-stone-400 font-light">An Evening Of</span>
            <span className="font-serif text-[28px] font-light tracking-tight text-[#111] leading-[1.02] mt-2">
              Art &amp;<br />Philanthropy
            </span>
            {/* Editorial rule line */}
            <div className="w-12 h-[1.5px] bg-stone-800 my-3.5" />
            <span className="text-[7.5px] text-stone-500 font-light uppercase tracking-[2.5px]">The Metropolitan · New York</span>
            <span className="text-[7.5px] text-stone-500 font-light uppercase tracking-[2.5px] mt-0.5">October 24 · 7:00 PM</span>
          </div>

          {/* Perforated line — ticket stub effect */}
          <div className="w-full my-2 relative z-10" style={{
            borderBottom: "1.5px dashed #D5CFC5",
          }} />

          {/* Footer — refined ticket stub */}
          <div className="flex justify-between items-end relative z-10">
            <div className="flex flex-col">
              <span className="text-[6px] uppercase tracking-[2px] text-stone-400 font-bold">Admit</span>
              <span className="font-serif text-[13px] italic text-[#111]">{name}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className="text-[7px] font-bold tracking-[2.5px] uppercase px-2.5 py-1"
                style={{
                  color: lightAccentColor,
                  border: `1.5px solid ${lightAccentColor}55`,
                }}
              >GALA</span>
            </div>
          </div>
        </div>
      );

    case "floral": // Floral — Garden Party (Milestone Party)
      return (
        <div
          className="ic-card w-full h-full flex flex-col items-center justify-between rounded select-none relative overflow-hidden font-serif"
          style={{
            background: "linear-gradient(155deg, #FFF8F9 0%, #FFF3F5 30%, #FFECF0 60%, #FFF5F7 100%)",
            border: `1.5px solid ${accentColor}30`,
            color: accentColor,
            boxShadow: `inset 0 0 25px ${accentColor}05`,
            padding: "12px 14px",
          }}
        >
          {/* Floral SVG — top-right */}
          <svg className="absolute -top-2 -right-2 pointer-events-none" width="65" height="65" viewBox="0 0 65 65" style={{ opacity: 0.2 }}>
            {/* Rose bloom */}
            <circle cx="42" cy="22" r="10" fill={accentColor} opacity="0.3" />
            <path d="M42 12 Q48 16 48 22 Q48 28 42 32 Q36 28 36 22 Q36 16 42 12Z" fill={accentColor} opacity="0.2" />
            <path d="M32 22 Q36 16 42 12" fill="none" stroke={accentColor} strokeWidth="0.5" />
            <circle cx="42" cy="22" r="4" fill={accentColor} opacity="0.15" />
            <circle cx="42" cy="22" r="2" fill={accentColor} opacity="0.25" />
            {/* Leaves */}
            <path d="M42 32 Q38 40 30 45 Q35 38 42 32Z" fill={accentColor} opacity="0.25" />
            <path d="M42 32 Q48 38 52 46 Q46 40 42 32Z" fill={accentColor} opacity="0.2" />
            <path d="M36 36 Q32 42 26 46" fill="none" stroke={accentColor} strokeWidth="0.4" />
          </svg>

          {/* Floral SVG — bottom-left */}
          <svg className="absolute -bottom-2 -left-2 pointer-events-none" width="55" height="55" viewBox="0 0 55 55" style={{ opacity: 0.18, transform: "scaleX(-1)" }}>
            <circle cx="30" cy="30" r="8" fill={accentColor} opacity="0.25" />
            <path d="M30 22 Q35 25 35 30 Q35 35 30 38 Q25 35 25 30 Q25 25 30 22Z" fill={accentColor} opacity="0.15" />
            <circle cx="30" cy="30" r="3" fill={accentColor} opacity="0.2" />
            <path d="M30 38 Q26 44 20 48 Q24 42 30 38Z" fill={accentColor} opacity="0.2" />
            <path d="M30 38 Q36 42 40 48 Q34 44 30 38Z" fill={accentColor} opacity="0.15" />
          </svg>

          {/* Scattered petal accents */}
          {[
            { top: "15%", left: "12%", size: 3, opacity: 0.15 },
            { top: "70%", right: "15%", size: 4, opacity: 0.12 },
            { top: "45%", left: "8%", size: 2.5, opacity: 0.1 },
            { top: "25%", right: "22%", size: 2, opacity: 0.1 },
          ].map((p, i) => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{
              ...p, width: p.size * 2, height: p.size,
              background: accentColor, opacity: p.opacity,
              transform: `rotate(${i * 35}deg)`,
              borderRadius: "50%",
            }} />
          ))}

          <div className="text-[7px] uppercase tracking-[3px] font-sans font-semibold text-center text-stone-500 relative z-10 mt-1">You&apos;re invited to a</div>

          <div className="flex flex-col items-center text-center my-auto relative z-10">
            <span className="font-script text-[32px] leading-none" style={{ color: accentColor }}>Garden Party</span>
            <span className="text-[7.5px] tracking-[2px] uppercase font-sans text-stone-500 mt-1.5">In celebration of Lucy&apos;s 30th</span>

            {/* Floral divider */}
            <div className="flex items-center gap-1.5 my-2.5">
              <span className="w-6 h-px" style={{ background: `${accentColor}40` }} />
              <svg width="14" height="10" viewBox="0 0 14 10" style={{ opacity: 0.5 }}>
                <circle cx="7" cy="5" r="2" fill={accentColor} opacity="0.3" />
                <circle cx="7" cy="5" r="1" fill={accentColor} opacity="0.5" />
                <path d="M3 5 Q5 3 7 5 Q9 7 11 5" fill="none" stroke={accentColor} strokeWidth="0.5" />
                <path d="M5 3 Q7 1 9 3" fill="none" stroke={accentColor} strokeWidth="0.4" opacity="0.4" />
              </svg>
              <span className="w-6 h-px" style={{ background: `${accentColor}40` }} />
            </div>

            <span className="text-[8.5px] font-bold tracking-[1px] text-stone-600">SATURDAY · OCTOBER 24, 2026</span>
            <span className="text-[7.5px] italic text-stone-500 mt-0.5">The Rose Terrace · Plaza Hotel</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 relative z-10">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}60` }}>Reserved for</span>
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>

          <div className="text-[7px] font-sans font-bold uppercase tracking-[2.5px] relative z-10" style={{ color: `${lightAccentColor}90` }}>Kindly reply by Sept 15</div>
        </div>
      );

    default:
      return (
        <div className="ic-card w-full h-full p-4 flex flex-col items-center justify-between rounded select-none relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #FCFAF6 0%, #F8F4EC 100%)",
            border: `1.5px solid ${accentColor}30`,
            color: accentColor,
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${accentColor}, ${lightAccentColor})` }} />
          <span className="text-[7.5px] uppercase tracking-[3px] font-sans text-stone-400 mt-2">You are invited</span>
          <div className="flex flex-col items-center my-auto text-center">
            <span className="font-script text-[28px] my-1" style={{ color: accentColor }}>Aria &amp; Julian</span>
            <div className="w-8 h-px my-1" style={{ background: `${accentColor}40` }} />
            <span className="text-[8px] font-sans text-stone-500">October 24, 2026</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 mb-1">
            <span className="text-[6.5px] uppercase tracking-[2px] font-sans" style={{ color: `${accentColor}70` }}>Reserved for</span>
            <span className="font-script text-lg" style={{ color: accentColor }}>{name}</span>
          </div>
        </div>
      );
  }
}

/* Animation for the luxury shimmer sweep */
const InvitationCardStyles = () => (
  <style jsx global>{`
    .ic-shimmer {
      background: linear-gradient(
        115deg,
        transparent 25%,
        rgba(215,190,128,0.12) 45%,
        rgba(255,245,220,0.08) 50%,
        rgba(215,190,128,0.12) 55%,
        transparent 75%
      );
      background-size: 250% 100%;
      animation: ic-shimmer-sweep 4s ease-in-out infinite;
    }
    @keyframes ic-shimmer-sweep {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `}</style>
);

// Render styles once globally
if (typeof document !== "undefined") {
  const id = "ic-shimmer-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .ic-shimmer {
        background: linear-gradient(115deg, transparent 25%, rgba(215,190,128,0.12) 45%, rgba(255,245,220,0.08) 50%, rgba(215,190,128,0.12) 55%, transparent 75%);
        background-size: 250% 100%;
        animation: ic-shimmer-sweep 4s ease-in-out infinite;
      }
      @keyframes ic-shimmer-sweep {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
