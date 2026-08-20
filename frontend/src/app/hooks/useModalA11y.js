'use client';
import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal accessibility plumbing — focus trap, initial focus, focus
 * restore on close, Escape-to-close, and body-scroll lock. Consumed as a
 * hook rather than a wrapping component: every modal in this app has its own
 * bespoke visual shell/animation, so centralizing behavior here (instead of
 * forcing a single generic wrapper's markup on all of them) fixes the actual
 * accessibility gap without any visual risk.
 *
 * Usage:
 *   const dialogRef = useModalA11y(isOpen, { onClose });
 *   <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>...</div>
 *
 * ── WHY THE EFFECT DEPENDS ONLY ON `isOpen` ──────────────────────────────
 *
 * It used to depend on `[isOpen, onClose]`, and that made every modal form in
 * this app impossible to type in.
 *
 * Callers pass `onClose={() => setOpen(false)}` — an inline arrow, so a NEW
 * function identity on every render of the parent. Typing one character into
 * a field calls setState, the parent re-renders, `onClose` is a different
 * function, the dependency array changes, and React tears the effect down and
 * runs it again. The teardown calls `triggerRef.current.focus()` (restoring
 * focus to whatever opened the modal) and the re-run focuses the dialog's
 * FIRST focusable child. Net effect: focus left the field after every single
 * keystroke, so text came out one letter at a time into whatever was focused
 * next. It was reported as "I write letter letter and not able to write
 * constant", on the shop's product form, and it was never a shop bug — all 16
 * modals that use this hook had it, including Edit guest and Import guests.
 *
 * The callback lives in a ref instead. The effect keeps the LATEST `onClose`
 * without depending on its identity, so it runs exactly twice per modal: once
 * when it opens, once when it closes.
 */
export function useModalA11y(isOpen, { onClose } = {}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  /* Updated on every render, read only from inside the effect. Assigned during
     render rather than in its own effect so that an Escape keypress in the
     same tick as a re-render still calls the current handler. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    triggerRef.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Defer to the next frame so the dialog's own enter-animation branch has
    // mounted its focusable children (several modals here mount empty on the
    // first paint of a fade/scale-in transition).
    const focusFrame = requestAnimationFrame(() => {
      const container = dialogRef.current;
      const firstFocusable = container?.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || container)?.focus();
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus?.();
    };
  }, [isOpen]);

  return dialogRef;
}
