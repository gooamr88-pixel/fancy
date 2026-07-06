'use client';

import ToastCard from './ToastCard';

/**
 * Lightweight toast notification, styled to match the Fancy RSVP auth theme.
 *
 * Controlled component: render it with a `toast` object ({ message, kind }) to
 * show, or `null` to hide. Calls `onClose` when the auto-dismiss timer fires,
 * the user clicks the close button, or swipes it away.
 *
 *   const [toast, setToast] = useState(null);
 *   <Toast toast={toast} onClose={() => setToast(null)} />
 *   setToast({ message: 'Invalid email or password.', kind: 'error' });
 *
 * For a global, stacked multi-toast queue (raised via `toast.error(...)` from
 * anywhere in the app), see <ToastHost/> instead — it renders the same
 * <ToastCard/> in its own viewport and handles more than one at a time.
 *
 * @param {{message: string, kind?: 'error'|'success'}|null} toast
 * @param {() => void} onClose
 * @param {number} [duration]  ms before auto-dismiss. Errors default to 6000,
 *                             success to 3500. Pass 0 to disable auto-dismiss.
 */
export default function Toast({ toast, onClose, duration }) {
  if (!toast) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="assertive">
      <ToastCard toast={toast} onClose={onClose} duration={duration} />

      <style jsx>{`
        .toast-viewport {
          position: fixed;
          /* MOB-8: was a bare 24px, so a notch/Dynamic Island could clip it;
             also raised above LogoutModal's z-index:100000 (and every other
             modal) — a toast fired while a modal is open must stay visible,
             not render invisibly underneath it. */
          top: max(24px, calc(env(safe-area-inset-top) + 12px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 100001;
          width: max-content;
          max-width: min(420px, calc(100vw - 32px));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
