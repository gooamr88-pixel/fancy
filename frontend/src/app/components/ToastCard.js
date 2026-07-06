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
      initial={reduceMotion ? false : { opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="toast-icon" aria-hidden="true">
        {kind === 'success' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>

      <style jsx>{`
        .toast {
          pointer-events: auto;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1.45;
          font-family: var(--font-sans), Lato, sans-serif;
          box-shadow: 0 12px 32px rgba(25, 27, 30, 0.18);
          border: 1px solid transparent;
          cursor: grab;
          touch-action: pan-y;
        }
        .toast:active {
          cursor: grabbing;
        }
        .toast-error {
          background: #FFF1F2;
          border-color: #FECDD3;
          color: #9F1239;
        }
        .toast-success {
          background: #ECFDF5;
          border-color: #A7F3D0;
          color: #065F46;
        }
        .toast-icon {
          flex-shrink: 0;
          margin-top: 1px;
          display: flex;
        }
        .toast-message {
          flex: 1;
          min-width: 0;
          word-break: break-word;
        }
        .toast-close {
          flex-shrink: 0;
          background: none;
          border: none;
          padding: 2px;
          margin: -2px -4px -2px 0;
          cursor: pointer;
          color: inherit;
          opacity: 0.55;
          display: flex;
          transition: opacity 0.2s;
        }
        .toast-close:hover {
          opacity: 1;
        }
      `}</style>
    </motion.div>
  );
}
