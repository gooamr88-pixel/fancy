// Named import, not the default: this module is imported by BOTH a server
// component (the event page) and a client one (the RSVP route), and `preload`
// is a named export in every react-dom build — reaching for it through the
// default export is the form that varies between them.
import { preload } from "react-dom";

/* ═══════════════════════════════════════════════════════════════════════════
   The envelope reveal's artwork, and the one place that knows how to fetch it
   early.

   These four files are the FIRST thing a guest sees — the reveal is a
   full-screen overlay that mounts the moment the event data lands. Loaded the
   ordinary way (a plain <img src> inside the overlay) the browser doesn't even
   learn they exist until React has fetched the event, rendered the page, and
   mounted the overlay: three round trips deep. Until they arrive the guest is
   looking at a blank white screen with an invisible tap target on it.

   preloadRevealAssets() is called from the two guest ROUTES instead, so the
   requests go out alongside the event fetch rather than after it. On the
   server-rendered event page the <link rel=preload> tags ship in the initial
   HTML, which is as early as it is possible to ask for them.

   The list is shared with InvitationReveal so the thing that preloads and the
   thing that renders can never drift apart.
   ═══════════════════════════════════════════════════════════════════════════ */

export const REVEAL_ASSETS = {
  flapDeco: "/images/reveal/flap-deco.webp",
  flapPlain: "/images/reveal/flap-plain.webp",
  seal: "/images/reveal/seal.webp",
  flourish: "/images/reveal/flourish.webp",
};

/* The three the envelope cannot be drawn without. The flourish is a decorative
   rule under the label — if only that one fails, the reveal is still correct,
   so it is deliberately NOT in this list and never triggers the fallback. */
export const REVEAL_ASSETS_CRITICAL = [
  REVEAL_ASSETS.seal,
  REVEAL_ASSETS.flapDeco,
  REVEAL_ASSETS.flapPlain,
];

export const REVEAL_ASSETS_ALL = [...REVEAL_ASSETS_CRITICAL, REVEAL_ASSETS.flourish];

/* Call during render, not in an effect: React hoists these to <head>, and on
   the server that means they leave with the document. Repeat calls are
   deduped by React, so routes may call it freely. */
export function preloadRevealAssets() {
  for (const href of REVEAL_ASSETS_ALL) {
    preload(href, { as: "image", type: "image/webp", fetchPriority: "high" });
  }
}
