'use client';

import { useState, useEffect, useCallback } from 'react';
import Toast from './Toast';
import { subscribeToasts } from '../utils/toast';

/**
 * Mounts once (in the root layout) and renders global toasts raised via `toast.*`
 * through the shared <Toast/> UI. Latest toast wins (one at a time), matching the
 * one-at-a-time UX of the native alert() it replaces — but professional and on-brand.
 */
export default function ToastHost() {
  const [current, setCurrent] = useState(null);
  useEffect(() => subscribeToasts((t) => setCurrent(t)), []);
  const onClose = useCallback(() => setCurrent(null), []);
  return <Toast toast={current} onClose={onClose} />;
}
