import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));

import HeroSection from '../src/app/components/landing/HeroSection';
import HowItWorksSection from '../src/app/components/landing/HowItWorksSection';
import CapabilitiesSection from '../src/app/components/landing/CapabilitiesSection';
import DashboardShowcaseSection from '../src/app/components/landing/DashboardShowcaseSection';
import FaqCtaSection, { FAQS } from '../src/app/components/landing/FaqCtaSection';
import FooterSection from '../src/app/components/landing/FooterSection';
import ProofSection from '../src/app/components/landing/ProofSection';
import {
  CAPABILITIES,
  HOMEPAGE_CAPABILITIES,
  REMAINING_CAPABILITY_COUNT,
} from '../src/app/components/landing/platformCapabilities';
import { BAND_ORDER, C } from '../src/app/components/landing/landingTokens';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const LANDING = path.join(ROOT, 'src/app/components/landing');

/**
 * Source with its COMMENTS REMOVED.
 *
 * Every one of these files carries a long header explaining what it replaced
 * and why, and those explanations necessarily name the very things these tests
 * forbid — "ScrollReveal", "nth-child", "<style jsx>". Asserting against raw
 * text made four of these tests fail on their own documentation, which is the
 * worst kind of false positive: it punishes writing down the reason.
 *
 * Handles block comments, JSX `{/* … *\/}` comments (the braces are stripped by
 * the block rule leaving `{}`), and whole-line `//`. Newlines are preserved so
 * reported line numbers still mean something.
 */
const code = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/^[ \t]*\/\/.*$/gm, '');

/** Every `<style …>{` … `}</style>` in a file, scoped or plain, as its CSS.
 *  Module scope: two separate describes need it. */
const styleBlocks = (src) =>
  [...src.matchAll(/<style(?: jsx)?(?: global)?>\{`([\s\S]*?)`\}<\/style>/g)].map((m) => m[1]);

const PAGE = code(read('src/app/page.js'));
const FOOTER_RAW = read('src/app/components/landing/FooterSection.js');
const FOOTER = code(FOOTER_RAW);
const NAVBAR = read('src/app/components/landing/Navbar.js');

/**
 * Does `/foo` resolve to a real page?
 *
 * Not a path join: Next ROUTE GROUPS are directories in parentheses that do
 * not appear in the URL, so `/register` lives at `(auth)/register/page.js`.
 * Checking `src/app/register/page.js` reports a real route as broken.
 */
