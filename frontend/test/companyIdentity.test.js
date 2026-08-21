import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  COMPANY_NAME, COMPANY_CITY, COMPANY_LOCATION, COMPANY_EMAIL,
  SOCIAL_INSTAGRAM, SOCIAL_FACEBOOK, SOCIAL_PROFILES, INSTAGRAM_HANDLE,
  COMPANY_ADDRESS, ADDRESS_CONFIGURED, addressLines, addressOneLine, postalAddressLd,
  REFUND_REQUEST_HREF,
} from '../src/app/utils/company';

/* ═══════════════════════════════════════════════════════════════════════════
   ONE IDENTITY, EVERYWHERE.

   The operator's name, location and social accounts were written out by hand
   in nine files. That is not a tidiness problem: the surfaces carrying them
   are the Terms' contracting party, the Privacy Policy's notice block, the
   SMS opt-in page a Twilio reviewer reads, the Organization JSON-LD search
   engines index, and the footer of every transactional email.

   ⚠ TWILIO. This account's Toll-Free Verification was rejected once for
   "Business could not be verified", and the recorded cause was precisely a
   published identity that contradicted the submitted one — the site showed a
   California address while the submission named a Canadian corporation. These
   cases cannot check what is on file at Twilio. What they CAN do is make sure
   the site never again says two different things about itself, which is the
   half of that failure that lives in this repo.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, '..', rel), 'utf8');
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

/** Every file that states who the company is, to a customer or a regulator. */
const IDENTITY_SURFACES = [
  'src/app/page.js',
  'src/app/about/page.js',
  'src/app/contact/page.js',
  'src/app/privacy/page.js',
  'src/app/terms/page.js',
  'src/app/sms-opt-in/page.js',
  'src/app/components/landing/FooterSection.js',
];

/* The previous operator, its address, and its social accounts. Retired
   2026-08-22. Comments are stripped before the search, because several of
   these files explain in a comment exactly which identity was replaced —
   reading that prose as code makes the record of the change fail the test
   that enforces it. */
const RETIRED = [
  '16941460',
  'Canada Corp',
  'Via Marketing',
  'Mississauga',
  'Selord',
  'viamarketing',
];

