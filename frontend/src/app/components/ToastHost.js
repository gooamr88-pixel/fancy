'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import ToastCard from './ToastCard';
import { subscribeToasts } from '../utils/toast';

// Cap how many alerts stack at once — a runaway caller (e.g. a retry loop)
// shouldn't be able to fill the whole screen. Lower than it used to be because
// these are now full-width banners, not corner cards: three already occupy
// ~180px of the viewport.
const MAX_STACKED = 3;

/**
 * Mounts once (in the root layout) and renders global alerts raised via
 * `toast.*` through the shared <ToastCard/>, stacked in arrival order so an
 * earlier one isn't silently replaced before it's read or dismissed.
 *
 * Positioning is the shared `.fx-alert-viewport` class in globals.css — the
 * same one <Toast/> uses. It used to be a <style jsx> block duplicated between
 * the two files, each carrying a comment asking the next person to keep them in
 * sync; they had already drifted once.
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
    <div className="fx-alert-viewport" role="status" aria-live="assertive">
      <AnimatePresence initial={false}>
        {queue.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
