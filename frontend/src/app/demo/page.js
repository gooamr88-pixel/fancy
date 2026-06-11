'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ═══════════════════════════════════════════
   INTERACTIVE DEMO — Immersive RSVP Experience
   4 Stages: Envelope → Invitation → RSVP Form → Confirmation
   ═══════════════════════════════════════════ */

export default function DemoPage() {
  const [stage, setStage] = useState(0); // 0=envelope, 1=opening, 2=invitation, 3=rsvp, 4=confirmed
  const [mounted, setMounted] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState(null); // true/false
  const [guestCount, setGuestCount] = useState(1);
  const [mealChoice, setMealChoice] = useState('');
  const [particles, setParticles] = useState([]);

  useEffect(() => { setMounted(true); }, []);

  // Generate celebration particles
  const createParticles = useCallback(() => {
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
      type: Math.random() > 0.5 ? 'circle' : 'diamond',
    }));
    setParticles(newParticles);
  }, []);

  const handleOpenEnvelope = () => {
    setStage(1);
    setTimeout(() => setStage(2), 1200);
  };

  const handleRSVP = () => setStage(3);

  const handleSubmitRSVP = (e) => {
    e.preventDefault();
    if (!guestName || attending === null) return;
    createParticles();
    setStage(4);
  };

  const handleReset = () => {
    setStage(0);
    setGuestName('');
    setAttending(null);
    setGuestCount(1);
    setMealChoice('');
    setParticles([]);
  };

  if (!mounted) return null;

  return (
    <div className="demo-page">
      {/* Floating bokeh particles background */}
      <div className="demo-bg">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="bokeh-dot" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: `${6 + Math.random() * 14}px`, height: `${6 + Math.random() * 14}px`,
            animationDelay: `${Math.random() * 8}s`, animationDuration: `${6 + Math.random() * 8}s`,
            opacity: 0.1 + Math.random() * 0.2,
          }} />
        ))}
      </div>

      {/* Back button */}
      <Link href="/" className="demo-back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to Fancy RSVP
      </Link>

      {/* ═══ STAGE 0 & 1: ENVELOPE ═══ */}
      {stage <= 1 && (
        <div className={`envelope-scene ${stage === 0 ? 'scene-ready' : 'scene-opening'}`}>
          <p className="tap-hint">{stage === 0 ? 'Tap the envelope to open' : ''}</p>

          <div className="envelope-wrapper" onClick={stage === 0 ? handleOpenEnvelope : undefined}>
            {/* Envelope body */}
            <div className="envelope-body">
              {/* Card inside (peeks out) */}
              <div className={`inner-card ${stage === 1 ? 'card-rising' : ''}`}>
                <div className="inner-card-edge" />
                <span className="inner-peek-text">You're Invited</span>
              </div>

              {/* Front face with wax seal */}
              <div className="envelope-front">
                <div className="wax-seal">
                  <span className="seal-letter">F</span>
                </div>
              </div>

              {/* Flap */}
              <div className={`envelope-flap-demo ${stage === 1 ? 'flap-open' : ''}`}>
                <div className="flap-inner" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STAGE 2: INVITATION CARD ═══ */}
      {stage === 2 && (
        <div className="invitation-scene">
          <div className="invitation-card">
            {/* Venue image */}
            <div className="invitation-image">
              <img src="/images/demo-venue.png" alt="Wedding Venue" />
              <div className="image-overlay-gradient" />
            </div>

            {/* Card content */}
            <div className="invitation-content">
              <div className="inv-ornament">✦ ✦ ✦</div>
              <p className="inv-eyebrow">Together with their families</p>
              <h1 className="inv-couple">
                <span className="inv-name-script">Sophia</span>
                <span className="inv-ampersand">&</span>
                <span className="inv-name-script">Alexander</span>
              </h1>
              <p className="inv-subtitle">Request the pleasure of your company at their wedding celebration</p>

              <div className="inv-divider" />

              <div className="inv-details">
                <div className="inv-detail-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div>
                    <strong>Saturday, September 20th, 2025</strong>
                    <span>Ceremony begins at 4:00 PM</span>
                  </div>
                </div>
                <div className="inv-detail-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div>
                    <strong>The Grand Rosewood Estate</strong>
                    <span>142 Garden Terrace, Belmont Hills</span>
                  </div>
                </div>
                <div className="inv-detail-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <div>
                    <strong>Reception to follow</strong>
                    <span>Dinner, dancing & celebration until midnight</span>
                  </div>
                </div>
              </div>

              <div className="inv-divider" />

              <p className="inv-dress-code">Dress Code: <strong>Black Tie Optional</strong></p>

              <button className="inv-rsvp-btn" onClick={handleRSVP}>
                RSVP Now
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STAGE 3: RSVP FORM ═══ */}
      {stage === 3 && (
        <div className="rsvp-scene">
          <div className="rsvp-card">
            <div className="rsvp-header">
              <button className="rsvp-back-arrow" onClick={() => setStage(2)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#77736A" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div>
                <h2 className="rsvp-title">RSVP</h2>
                <p className="rsvp-couple-small">Sophia & Alexander's Wedding</p>
              </div>
            </div>

            <form onSubmit={handleSubmitRSVP} className="rsvp-form">
              {/* Name */}
              <div className="rsvp-field">
                <label className="rsvp-label">Your Full Name</label>
                <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                  placeholder="Enter your name" className="rsvp-input" required />
              </div>

              {/* Attending */}
              <div className="rsvp-field">
                <label className="rsvp-label">Will you be attending?</label>
                <div className="attend-toggle">
                  <button type="button" className={`attend-btn ${attending === true ? 'attend-yes' : ''}`}
                    onClick={() => setAttending(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round"/><path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Joyfully Accept
                  </button>
                  <button type="button" className={`attend-btn ${attending === false ? 'attend-no' : ''}`}
                    onClick={() => setAttending(false)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6" strokeLinecap="round"/></svg>
                    Respectfully Decline
                  </button>
                </div>
              </div>

              {/* Conditional fields */}
              {attending === true && (
                <>
                  {/* Guest Count */}
                  <div className="rsvp-field">
                    <label className="rsvp-label">Number of Guests</label>
                    <div className="guest-counter">
                      <button type="button" className="counter-btn" onClick={() => setGuestCount(Math.max(1, guestCount - 1))}>−</button>
                      <span className="counter-value">{guestCount}</span>
                      <button type="button" className="counter-btn" onClick={() => setGuestCount(Math.min(5, guestCount + 1))}>+</button>
                    </div>
                  </div>

                  {/* Meal */}
                  <div className="rsvp-field">
                    <label className="rsvp-label">Meal Preference</label>
                    <div className="meal-grid">
                      {[
                        { id: 'filet', icon: '🥩', name: 'Filet Mignon', desc: 'Herb-crusted, truffle jus' },
                        { id: 'salmon', icon: '🐟', name: 'Atlantic Salmon', desc: 'Citrus glaze, asparagus' },
                        { id: 'veggie', icon: '🌿', name: 'Garden Risotto', desc: 'Wild mushroom, parmesan' },
                      ].map(meal => (
                        <button key={meal.id} type="button"
                          className={`meal-card ${mealChoice === meal.id ? 'meal-selected' : ''}`}
                          onClick={() => setMealChoice(meal.id)}>
                          <span className="meal-icon">{meal.icon}</span>
                          <strong className="meal-name">{meal.name}</strong>
                          <span className="meal-desc">{meal.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="rsvp-submit" disabled={!guestName || attending === null}>
                {attending === false ? 'Send Response' : 'Confirm RSVP'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ STAGE 4: CONFIRMATION ═══ */}
      {stage === 4 && (
        <div className="confirm-scene">
          {/* Celebration particles */}
          {particles.map(p => (
            <div key={p.id} className={`particle particle-${p.type}`} style={{
              left: `${p.x}%`, animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              width: `${p.size}px`, height: `${p.size}px`,
              transform: `rotate(${p.rotation}deg)`,
            }} />
          ))}

          <div className="confirm-card">
            <div className="confirm-check-circle">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" className="check-path" />
              </svg>
            </div>

            {attending ? (
              <>
                <h1 className="confirm-heading">You're on the Guest List!</h1>
                <p className="confirm-sub">
                  Thank you, <strong>{guestName}</strong>! We can't wait to celebrate with you{guestCount > 1 ? ` and your ${guestCount - 1} guest${guestCount > 2 ? 's' : ''}` : ''}.
                </p>
                <div className="confirm-summary">
                  <div className="summary-row"><span>📅</span><span>Saturday, September 20th, 2025</span></div>
                  <div className="summary-row"><span>📍</span><span>The Grand Rosewood Estate</span></div>
                  <div className="summary-row"><span>👥</span><span>{guestCount} guest{guestCount > 1 ? 's' : ''}</span></div>
                  {mealChoice && <div className="summary-row"><span>🍽️</span><span>{mealChoice === 'filet' ? 'Filet Mignon' : mealChoice === 'salmon' ? 'Atlantic Salmon' : 'Garden Risotto'}</span></div>}
                </div>
              </>
            ) : (
              <>
                <h1 className="confirm-heading">Response Received</h1>
                <p className="confirm-sub">
                  Thank you, <strong>{guestName}</strong>. We're sorry you can't make it, but we appreciate you letting us know.
                </p>
              </>
            )}

            <div className="confirm-qr-section">
              <div className="qr-mock">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="4" width="14" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5"/><rect x="7" y="7" width="8" height="8" rx="1" fill="#B8944F" opacity="0.3"/>
                  <rect x="30" y="4" width="14" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5"/><rect x="33" y="7" width="8" height="8" rx="1" fill="#B8944F" opacity="0.3"/>
                  <rect x="4" y="30" width="14" height="14" rx="2" stroke="#B8944F" strokeWidth="1.5"/><rect x="7" y="33" width="8" height="8" rx="1" fill="#B8944F" opacity="0.3"/>
                  <rect x="22" y="22" width="4" height="4" fill="#B8944F" opacity="0.5"/><rect x="30" y="30" width="4" height="4" fill="#B8944F" opacity="0.3"/>
                  <rect x="36" y="36" width="8" height="8" rx="1" fill="#B8944F" opacity="0.2"/>
                </svg>
              </div>
              <p className="qr-text">Your digital check-in QR code</p>
            </div>

            <div className="confirm-actions">
              <button className="confirm-restart" onClick={handleReset}>Try Again</button>
              <Link href="/" className="confirm-cta">Get Started with Fancy RSVP</Link>
            </div>

            <p className="demo-badge">✨ This was an interactive demo — <Link href="/register" className="demo-badge-link">Create your own event</Link></p>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ═══ PAGE ═══ */
        .demo-page {
          min-height: 100vh;
          background: #0D0D0F;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: var(--font-sans), Lato, sans-serif;
        }

        /* ── Bokeh Background ── */
        .demo-bg { position: absolute; inset: 0; pointer-events: none; }
        .bokeh-dot {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(184,148,79,0.6) 0%, transparent 70%);
          animation: bokehFloat 8s ease-in-out infinite alternate;
        }
        @keyframes bokehFloat {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-30px) scale(1.2); }
        }

        /* ── Back Button ── */
        .demo-back {
          position: fixed; top: 24px; left: 24px; z-index: 100;
          display: flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 600;
          text-decoration: none; transition: color 0.3s;
          font-family: var(--font-sans);
        }
        .demo-back:hover { color: #D7BE80; }

        /* ═══ STAGE 0-1: ENVELOPE ═══ */
        .envelope-scene {
          display: flex; flex-direction: column; align-items: center; gap: 32px;
          animation: fadeInScale 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .tap-hint {
          color: rgba(255,255,255,0.4); font-size: 14px; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          animation: hintPulse 2s ease-in-out infinite;
          height: 20px;
        }
        @keyframes hintPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }

        .envelope-wrapper {
          width: 320px; height: 220px;
          position: relative; cursor: pointer;
          perspective: 1200px;
          transition: transform 0.3s ease;
        }
        .scene-ready .envelope-wrapper:hover { transform: scale(1.03) translateY(-4px); }
        .scene-opening .envelope-wrapper { cursor: default; }

        .envelope-body {
          width: 100%; height: 100%;
          position: relative;
          background: linear-gradient(145deg, #F5EFE4 0%, #EDE5D5 100%);
          border-radius: 4px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(184,148,79,0.08);
          overflow: visible;
        }
        .envelope-body::before {
          content: ''; position: absolute; inset: 6px;
          border: 1px solid rgba(184,148,79,0.15); border-radius: 2px; pointer-events: none;
        }

        /* Inner card */
        .inner-card {
          position: absolute; left: 20px; right: 20px; bottom: 20px;
          height: 160px; background: #FFFFFF;
          border: 1px solid rgba(184,148,79,0.2); border-radius: 3px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          transition: transform 1s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1;
        }
        .card-rising { transform: translateY(-200px); opacity: 0; }
        .inner-card-edge {
          position: absolute; top: 0; left: 20px; right: 20px;
          height: 1px; background: linear-gradient(90deg, transparent, #D7BE80, transparent);
        }
        .inner-peek-text {
          font-family: var(--font-script); font-size: 22px; color: #B8944F;
        }

        /* Envelope front (covers card) */
        .envelope-front {
          position: absolute; bottom: 0; left: 0; right: 0; height: 55%;
          background: linear-gradient(170deg, #EDE5D5 0%, #E5DCC8 100%);
          border-radius: 0 0 4px 4px;
          display: flex; align-items: center; justify-content: center;
          z-index: 5;
          clip-path: polygon(0 35%, 50% 0, 100% 35%, 100% 100%, 0 100%);
        }

        /* Wax seal */
        .wax-seal {
          width: 52px; height: 52px; border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #C9433A 0%, #8B2E28 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(139,46,40,0.4), inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.1);
          margin-top: 10px;
        }
        .seal-letter {
          font-family: var(--font-serif); font-size: 22px; font-weight: 700;
          color: rgba(255,255,255,0.9); text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        /* Flap */
        .envelope-flap-demo {
          position: absolute; top: 0; left: 0; right: 0; height: 50%;
          transform-origin: top center;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }
        .flap-inner {
          width: 100%; height: 100%;
          background: linear-gradient(180deg, #E8DFD0 0%, #F0E8D8 100%);
          clip-path: polygon(0 0, 100% 0, 50% 100%);
          border-radius: 4px 4px 0 0;
        }
        .flap-open {
          transform: rotateX(180deg);
          z-index: 0;
        }

        /* ═══ STAGE 2: INVITATION ═══ */
        .invitation-scene {
          animation: cardReveal 0.8s cubic-bezier(0.16,1,0.3,1) both;
          padding: 20px;
          max-height: 100vh;
          overflow-y: auto;
        }
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .invitation-card {
          width: 420px; max-width: 90vw;
          background: #FFFFFF; border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(184,148,79,0.15);
        }
        .invitation-image {
          position: relative; height: 200px; overflow: hidden;
        }
        .invitation-image img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .image-overlay-gradient {
          position: absolute; bottom: 0; left: 0; right: 0; height: 60%;
          background: linear-gradient(to top, #FFFFFF 0%, transparent 100%);
        }

        .invitation-content {
          padding: 8px 32px 32px; text-align: center;
        }
        .inv-ornament { color: #D7BE80; font-size: 10px; letter-spacing: 8px; margin-bottom: 12px; }
        .inv-eyebrow {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;
          color: #77736A; font-weight: 600; margin-bottom: 8px;
        }
        .inv-couple { margin: 8px 0 4px; line-height: 1.2; }
        .inv-name-script {
          font-family: var(--font-script); font-size: 42px; color: #191B1E;
          display: block;
        }
        .inv-ampersand {
          font-family: var(--font-serif); font-size: 20px; color: #B8944F;
          display: block; margin: 2px 0;
        }
        .inv-subtitle {
          font-size: 13px; color: #77736A; line-height: 1.6;
          max-width: 300px; margin: 12px auto 0; font-style: italic;
          font-family: var(--font-serif);
        }
        .inv-divider {
          width: 50px; height: 1px; margin: 20px auto;
          background: linear-gradient(90deg, transparent, #D7BE80, transparent);
        }
        .inv-details { text-align: left; display: flex; flex-direction: column; gap: 14px; }
        .inv-detail-row {
          display: flex; align-items: flex-start; gap: 12px;
        }
        .inv-detail-row svg { flex-shrink: 0; margin-top: 2px; }
        .inv-detail-row strong { font-size: 13px; color: #191B1E; display: block; font-weight: 600; }
        .inv-detail-row span { font-size: 12px; color: #77736A; }
        .inv-dress-code {
          font-size: 12px; color: #77736A; margin-bottom: 4px;
          letter-spacing: 0.05em;
        }
        .inv-dress-code strong { color: #191B1E; }
        .inv-rsvp-btn {
          width: 100%; padding: 16px; margin-top: 8px;
          background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
          color: white; border: none; border-radius: 12px;
          font-size: 14px; font-weight: 700; letter-spacing: 0.08em;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.3s ease; font-family: var(--font-sans);
        }
        .inv-rsvp-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(184,148,79,0.4);
        }

        /* ═══ STAGE 3: RSVP FORM ═══ */
        .rsvp-scene {
          animation: cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) both;
          padding: 20px; max-height: 100vh; overflow-y: auto;
        }
        .rsvp-card {
          width: 440px; max-width: 90vw;
          background: #FFFFFF; border-radius: 20px; overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(184,148,79,0.15);
          padding: 32px;
        }
        .rsvp-header {
          display: flex; align-items: center; gap: 16px; margin-bottom: 28px;
        }
        .rsvp-back-arrow {
          width: 40px; height: 40px; border-radius: 10px;
          background: #FAFAF8; border: 1px solid #E8E2D6;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; flex-shrink: 0;
        }
        .rsvp-back-arrow:hover { border-color: #B8944F; }
        .rsvp-title {
          font-family: var(--font-serif); font-size: 24px; font-weight: 600;
          color: #191B1E; margin: 0;
        }
        .rsvp-couple-small {
          font-size: 12px; color: #77736A; margin: 2px 0 0;
        }
        .rsvp-form { display: flex; flex-direction: column; gap: 24px; }
        .rsvp-label {
          display: block; font-size: 11px; font-weight: 700; color: #77736A;
          text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;
        }
        .rsvp-input {
          width: 100%; padding: 14px 16px; border: 1.5px solid #E8E2D6;
          border-radius: 10px; background: #FAFAF8; color: #191B1E;
          font-size: 14px; font-family: var(--font-sans);
          outline: none; transition: all 0.3s; box-sizing: border-box;
        }
        .rsvp-input:focus { border-color: #B8944F; background: #FFF; box-shadow: 0 0 0 3px rgba(184,148,79,0.08); }
        .rsvp-input::placeholder { color: #B5B0A7; }

        /* Attend toggle */
        .attend-toggle { display: flex; gap: 12px; }
        .attend-btn {
          flex: 1; padding: 14px 12px; border: 1.5px solid #E8E2D6;
          border-radius: 12px; background: #FAFAF8; color: #77736A;
          font-size: 13px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.3s; font-family: var(--font-sans);
        }
        .attend-btn:hover { border-color: #D7BE80; }
        .attend-yes {
          border-color: #B8944F; background: rgba(184,148,79,0.06);
          color: #B8944F; box-shadow: 0 0 0 3px rgba(184,148,79,0.08);
        }
        .attend-no {
          border-color: #9F1239; background: rgba(159,18,57,0.04);
          color: #9F1239;
        }

        /* Guest counter */
        .guest-counter {
          display: flex; align-items: center; gap: 20px;
          justify-content: center;
        }
        .counter-btn {
          width: 44px; height: 44px; border-radius: 12px;
          border: 1.5px solid #E8E2D6; background: #FAFAF8;
          font-size: 20px; color: #191B1E; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; font-family: var(--font-sans);
        }
        .counter-btn:hover { border-color: #B8944F; background: rgba(184,148,79,0.06); }
        .counter-value {
          font-family: var(--font-serif); font-size: 28px; font-weight: 700;
          color: #191B1E; min-width: 40px; text-align: center;
        }

        /* Meal grid */
        .meal-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .meal-card {
          padding: 16px 8px; border: 1.5px solid #E8E2D6; border-radius: 12px;
          background: #FAFAF8; cursor: pointer; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          transition: all 0.3s; font-family: var(--font-sans);
        }
        .meal-card:hover { border-color: #D7BE80; }
        .meal-selected {
          border-color: #B8944F; background: rgba(184,148,79,0.06);
          box-shadow: 0 0 0 3px rgba(184,148,79,0.08);
        }
        .meal-icon { font-size: 24px; }
        .meal-name { font-size: 12px; color: #191B1E; }
        .meal-desc { font-size: 10px; color: #77736A; }

        .rsvp-submit {
          width: 100%; padding: 16px;
          background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
          color: white; border: none; border-radius: 12px;
          font-size: 14px; font-weight: 700; letter-spacing: 0.06em;
          cursor: pointer; transition: all 0.3s; font-family: var(--font-sans);
        }
        .rsvp-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,0.3); }
        .rsvp-submit:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ═══ STAGE 4: CONFIRMATION ═══ */
        .confirm-scene {
          animation: cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) both;
          padding: 20px; position: relative;
          max-height: 100vh; overflow-y: auto;
        }
        .particle {
          position: fixed; z-index: 50; pointer-events: none;
          animation: particleFall linear forwards;
          top: -20px;
        }
        .particle-circle {
          border-radius: 50%;
          background: #B8944F;
        }
        .particle-diamond {
          background: #D7BE80;
          transform: rotate(45deg);
        }
        @keyframes particleFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }

        .confirm-card {
          width: 440px; max-width: 90vw; background: #FFFFFF;
          border-radius: 20px; overflow: hidden; padding: 40px 32px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(184,148,79,0.15);
          text-align: center; position: relative; z-index: 10;
        }
        .confirm-check-circle {
          width: 80px; height: 80px; border-radius: 50%;
          background: rgba(184,148,79,0.08); border: 2px solid rgba(184,148,79,0.2);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px;
          animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes popIn { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .check-path {
          stroke-dasharray: 24; stroke-dashoffset: 24;
          animation: drawCheck 0.6s 0.3s ease forwards;
        }
        @keyframes drawCheck { to { stroke-dashoffset: 0; } }

        .confirm-heading {
          font-family: var(--font-serif); font-size: 26px; font-weight: 600;
          color: #191B1E; margin: 0 0 12px;
        }
        .confirm-sub {
          font-size: 14px; color: #77736A; line-height: 1.7;
          margin: 0 0 24px; max-width: 340px; margin-left: auto; margin-right: auto;
        }
        .confirm-sub strong { color: #B8944F; }

        .confirm-summary {
          background: #FAFAF8; border: 1px solid #E8E2D6; border-radius: 12px;
          padding: 16px 20px; margin-bottom: 24px; text-align: left;
          display: flex; flex-direction: column; gap: 10px;
        }
        .summary-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #191B1E; }

        .confirm-qr-section { margin-bottom: 24px; }
        .qr-mock {
          width: 72px; height: 72px; margin: 0 auto 8px;
          background: #FAFAF8; border: 1px solid #E8E2D6; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .qr-text { font-size: 11px; color: #77736A; }

        .confirm-actions { display: flex; gap: 12px; margin-bottom: 20px; }
        .confirm-restart {
          flex: 1; padding: 14px; border: 1.5px solid #E8E2D6;
          border-radius: 12px; background: transparent; color: #77736A;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all 0.3s; font-family: var(--font-sans);
        }
        .confirm-restart:hover { border-color: #B8944F; color: #B8944F; }
        .confirm-cta {
          flex: 2; padding: 14px;
          background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%);
          color: white; border: none; border-radius: 12px;
          font-size: 13px; font-weight: 700; text-align: center;
          text-decoration: none; transition: all 0.3s; font-family: var(--font-sans);
          display: flex; align-items: center; justify-content: center;
        }
        .confirm-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,0.3); }

        .demo-badge {
          font-size: 11px; color: #77736A; margin: 0; padding-top: 16px;
          border-top: 1px solid #E8E2D6;
        }
        .demo-badge-link { color: #B8944F; font-weight: 700; text-decoration: none; }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 480px) {
          .envelope-wrapper { width: 260px; height: 180px; }
          .inv-name-script { font-size: 32px; }
          .invitation-content { padding: 8px 20px 24px; }
          .rsvp-card, .confirm-card { padding: 24px 20px; }
          .meal-grid { grid-template-columns: 1fr; }
          .attend-toggle { flex-direction: column; }
          .confirm-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
