'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useIsClient } from '../utils/useIsClient';

export default function DemoPage() {
  const [phase, setPhase] = useState('closed');
  const [flipping, setFlipping] = useState(false);
  const isClient = useIsClient();
  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [mealChoice, setMealChoice] = useState('');
  const [confetti, setConfetti] = useState([]);

  const handleOpen = () => {
    if (phase !== 'closed') return;
    setFlipping(true);
    setTimeout(() => setPhase('invite'), 1200);
  };

  const handleSubmitRSVP = (e) => {
    e.preventDefault();
    if (!guestName || attending === null) return;
    setConfetti(Array.from({ length: 60 }, (_, i) => ({
      id: i, x: 10 + Math.random() * 80, size: 4 + Math.random() * 10,
      delay: Math.random() * 1.5, dur: 2.5 + Math.random() * 2,
      rot: Math.random() * 360,
      color: ['#B8944F','#D7BE80','#E8DFD0','#FFFFFF','#F5EFE4'][Math.floor(Math.random()*5)],
    })));
    setPhase('done');
  };

  if (!isClient) return null;

  return (
    <div className="demo">
      {/* Back */}
      <Link href="/" className="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5m7-7l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </Link>

      {/* ═══════════════════════════════════════════
          CLOSED CARD — Luxury 3D Flip
          ═══════════════════════════════════════════ */}
      {phase === 'closed' && (
        <div className="closed-scene">
          {/* Ambient light */}
          <div className="amb-glow" />
          <div className="amb-glow amb-glow-2" />

          {/* The Card */}
          <div
            className={`flip-card ${flipping ? 'is-flipping' : ''}`}
            onClick={handleOpen}
            role="button"
            tabIndex={0}
            aria-label="Tap to open your invitation"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
          >
            <div className="flip-inner">
              {/* ── FRONT FACE ── */}
              <div className="flip-front">
                {/* BG Image */}
                <Image src="/images/demo-venue.png" alt="" fill priority sizes="(max-width: 768px) 320px, 440px" className="front-bg" />
                <div className="front-overlay" />

                {/* Gold border frame */}
                <div className="front-frame">
                  <div className="frame-inner">
                    {/* Corner ornaments */}
                    <div className="f-corner f-tl">
                      <svg width="32" height="32" viewBox="0 0 32 32"><path d="M2 30 C2 14 14 2 30 2" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="30" cy="2" r="1.5" fill="#D7BE80" opacity=".6"/><circle cx="2" cy="30" r="1.5" fill="#D7BE80" opacity=".6"/></svg>
                    </div>
                    <div className="f-corner f-tr">
                      <svg width="32" height="32" viewBox="0 0 32 32"><path d="M30 30 C30 14 18 2 2 2" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="2" cy="2" r="1.5" fill="#D7BE80" opacity=".6"/><circle cx="30" cy="30" r="1.5" fill="#D7BE80" opacity=".6"/></svg>
                    </div>
                    <div className="f-corner f-bl">
                      <svg width="32" height="32" viewBox="0 0 32 32"><path d="M2 2 C2 18 14 30 30 30" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="2" cy="2" r="1.5" fill="#D7BE80" opacity=".6"/><circle cx="30" cy="30" r="1.5" fill="#D7BE80" opacity=".6"/></svg>
                    </div>
                    <div className="f-corner f-br">
                      <svg width="32" height="32" viewBox="0 0 32 32"><path d="M30 2 C30 18 18 30 2 30" stroke="#D7BE80" strokeWidth="1.2" fill="none"/><circle cx="30" cy="2" r="1.5" fill="#D7BE80" opacity=".6"/><circle cx="2" cy="30" r="1.5" fill="#D7BE80" opacity=".6"/></svg>
                    </div>

                    {/* Content */}
                    <div className="front-content">
                      <div className="fc-ornament">
                        <span className="fc-line" />
                        <span className="fc-star">✦</span>
                        <span className="fc-line" />
                      </div>

                      <p className="fc-label">YOU ARE CORDIALLY INVITED TO</p>
                      <p className="fc-label-sub">THE WEDDING CELEBRATION OF</p>

                      <h1 className="fc-names">
                        <span className="fc-script">Sophia</span>
                        <span className="fc-and">&</span>
                        <span className="fc-script">Alexander</span>
                      </h1>

                      <div className="fc-divider">
                        <span /><span className="fc-diamond">◆</span><span />
                      </div>

                      <p className="fc-date">SATURDAY, THE TWENTIETH OF SEPTEMBER</p>
                      <p className="fc-year">TWO THOUSAND AND TWENTY-FIVE</p>

                      <div className="fc-venue-line">
                        <span className="fc-vl" />
                        <p className="fc-venue">THE GRAND ROSEWOOD ESTATE</p>
                        <span className="fc-vl" />
                      </div>

                      <div className="fc-ornament fc-ornament-bottom">
                        <span className="fc-line" />
                        <span className="fc-star">✦</span>
                        <span className="fc-line" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shimmer effect */}
                <div className="front-shimmer" />
              </div>
            </div>
          </div>

          {/* Tap hint */}
          <div className={`tap-hint ${flipping ? 'hint-gone' : ''}`}>
            <div className="tap-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span>Tap to Open Invitation</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          INVITATION CARD
          ═══════════════════════════════════════════ */}
      {(phase === 'invite' || phase === 'rsvp') && (
        <div className="invite-phase">
          <div className="invite-scroll">
            <div className="card">
              <div className="card-border-top">
                <svg viewBox="0 0 400 24" className="ornate-svg">
                  <path d="M0,12 C50,0 100,24 150,12 C200,0 250,24 300,12 C350,0 400,24 400,12" stroke="#D7BE80" strokeWidth="0.8" fill="none" opacity="0.5"/>
                  <path d="M0,12 C50,24 100,0 150,12 C200,24 250,0 300,12 C350,24 400,0 400,12" stroke="#D7BE80" strokeWidth="0.8" fill="none" opacity="0.5"/>
                </svg>
              </div>

              <div className="gold-frame">
                <svg className="corner-fl corner-tl" viewBox="0 0 60 60"><path d="M5,55 C5,30 15,15 55,5" stroke="#D7BE80" strokeWidth="1" fill="none"/><path d="M10,55 C10,35 20,20 55,10" stroke="#D7BE80" strokeWidth="0.5" fill="none" opacity="0.5"/><circle cx="55" cy="5" r="2" fill="#D7BE80" opacity="0.4"/></svg>
                <svg className="corner-fl corner-tr" viewBox="0 0 60 60"><path d="M55,55 C55,30 45,15 5,5" stroke="#D7BE80" strokeWidth="1" fill="none"/><path d="M50,55 C50,35 40,20 5,10" stroke="#D7BE80" strokeWidth="0.5" fill="none" opacity="0.5"/><circle cx="5" cy="5" r="2" fill="#D7BE80" opacity="0.4"/></svg>
                <svg className="corner-fl corner-bl" viewBox="0 0 60 60"><path d="M5,5 C5,30 15,45 55,55" stroke="#D7BE80" strokeWidth="1" fill="none"/><path d="M10,5 C10,25 20,40 55,50" stroke="#D7BE80" strokeWidth="0.5" fill="none" opacity="0.5"/><circle cx="55" cy="55" r="2" fill="#D7BE80" opacity="0.4"/></svg>
                <svg className="corner-fl corner-br" viewBox="0 0 60 60"><path d="M55,5 C55,30 45,45 5,55" stroke="#D7BE80" strokeWidth="1" fill="none"/><path d="M50,5 C50,25 40,40 5,50" stroke="#D7BE80" strokeWidth="0.5" fill="none" opacity="0.5"/><circle cx="5" cy="55" r="2" fill="#D7BE80" opacity="0.4"/></svg>

                <div className="venue-img">
                  <Image src="/images/demo-venue.png" alt="Venue" fill sizes="(max-width: 768px) 320px, 440px" />
                  <div className="venue-fade" />
                </div>

                <div className="inv-body">
                  <div className="inv-ornament-top">✦</div>
                  <p className="inv-together">Together with their families</p>
                  <h1 className="inv-names">
                    <span className="name-script">Sophia</span>
                    <span className="name-and">&</span>
                    <span className="name-script">Alexander</span>
                  </h1>
                  <p className="inv-request">invite you to celebrate their marriage</p>

                  <div className="inv-gold-line">
                    <span className="line-dot" /><span className="line-bar" /><span className="line-diamond">◆</span><span className="line-bar" /><span className="line-dot" />
                  </div>

                  <div className="inv-details-grid">
                    <div className="detail-block">
                      <span className="detail-label">THE DATE</span>
                      <span className="detail-value">Saturday, September 20th</span>
                      <span className="detail-sub">Two Thousand Twenty-Five</span>
                    </div>
                    <div className="detail-divider" />
                    <div className="detail-block">
                      <span className="detail-label">THE TIME</span>
                      <span className="detail-value">Four O&apos;Clock</span>
                      <span className="detail-sub">in the Afternoon</span>
                    </div>
                  </div>

                  <div className="detail-block venue-block">
                    <span className="detail-label">THE VENUE</span>
                    <span className="detail-value venue-name">The Grand Rosewood Estate</span>
                    <span className="detail-sub">142 Garden Terrace · Belmont Hills</span>
                  </div>

                  <p className="inv-reception">Dinner, Dancing & Celebration to Follow</p>
                  <p className="inv-dress">Dress Code: <em>Black Tie Optional</em></p>

                  {phase === 'invite' && (
                    <button className="rsvp-open-btn" onClick={() => setPhase('rsvp')}>
                      <span className="rsvp-btn-inner">
                        <span className="rsvp-btn-text">Répondez S&apos;il Vous Plaît</span>
                        <span className="rsvp-btn-sub">KINDLY RESPOND BY AUGUST 15TH</span>
                      </span>
                    </button>
                  )}

                  {phase === 'rsvp' && (
                    <div className="rsvp-inline">
                      <div className="rsvp-divider-line"><span /><span className="rsvp-divider-text">RSVP</span><span /></div>
                      <form onSubmit={handleSubmitRSVP} className="rsvp-form">
                        <div className="field">
                          <label>Guest Name</label>
                          <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                            placeholder="Your full name" required className="elegant-input" />
                        </div>
                        <div className="field">
                          <label>Attendance</label>
                          <div className="attend-row">
                            <button type="button" className={`attend-opt ${attending === true ? 'active-yes' : ''}`} onClick={() => setAttending(true)}>
                              <span className="att-radio" /><span>Joyfully Accepts</span>
                            </button>
                            <button type="button" className={`attend-opt ${attending === false ? 'active-no' : ''}`} onClick={() => setAttending(false)}>
                              <span className="att-radio" /><span>Respectfully Declines</span>
                            </button>
                          </div>
                        </div>
                        {attending === true && (
                          <>
                            <div className="field">
                              <label>Number Attending</label>
                              <div className="counter">
                                <button type="button" onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="counter-btn">−</button>
                                <span className="counter-num">{guestCount}</span>
                                <button type="button" onClick={() => setGuestCount(Math.min(5, guestCount + 1))} className="counter-btn">+</button>
                              </div>
                            </div>
                            <div className="field">
                              <label>Dinner Selection</label>
                              <div className="meal-row">
                                {[
                                  { id: 'filet', name: 'Filet Mignon', desc: 'Herb-crusted, truffle jus' },
                                  { id: 'salmon', name: 'Pan-Seared Salmon', desc: 'Citrus glaze, asparagus' },
                                  { id: 'risotto', name: 'Wild Mushroom Risotto', desc: 'Truffle oil, parmesan' },
                                ].map(m => (
                                  <button key={m.id} type="button" className={`meal-opt ${mealChoice === m.id ? 'meal-active' : ''}`}
                                    onClick={() => setMealChoice(m.id)}>
                                    <span className="meal-radio" />
                                    <div><strong>{m.name}</strong><small>{m.desc}</small></div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                        <button type="submit" className="submit-rsvp" disabled={!guestName || attending === null}>Send Response</button>
                      </form>
                    </div>
                  )}
                  <div className="inv-ornament-bottom">✦</div>
                </div>
              </div>

              <div className="card-border-bottom">
                <svg viewBox="0 0 400 24" className="ornate-svg">
                  <path d="M0,12 C50,0 100,24 150,12 C200,0 250,24 300,12 C350,0 400,24 400,12" stroke="#D7BE80" strokeWidth="0.8" fill="none" opacity="0.5"/>
                  <path d="M0,12 C50,24 100,0 150,12 C200,24 250,0 300,12 C350,24 400,0 400,12" stroke="#D7BE80" strokeWidth="0.8" fill="none" opacity="0.5"/>
                </svg>
              </div>
            </div>
            <p className="demo-tag">✨ Interactive Demo — <Link href="/register" className="demo-tag-link">Create Your Own Event</Link></p>
          </div>
        </div>
      )}

      {/* ═══ CONFIRMATION ═══ */}
      {phase === 'done' && (
        <div className="done-phase">
          {confetti.map(c => (
            <div key={c.id} className="conf-piece" style={{
              left: `${c.x}%`, width: c.size, height: c.size,
              animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`,
              background: c.color, transform: `rotate(${c.rot}deg)`,
            }} />
          ))}
          <div className="done-card">
            <div className="done-check">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#B8944F" strokeWidth="2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" className="draw-check" />
              </svg>
            </div>
            {attending ? (
              <>
                <h1 className="done-title">You&apos;re on the Guest List!</h1>
                <p className="done-sub">Thank you, <strong>{guestName}</strong>. We can&apos;t wait to celebrate with you{guestCount > 1 ? ` and your ${guestCount - 1} guest${guestCount > 2 ? 's' : ''}` : ''}.</p>
                <div className="done-summary">
                  <div className="sum-item"><span>📅</span> Saturday, September 20th, 2025</div>
                  <div className="sum-item"><span>📍</span> The Grand Rosewood Estate</div>
                  <div className="sum-item"><span>👥</span> {guestCount} guest{guestCount > 1 ? 's' : ''}</div>
                  {mealChoice && <div className="sum-item"><span>🍽️</span> {mealChoice === 'filet' ? 'Filet Mignon' : mealChoice === 'salmon' ? 'Pan-Seared Salmon' : 'Wild Mushroom Risotto'}</div>}
                </div>
              </>
            ) : (
              <>
                <h1 className="done-title">Response Received</h1>
                <p className="done-sub">Thank you, <strong>{guestName}</strong>. We&apos;ll miss you!</p>
              </>
            )}
            <div className="done-actions">
              <button onClick={() => { setPhase('closed'); setFlipping(false); setGuestName(''); setAttending(null); setGuestCount(1); setMealChoice(''); setConfetti([]); }}
                className="btn-retry">Try Again</button>
              <Link href="/register" className="btn-start">Create Your Event</Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ═══ BASE ═══ */
        .demo {
          min-height: 100vh;
          background: #08080A;
          position: relative;
          overflow-x: hidden;
          font-family: var(--font-sans);
        }
        .back-link {
          position: fixed; top: 24px; left: 24px; z-index: 100;
          display: flex; align-items: center; gap: 8px;
          color: rgba(255,255,255,.35); font-size: 12px; font-weight: 600;
          text-decoration: none; letter-spacing: .06em; transition: color .3s;
        }
        .back-link:hover { color: #D7BE80; }

        /* ═══ CLOSED SCENE ═══ */
        .closed-scene {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 32px; position: relative;
          animation: sceneFadeIn 1s ease both;
        }
        @keyframes sceneFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* Ambient glows */
        .amb-glow {
          position: absolute;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(184,148,79,.07) 0%, transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: glowBreathe 5s ease-in-out infinite;
          pointer-events: none;
        }
        .amb-glow-2 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(184,148,79,.04) 0%, transparent 70%);
          animation-delay: 2.5s;
        }
        @keyframes glowBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: .6; }
        }

        /* ── Flip Card ── */
        .flip-card {
          width: 440px; height: 600px;
          perspective: 2000px;
          cursor: pointer;
          position: relative; z-index: 2;
        }
        .flip-inner {
          width: 100%; height: 100%;
          transition: transform 1.2s cubic-bezier(.4, 0, .2, 1);
          transform-style: preserve-3d;
        }
        .is-flipping .flip-inner {
          transform: rotateY(90deg) scale(.92);
        }

        /* ── Front Face ── */
        .flip-front {
          width: 100%; height: 100%;
          position: relative;
          overflow: hidden;
          box-shadow:
            0 40px 80px rgba(0,0,0,.6),
            0 0 0 1px rgba(215,190,128,.15),
            0 0 120px rgba(184,148,79,.05);
        }
        .front-bg {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          filter: brightness(.35) saturate(.8);
        }
        .front-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            180deg,
            rgba(8,8,10,.3) 0%,
            rgba(8,8,10,.1) 30%,
            rgba(8,8,10,.1) 70%,
            rgba(8,8,10,.4) 100%
          );
        }

        /* Gold border frame */
        .front-frame {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .frame-inner {
          position: absolute;
          inset: 20px;
          border: 1px solid rgba(215,190,128,.35);
        }
        .frame-inner::after {
          content: ''; position: absolute; inset: 4px;
          border: 1px solid rgba(215,190,128,.15);
        }

        /* Corners */
        .f-corner { position: absolute; z-index: 2; }
        .f-tl { top: -1px; left: -1px; }
        .f-tr { top: -1px; right: -1px; }
        .f-bl { bottom: -1px; left: -1px; }
        .f-br { bottom: -1px; right: -1px; }

        /* Content on front */
        .front-content {
          position: relative; z-index: 3;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; padding: 48px 40px;
          text-align: center;
        }

        .fc-ornament {
          display: flex; align-items: center; gap: 12px; margin-bottom: 28px;
        }
        .fc-ornament-bottom { margin-bottom: 0; margin-top: 28px; }
        .fc-line {
          width: 40px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(215,190,128,.5), transparent);
        }
        .fc-star { color: #D7BE80; font-size: 12px; opacity: .7; }

        .fc-label {
          font-size: 9px; font-weight: 700; letter-spacing: .35em;
          color: rgba(215,190,128,.7); margin: 0 0 4px;
          font-family: var(--font-sans);
        }
        .fc-label-sub {
          font-size: 8px; font-weight: 600; letter-spacing: .3em;
          color: rgba(255,255,255,.3); margin: 0 0 24px;
          font-family: var(--font-sans);
        }

        .fc-names { margin: 0; line-height: 1.05; }
        .fc-script {
          font-family: var(--font-script);
          font-size: 52px; color: #FFFFFF;
          display: block; font-weight: 400;
          text-shadow: 0 2px 20px rgba(184,148,79,.2);
        }
        .fc-and {
          font-family: var(--font-serif);
          font-size: 20px; color: #D7BE80;
          display: block; font-style: italic;
          margin: 4px 0;
        }

        .fc-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 24px 0;
        }
        .fc-divider span:first-child, .fc-divider span:last-child {
          width: 50px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(215,190,128,.4), transparent);
        }
        .fc-diamond { color: #D7BE80; font-size: 8px; opacity: .6; }

        .fc-date {
          font-family: var(--font-sans);
          font-size: 10px; font-weight: 700; letter-spacing: .3em;
          color: rgba(255,255,255,.65); margin: 0 0 4px;
        }
        .fc-year {
          font-family: var(--font-serif);
          font-size: 11px; font-weight: 400; font-style: italic;
          color: rgba(255,255,255,.4); margin: 0 0 24px;
          letter-spacing: .1em;
        }

        .fc-venue-line {
          display: flex; align-items: center; gap: 16px;
        }
        .fc-vl {
          width: 24px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(215,190,128,.3), transparent);
        }
        .fc-venue {
          font-family: var(--font-serif);
          font-size: 11px; font-weight: 500; letter-spacing: .2em;
          color: rgba(215,190,128,.8); margin: 0;
        }

        /* Shimmer sweep */
        .front-shimmer {
          position: absolute; inset: 0; z-index: 4;
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(215,190,128,.06) 45%,
            rgba(215,190,128,.12) 50%,
            rgba(215,190,128,.06) 55%,
            transparent 60%
          );
          background-size: 300% 100%;
          animation: shimmerSweep 4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes shimmerSweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Tap Hint ── */
        .tap-hint {
          display: flex; align-items: center; gap: 10px;
          color: rgba(255,255,255,.3);
          font-size: 13px; font-weight: 500;
          letter-spacing: .12em; text-transform: uppercase;
          animation: hintFloat 3s ease-in-out infinite;
          transition: opacity .5s;
        }
        .hint-gone { opacity: 0; pointer-events: none; }
        .tap-icon {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(215,190,128,.2);
          display: flex; align-items: center; justify-content: center;
          animation: tapPulse 2s ease-in-out infinite;
        }
        @keyframes tapPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(215,190,128,.15); }
          50% { box-shadow: 0 0 0 10px rgba(215,190,128,0); }
        }
        @keyframes hintFloat {
          0%, 100% { transform: translateY(0); opacity: .3; }
          50% { transform: translateY(-4px); opacity: .6; }
        }

        /* ═══ INVITATION ═══ */
        .invite-phase {
          min-height: 100vh; display: flex; justify-content: center;
          padding: 40px 20px; position: relative; z-index: 1;
          animation: invReveal 1s cubic-bezier(.16,1,.3,1) both;
          background: linear-gradient(180deg, #08080A 0%, #111114 50%, #08080A 100%);
        }
        @keyframes invReveal { from { opacity:0; transform:scale(.92); } to { opacity:1; transform:scale(1); } }
        .invite-scroll { max-width: 520px; width: 100%; }

        .card {
          background: linear-gradient(170deg, #FFFDF9 0%, #FBF8F2 40%, #F8F4EC 100%);
          border-radius: 4px; overflow: hidden; position: relative;
          box-shadow: 0 40px 100px rgba(0,0,0,.6), 0 0 0 1px rgba(215,190,128,.2), 0 0 120px rgba(184,148,79,.06);
        }
        .card::before {
          content: ''; position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D7BE80' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          pointer-events: none; z-index: 0;
        }

        .card-border-top, .card-border-bottom { padding: 8px 20px; }
        .ornate-svg { width: 100%; height: 24px; }

        .gold-frame { margin: 0 16px 16px; border: 1px solid rgba(215,190,128,.25); position: relative; z-index: 1; }
        .gold-frame::before { content: ''; position: absolute; inset: 3px; border: 1px solid rgba(215,190,128,.12); pointer-events: none; }
        .corner-fl { position: absolute; width: 50px; height: 50px; z-index: 2; }
        .corner-tl { top: -1px; left: -1px; }
        .corner-tr { top: -1px; right: -1px; }
        .corner-bl { bottom: -1px; left: -1px; }
        .corner-br { bottom: -1px; right: -1px; }

        .venue-img { height: 220px; overflow: hidden; position: relative; }
        .venue-img img { width: 100%; height: 100%; object-fit: cover; filter: brightness(.95) contrast(1.05); }
        .venue-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 80%; background: linear-gradient(to top, #FFFDF9 0%, rgba(255,253,249,.8) 40%, transparent 100%); }

        .inv-body { padding: 0 36px 36px; text-align: center; position: relative; }
        .inv-ornament-top, .inv-ornament-bottom { color: #D7BE80; font-size: 14px; letter-spacing: 6px; margin: 4px 0 16px; }
        .inv-ornament-bottom { margin: 28px 0 0; }
        .inv-together { font-family: var(--font-serif); font-size: 11px; text-transform: uppercase; letter-spacing: .25em; color: #9A9590; margin: 0 0 12px; font-weight: 500; }
        .inv-names { margin: 0 0 8px; line-height: 1.1; }
        .name-script { font-family: var(--font-script); font-size: clamp(38px, 8vw, 56px); color: #191B1E; display: block; font-weight: 400; }
        .name-and { font-family: var(--font-serif); font-size: 18px; color: #B8944F; display: block; font-style: italic; }
        .inv-request { font-family: var(--font-serif); font-size: 13px; font-style: italic; color: #77736A; margin: 8px 0 0; letter-spacing: .03em; }

        .inv-gold-line { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 24px 0; }
        .line-dot { width: 4px; height: 4px; border-radius: 50%; background: #D7BE80; }
        .line-bar { width: 40px; height: 1px; background: linear-gradient(90deg, transparent, #D7BE80, transparent); }
        .line-diamond { color: #D7BE80; font-size: 8px; line-height: 1; }

        .inv-details-grid { display: flex; justify-content: center; gap: 24px; margin-bottom: 20px; }
        .detail-block { text-align: center; }
        .detail-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: .25em; text-transform: uppercase; color: #B8944F; margin-bottom: 6px; font-family: var(--font-sans); }
        .detail-value { display: block; font-family: var(--font-serif); font-size: 15px; font-weight: 500; color: #191B1E; }
        .detail-sub { display: block; font-family: var(--font-serif); font-size: 12px; color: #77736A; font-style: italic; margin-top: 2px; }
        .detail-divider { width: 1px; background: linear-gradient(to bottom, transparent, #D7BE80, transparent); align-self: stretch; }
        .venue-block { margin-bottom: 20px; }
        .venue-name { font-size: 17px !important; }
        .inv-reception { font-family: var(--font-serif); font-size: 12px; font-style: italic; color: #77736A; margin: 0 0 4px; letter-spacing: .05em; }
        .inv-dress { font-size: 11px; color: #9A9590; margin: 0 0 24px; letter-spacing: .05em; }

        .rsvp-open-btn { width: 100%; padding: 0; border: none; background: none; cursor: pointer; }
        .rsvp-btn-inner { display: block; padding: 20px; border: 1.5px solid #D7BE80; background: linear-gradient(135deg, rgba(184,148,79,.04) 0%, rgba(215,190,128,.08) 100%); transition: all .4s ease; }
        .rsvp-btn-inner:hover { background: linear-gradient(135deg, rgba(184,148,79,.08) 0%, rgba(215,190,128,.14) 100%); border-color: #B8944F; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,.1); }
        .rsvp-btn-text { display: block; font-family: var(--font-serif); font-size: 16px; font-style: italic; color: #B8944F; letter-spacing: .08em; }
        .rsvp-btn-sub { display: block; font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: #9A9590; margin-top: 6px; font-family: var(--font-sans); }

        .rsvp-inline { animation: formSlide .6s cubic-bezier(.16,1,.3,1) both; }
        @keyframes formSlide { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .rsvp-divider-line { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
        .rsvp-divider-line span:first-child, .rsvp-divider-line span:last-child { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #D7BE80, transparent); }
        .rsvp-divider-text { font-family: var(--font-serif); font-size: 14px; font-weight: 600; color: #B8944F; letter-spacing: .3em; }

        .rsvp-form { display: flex; flex-direction: column; gap: 22px; text-align: left; }
        .field label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .2em; color: #9A9590; margin-bottom: 8px; font-family: var(--font-sans); }
        .elegant-input { width: 100%; padding: 14px 16px; border: 1px solid #E8E2D6; border-radius: 0; background: rgba(255,255,255,.6); color: #191B1E; font-size: 14px; font-family: var(--font-serif); outline: none; transition: all .3s; box-sizing: border-box; }
        .elegant-input:focus { border-color: #B8944F; background: #FFFFFF; box-shadow: 0 0 0 3px rgba(184,148,79,.06); }
        .elegant-input::placeholder { color: #C5C0B8; font-style: italic; }

        .attend-row { display: flex; flex-direction: column; gap: 8px; }
        .attend-opt { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #E8E2D6; background: rgba(255,255,255,.4); cursor: pointer; transition: all .3s; font-family: var(--font-serif); font-size: 14px; color: #4A4A4A; }
        .attend-opt:hover { border-color: #D7BE80; }
        .att-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #E8E2D6; transition: all .3s; flex-shrink: 0; }
        .active-yes { border-color: #B8944F; background: rgba(184,148,79,.04); }
        .active-yes .att-radio { border-color: #B8944F; background: #B8944F; box-shadow: inset 0 0 0 3px #FFFDF9; }
        .active-no { border-color: #C45E5E; background: rgba(196,94,94,.03); }
        .active-no .att-radio { border-color: #C45E5E; background: #C45E5E; box-shadow: inset 0 0 0 3px #FFFDF9; }

        .counter { display: flex; align-items: center; justify-content: center; gap: 20px; }
        .counter-btn { width: 40px; height: 40px; border: 1px solid #E8E2D6; background: rgba(255,255,255,.5); font-size: 18px; color: #191B1E; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .2s; font-family: var(--font-sans); }
        .counter-btn:hover { border-color: #B8944F; }
        .counter-num { font-family: var(--font-serif); font-size: 24px; font-weight: 700; color: #191B1E; min-width: 32px; text-align: center; }

        .meal-row { display: flex; flex-direction: column; gap: 8px; }
        .meal-opt { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 1px solid #E8E2D6; background: rgba(255,255,255,.4); cursor: pointer; transition: all .3s; text-align: left; font-family: var(--font-sans); }
        .meal-opt:hover { border-color: #D7BE80; }
        .meal-radio { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #E8E2D6; transition: all .3s; flex-shrink: 0; margin-top: 2px; }
        .meal-active { border-color: #B8944F; background: rgba(184,148,79,.04); }
        .meal-active .meal-radio { border-color: #B8944F; background: #B8944F; box-shadow: inset 0 0 0 3px #FFFDF9; }
        .meal-opt strong { display: block; font-size: 13px; color: #191B1E; font-weight: 600; }
        .meal-opt small { display: block; font-size: 11px; color: #77736A; margin-top: 2px; }

        .submit-rsvp { width: 100%; padding: 16px; border: none; background: linear-gradient(135deg, #B8944F 0%, #D7BE80 100%); color: #FFF; font-size: 13px; font-weight: 700; font-family: var(--font-sans); letter-spacing: .1em; cursor: pointer; transition: all .3s; text-transform: uppercase; margin-top: 4px; }
        .submit-rsvp:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,.3); }
        .submit-rsvp:disabled { opacity: .4; cursor: not-allowed; }

        .demo-tag { text-align: center; color: rgba(255,255,255,.3); font-size: 12px; margin: 24px 0 0; }
        .demo-tag-link { color: #D7BE80; text-decoration: none; font-weight: 700; }

        /* ═══ DONE ═══ */
        .done-phase { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; position: relative; z-index: 1; }
        .conf-piece { position: fixed; top: -20px; border-radius: 2px; animation: confFall linear forwards; z-index: 0; pointer-events: none; }
        @keyframes confFall { 0% { opacity:1; transform:translateY(0) rotate(0); } 100% { opacity:0; transform:translateY(100vh) rotate(720deg); } }

        .done-card { max-width: 420px; width: 100%; background: #FFFDF9; border: 1px solid rgba(215,190,128,.2); padding: 48px 36px; text-align: center; position: relative; z-index: 1; box-shadow: 0 40px 80px rgba(0,0,0,.4); animation: cardPop .6s cubic-bezier(.16,1,.3,1) both; }
        @keyframes cardPop { from { opacity:0; transform:scale(.9) translateY(20px); } to { opacity:1; transform:scale(1) translateY(0); } }

        .done-check { width: 80px; height: 80px; border-radius: 50%; background: rgba(184,148,79,.06); border: 2px solid rgba(184,148,79,.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; animation: popIn .5s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes popIn { from { transform:scale(.3); opacity:0; } to { transform:scale(1); opacity:1; } }
        .draw-check { stroke-dasharray: 24; stroke-dashoffset: 24; animation: drawLine .6s .3s ease forwards; }
        @keyframes drawLine { to { stroke-dashoffset: 0; } }

        .done-title { font-family: var(--font-serif); font-size: 26px; font-weight: 600; color: #191B1E; margin: 0 0 12px; }
        .done-sub { font-size: 14px; color: #77736A; line-height: 1.7; margin: 0 0 24px; }
        .done-sub strong { color: #B8944F; }
        .done-summary { background: #F8F4EC; border: 1px solid #E8E2D6; padding: 16px 20px; margin-bottom: 24px; text-align: left; display: flex; flex-direction: column; gap: 10px; }
        .sum-item { font-size: 13px; color: #191B1E; display: flex; align-items: center; gap: 10px; }

        .done-actions { display: flex; gap: 12px; }
        .btn-retry { flex: 1; padding: 14px; border: 1px solid #E8E2D6; background: transparent; color: #77736A; font-size: 12px; font-weight: 700; cursor: pointer; transition: all .3s; font-family: var(--font-sans); letter-spacing: .05em; }
        .btn-retry:hover { border-color: #B8944F; color: #B8944F; }
        .btn-start { flex: 2; padding: 14px; background: linear-gradient(135deg,#B8944F,#D7BE80); color: #FFF; font-size: 12px; font-weight: 700; text-align: center; text-decoration: none; font-family: var(--font-sans); letter-spacing: .05em; transition: all .3s; display: flex; align-items: center; justify-content: center; }
        .btn-start:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,148,79,.3); }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 500px) {
          .flip-card { width: 320px; height: 460px; }
          .fc-script { font-size: 38px; }
          .fc-label { font-size: 8px; letter-spacing: .25em; }
          .front-content { padding: 32px 24px; }
          .fc-ornament { margin-bottom: 20px; }
          .fc-ornament-bottom { margin-top: 20px; }
          .fc-divider { margin: 16px 0; }
          .fc-year { margin-bottom: 16px; }

          .inv-body { padding: 0 20px 28px; }
          .name-script { font-size: 36px; }
          .inv-details-grid { flex-direction: column; gap: 16px; }
          .detail-divider { width: 40px; height: 1px; margin: 0 auto; }
          .venue-img { height: 160px; }
          .gold-frame { margin: 0 10px 10px; }
          .done-card { padding: 32px 20px; }
          .done-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