describe('the retired identity is gone from every public surface', () => {
  IDENTITY_SURFACES.forEach((rel) => {
    it(`${rel} names no previous entity`, () => {
      const src = stripComments(read(rel));
      RETIRED.forEach((needle) => {
        expect(src.includes(needle), `${rel} still says "${needle}"`).toBe(false);
      });
    });
  });

  it('the transactional email footer matches the site', () => {
    /* A commercial email must identify its sender under CAN-SPAM and CASL, and
       the backend cannot import from the Next app — so it holds its own copy
       and this is what stops the two drifting. */
    const src = stripComments(readRepo('backend/utils/emailTemplates.js'));
    RETIRED.forEach((needle) => {
      expect(src.includes(needle), `the email footer still says "${needle}"`).toBe(false);
    });
    expect(src).toContain(`const COMPANY_NAME = '${COMPANY_NAME}'`);
    /* The backend mirrors the ADDRESS OBJECT, field for field, and derives its
       footer line the same way — so the email says what the site says in both
       states, not just while the street happens to be blank. */
    ['locality', 'region', 'regionName', 'postalCode', 'countryName', 'line1', 'line2']
      .forEach((field) => {
        expect(src, `the email footer is missing address.${field}`)
          .toContain(`${field}: '${COMPANY_ADDRESS[field]}'`);
      });
    expect(src, 'the email footer does not gate on a complete address')
      .toMatch(/const ADDRESS_CONFIGURED = Boolean\(/);
  });
});

describe('every surface reaches the identity through the shared module', () => {
  IDENTITY_SURFACES.forEach((rel) => {
    it(`${rel} imports it rather than typing it out`, () => {
      expect(stripComments(read(rel)), `${rel} hardcodes its own identity`)
        .toMatch(/utils\/company/);
    });
  });
});

describe('the social accounts are the brand ones, without the tracking', () => {
  it('points at the Fancy accounts', () => {
    expect(SOCIAL_INSTAGRAM).toBe('https://www.instagram.com/fancyrsvp');
    expect(SOCIAL_FACEBOOK).toBe('https://www.facebook.com/profile.php?id=61593600211608');
    expect(INSTAGRAM_HANDLE).toBe('@fancyrsvp');
    expect(SOCIAL_PROFILES).toEqual([SOCIAL_INSTAGRAM, SOCIAL_FACEBOOK]);
  });

  it('carries no share-session or campaign parameters', () => {
    /* The links arrive off a phone's share sheet with `mibextid` / `igsi`
       (session tokens, meaningless to anyone else) and `utm_source=qr`. The
       last one is the harmful one: on a sitewide footer link it files every
       visitor who ever clicks it as having arrived from a QR code, in our
       analytics and the platform's alike. `id=` is not tracking — it is how a
       Facebook profile URL identifies the page — so it stays. */
    [SOCIAL_INSTAGRAM, SOCIAL_FACEBOOK].forEach((url) => {
      expect(url, `${url} carries tracking`).not.toMatch(/utm_|mibextid|igsi/);
    });
    expect(SOCIAL_FACEBOOK).toContain('id=61593600211608');
  });
});

describe('where the business is', () => {
  it('is San Diego, and says so consistently', () => {
    expect(COMPANY_CITY).toBe('San Diego, California');
    expect(COMPANY_LOCATION).toContain('San Diego');
    expect(COMPANY_LOCATION).toContain('California');
  });

  it('degrades honestly while the street is unknown, and upgrades in one edit', () => {
    /* A legal notice address no letter reaches is worse than an absent one: it
       does not merely fail to comply, it asserts something false in a document
       the business is bound by. So every surface reads ADDRESS_CONFIGURED and
       prints the city line until two fields are filled in.

       This case deliberately passes in BOTH states — it is not a reminder that
       the address is missing (scripts/companyIdentity.js exits non-zero for
       that). What it pins is that the two states stay consistent. */
    if (ADDRESS_CONFIGURED) {
      expect(addressLines().length).toBeGreaterThan(1);
      expect(addressOneLine()).toContain(COMPANY_ADDRESS.postalCode);
      expect(postalAddressLd()).toHaveProperty('streetAddress');
      expect(postalAddressLd()).toHaveProperty('postalCode');
    } else {
      expect(addressLines()).toEqual([COMPANY_LOCATION]);
      // Never an EMPTY string in structured data — an empty value is a
      // published claim that the value is empty, not that it is unknown.
      expect(postalAddressLd()).not.toHaveProperty('streetAddress');
      expect(postalAddressLd()).not.toHaveProperty('postalCode');
      [COMPANY_CITY, COMPANY_LOCATION].forEach((v) => {
        expect(v, 'a street number appeared in the location').not.toMatch(/\d{2,}/);
      });
    }
    // Locality and region are true either way, so they are always published.
    expect(postalAddressLd()).toMatchObject({ addressLocality: 'San Diego', addressRegion: 'CA' });
  });

  it('gates on line1 AND postalCode, not on either alone', () => {
    // A street with no postcode is not a deliverable address, and a postcode
    // with no street is not one either. One definition, in one place.
    const gate = (a) => Boolean(a.line1.trim() && a.postalCode.trim());
    expect(gate({ line1: '', postalCode: '' })).toBe(false);
    expect(gate({ line1: '1 A St', postalCode: '' })).toBe(false);
    expect(gate({ line1: '', postalCode: '92101' })).toBe(false);
    expect(gate({ line1: '1 A St', postalCode: '92101' })).toBe(true);
    expect(ADDRESS_CONFIGURED).toBe(gate(COMPANY_ADDRESS));
  });

  it('reports the gap through a script that can gate a release', () => {
    /* Four obligations depend on the address and none of them announces itself
       when missing, so the check is a command with an exit code rather than
       something somebody remembers to look at. */
    const script = read('scripts/companyIdentity.js');
    expect(script).toMatch(/process\.exit\(configured \? 0 : 1\)/);
    expect(script).toMatch(/CAN-SPAM/);
    expect(script).toMatch(/Twilio TFV/);
  });

  it('gives the refund policy a route, not just a rule', () => {
    /* The policy used to end at a bare mailto buried in Terms §7 — a rule with
       no door. The contact form already routes by subject and accepts a
       ?subject= deep link, and the mechanism behind it is real
       (services/stripeRefundService.js). */
    expect(REFUND_REQUEST_HREF).toBe('/contact?subject=refund');
    const contact = read('src/app/contact/page.js');
    expect(contact, 'the contact form has no refund subject').toMatch(/<option value="refund">/);
    expect(contact, 'a refund deep link would be dropped as an unknown subject')
      .toMatch(/validSubjects = \[[^\]]*"refund"/);
  });

  it('keeps one email for the company', () => {
    expect(COMPANY_EMAIL).toBe('info@fancyrsvp.com');
    expect(stripComments(read('src/app/components/landing/FooterSection.js')))
      .toMatch(/CONTACT_EMAIL = COMPANY_EMAIL/);
  });
});