function routeExists(href) {
  const segments = href.replace(/^\//, '').split('/').filter(Boolean);
  const walk = (dir, rest) => {
    if (rest.length === 0) return fs.existsSync(path.join(dir, 'page.js'));
    const [head, ...tail] = rest;
    if (fs.existsSync(path.join(dir, head)) && walk(path.join(dir, head), tail)) return true;
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
      .some((g) => walk(path.join(dir, g.name), rest));
  };
  return walk(path.join(ROOT, 'src/app'), segments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE HOMEPAGE DOES NOT DRAW ITS OWN PRODUCT, AND IT SAYS WHAT THE PRODUCT IS.

   Both properties were false. The page carried ~1,900 lines of hand-drawn
   imitations of components that actually ship (a fake dashboard with a fake
   donut and hardcoded seating coordinates; four fake phone screens with a fake
   notch), and it named none of the thirteen real capabilities.

   Neither failure was loud. A drawn dashboard renders perfectly forever, and a
   page that omits your seating feature looks fine — it just quietly sells
   something narrower than what you built. These pin both.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the homepage shows the product, not a drawing of it', () => {
  it('has deleted every hand-drawn mockup section', () => {
    /* Named individually rather than by a pattern: each of these was a
       specific, large, invented imitation of a real component, and the point
       is that re-adding one has to be a deliberate act with a name attached. */
    const GONE = [
      'DashboardPreviewSection.js', // 1,029 lines — fake dashboard
      'RSVPFlowSection.js',         // 889 lines — four fake phone screens
      'SocialProofBar.js',          // a whole band for three numbers
      'HeroEnvelope.js',            // a drawn imitation of the real reveal
    ];
    GONE.forEach((f) => {
      expect(fs.existsSync(path.join(LANDING, f)), `${f} is back`).toBe(false);
      expect(PAGE.includes(f.replace('.js', '')) && PAGE.includes(`import ${f.replace('.js', '')}`),
        `page.js imports ${f} again`).toBe(false);
    });
  });

  it('every product image it names is a real file that is actually shipped', () => {
    [DashboardShowcaseSection, HeroSection].forEach((Section) => {
      const { container, unmount } = render(<Section />);
      const imgs = [...container.querySelectorAll('img')];
      expect(imgs.length, 'a product section with no product imagery').toBeGreaterThan(0);
      imgs.forEach((img) => {
        const src = img.getAttribute('src');
        expect(fs.existsSync(path.join(ROOT, 'public', src.replace(/^\//, ''))),
          `${src} is not in public/`).toBe(true);
      });
      unmount();
    });
  });

  it('declares dimensions on every image, so nothing shifts as they decode', () => {
    [HeroSection, DashboardShowcaseSection].forEach((Section) => {
      const { container, unmount } = render(<Section />);
      [...container.querySelectorAll('img')].forEach((img) => {
        expect(img.getAttribute('width'), 'no width — this will shift the layout').toBeTruthy();
        expect(img.getAttribute('height')).toBeTruthy();
        expect((img.getAttribute('alt') || '').length, 'alt text is too thin').toBeGreaterThan(30);
      });
      unmount();
    });
  });

  it('can regenerate the product shots it depends on', () => {
    // If the only way to remake these is to remember how, they go stale the
    // first time the dashboard changes.
    const dump = read('test/shots/landingShots.dump.jsx');
    expect(dump).toContain('OrganizerOverview');
    expect(dump).toContain('SeatingMiniMap');
    expect(dump).toContain('force-device-scale-factor');
    expect(read('vitest.shots.config.mjs')).toContain("config.test.include = ['test/shots/*.dump.jsx']");
  });
});

describe('the page explains the platform', () => {
  it('names eight real capabilities, from the same array /features renders', () => {
    render(<CapabilitiesSection />);
    expect(HOMEPAGE_CAPABILITIES.length).toBe(8);
    HOMEPAGE_CAPABILITIES.forEach((c) => {
      expect(screen.getByText(c.title), `${c.title} is missing from the homepage`).toBeTruthy();
    });
    // The /features page must not have re-declared its own copy.
    const features = read('src/app/features/page.js');
    expect(features).toContain('platformCapabilities');
    expect(features, '/features declared its own features array again').not.toMatch(/^const features = \[/m);
  });

  it('names the capabilities that make this more than a form', () => {
    /* The specific omission this section exists to fix: a visitor could read
       the entire old front page and not learn that it does seating, runs a
       door, sends SMS, or lays out Arabic. */
    render(<CapabilitiesSection />);
    ['Seating Charts', 'QR Check-In', 'SMS Campaigns', 'Bilingual Invitations']
      .forEach((t) => expect(screen.getByText(t), `${t} is not on the homepage`).toBeTruthy());
  });

  it('counts the remaining capabilities instead of hardcoding a number', () => {
    const src = read('src/app/components/landing/CapabilitiesSection.js');
    expect(src).toContain('REMAINING_CAPABILITY_COUNT');
    expect(REMAINING_CAPABILITY_COUNT).toBe(CAPABILITIES.length - 8);
    // A hardcoded "and 5 more" is wrong the first time anyone adds a feature.
    expect(src, 'the count is written out rather than computed')
      .not.toMatch(/And \d+ more/);
  });

  it('walks the organizer through the whole job in three steps', () => {
    render(<HowItWorksSection />);
    expect(screen.getByText(/Build the invitation/)).toBeTruthy();
    expect(screen.getByText(/watch the replies/)).toBeTruthy();
    expect(screen.getByText(/run the door/)).toBeTruthy();
  });
});

describe('the page is not longer than it needs to be', () => {
  it('renders ten bands, in the declared rhythm', () => {
    /* BAND_ORDER is the one place the arrangement is stated. If a section is
       added, removed or moved in page.js without updating it, this fails —
       which is the only way "does this page still alternate?" stays a
       question you answer by reading ten lines. */
    const names = BAND_ORDER.map((b) => b.split(':')[0]);
    expect(names.length).toBe(10);

    const EXPECTED_COMPONENT = {
      hero: 'HeroSection',
      invitations: 'TemplatesShowcaseSection',
      statement: 'StatementSection',
      'how-it-works': 'HowItWorksSection',
      dashboard: 'DashboardShowcaseSection',
      capabilities: 'CapabilitiesSection',
      printed: 'PrintedInvitationsSection',
      proof: 'ProofSection',
      'faq-cta': 'FaqCtaSection',
      footer: 'FooterSection',
    };

    // Every declared band has a component, rendered in that order in page.js.
    const positions = names.map((n) => {
      const comp = EXPECTED_COMPONENT[n];
      expect(comp, `BAND_ORDER names "${n}", which maps to no component`).toBeTruthy();
      const at = PAGE.indexOf(`<${comp} />`);
      expect(at, `page.js does not render <${comp} />`).toBeGreaterThan(-1);
      return at;
    });
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions, 'page.js renders the bands in a different order than BAND_ORDER declares')
      .toEqual(sorted);
  });

  it('never puts two bands of the same background next to each other', () => {
    const tones = BAND_ORDER.map((b) => b.split(':')[1]);
    tones.forEach((tone, i) => {
      if (i === 0) return;
      // The footer sits directly under the FAQ band. Since 2026-08-20 those
      // are two different tones (light → deep) so this exemption is no longer
      // load-bearing, but it stays: the footer is the one band whose tone is
      // chosen to close the page rather than to alternate with its neighbour.
      if (BAND_ORDER[i].startsWith('footer')) return;
      expect(tone === tones[i - 1], `bands ${i - 1} and ${i} are both "${tone}"`).toBe(false);
    });
  });

  it('each band actually paints the tone it declares', () => {
    /* BAND_ORDER was a promise nothing kept. The test above only checks that
       the DECLARATION is internally consistent — that no two adjacent entries
       name the same tone. It never opened a component to see whether the CSS
       agreed, so on 2026-08-20 ProofSection declared "deep" and painted
       "warm" and the whole suite stayed green.

       This reads the background out of each section's own style block and
       compares it to BAND, which is where the three tones are defined. */
    const TONE_HEX = { light: C.paper, warm: C.paper2, deep: C.paper3 };

    const FILE = {
      hero: 'HeroSection',
      invitations: 'TemplatesShowcaseSection',
      statement: 'StatementSection',
      'how-it-works': 'HowItWorksSection',
      dashboard: 'DashboardShowcaseSection',
      capabilities: 'CapabilitiesSection',
      printed: 'PrintedInvitationsSection',
      proof: 'ProofSection',
      'faq-cta': 'FaqCtaSection',
      footer: 'FooterSection',
    };

    BAND_ORDER.forEach((entry) => {
      const [name, tone] = entry.split(':');
      const src = fs.readFileSync(path.join(LANDING, `${FILE[name]}.js`), 'utf8');
      const expected = TONE_HEX[tone];
      expect(expected, `BAND_ORDER names an unknown tone "${tone}"`).toBeTruthy();

      /* The section's own ground is the first `background:` that names one of
         the three tones — either as the literal hex or as the token that
         resolves to it. Inner surfaces (cards, the ink block) name other
         colours and are not matched. */
      const named = [...src.matchAll(/background:\s*(?:\$\{)?C\.(paper3|paper2|paper)\}?/g)]
        .map((m) => m[1]);
      const TOKEN_FOR = { light: 'paper', warm: 'paper2', deep: 'paper3' };

      expect(
        named.includes(TOKEN_FOR[tone]),
        `${FILE[name]} is declared "${tone}" (C.${TOKEN_FOR[tone]}) but its `
        + `backgrounds are: ${named.join(', ') || 'none found'}`,
      ).toBe(true);
    });
  });

  it('does not wrap the page in scroll-reveal wrappers', () => {
    /* ScrollReveal server-rendered everything below the fold at opacity:0 and
       needed an IntersectionObserver to bring it back — a slow or failed
       hydration left the page blank under the hero — and it had no
       prefers-reduced-motion branch. */
    expect(PAGE).not.toContain('ScrollReveal');
    expect(fs.existsSync(path.join(LANDING, 'ScrollReveal.js'))).toBe(false);
  });

  it('keeps the primary nav to six items', () => {
    const block = NAVBAR.slice(NAVBAR.indexOf('const NAV_LINKS'), NAVBAR.indexOf('export default function Navbar'));
    const items = [...block.matchAll(/label:\s*"/g)];
    expect(items.length, 'the nav is growing back toward a list').toBeLessThanOrEqual(6);
  });
});

describe('the footer', () => {
  it('gives the newsletter its own row instead of a sixth grid column', () => {
    /* Six tracks in a 1200px container left the newsletter's input and its
       Subscribe button sharing ~170px. */
    expect(FOOTER).toContain('.foot-top');
    expect(FOOTER, 'the six-column grid is back').not.toMatch(/minmax\(0, 1\.4fr\)/);
  });

  it('never targets a link list by DOM position', () => {
    /* The old rules were `footer > div:nth-child(2) > div:first-child`, so
       inserting anything into the footer silently stopped the mobile collapse
       from applying — six fixed columns on a 320px phone, failing only on
       mobile and only after an unrelated edit. */
    styleBlocks(FOOTER_RAW).forEach((css, i) => {
      expect(css.includes('nth-child'), `nth-child is back in footer style block ${i}`).toBe(false);
    });
  });

  it('colours its links inline, not through a scoped rule on a next/link', () => {
    /* A scoped className on a Link failed to attach in the production
       Turbopack build and left every footer link invisible against the
       near-black background. */
    const linkFn = FOOTER.slice(FOOTER.indexOf('function FooterLink'), FOOTER.indexOf('function SocialIcon'));
    expect(linkFn).toContain('color: active ?');
    expect(linkFn, 'FooterLink is using a className again').not.toMatch(/className=/);
  });

  it('offers a way to actually reach a human', () => {
    const { container } = render(<FooterSection />);
    const mailto = [...container.querySelectorAll('a')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h.startsWith('mailto:'));
    expect(mailto.length, 'the footer has no email address on it').toBeGreaterThan(0);
    expect(mailto[0]).toContain('info@fancyrsvp.com');
  });

  it('does not shrink its input below the size that zooms iOS Safari', () => {
    /* Anything under 16px makes iOS zoom the page on focus and leave it
       zoomed. It was 13px here. */
    const news = FOOTER_RAW.slice(FOOTER_RAW.indexOf('function Newsletter'), FOOTER_RAW.indexOf('export default function FooterSection'));
    const size = news.match(/fontSize:\s*'(\d+)px'/);
    expect(size, 'the newsletter input has no explicit font size').toBeTruthy();
    expect(Number(size[1])).toBeGreaterThanOrEqual(16);
  });
});

describe('nothing links into a hole', () => {
  it('every internal href on the page resolves to a real page.js', () => {
    const sections = [HeroSection, HowItWorksSection, CapabilitiesSection,
      DashboardShowcaseSection, FaqCtaSection, FooterSection];
    sections.forEach((Section) => {
      const { container, unmount } = render(<Section />);
      [...container.querySelectorAll('a')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && h.startsWith('/'))
        /* Drop the fragment before resolving. "/#invitations" is this page
           plus an anchor, and asking the filesystem for a route called
           "#invitations" fails a link that works perfectly. A bare "#foo" is
           already excluded by the startsWith('/') filter above. */
        .map((h) => h.split('#')[0] || '/')
        .forEach((h) => expect(routeExists(h), `${h} resolves to no page.js`).toBe(true));
      unmount();
    });
  });
});

describe('the FAQ and its structured data cannot disagree', () => {
  it('builds the FAQPage JSON-LD from the array the accordion renders', () => {
    expect(PAGE).toContain('FAQS.map');
    expect(PAGE).toContain("'@type': 'FAQPage'");
    render(<FaqCtaSection />);
    FAQS.forEach((f) => expect(screen.getByText(f.q), `${f.q} is not rendered`).toBeTruthy());
  });

  it('uses native disclosure rather than hand-rolled aria state', () => {
    const { container } = render(<FaqCtaSection />);
    const details = container.querySelectorAll('details');
    expect(details.length).toBe(FAQS.length);
    expect(container.querySelectorAll('details > summary').length).toBe(FAQS.length);
  });

  it('never imports a VALUE into page.js from a client module', () => {
    /* THE BUG THIS EXISTS FOR, and it is invisible to every other check here.
     *
     * FAQS was originally exported from FaqCtaSection.js, which is
     * `'use client'`, and page.js — a Server Component — imported it to build
     * the JSON-LD. That renders in development, passes every test in this
     * file, and then fails the PRODUCTION BUILD:
     *
     *     TypeError: I.FAQS.map is not a function
     *     Failed to collect page data for /
     *
     * A Server Component importing across a client boundary receives client
     * REFERENCES, not values. Only `next build` models that, which is why the
     * homepage has to keep its shared data in modules that carry no
     * 'use client' — here, faqContent.js.
     */
    const importLines = [...PAGE.matchAll(/import\s+\{([^}]+)\}\s+from\s+"([^"]+)"/g)];
    expect(importLines.length, 'page.js stopped using named imports').toBeGreaterThan(0);

    importLines.forEach(([, names, spec]) => {
      if (!spec.startsWith('./components/landing/')) return;
      const file = path.join(ROOT, 'src/app', `${spec.replace(/^\.\//, '')}.js`);
      if (!fs.existsSync(file)) return;
      const head = read(path.relative(ROOT, file)).trimStart();
      const isClient = head.startsWith("'use client'") || head.startsWith('"use client"');
      expect(isClient,
        `page.js imports { ${names.trim()} } from ${spec}, which is a Client Component. `
        + 'On the server those are client references, not values — this fails `next build`.')
        .toBe(false);
    });
  });

  it('points the refund answer at the terms rather than restating them', () => {
    const refund = FAQS.find((f) => /refund/i.test(f.q));
    expect(refund, 'the refund question is gone').toBeTruthy();
    expect(refund.link?.href).toBe('/terms');
  });
});

describe('the sections that need real data render nothing without it', () => {
  it('the proof band disappears when there are no reviews and no press', () => {
    /* This is the state of a fresh install — both endpoints return empty
       arrays — so the page has to read correctly with this band absent. */
    const { container } = render(<ProofSection />);
    expect(container.innerHTML).toBe('');
  });
});

describe('the styled-jsx traps this codebase has already paid for', () => {
  const FILES = [
    'HeroSection.js', 'HowItWorksSection.js', 'CapabilitiesSection.js',
    'DashboardShowcaseSection.js', 'FaqCtaSection.js', 'FooterSection.js',
    'ProofSection.js',
  ];

  it('has no backtick inside any style block', () => {
    /* One backtick in a CSS comment ends the template literal and the file
       stops parsing — a syntax error, not a style bug. AGENTS.md says to run
       the build rather than grep for it, and the build DID catch it here: two
       of these files shipped one on the first pass. This is the cheap check
       that catches it before the 3-minute build does. */
    FILES.forEach((f) => {
      styleBlocks(read(`src/app/components/landing/${f}`)).forEach((css, i) => {
        expect(css.includes('`'), `a backtick is inside style block ${i} of ${f}`).toBe(false);
      });
    });
  });

  it('never aims a SCOPED styled-jsx rule at a next/link', () => {
    /* styled-jsx stamps its hash only onto lowercase intrinsic elements, so a
       scoped rule for a class sitting on a next/link compiles to
       `.foo.jsx-hash` and matches NOTHING — the failure that once made every
       alert on this platform invisible, and the footer's links along with it.
       Two escapes are legitimate: a `style jsx global` block, or a plain
       `<style>` element (which is also the only option in a Server Component,
       since styled-jsx cannot be imported into one at all). */
    FILES.forEach((f) => {
      const src = read(`src/app/components/landing/${f}`);
      if (!/<Link[^>]*className=/.test(code(src))) return;
      const hasScoped = /<style jsx>\{`/.test(src);
      if (!hasScoped) return; // plain <style> — global by nature, fine.
      expect(/<style jsx global>\{`/.test(src),
        `${f} puts a className on a next/link, uses a scoped block, and has no global one`).toBe(true);
    });
  });

  it('uses only breakpoints on the four-value scale', () => {
    /* AGENTS.md: four values, and a fifth is never introduced. Three crept in
       on the first pass here (479.98, 899.98, 860) and each had a plausible
       local reason — which is exactly why this is a test and not a habit. */
    const ALLOWED = new Set(['639.98', '640', '767.98', '768', '1023.98', '1024', '1279.98', '1280', '44']);
    FILES.concat(['TemplatesShowcaseSection.js']).forEach((f) => {
      const src = read(`src/app/components/landing/${f}`);
      [...src.matchAll(/\((?:max|min)-width: *([\d.]+)px\)/g)]
        .forEach((m) => expect(ALLOWED.has(m[1]), `${f}: ${m[1]}px is off the scale`).toBe(true));
    });
  });

  it('keeps the three no-interaction bands as Server Components', () => {
    /* They render markup and nothing else. Marking one "use client" to get
       styled-jsx scoping back would ship JavaScript to draw static type — and
       it is how the first pass of this rebuild failed the build outright. */
    ['HowItWorksSection.js', 'CapabilitiesSection.js', 'DashboardShowcaseSection.js']
      .forEach((f) => {
        const src = read(`src/app/components/landing/${f}`);
        expect(src.trimStart().startsWith("'use client'") || src.trimStart().startsWith('"use client"'),
          `${f} became a Client Component`).toBe(false);
        expect(src, `${f} imports styled-jsx, which a Server Component cannot`)
          .not.toMatch(/<style jsx(?: global)?>\{`/);
      });
  });
});
