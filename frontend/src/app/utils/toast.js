'use client';

// Tiny global toast bus so any component can raise a professional toast without
// prop-drilling a setter. <ToastHost/> (mounted once in the root layout) subscribes
// and renders them through the shared <Toast/> UI — replacing native alert() dialogs.

// HMR safety: during hot-module replacement the module scope is re-evaluated,
// which would re-create the listeners array and orphan existing subscribers.
// By storing listeners on `window` they survive module re-evaluation.
if (typeof window !== 'undefined' && !window.__toastListeners) {
  window.__toastListeners = [];
}
const getListeners = () => (typeof window !== 'undefined' ? (window.__toastListeners || []) : []);
let seq = 0;

export function subscribeToasts(fn) {
  const listeners = getListeners();
  listeners.push(fn);
  return () => {
    const ls = getListeners();
    const idx = ls.indexOf(fn);
    if (idx !== -1) ls.splice(idx, 1);
  };
}

function emit(message, kind) {
  const text = message == null ? '' : String(message);
  if (!text.trim()) return;
  const payload = { id: ++seq, message: text, kind };
  getListeners().forEach((l) => { try { l(payload); } catch { /* a bad listener must not block others */ } });
}

export const toast = {
  error: (message) => emit(message, 'error'),
  success: (message) => emit(message, 'success'),
  show: (message, kind = 'error') => emit(message, kind === 'success' ? 'success' : 'error'),
};
