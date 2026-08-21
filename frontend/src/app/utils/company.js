/* ═══════════════════════════════════════════════════════════════════════════
   WHO WE ARE, IN ONE PLACE.

   ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────

   The operator's name, address and social accounts were written out by hand in
   nine files: the footer, /about, /contact, /privacy, /terms, /sms-opt-in, the
   homepage's Organization JSON-LD and the transactional email footer. When the
   business was rebranded on 2026-08-22 every one of them had to be found by
   grep, and the ones that are legally load-bearing — the contracting party in
   the Terms, the notice address in the Privacy Policy, the sender identity on
   the SMS opt-in page — are exactly the ones where a missed occurrence is
   worst.

   ── ⚠ COMPLIANCE-BEARING COPY, NOT MARKETING COPY ─────────────────────────

   /sms-opt-in is the page Twilio's Toll-Free Verification reviewer opens. The
   identity printed there must match the business identity on the TFV
   submission — a mismatch is a rejection, and this account has been rejected
   over exactly that before (TWILIO_COMPLIANCE_MASTER_AUDIT.md records the
   cause as a published California identity contradicting a submitted Canadian
   one). Changing a value here means re-submitting there.
   `node scripts/companyIdentity.js` prints the block to paste into that form,
   so the two cannot be typed differently.

   NO 'use client'. /privacy and /terms are client pages, but the homepage is a
   Server Component building Organization JSON-LD from these values, and a
   Server Component importing from a 'use client' module receives client
   references instead of values — a failure that appears only in a production
   build. faqContent.js carries the same warning.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The operating name, used as the company everywhere — including as the
 *  contracting party in the Terms and the sender identity on /sms-opt-in. */
export const COMPANY_NAME = 'Fancy RSVP';

/* BRAND_NAME and COMPANY_SHORT lived here and are gone. Nothing imported
   either: they were written for a future in which "the company" and "the
   product" are different names, which is not today's problem and is a
   one-line addition on the day it is. An export with no importer is not
   flexibility, it is something a reader has to check before changing. */

export const COMPANY_EMAIL = 'info@fancyrsvp.com';
export const COMPANY_SITE = 'https://fancyrsvp.com';

/* ═══════════════════════════════════════════════════════════════════════════
   THE POSTAL ADDRESS — FILL IN `line1` AND `postalCode` AND EVERYTHING ELSE
   UPDATES ON ITS OWN.

   Four surfaces are legally incomplete until these two fields are filled in,
   and all four read this object:

     1. /terms          a contracting party is normally expected to state a
                        registered office.
     2. /privacy        GDPR Art. 13, CCPA and PIPEDA all expect a postal
                        address a data-subject request can be sent to.
     3. email footer    CAN-SPAM §7704(a)(5) and CASL both require a valid
                        physical mailing address in every commercial email.
                        backend/utils/emailTemplates.js holds the mirror copy.
     4. Twilio TFV      the submission carries a business address, and it must
                        match what this site publishes.

   WHY THIS IS BLANK RATHER THAN GUESSED. A legal notice address that no letter
   reaches is worse than an absent one: it does not merely fail to comply, it
   asserts something false in a document the business is bound by, and on a TFV
   form it is a misrepresentation to a carrier. So the fields are empty, every
   surface degrades to an honest city-only line, and `ADDRESS_CONFIGURED` below
   is what flips them all over at once.

   CAN-SPAM accepts a registered agent's address or a post-office box
   registered to the business — it does not have to be a street you sit at. If
   the business is remote-first, that is the usual answer.
   ═══════════════════════════════════════════════════════════════════════════ */
export const COMPANY_ADDRESS = {
  /** Street, or PO box / registered agent line. ← REQUIRED */
  line1: '',
  /** Suite, unit, floor. Optional. */
  line2: '',
  locality: 'San Diego',
  /** Two-letter code, for structured data and postal use. */
  region: 'CA',
  /** Spelled out, for prose. */
  regionName: 'California',
  /** ← REQUIRED */
  postalCode: '',
  country: 'US',
  countryName: 'United States',
};

/**
 * Is the address complete enough to print as a postal address?
 *
 * The gate is line1 + postalCode: a city and state alone is a location, not
 * somewhere a letter goes, and printing it under a heading like "Mail" or in a
 * CAN-SPAM footer would imply otherwise. Every consumer branches on this
 * rather than testing the fields itself, so there is one definition of
 * "configured" and switching it on is one edit in one file.
 */
export const ADDRESS_CONFIGURED = Boolean(
  COMPANY_ADDRESS.line1.trim() && COMPANY_ADDRESS.postalCode.trim(),
);

