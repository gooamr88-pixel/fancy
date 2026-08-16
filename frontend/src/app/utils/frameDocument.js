/* ═══════════════════════════════════════════════════════════════════════════
   Which document is this element actually in?

   The guest page renders in two places: as the document itself, for a guest,
   and portalled into an <iframe> for the organizer's preview (see
   components/templates/PreviewFrame.js). In the second case the React tree
   still executes in the DASHBOARD's JavaScript realm, so the bare `document`
   and `window` globals point at the dashboard — not at the frame the elements
   are in.

   The failure mode is silent in both directions:

     document.getElementById('ha-rsvp')  →  null, because #ha-rsvp is in the
                                            frame. The "scroll to RSVP" cue
                                            becomes a button that does nothing,
                                            with no error.
     document.createElement(…)           →  a node from the wrong document,
                                            which appendChild adopts rather
                                            than rejecting, so it works until
                                            it doesn't.

   Resolving from a node that is definitely in the right tree — a ref, or an
   event's own currentTarget — is correct in both cases and identical to the
   global for a real guest.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The document `node` lives in, falling back to the global one. */
export function docOf(node) {
  return node?.ownerDocument || (typeof document !== 'undefined' ? document : null);
}

/** The window `node`'s document belongs to, falling back to the global one. */
export function viewOf(node) {
  return docOf(node)?.defaultView || (typeof window !== 'undefined' ? window : null);
}

/** `getElementById` against `node`'s own document rather than the global one. */
export function byIdNear(node, id) {
  return docOf(node)?.getElementById(id) || null;
}
