'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * One alert banner: icon, message, close button, auto-dismiss timer with a
 * visible countdown, and swipe-up-to-dismiss. Rendered inside a fixed viewport
 * by <Toast/> (single) or <ToastHost/> (stacked queue) — this component owns no
 * positioning itself.
 *
 * ALL STYLING LIVES IN globals.css (.fx-alert*), NOT IN A <style jsx> BLOCK
 * HERE, AND THAT IS DELIBERATE. This card's root is a <motion.div>, and
 * styled-jsx stamps its jsx-<hash> class only onto lowercase intrinsic
 * elements. The previous version put `.toast { background; padding; box-shadow;
 * color }` in a scoped block, so those rules compiled to `.toast.jsx-hash` and
 * matched nothing — the card had no background at all, while
 * `.toast-message { color: #F3F0E8 }` on a plain <span> applied normally.
 * Every error on the platform was near-white text painted straight onto the
 * page behind it. Do not move these rules back.
 *
 * @param {{message: string, kind?: 'error'|'success'}} toast
 * @param {() => void} onClose
 * @param {number} [duration] ms before auto-dismiss. Pass 0 to disable.
 */
export default function ToastCard({ toast, onClose, duration }) {
  const kind = toast?.kind === 'success' ? 'success' : 'error';
  // An error is something the reader has to ACT on, and 6s was not enough to
  // read a sentence and reach for the thing it names. A success is only an
  // acknowledgement and can leave sooner. Neither is permanent: a banner that
  // never goes away ends up covering the header the reader needs next.
  const autoMs = duration ?? (kind === 'success' ? 4000 : 10000);
  const reduceMotion = useReducedMotion();

  // Callers pass a fresh inline `onClose` on every render, so keeping it out of
  // the timer effect's deps via a ref avoids re-arming the dismiss timer on
  // every unrelated re-render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!toast || autoMs <= 0) return undefined;
    const timer = setTimeout(() => onCloseRef.current(), autoMs);
    return () => clearTimeout(timer);
    // Re-arm only when a genuinely new toast object is shown, not on every render.
  }, [toast, autoMs]);

  if (!toast) return null;

  const SWIPE_DISMISS_DISTANCE = 56;
  const SWIPE_DISMISS_VELOCITY = 400;

  return (
    <motion.div
      className={`fx-alert fx-alert--${kind}`}
      // Up, not sideways: a full-width banner's escape route is the edge it
      // arrived from, and there is nowhere for it to go horizontally.
      drag={reduceMotion ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.5, bottom: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -SWIPE_DISMISS_DISTANCE || info.velocity.y < -SWIPE_DISMISS_VELOCITY) {
          onCloseRef.current();
        }
      }}
      initial={reduceMotion ? false : { y: '-100%' }}
      animate={{ y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { y: '-100%', transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: reduceMotion ? 0.01 : 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="fx-alert__inner">
        <span className="fx-alert__icon" aria-hidden="true">
          {kind === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 7v6m0 4h.01" strokeLinecap="round" />
            </svg>
          )}
        </span>

        {/* dir="auto" per message, not per app: this host lives in the LTR root
            layout, but half the platform's messages are Arabic. Without it an
            Arabic sentence renders with its punctuation stranded on the wrong
            end. "auto" resolves direction from the first strong character, so
            each banner orients itself. */}
        <span className="fx-alert__message" dir="auto">{toast.message}</span>

        <button type="button" className="fx-alert__close" onClick={onClose} aria-label="Dismiss">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Skipped when auto-dismiss is off, and when the reader has asked for
          less motion — a 10-second linear animation is exactly the kind of
          thing prefers-reduced-motion exists to stop. */}
      {autoMs > 0 && !reduceMotion && (
        <motion.div
          className="fx-alert__countdown"
          aria-hidden="true"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: autoMs / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}
