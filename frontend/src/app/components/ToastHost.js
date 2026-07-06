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
          top: max(24px, calc(env(safe-area-inset-top) + 12px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 100001;
          width: max-content;
          max-width: min(420px, calc(100vw - 32px));
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
