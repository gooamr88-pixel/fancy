'use client';

import { useSyncExternalStore } from 'react';
import { BREAKPOINTS, up, down, between, COARSE_POINTER, REDUCED_MOTION } from '../lib/breakpoints';

/**
 * Shared, SSR-safe media-query hooks.
 *
 * This consolidates two prior implementations that had drifted apart:
 * Stage1_TemplatesSimulator.js's useSyncExternalStore version (correct,
 * but private to that file) and AdminShell.js's useState+useEffect one,
 * which additionally used a DIFFERENT breakpoint (900px vs 768px) for
 * what was nominally the same "is mobile" question.
 *
 * useSyncExternalStore rather than useState + useEffect because it gives
 * the correct value on the very first client render instead of painting
 * the desktop layout and then correcting it — and because a setState in a
 * mount effect trips this project's eslint set-state-in-effect rule.
 */

/**
 * One cached store per query string.
 *
 * This cache is the CONTRACT, not an optimisation. useSyncExternalStore
 * re-subscribes whenever the `subscribe` function identity changes, so
 * inlining the closure here would tear down and re-add a matchMedia
 * listener on every single render, on every route that uses a hook from
 * this file. There is no error and no warning when that happens — just
 * unbounded listener churn. Do not "simplify" this away.
 */
const stores = new Map();

function getStore(query) {
  let store = stores.get(query);
  if (!store) {
    store = {
      subscribe(callback) {
        // Guard for the server and for any environment without matchMedia
        // (jsdom without the polyfill, for instance). Returning a no-op
        // unsubscribe keeps useSyncExternalStore happy.
        if (typeof window === 'undefined' || !window.matchMedia) return () => {};
        const mq = window.matchMedia(query);
        mq.addEventListener('change', callback);
        return () => mq.removeEventListener('change', callback);
      },
      getSnapshot() {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia(query).matches;
      },
    };
    stores.set(query, store);
  }
  return store;
}

/**
 * Subscribe to an arbitrary media query string.
 *
 * The server snapshot is always `false`, so the server and the first
 * client render agree and there is no hydration mismatch. Design your
 * component so `false` is the safe/desktop branch; if a layout genuinely
 * cannot render server-side, gate it on the value rather than inverting
 * the default.
 */
export function useMediaQuery(query) {
  const store = getStore(query);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
}

/** `>= bp`, e.g. useBreakpointUp('lg') — Tailwind's `lg:` in JS. */
export function useBreakpointUp(bp) {
  return useMediaQuery(up(bp));
}

/** `< bp`, e.g. useBreakpointDown('md') — narrower than tablet portrait. */
export function useBreakpointDown(bp) {
  return useMediaQuery(down(bp));
}

/** `>= a and < b`. */
export function useBreakpointBetween(a, b) {
  return useMediaQuery(between(a, b));
}

/** Narrower than the md breakpoint (768px) — phones and small tablets. */
export function useIsMobile() {
  return useBreakpointDown('md');
}

/** Between md (768px) and lg (1024px). */
export function useIsTablet() {
  return useBreakpointBetween('md', 'lg');
}

/** lg (1024px) and up. */
export function useIsDesktop() {
  return useBreakpointUp('lg');
}

/**
 * Touch-primary pointer, regardless of viewport width — a large phone in
 * landscape is 900px+ wide but is still a touch device. Use this for
 * interaction decisions (drag vs tap, hover affordances); use the width
 * hooks for layout decisions.
 */
export function useIsTouch() {
  return useMediaQuery(COARSE_POINTER);
}

export function usePrefersReducedMotion() {
  return useMediaQuery(REDUCED_MOTION);
}

export { BREAKPOINTS };
