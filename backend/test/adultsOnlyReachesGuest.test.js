require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ADULTS-ONLY RULE HAS TO SURVIVE EVERY ROUTE A GUEST CAN ARRIVE BY.
 *
 * `events.no_kids_allowed` is one organizer toggle, and it has to cross four
 * boundaries to reach a guest. Each is a separate hand-maintained list, and the
 * rule was being dropped at two of them:
 *
 *   1. the organizer can SET it            — Stage2 + EventSettings gates
 *   2. the API SENDS it                    — two different event payloads
 *   3. the invitation page SHOWS it        — HeritageArchPage's section
 *   4. the RSVP form SHOWS it              — two different form implementations
 *
 * Where it broke, and why it looked like a template bug: the token-RSVP endpoint
 * (the emailed "RSVP" button) hand-picks its event columns and never listed
 * `no_kids_allowed`, while getPublicEventBySlug returns the row. Same event,
 * same guest, two links — one carried the rule and one silently did not.
 *
 * The RSVP form was worse: neither implementation mentioned the rule at all, on
 * any template, even though the party-size stepper is the one control the rule
 * actually constrains.
 *
 * These are source assertions on purpose. Every one of these failures is a
 * MISSING line — a column absent from a select, a component absent from a form
 * — and a missing line produces no error, no warning, and a page that looks
 * completely fine unless you already know what should be on it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const FE = 'frontend/src/app';

/* ── 2. the API sends it ─────────────────────────────────────────────────── */

test('the token-RSVP endpoint selects the adults-only column', () => {
  // The emailed "RSVP" button lands here. It hand-picks columns, so anything
  // not named is silently absent from the page's `event`.
  const src = read('backend/controllers/rsvpController.js');
  // Anchored to the handler, not to the first `from('rsvp_parties')` in a
  // 2000-line controller — there are several, and the others prove nothing.
  const fn = src.indexOf('const getRsvpInvite = async');
  assert.notEqual(fn, -1, 'getRsvpInvite not found — this test is pinned to a renamed handler');
  const start = src.indexOf("from('rsvp_parties')", fn);
  assert.notEqual(start, -1);
  const select = src.slice(start, start + 1200);
  assert.match(select, /no_kids_allowed/,
    'resolveInviteToken must select no_kids_allowed, or the RSVP form cannot show the notice');
  assert.match(select, /collect_dietary_restrictions/,
    'the same select drives showDietary — it was relying on an undefined reading as ON');
});

/* ── 4. both RSVP forms show it ──────────────────────────────────────────── */

/**
 * The public RSVP has TWO independent implementations and always has:
 *   • RsvpSection      — inline on the full-page templates (Custom Canvas included)
 *   • StepPartyDetails — the standalone /[slug]/rsvp route, via RsvpWizard
 * They have drifted feature by feature. Both must render the shared notice.
 */
const RSVP_FORMS = [
  `${FE}/components/templates/heritageArch/sections/RsvpSection.js`,
  `${FE}/[slug]/rsvp/steps/StepPartyDetails.js`,
];

for (const rel of RSVP_FORMS) {
  test(`${path.basename(rel)} shows the adults-only notice`, () => {
    const src = read(rel);
    assert.match(src, /AdultsOnlyNotice/,
      'this RSVP form must render the shared notice — a guest choosing a party size is who the rule is for');
    assert.match(src, /import AdultsOnlyNotice from/,
      'it must be the shared component, not a local re-implementation');
  });
}

test('the notice is one component, not a copy in each form', () => {
  // The two forms are already a duplication; the notice must not become a third.
  const shared = read(`${FE}/components/guest/AdultsOnlyNotice.js`);
  assert.match(shared, /export default function AdultsOnlyNotice/);
  for (const rel of RSVP_FORMS) {
    const src = read(rel);
    assert.doesNotMatch(src, /function AdultsOnlyNotice/,
      `${path.basename(rel)} must import the notice, never declare its own`);
  }
});

test('the notice is painted in the event colour, not a fixed gold', () => {
  // Asserted on the source because the tint is 8-digit #RRGGBBAA, which jsdom's
  // CSS parser drops — a DOM assertion there tests the parser, not the panel.
  // Every guest surface recolours per event; a gold box on a burgundy palette
  // is the tell that a component was bolted on afterwards.
  const src = read(`${FE}/components/guest/AdultsOnlyNotice.js`);
  assert.match(src, /background: `\$\{themeColor\}/, 'the wash must come from the event colour');
  assert.match(src, /border: `1px solid \$\{themeColor\}/, 'so must the edge');
});

test('the wizard passes the flag down from the event', () => {
  const src = read(`${FE}/[slug]/rsvp/RsvpWizard.js`);
  assert.match(src, /noKidsAllowed=\{!!event\?\.no_kids_allowed\}/,
    'StepPartyDetails cannot read the event itself — RsvpWizard has to thread it');
});

/* ── 3. the invitation page shows it ─────────────────────────────────────── */

test('the invitation page keys on the flag alone, not on the template', () => {
  // Verified by render as well: the section appears for custom, wedding,
  // engagement and the curated variants alike, and disappears when the flag is
  // off. This pins the reason — no template check.
  const src = read(`${FE}/components/templates/heritageArch/HeritageArchPage.js`);
  const idx = src.indexOf('const showNoKids');
  assert.notEqual(idx, -1);
  const line = src.slice(idx, src.indexOf('\n', idx));
  assert.match(line, /!!event\.no_kids_allowed/);
  assert.doesNotMatch(line, /template_type/,
    'a template check here is what previously excluded Custom Canvas');
});

/* ── 1. the organizer can set it ─────────────────────────────────────────── */

test('both organizer surfaces offer the toggle to every full-page template', () => {
  for (const rel of [
    `${FE}/dashboard/create-event/components/Stage2_FormConfiguration.js`,
    `${FE}/dashboard/components/EventSettings.js`,
  ]) {
    const src = read(rel);
    assert.match(src, /isFullPage/,
      `${path.basename(rel)} must gate the toggle on isFullPage, not a wedding/engagement literal`);
    assert.match(src, /'custom'/,
      `${path.basename(rel)}'s full-page list must include Custom Canvas`);
  }
});

test('the guest page and the organizer gates agree on which templates are full-page', () => {
  // Three hand-maintained copies of one list. They have drifted before — Custom
  // was added to the guest engine and not to the settings gate, which is how the
  // toggle went missing for the one template whose premise is "every feature".
  const lists = {
    guest: read(`${FE}/[slug]/EventPageClient.js`),
    wizard: read(`${FE}/dashboard/create-event/components/Stage2_FormConfiguration.js`),
    settings: read(`${FE}/dashboard/components/EventSettings.js`),
  };
  for (const [name, src] of Object.entries(lists)) {
    for (const key of ['custom', 'engagement', 'heritageArch', 'tuscany']) {
      assert.match(src, new RegExp(`'${key}'`), `${name} is missing '${key}' from its full-page list`);
    }
  }
});
