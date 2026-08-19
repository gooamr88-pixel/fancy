/* ═══════════════════════════════════════════════════════════════════════════
   THE HOMEPAGE FAQ — the questions and answers, and nothing else.

   WHY THIS IS ITS OWN FILE, AND MUST STAY THAT WAY

   This list started out exported from `FaqCtaSection.js`, which carries
   `'use client'`. `page.js` — a Server Component — imported it to build the
   FAQPage structured data. That compiles, passes every test, renders in
   development, and then fails the PRODUCTION BUILD with:

       TypeError: I.FAQS.map is not a function
       Failed to collect page data for /

   The reason is the client boundary itself: when a Server Component imports
   from a `'use client'` module, it does not get the module's values. Every
   export is replaced by a client REFERENCE that the bundler ships to the
   browser, so on the server `FAQS` is an opaque proxy, not an array. It is a
   whole class of bug that only a real `next build` finds, because nothing
   earlier in the toolchain models that boundary.

   So the data lives here, in a module with NO `'use client'`, and both sides
   import it: `page.js` for the JSON-LD and `FaqCtaSection.js` for the
   accordion. The property that matters is preserved — the structured data and
   the visible answers are literally the same strings, and cannot drift.

   DO NOT move this back into the component, and do not add `'use client'`
   here.

   The refund answer links to /terms rather than restating the policy in full,
   because a marketing page paraphrasing a legal document is how the two end up
   disagreeing.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Plain strings, no JSX — so this module has nothing that needs a runtime. */
export const FAQS = [
  {
    q: 'How do I get started?',
    a: "Create a free account, pick a template, and fill in your names, date and venue. You can be collecting RSVPs in a few minutes — there is nothing to install and no technical setup.",
  },
  {
    q: 'Can I change what the RSVP form asks?',
    a: "Yes. Add your own questions, meal choices, dietary notes and plus-one rules, and mark each one required or optional. Everything can be written in English, Arabic, or both.",
  },
  {
    q: 'How does the seating chart work?',
    a: "Lay out round or rectangular tables, set each one's capacity, and drag guests onto them. The planner tracks remaining seats and will not let you overbook a table. Guests can then look up their own seat with their name and the last four digits of their phone number, and seating stays hidden until you reveal it.",
  },
  {
    q: 'Is there a limit on the number of guests?',
    a: "Each plan has its own guest cap — the Pricing page shows the current numbers. There is no per-guest overage fee: if an event reaches its cap, you upgrade and are charged only the difference. For an event larger than any listed plan, contact us for a custom quote.",
  },
  {
    q: 'Can guests change their RSVP after submitting?',
    a: "Yes. A guest can return to their own link any time before your deadline and update their response, party size or meal choice. The change appears on your dashboard immediately.",
  },
  {
    q: 'Do you offer refunds if I cancel my event?',
    a: "Yes — a full refund within 14 days of purchase, as long as the event has not gone live. For an event that is already active, we issue pro-rated credit you can put toward a future event.",
    // Only this answer carries a link: it is the one that summarises a legal
    // document, and the summary must not become the authority.
    link: { href: '/terms', label: 'Read the full terms' },
  },
];
