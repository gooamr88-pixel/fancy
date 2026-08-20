import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/' }));

import TemplatesShowcaseSection from '../src/app/components/landing/TemplatesShowcaseSection';
import { TEMPLATES } from '../src/app/utils/curatedTemplates';
import { CINEMATIC_KEYS } from '../src/app/components/templates/cinematic/cinematicThemes';
import { occasionPolicyFor } from '../src/app/utils/eventOccasion';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SECTION = read('src/app/components/landing/TemplatesShowcaseSection.js');

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
    // Descend through any route group at this level.
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
      .some((g) => walk(path.join(dir, g.name), rest));
  };
  return walk(path.join(ROOT, 'src/app'), segments);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE HOMEPAGE SHOWS THE ACTUAL INVITATIONS.

   Everything on the landing page used to be drawn by hand — a 39KB "decorative
   mockup" of the dashboard and four hand-built phone screens — while the three
   cinematic templates, the most differentiated thing this platform makes,
   appeared on it nowhere.

   These pin the two properties that matter: the imagery is real and current,
   and the words next to it come from the same source the product does.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the invitations are shown, and they are real', () => {
  it('shows every cinematic template', () => {
    render(<TemplatesShowcaseSection />);
    CINEMATIC_KEYS.forEach((key) => {
      const tpl = TEMPLATES.find((t) => t.key === key);
      expect(tpl, `${key} is not in the picker`).toBeTruthy();
      expect(screen.getByText(tpl.label), `${tpl.label} is missing from the homepage`).toBeTruthy();
    });
  });

  it('shows the opened page for each', () => {
    const { container } = render(<TemplatesShowcaseSection />);
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    CINEMATIC_KEYS.forEach((key) => {
      expect(srcs, `${key} has no opened page`).toContain(`/images/landing/hero-${key}.webp`);
    });
  });

  it('the sealed-and-opened pair is still made, in the hero', () => {
    /* The claim is "it opens on film before it becomes a page", and one image
       cannot make that point. This band used to carry the pair for all three
       templates — six tall photographs in a row, which showed the same idea
       three times. Since 2026-08-20 the HERO makes the argument once, with
       Swan Lake sealed beside Swan Lake open, and this band shows what each
       one becomes.

       So the guarantee did not go away, it moved: assert it where it now
       lives, or the page can quietly lose the pair entirely. */
    const hero = read('src/app/components/landing/HeroSection.js');
    expect(hero, 'the hero no longer shows a sealed invitation')
      .toContain('/images/landing/cover-swans.webp');
    expect(hero, 'the hero no longer shows an opened invitation')
      .toContain('/images/landing/hero-swans.webp');
  });

  it('every image it names is actually shipped', () => {
    const { container } = render(<TemplatesShowcaseSection />);
    [...container.querySelectorAll('img')].forEach((img) => {
      const src = img.getAttribute('src');
      const file = path.join(ROOT, 'public', src.replace(/^\//, ''));
      expect(fs.existsSync(file), `${src} is not in public/`).toBe(true);
    });
  });

  it('keeps the whole set inside a sane page budget', () => {
    /* Six full-bleed invitation photographs sit below the fold on the
       homepage. They are lazy, but they are still the page's weight. */
    const dir = path.join(ROOT, 'public/images/landing');
    const total = fs.readdirSync(dir)
      .reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
    expect(Math.round(total / 1024), 'the landing imagery has grown past its budget')
      .toBeLessThan(320);
  });

  it('declares dimensions and defers loading', () => {
    const { container } = render(<TemplatesShowcaseSection />);
    [...container.querySelectorAll('img')].forEach((img) => {
      // Without both, six tall images below the fold are a layout shift and a
      // blocking download.
      expect(img.getAttribute('width'), 'no width — this will shift the layout').toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
      expect(img.getAttribute('loading')).toBe('lazy');
      expect((img.getAttribute('alt') || '').length, 'alt text is too thin').toBeGreaterThan(30);
    });
  });
});

