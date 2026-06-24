'use client';

// Tiny global toast bus so any component can raise a professional toast without
// prop-drilling a setter. <ToastHost/> (mounted once in the root layout) subscribes
// and renders them through the shared <Toast/> UI — replacing native alert() dialogs.

let listeners = [];
let seq = 0;

export function subscribeToasts(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

function emit(message, kind) {
  const text = message == null ? '' : String(message);
  if (!text.trim()) return;
  const payload = { id: ++seq, message: text, kind };
  listeners.forEach((l) => { try { l(payload); } catch { /* a bad listener must not block others */ } });
}

export const toast = {
  error: (message) => emit(message, 'error'),
  success: (message) => emit(message, 'success'),
  show: (message, kind = 'error') => emit(message, kind === 'success' ? 'success' : 'error'),
};
