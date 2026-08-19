import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  CHECKIN_APK_URL, CHECKIN_APK_SIZE_LABEL, CHECKIN_MIN_ANDROID, CHECKIN_SCREENS,
} from '../src/app/utils/checkinApp';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PAGE = read('src/app/checkin-app/page.js');

/* ═══════════════════════════════════════════════════════════════════════════
   THE DOOR APP HAS A WAY IN.

   The app was finished, signed and hosted for weeks while the product said
   nothing: `/checkin-app` had no picture of it, no download link, and told
   readers to fetch it from a dashboard. The one URL that worked appeared
   NOWHERE in this repository.

   These pin the things that would quietly undo that again.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the download is reachable', () => {
  it('the page links the public APK, from the shared constant', () => {
    expect(PAGE).toContain('CHECKIN_APK_URL');
    expect(PAGE).toMatch(/href=\{CHECKIN_APK_URL\}/);
    // A literal URL in the page is how the marketing copy and the dashboard
    // drift apart when a new build is published.
    expect(PAGE, 'the APK URL is hardcoded in the page').not.toContain('fancyrsvp.com/download');
  });

  it('the URL points at the web root, not the API or Storage', () => {
    /* Three download paths exist and only this one is public. The gated one
       (an event-scoped 302 to a signed Supabase URL) writes an audit row and
       must not be swapped in here — it would 403 for anyone without a paid
       event, on a page that promises a free install. */
    expect(CHECKIN_APK_URL).toMatch(/^https:\/\/[^/]+\/download\/[\w.-]+\.apk$/);
    expect(CHECKIN_APK_URL).not.toContain('/api/');
    expect(CHECKIN_APK_URL).not.toContain('supabase');
  });

  it('leaves the app for the file rather than routing to it', () => {
    // A client-side <Link> transition to a 60 MB binary is not a navigation.
    const anchor = PAGE.slice(PAGE.indexOf('href={CHECKIN_APK_URL}') - 200, PAGE.indexOf('href={CHECKIN_APK_URL}') + 300);
    expect(anchor).toContain('<a');
    expect(anchor).toContain('rel="noopener"');
  });
});

describe('what the page claims is what the app is', () => {
  it('states the Android floor the build actually sets', () => {
    /* minSdk 26 is Android 8.0. This is a promise made to somebody standing
       in a shop choosing a tablet, so it has to track the build file. */
    const gradle = read('../android/app/build.gradle.kts');
    const minSdk = Number(gradle.match(/minSdk\s*=\s*(\d+)/)[1]);
    expect(minSdk, 'minSdk moved — CHECKIN_MIN_ANDROID is now wrong').toBe(26);
    expect(CHECKIN_MIN_ANDROID).toMatch(/Android 8\.0/);
    expect(PAGE).toContain('CHECKIN_MIN_ANDROID');
  });

  it('never prints a version it cannot verify', () => {
    /* build.gradle.kts is what this repo would BUILD, not what the web root
       is SERVING — those have drifted before. A page naming the wrong version
       is worse than one naming none. */
    const constants = read('src/app/utils/checkinApp.js');
    expect(constants).not.toMatch(/VERSION\s*=/);
    expect(PAGE).not.toMatch(/\bv?\d+\.\d+\.\d+\b/);
  });

  it('warns about the size before a 60 MB download starts', () => {
    expect(CHECKIN_APK_SIZE_LABEL).toMatch(/MB/);
    expect(PAGE).toContain('CHECKIN_APK_SIZE_LABEL');
  });

  it('says the two things that otherwise become support tickets', () => {
    // Android blocks installs from outside the Play Store by default, and a
    // free install still needs a paid event before it does anything.
    expect(PAGE).toMatch(/outside the Play Store/i);
    expect(PAGE).toMatch(/Installing is free/i);
  });

  it('does not still tell the reader to download it from the dashboard', () => {
    // That sentence and the button at the top of the page cannot both be the
    // instruction.
    expect(PAGE).not.toMatch(/download and install it from your dashboard/i);
  });
});

describe('the app imagery is real and shipped', () => {
  it('every screen the page names exists in public/', () => {
    CHECKIN_SCREENS.forEach(({ src }) => {
      const file = path.join(ROOT, 'public', src.replace(/^\//, ''));
      expect(fs.existsSync(file), `${src} is not in public/`).toBe(true);
    });
  });

  it('the screens stay small enough to sit in a hero', () => {
    // They are rendered at 2x and converted; a stray PNG here is multi-megabyte.
    CHECKIN_SCREENS.forEach(({ src }) => {
      const { size } = fs.statSync(path.join(ROOT, 'public', src.replace(/^\//, '')));
      expect(size, `${src} is ${Math.round(size / 1024)}KB`).toBeLessThan(200 * 1024);
    });
  });

  it('every screen carries alt text describing what is on it', () => {
    CHECKIN_SCREENS.forEach(({ src, alt }) => {
      expect(alt, `${src} has no alt text`).toBeTruthy();
      expect(alt.length, `${src}'s alt text is too thin to be useful`).toBeGreaterThan(40);
    });
  });

  it('the page says these are renders, not photographs of a device', () => {
    // The app has never been photographed. Implying otherwise on a page
    // asking for a download is the one claim here that would be a lie.
    expect(PAGE).toMatch(/Rendered from the app/i);
  });

  it('can be regenerated from the design source it came from', () => {
    const script = read('scripts/renderCheckinScreens.js');
    expect(script).toContain('Checkin-Result-Screens-Mockup.html');
    expect(fs.existsSync(path.join(ROOT, '..', 'docs', 'Checkin-Result-Screens-Mockup.html'))).toBe(true);
  });
});

describe('the hero survives a phone', () => {
  it('releases the grid minimum the app screenshots would otherwise set', () => {
    /* A grid item's automatic minimum is its content's min-content size, and
       these images are 1400px wide intrinsically. Measured at a 390px
       viewport with the rule in place: documentElement.scrollWidth 375. */
    expect(PAGE).toMatch(/\.cka-hero-grid > \* \{ min-width: 0; \}/);
  });

  it('lets each fact wrap beside its icon instead of under it', () => {
    expect(PAGE).toMatch(/\.cka-hero-facts li span \{ flex: 1 1 0; min-width: 0; \}/);
  });

  it('uses only breakpoints on the four-value scale', () => {
    const widths = [...PAGE.matchAll(/\((?:max|min)-width: *([\d.]+)px\)/g)].map((m) => m[1]);
    const ALLOWED = new Set(['639.98', '640', '767.98', '768', '1023.98', '1024', '1279.98', '1280', '44']);
    widths.forEach((w) => expect(ALLOWED.has(w), `${w}px is off the scale`).toBe(true));
  });

  it('has no backtick inside the style block', () => {
    /* One backtick in a CSS comment ends the styled-jsx template literal and
       the file stops parsing. It has cost two build failures on this page
       alone. */
    const style = PAGE.slice(PAGE.indexOf('<style jsx>{`') + 13, PAGE.lastIndexOf('`}</style>'));
    expect(style.includes('`'), 'a backtick is back inside the style block').toBe(false);
  });
});
