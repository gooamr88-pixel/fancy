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

import { REFUND_SUMMARY, REFUND_HOW } from '../../utils/refundPolicy';
import { REFUND_REQUEST_HREF } from '../../utils/company';

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
    /* REFUND_SUMMARY, not a paraphrase. This answer used to be written out
       here, /pricing said something different, and /terms described refunds
       on monthly and annual subscriptions this product does not sell — three
       answers to one question, in three documents a customer can open in
       three tabs. One string now, imported by every surface. */
    a: `Yes. ${REFUND_SUMMARY} ${REFUND_HOW}`,
    // The link is the REQUEST, not the terms. Someone reading this answer has
    // already decided they want a refund; handing them a legal document to
    // read instead of a form to fill in is the wrong next step. The terms are
    // still the authority and are linked from the answer on /pricing.
    link: { href: REFUND_REQUEST_HREF, label: 'Request a refund' },
  },
];
