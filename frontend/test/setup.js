import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

/* Matchers registered by hand rather than via '@testing-library/jest-dom/vitest'.
   This is an npm-workspaces repo: testing-library hoists to the ROOT
   node_modules while vitest resolves inside frontend/, so jest-dom's own
   vitest entry point cannot find vitest from where it sits. Importing the
   plain matchers (which import nothing) and extending expect ourselves side-
   steps the hoisting entirely instead of fighting it. */
expect.extend(jestDomMatchers);

/* Browser APIs jsdom does not implement that this app's components reach for.
   Each one is stubbed as the "nothing special is going on" answer, so a test
   that cares about the behaviour has to opt in explicitly rather than
   inheriting it. */

// framer-motion's useReducedMotion reads this. Default: motion is fine.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // jsdom's HTMLImageElement never loads anything, so the reveal's artwork
  // gate would sit on its timeout in every test. Resolve on the next tick
  // instead — the gate's real behaviour (wait for decode) is preserved, it
  // just always succeeds. Tests that need the failure path override `src`.
  Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
    configurable: true,
    set(value) {
      this.setAttribute('src', value);
      queueMicrotask(() => {
        if (String(value).includes('__fail__')) this.onerror?.(new Event('error'));
        else this.onload?.(new Event('load'));
      });
    },
    get() { return this.getAttribute('src') || ''; },
  });

  // navigator.sendBeacon — the analytics hook's preferred transport.
  if (!navigator.sendBeacon) navigator.sendBeacon = vi.fn(() => true);

  /* IntersectionObserver — jsdom ships none, and the guest page's shell uses
     one to reveal sections as they scroll into view. Without this, rendering
     the real page in a test throws before anything can be asserted.

     Deliberately inert (observe/unobserve/disconnect are no-ops) rather than
     auto-firing: SnapShell already has a 2.5s failsafe that reveals every
     section if the observer never reports, and a stub that eagerly fired
     would test the observer path while hiding whether that failsafe works.
     Tests that care about reveal timing should drive the callback themselves. */
  /* scrollIntoView / scrollTo — jsdom implements neither. The guest RSVP form
     calls scrollIntoView from a requestAnimationFrame callback the moment a
     guest picks yes/no, and an exception thrown inside rAF does not fail the
     test that caused it: it surfaces as an unhandled error that fails the
     whole FILE, with the passing tests still reported as passing. Stubbed as
     no-ops — scroll position is not something jsdom can meaningfully assert. */
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  }
  if (!window.scrollTo || !vi.isMockFunction(window.scrollTo)) {
    window.scrollTo = vi.fn();
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
    globalThis.IntersectionObserver = window.IntersectionObserver;
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try { window.sessionStorage.clear(); } catch { /* not available */ }
});