describe('the words come from the product, not a second copy', () => {
  it('takes name and description from the template registry', () => {
    /* The tagline is no longer printed here. Each plate carried FOUR lines of
       prose — tagline, arrival, description, badge — under a photograph that
       is already doing most of the talking, and the tagline was the one that
       overlapped the description in meaning.

       What matters is unchanged and still asserted: the name and description a
       visitor reads are the registry's, so they cannot drift from what the
       wizard shows. */
    render(<TemplatesShowcaseSection />);
    TEMPLATES.filter((t) => CINEMATIC_KEYS.includes(t.key)).forEach((t) => {
      expect(screen.getByText(t.label)).toBeTruthy();
      expect(screen.getByText(t.desc)).toBeTruthy();
    });
    expect(SECTION).toContain('TEMPLATES');
    expect(SECTION).toContain('CINEMATIC_KEYS');
  });

  it('takes the occasion badge from the same policy the picker offers from', () => {
    /* Otherwise the homepage can advertise "any occasion" on a template the
       wizard then refuses — Velvet Ring is engagements only. */
    render(<TemplatesShowcaseSection />);
    expect(SECTION).toContain('occasionPolicyFor');
    expect(screen.getAllByText(occasionPolicyFor('ring').label).length).toBeGreaterThan(0);
    expect(screen.getAllByText(occasionPolicyFor('bab').label).length).toBeGreaterThan(0);
  });

  it('does not link anywhere that does not exist', () => {
    // There is no /templates route; the place a visitor actually picks one is
    // step 1 of the wizard.
    expect(SECTION).not.toMatch(/href="\/templates"/);
    const { container } = render(<TemplatesShowcaseSection />);
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach((h) => {
      expect(routeExists(h), `${h} resolves to no page.js`).toBe(true);
    });
  });
});

describe('it survives a phone', () => {
  it('releases the grid minimum the invitation images would otherwise set', () => {
    // A grid item's automatic minimum is its content's min-content size, and
    // these images are 468px wide intrinsically — so without this the band
    // sets a floor no phone can meet and the page scrolls sideways.
    expect(SECTION).toMatch(/\.tss-plate \{ min-width: 0; \}/);
  });

  it('uses only breakpoints on the four-value scale', () => {
    const widths = [...SECTION.matchAll(/\((?:max|min)-width: *([\d.]+)px\)/g)].map((m) => m[1]);
    const ALLOWED = new Set(['639.98', '640', '767.98', '768', '1023.98', '1024', '1279.98', '1280', '44']);
    widths.forEach((w) => expect(ALLOWED.has(w), `${w}px is off the scale`).toBe(true));
  });

  it('uses a plain style element, so next/link cannot lose its rules', () => {
    /* This used to need a SEPARATE "style jsx global" block, because
       styled-jsx stamps its hash only onto lowercase intrinsic elements and a
       scoped rule aimed at a class on a next/link matches nothing — the bug
       that once made every footer link invisible in production only.

       A plain <style> has no scoped/global distinction to get wrong, so the
       stronger assertion is that styled-jsx is not here at all. Scoping is
       replaced by the "tss-" prefix on every class. */
    expect(SECTION, 'styled-jsx is back, and next/link will silently lose its rules')
      .not.toContain('style jsx');
    expect(SECTION).toMatch(/<style>\{`/);
    expect(SECTION).toMatch(/\.tss-btn \{/);
  });

  it('has no backtick inside its style block', () => {
    // One backtick in a CSS comment ends the template literal and the file
    // stops parsing. It has cost three build failures across this codebase —
    // scripts/backtickInCssComment.js now checks the whole tree for it.
    const blocks = [...SECTION.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)];
    expect(blocks.length, 'the style block moved').toBe(1);
    blocks.forEach(([, css], i) => {
      expect(css.includes('`'), `a backtick is inside style block ${i}`).toBe(false);
    });
  });
});

describe('the imagery can be regenerated', () => {
  it('the shots harness exists and is kept out of the test suite', () => {
    /* If the only way to regenerate these is to remember how, they go stale
       the first time a template changes. */
    const dump = read('test/shots/templateShots.dump.jsx');
    expect(dump).toContain('VelvetBoxOpening');
    expect(dump).toContain('WaxEnvelopeOpening');
    expect(dump).toContain('force-device-scale-factor');

    const cfg = read('vitest.shots.config.mjs');
    expect(cfg).toContain("config.test.include = ['test/shots/*.dump.jsx']");

    // ...and the default suite must not pick it up.
    const base = read('vitest.config.mjs');
    expect(base).toContain("include: ['test/**/*.test.{js,jsx}']");
  });
});
