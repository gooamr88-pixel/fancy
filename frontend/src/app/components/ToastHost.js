'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import ToastCard from './ToastCard';
import { subscribeToasts } from '../utils/toast';

// Cap how many toasts stack at once — a runaway caller (e.g. a retry loop)
// shouldn't be able to fill the whole screen with toasts.
const MAX_STACKED = 4;

/**
 * Mounts once (in the root layout) and renders global toasts raised via `toast.*`
 * through the shared <ToastCard/> UI, stacked in the order they arrive so an
 * earlier toast isn't silently replaced/lost before it's read or dismissed.
 */
export default function ToastHost() {
  const [queue, setQueue] = useState([]);

  useEffect(() => subscribeToasts((t) => {
    setQueue((q) => [...q, t].slice(-MAX_STACKED));
  }), []);

  const dismiss = useCallback((id) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="toast-stack-viewport" role="status" aria-live="assertive">
      <AnimatePresence initial={false}>
        {queue.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>

      <style jsx>{`
        .toast-stack-viewport {
          position: fixed;
          /* Cleared below the tallest sticky in-app header (the organizer
             dashboard's title bar, ~92px) so a toast never lands on top of
             a page heading — it was rendering at the very top of the
             viewport and covering the dashboard's title/back bar. */
          top: max(100px, calc(env(safe-area-inset-top) + 88px));
          right: max(20px, calc(env(safe-area-inset-right) + 16px));
          z-index: 100001;
          width: max-content;
          max-width: min(400px, calc(100vw - 32px));
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          pointer-events: none;
        }
        @media (max-width: 480px) {
          .toast-stack-viewport {
            left: 16px;
            right: 16px;
            max-width: none;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}
