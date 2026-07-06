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
 */
export function useModalA11y(isOpen, { onClose } = {}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

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
      if (e.key === 'Escape') { onClose?.(); return; }
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
  }, [isOpen, onClose]);

  return dialogRef;
}
