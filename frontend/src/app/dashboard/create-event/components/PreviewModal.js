'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import GuestExperiencePreview from '../../../components/templates/GuestExperiencePreview';
import PreviewFrame from '../../../components/templates/PreviewFrame';
import Icon from '../../../components/icons/Icon';

/* ═══════════════════════════════════════════════════════════════
   "This is what your guests will get."

   A full-screen surface over the wizard showing the real guest experience,
   driven by the organizer's unsaved state — the arrival, the hero, every
   section they configured in the order they arranged, and their own RSVP
   form. Follows EventSettings' RevealPreviewModal (backdrop + Escape to
   close, phone frame, replay); adds the two axes that modal never had:

     DEVICE    the same page at 390px and at full width. Most guests are on a
               phone, but the organizer is looking at a desktop right now and
               will assume what they see is what everyone gets.
     LANGUAGE  the invitation is bilingual and half its audience reads
               right-to-left. Until now that half was unpreviewable — the
               organizer could type Arabic into the fields and never once see
               the page it produced.
   ═══════════════════════════════════════════════════════════════ */

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF',
};

const PHONE_W = 390;

function Segmented({ options, value, onChange, label }) {
  return (
    <div
      role="group" aria-label={label}
      style={{
        // Wrappable, per the ratchet in test/mobileFit.test.js. A no-op at any
        // width these two- and three-option toggles actually reach, and the
        // alternative — a row whose min-content is the sum of its children —
        // is what used to push this dashboard sideways on a 320px screen.
        display: 'flex', flexWrap: 'wrap', gap: 2, padding: 3, borderRadius: 999,
        background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)',
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: active ? C.white : 'transparent',
              color: active ? C.charcoal : 'rgba(255,255,255,0.82)',
              fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700,
              transition: 'background 0.18s ease, color 0.18s ease',
            }}
          >
            {o.icon && <Icon name={o.icon} size={13} strokeWidth={1.8} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PreviewModal({
  event, invitationPattern, invitationTheme, invitationData, onClose,
  /* True when opened from Stage 1, where the organizer has entered nothing and
     an empty page would show them nothing to judge. False from Stage 2, where
     the question is "what will my guests get" and inventing an itinerary they
     never wrote answers a different one. */
  showSampleContent = false,
}) {
  const [device, setDevice] = useState('phone');
  const [lang, setLang] = useState('en');
  const [replayKey, setReplayKey] = useState(0);

  const dialogRef = useRef(null);

  /* `aria-modal="true"` is a promise to assistive tech that the rest of the
     page is inert. Nothing enforced it: focus stayed on the Preview button in
     the wizard behind, and Tab walked straight back into a form the user
     cannot see. Escape alone is not a substitute — it closes the dialog rather
     than letting anyone operate it.

     A minimal trap: move focus in on open, cycle it at the ends, and hand it
     back to whatever opened this on close. */
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    window.addEventListener('keydown', onKey);
    // The wizard scrolls behind this; letting it move while a full-screen
    // overlay is up is how a modal loses its place on close.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  const isPhone = device === 'phone';

  /* Escape, for the frame's own document.

     The listener above is on the host `window`, and the preview is an iframe:
     once the organizer clicks into it — the first thing anyone does — focus is
     in a different document and Escape never reaches this component. The ×
     button still worked, but a dialog that stops answering Escape as soon as
     you interact with it is a dialog that feels stuck. Tab is deliberately NOT
     forwarded: inside the frame the browser's own focus order is already
     correct and cycling it from out here would fight it. */
  const onFrameKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog" aria-modal="true" aria-label="Invitation preview"
      // Focusable so the trap has somewhere to land on open, but not a tab
      // stop of its own once the user starts cycling.
      tabIndex={-1}
      onClick={onClose}
      style={{
        outline: 'none',
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        background: 'rgba(18,16,14,0.86)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        padding: '18px 16px max(18px, calc(env(safe-area-inset-bottom) + 10px))',
      }}
    >
      {/* ── Toolbar ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
          gap: 10, width: '100%', maxWidth: 980, flexShrink: 0,
        }}
      >
        <span style={{
          marginInlineEnd: 'auto', color: C.white, fontFamily: 'var(--font-serif)',
          fontSize: 15, fontWeight: 600, letterSpacing: '0.01em',
        }}>
          What your guests will see
        </span>

        <Segmented
          label="Device"
          value={device}
          onChange={setDevice}
          options={[
            { value: 'phone', label: 'Phone', icon: 'mobile' },
            // Icon.js has no monitor glyph and this is not the place to add a
            // one-off; the label carries it.
            { value: 'desktop', label: 'Desktop' },
          ]}
        />
        <Segmented
          label="Language"
          value={lang}
          onChange={setLang}
          options={[{ value: 'en', label: 'EN' }, { value: 'ar', label: 'AR' }]}
        />

        <button
          type="button"
          onClick={() => setReplayKey((n) => n + 1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)',
            color: C.white, fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700,
          }}
        >
          <Icon name="play" size={13} strokeWidth={1.9} />
          Replay opening
        </button>

        <button
          type="button" onClick={onClose} aria-label="Close preview"
          style={{
            width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)',
            color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* ── The frame ──
          PreviewFrame gives the page inside its OWN viewport, which is what
          makes "Phone" mean anything: at 390px the guest page's media queries,
          `vw` type scale and `100dvh` sections resolve against the frame, so
          this is the mobile layout rather than the desktop one shrunk. It is
          also what makes the DEVICE toggle honest — switching to Desktop
          genuinely re-lays-out at 980px instead of just widening a box. See
          PreviewFrame.js for why nothing short of a real viewport does this.

          `transform: translateZ(0)` stays for PreviewFrame's inline fallback
          path. If the frame document is ever unreachable the page renders
          directly in this box, and its chrome — language pill, music toggle,
          calendar button, scroll-progress bar, scroll-to-RSVP cue — plus both
          cinematic openings are all `position: fixed`. Without a transformed
          ancestor they would resolve against the window and scatter across the
          modal. A transform makes this element their containing block. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', flex: 1, minHeight: 0, width: '100%',
          maxWidth: isPhone ? PHONE_W : 980,
          borderRadius: isPhone ? 30 : 14, overflow: 'hidden',
          background: C.white,
          border: isPhone ? '7px solid #171614' : '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7)',
          transform: 'translateZ(0)',
        }}
      >
        <PreviewFrame
          title="Guest invitation preview"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          onDocumentKeyDown={onFrameKeyDown}
          style={{ width: '100%', height: '100%' }}
        >
          <GuestExperiencePreview
            event={event}
            lang={lang}
            onLangChange={setLang}
            replayKey={replayKey}
            playOpening
            showSampleContent={showSampleContent}
            invitationPattern={invitationPattern}
            invitationTheme={invitationTheme}
            invitationData={invitationData}
          />
        </PreviewFrame>
      </div>

      <p
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: 0, flexShrink: 0, color: 'rgba(255,255,255,0.62)',
          fontFamily: 'var(--font-sans)', fontSize: 11.5, textAlign: 'center',
        }}
      >
        Live preview of your unsaved changes. Replies sent from here are not recorded.
      </p>
    </div>
  );
}
