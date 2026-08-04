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
 * For the global, stacked queue (raised via `toast.error(...)` from anywhere in
 * the app), see <ToastHost/> — same <ToastCard/>, same `.fx-alert-viewport`,
 * but it handles more than one at a time.
 *
 * @param {{message: string, kind?: 'error'|'success'}|null} toast
 * @param {() => void} onClose
 * @param {number} [duration]  ms before auto-dismiss. Errors default to 10000,
 *                             success to 4000. Pass 0 to disable auto-dismiss.
 */
export default function Toast({ toast, onClose, duration }) {
  if (!toast) return null;

  // Positioning is the shared global class, not a local <style jsx> block. The
  // two viewports each used to carry their own copy with a comment asking the
  // next person to keep them in sync — which is not a mechanism, and they had
  // already drifted apart once.
  return (
    <div className="fx-alert-viewport" role="status" aria-live="assertive">
      <ToastCard toast={toast} onClose={onClose} duration={duration} />
    </div>
  );
}
