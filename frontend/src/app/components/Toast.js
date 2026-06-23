'use client';

import { useEffect } from 'react';

/**
 * Lightweight toast notification, styled to match the Fancy RSVP auth theme.
 *
 * Controlled component: render it with a `toast` object ({ message, kind }) to
 * show, or `null` to hide. Calls `onClose` when the auto-dismiss timer fires or
 * the user clicks the close button.
 *
 *   const [toast, setToast] = useState(null);
 *   <Toast toast={toast} onClose={() => setToast(null)} />
 *   setToast({ message: 'Invalid email or password.', kind: 'error' });
 *
 * @param {{message: string, kind?: 'error'|'success'}|null} toast
 * @param {() => void} onClose
 * @param {number} [duration]  ms before auto-dismiss. Errors default to 6000,
 *                             success to 3500. Pass 0 to disable auto-dismiss.
 */
export default function Toast({ toast, onClose, duration }) {
  const kind = toast?.kind === 'success' ? 'success' : 'error';
  const autoMs = duration ?? (kind === 'success' ? 3500 : 6000);

  useEffect(() => {
    if (!toast || autoMs <= 0) return undefined;
    const id = setTimeout(onClose, autoMs);
    return () => clearTimeout(id);
    // Re-arm the timer whenever a new toast is shown.
  }, [toast, autoMs, onClose]);

  if (!toast) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="assertive">
      <div className={`toast toast-${kind}`}>
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
      </div>

      <style jsx>{`
        .toast-viewport {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          width: max-content;
          max-width: min(420px, calc(100vw - 32px));
          pointer-events: none;
        }
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
          animation: toastIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
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
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(-14px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
