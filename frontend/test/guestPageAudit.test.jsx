import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

import { FloatingParticles, ConfettiExplosion } from '../src/app/components/guest/GuestAnimations';
import { buildPreviewEvent, toStoredIso } from '../src/app/dashboard/create-event/components/previewEvent';

/* ═══════════════════════════════════════════════════════════════════════════
   Defects found by rendering the full guest page for all three templates at a
   real 390×844 viewport and looking at it.

   (The harness that produced them: dump the page to HTML from vitest, paint it
   in headless Chrome inside a 390px IFRAME — Windows Chrome will not open a
   window narrower than ~500px, so `--window-size=390,844` silently lays out at
   500 and crops the screenshot, which makes everything read as clipped.)
   ═══════════════════════════════════════════════════════════════════════════ */

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('a canvas that will not give out a context cannot blank the invitation', () => {
  /* jsdom's getContext('2d') returns null — the same thing iOS Safari does
     once a tab is past its canvas memory budget, and Firefox does under
     resistFingerprinting. Both components called ctx.clearRect straight after,
     and the first animate() runs SYNCHRONOUSLY inside the effect, so React
     re-threw it. With no error boundary over the guest page that unmounts the
     whole tree: the guest gets a white screen because an ambient decoration
     could not start. This is how the defect was found — it crashed the render
     harness before a single screenshot existed. */
  it('FloatingParticles renders instead of throwing', () => {
    expect(() => render(<FloatingParticles count={20} color="#B8944F" />)).not.toThrow();
  });

  it('ConfettiExplosion renders instead of throwing', () => {
    // Worse than the drift: this one fires the moment a guest confirms they
    // are coming, so the throw replaced their confirmation with a blank screen
    // AFTER the RSVP had already been recorded.
    expect(() => render(<ConfettiExplosion active duration={100} particleCount={10} />)).not.toThrow();
  });

  it('neither reads dimensions off the global window', () => {
    // The organizer's preview portals this page into an iframe, where the
    // global `window` is the DASHBOARD's — confetti sized to a 1440px desktop
    // burst mostly outside a 390px frame. See utils/frameDocument.js.
    const src = read('src/app/components/guest/GuestAnimations.js');
    expect(src).toContain('viewOf(canvas)');
    expect(src, 'a bare window.innerWidth/Height is back').not.toMatch(/window\.inner(Width|Height)/);
  });
});

describe('the wizard preview dates the event the way the server will', () => {
  /* `<input type="datetime-local">` yields "2027-05-15T02:00" — no timezone
     designator. Postgres (events.event_date is TIMESTAMPTZ, connection in UTC)
     reads that as 02:00 UTC; the browser's `new Date()` reads it as LOCAL. The
     guest page then formats everything with timeZone:'UTC', so the preview was
     off by the organizer's own offset: on UTC+3 an 18:30 ceremony previewed as
     15:30, and an event running to 02:00 on the 15th previewed as ending on
     the 14th — printing "MAY 14, 2027 - MAY 14, 2027" as its date range. */
  it('stamps a naive datetime-local value as UTC', () => {
    expect(toStoredIso('2027-05-15T02:00')).toBe('2027-05-15T02:00:00Z');
    expect(toStoredIso('2027-05-15T02:00:00')).toBe('2027-05-15T02:00:00Z');
  });

  it('leaves a value that already carries a zone alone', () => {
    // An event loaded back from the API into the wizard. Re-stamping these
    // would move them for real.
    ['2027-05-15T02:00:00Z', '2027-05-15T02:00:00+00:00', '2027-05-15T02:00:00-05:00']
      .forEach((v) => expect(toStoredIso(v)).toBe(v));
  });

  it('passes anything unrecognised straight through', () => {
    expect(toStoredIso('')).toBeNull();
    expect(toStoredIso(null)).toBeNull();
    expect(toStoredIso('2027-05-15')).toBe('2027-05-15');
  });

  it('the preview event reads back as the digits the organizer typed', () => {
    const ev = buildPreviewEvent({
      eventDate: '2027-05-14T18:30',
      eventEndDate: '2027-05-15T02:00',
      rsvpDeadline: '2027-04-30T23:59',
    });
    const utc = (iso) => new Date(iso).toISOString().slice(0, 16);
    // Would fail on any machine not on UTC before the fix — which is the point.
    expect(utc(ev.event_date)).toBe('2027-05-14T18:30');
    expect(utc(ev.event_end_date)).toBe('2027-05-15T02:00');
    expect(utc(ev.rsvp_deadline)).toBe('2027-04-30T23:59');
  });
});

describe('one scroll cue per screen', () => {
  /* SnapShell pins a fixed "SCROLL TO RSVP" to the bottom of every screen, and
     the cinematic heroes end on their own "Scroll down". Both landed on the
     bottom-centre of the FIRST screen — and on Velvet Ring, whose hero runs
     past the fold, they overlapped and neither was readable. */
  it('the cinematic hero declares that it draws its own', () => {
    expect(read('src/app/components/templates/heritageArch/HeritageArchPage.js'))
      .toMatch(/ownScrollCue: !!CinematicHero/);
  });

  it('SnapShell stands down on a section that has one', () => {
    expect(read('src/app/components/templates/heritageArch/SnapShell.js'))
      .toMatch(/!sections\[activeIndex\]\?\.ownScrollCue/);
  });
});

describe('guest-facing labels clear the reading floor', () => {
  /* The dashboard has a ratcheted 11px floor (test/mobileFit.test.js) because
     sub-11px type is unreadable for the organizer in their sixties. The guest
     page had no such check, and its smallest type is read by the OLDEST people
     invited, on a phone. --fx-label resolves LARGER as the viewport narrows.
     The invitation card is excluded on purpose: it is a stationery miniature
     and its type is meant to be small. */
  const SECTIONS = 'src/app/components/templates/heritageArch/sections';
  const FILES = fs.readdirSync(path.join(process.cwd(), SECTIONS)).filter((f) => f.endsWith('.js'));

  it.each(FILES)('%s has no sub-11px fontSize literal', (file) => {
    const src = read(path.join(SECTIONS, file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const offenders = [...src.matchAll(/fontSize: *'([0-9.]+)px'/g)]
      .map((m) => parseFloat(m[1]))
      .filter((n) => n < 11);
    expect(offenders, `use var(--fx-label) instead of ${offenders.join('px, ')}px`).toEqual([]);
  });
});

describe('the cinematic hero backdrop does not out-measure its container', () => {
  it('is inset to the container, not sized in vw', () => {
    /* `width: 100vw` counts the scrollbar gutter; the scroll container's
       content box does not. The photograph sat half a scrollbar-width past
       each edge on every desktop — real horizontal overflow, invisible only
       because SnapShell clips it. */
    const css = read('src/app/styles/cinematic.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const scene = css.match(/\.cine-vhero__scene\s*\{[^}]*\}/)?.[0] || '';
    expect(scene, 'no .cine-vhero__scene rule found').toBeTruthy();
    expect(scene).not.toMatch(/width:\s*100vw/);
    expect(scene).toMatch(/inset-inline:\s*0/);
  });
});