/** "San Diego, California" — true whether or not the street is known. */
export const COMPANY_CITY = `${COMPANY_ADDRESS.locality}, ${COMPANY_ADDRESS.regionName}`;

/** "San Diego, California, United States" — the honest fallback line. */
export const COMPANY_LOCATION = `${COMPANY_CITY}, ${COMPANY_ADDRESS.countryName}`;

/**
 * The address as lines, for a block that can wrap — a footer, a contact card.
 * Falls back to the city line while the street is unknown, so a caller never
 * has to decide what to do about it.
 */
export function addressLines() {
  if (!ADDRESS_CONFIGURED) return [COMPANY_LOCATION];
  const { line1, line2, locality, region, postalCode, countryName } = COMPANY_ADDRESS;
  return [
    line1,
    line2,
    `${locality}, ${region} ${postalCode}`,
    countryName,
  ].filter(Boolean);
}

/** The same thing on one line, for prose and for an email footer. */
export function addressOneLine() {
  return addressLines().join(', ');
}

/**
 * schema.org PostalAddress.
 *
 * `streetAddress` and `postalCode` are omitted rather than emitted empty while
 * the address is unknown: an empty string in structured data is a published
 * claim that the value is empty, not that it is unknown.
 */
export function postalAddressLd() {
  const { line1, line2, locality, region, postalCode, country } = COMPANY_ADDRESS;
  return {
    '@type': 'PostalAddress',
    ...(ADDRESS_CONFIGURED && { streetAddress: [line1, line2].filter(Boolean).join(', ') }),
    addressLocality: locality,
    addressRegion: region,
    ...(ADDRESS_CONFIGURED && { postalCode }),
    addressCountry: country,
  };
}

/* COMPANY_LOCALITY / COMPANY_REGION / COMPANY_COUNTRY were exported here with
   a comment claiming the homepage JSON-LD and the tests read them directly.
   They did, for about an hour — then both moved to postalAddressLd(), and the
   three exports survived with a comment that was no longer true. Read the
   fields off COMPANY_ADDRESS if you need them. */

/* ── Social ───────────────────────────────────────────────────────────────
   THE TRACKING PARAMETERS ARE STRIPPED, DELIBERATELY.

   The links were supplied as they come off a phone's share sheet:

     …/profile.php?id=61593600211608&mibextid=wwXIfr&mibextid=wwXIfr
     …/fancyrsvp?igsi=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr

   `mibextid` is a Facebook share-session token (duplicated here, which is what
   a double copy-paste produces) and `igsi` is its Instagram equivalent; both
   are tied to the session that generated them and mean nothing to anyone else.
   `utm_source=qr` is worse than noise: it is a campaign tag, so leaving it on a
   sitewide footer link would file every visitor who ever clicks the footer as
   having arrived from a QR code, in your analytics and Instagram's alike.

   `id=` is NOT tracking — it is how a Facebook profile URL identifies the page
   — so it stays. */
export const SOCIAL_INSTAGRAM = 'https://www.instagram.com/fancyrsvp';
export const SOCIAL_FACEBOOK = 'https://www.facebook.com/profile.php?id=61593600211608';
export const INSTAGRAM_HANDLE = '@fancyrsvp';

/** Every profile we claim, for Organization JSON-LD's `sameAs`. */
export const SOCIAL_PROFILES = [SOCIAL_INSTAGRAM, SOCIAL_FACEBOOK];

/* ── Refunds ──────────────────────────────────────────────────────────────
   The route a customer takes to ask for one. The policy itself lives in
   utils/refundPolicy.js; this is the door.

   A bare mailto buried in §7 of the Terms is a policy, not a method: it gives
   no structure, no record, and no acknowledgement. The contact form already
   exists, already routes by subject, and already accepts a `?subject=` deep
   link — so both refund answers now point here with the subject pre-selected,
   and the request lands in the same queue as everything else.

   The MECHANISM on the other side is real and already built:
   backend/services/stripeRefundService.js issues card refunds through Stripe
   and records a book-keeping refund for manually-paid events, exposed at
   POST /api/v1/admin/payments/:paymentId/refund with partial-amount support. */
/* Not exported: the subject key only exists to build the href, and the href is
   the thing every caller actually wants. It must stay in step with the
   `validSubjects` allowlist in contact/page.js — a subject the form does not
   recognise is silently dropped and the visitor lands on a blank picker.
   companyIdentity.test.js pins the two together. */
const REFUND_SUBJECT = 'refund';
export const REFUND_REQUEST_HREF = `/contact?subject=${REFUND_SUBJECT}`;
