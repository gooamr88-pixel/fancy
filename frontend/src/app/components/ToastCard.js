'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * A single toast bubble: icon, message, close button, auto-dismiss timer, and
 * a horizontal swipe-to-dismiss gesture (the expected mobile toast interaction).
 * Rendered inside a fixed-position viewport by <Toast/> (single) or
 * <ToastHost/> (stacked queue) — this component owns no positioning itself.
 *
 * @param {{message: string, kind?: 'error'|'success'}} toast
 * @param {() => void} onClose
 * @param {number} [duration] ms before auto-dismiss. Pass 0 to disable.
 */
export default function ToastCard({ toast, onClose, duration }) {
  const kind = toast?.kind === 'success' ? 'success' : 'error';
  const autoMs = duration ?? (kind === 'success' ? 3500 : 6000);
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

  const SWIPE_DISMISS_DISTANCE = 80;
  const SWIPE_DISMISS_VELOCITY = 500;

  return (
    <motion.div
      className={`toast toast-${kind}`}
      drag={reduceMotion ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > SWIPE_DISMISS_DISTANCE || Math.abs(info.velocity.x) > SWIPE_DISMISS_VELOCITY) {
          onCloseRef.current();
        }
      }}
      initial={reduceMotion ? false : { opacity: 0, x: 36, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 36, transition: { duration: 0.22 } }}
      transition={{ duration: reduceMotion ? 0.01 : 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="toast-icon" aria-hidden="true">
        {kind === 'success' ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>

      {/* Premium dark charcoal shell shared by every kind (matches the site's
          own hero/footer dark tone, not a generic UI-kit default) — only the
          icon badge and left accent rule change color, so the brand identity
          (charcoal + gold) stays intact regardless of message type, and the
          card reads clearly against any page background it lands on. */}
      <style jsx>{`
        .toast {
          pointer-events: auto;
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 16px 15px 18px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1.5;
          font-family: var(--font-sans), Lato, sans-serif;
          background: #21232A;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 45px rgba(10, 10, 12, 0.4), 0 2px 8px rgba(10, 10, 12, 0.25);
          color: #F3F0E8;
          cursor: grab;
          touch-action: pan-y;
          overflow: hidden;
        }
        .toast:active {
          cursor: grabbing;
        }
        .toast::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
        }
        .toast-error::before {
          background: #C45E5E;
        }
        .toast-success::before {
          background: #3B9B6D;
        }
        .toast-icon {
          flex-shrink: 0;
          margin-top: 1px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .toast-error .toast-icon {
          background: #C45E5E;
        }
        .toast-success .toast-icon {
          background: #3B9B6D;
        }
        .toast-message {
          flex: 1;
          min-width: 0;
          word-break: break-word;
          padding-top: 2px;
          color: #F3F0E8;
        }
        .toast-close {
          flex-shrink: 0;
          background: none;
          border: none;
          padding: 2px;
          margin: 0 -4px 0 0;
          cursor: pointer;
          color: #F3F0E8;
          opacity: 0.5;
          display: flex;
          transition: opacity 0.2s;
        }
        .toast-close:hover {
          opacity: 0.9;
        }
      `}</style>
    </motion.div>
  );
}
