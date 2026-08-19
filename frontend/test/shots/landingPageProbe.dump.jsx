/* ═══════════════════════════════════════════════════════════════════════════
   THE REBUILT HOMEPAGE, AS A PICTURE.

   Not a screenshot source for the product — nothing here ships. This stages
   the whole page so it can be PHOTOGRAPHED at a desktop width and at a real
   390px phone before being called finished, which is the standing rule on this
   project: string assertions are not verification, and there is no dev server
   here to point a browser at.

   It stages the bands that can render without a network: the two data-backed
   ones (PrintedInvitationsSection, which is an async Server Component, and
   ProofSection, which renders null until an admin publishes a review) are
   absent by design, and the page is meant to read correctly without them —
   that is exactly the state a fresh install is in.

     npx vitest run --config vitest.shots.config.mjs landingPageProbe

   then photograph .visual/landing/frame-page1280.html and frame-page390.html.
   ═══════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import { describe, it, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}));

/* Logged out — the state a first-time visitor is in, and the one whose CTA
   copy ("Create your event") actually matters. */
vi.mock('../../src/app/hooks/useAuth', () => ({
  useAuth: () => ({ isLoggedIn: false, loading: false, logout: () => {} }),
}));

/* The counters read a real endpoint; the fallback numbers are the ones the DB
   column defaults to, so this is what the page shows before the fetch lands. */
vi.mock('../../src/app/utils/useLandingStats', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useLandingStats: () => ({ stats: actual.FALLBACK_STATS }) };
});

globalThis.React = React;

import HeroSection from '../../src/app/components/landing/HeroSection';
import HowItWorksSection from '../../src/app/components/landing/HowItWorksSection';
import TemplatesShowcaseSection from '../../src/app/components/landing/TemplatesShowcaseSection';
import CapabilitiesSection from '../../src/app/components/landing/CapabilitiesSection';
import DashboardShowcaseSection from '../../src/app/components/landing/DashboardShowcaseSection';
import FaqCtaSection from '../../src/app/components/landing/FaqCtaSection';
import FooterSection from '../../src/app/components/landing/FooterSection';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'landing');
const STAGE = path.join(OUT, 'stage');
const PUBLIC = path.join(ROOT, 'public').replace(/\\/g, '/');

function appCss() {
  const dir = path.join(ROOT, '.next/static/chunks');
  if (!fs.existsSync(dir)) throw new Error('No .next build. Run `npx next build` first.');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  if (!css.includes('.fx-grid')) throw new Error('Built CSS has no .fx-grid — stale build.');
  return css;
}

const FONTS = `
  *,*::before,*::after { box-sizing: border-box; }
  :root {
    --font-sans:'Segoe UI',system-ui,sans-serif;
    --font-serif:Georgia,'Times New Roman',serif;
    --font-script:'Segoe Script','Brush Script MT',cursive;
  }
  html,body { margin:0; padding:0; background:#fff; }
`;

beforeEach(() => {
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    unobserve() {} disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
});

describe('landing — whole-page probe', () => {
  it('stages the rebuilt homepage at both widths', async () => {
    const { container } = render(
      <>
        <HeroSection />
        <HowItWorksSection />
        <TemplatesShowcaseSection />
        <CapabilitiesSection />
        <DashboardShowcaseSection />
        <FaqCtaSection />
        <FooterSection />
      </>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });

    /* An ABSOLUTE src ignores <base>, so every image would render as a broken
       icon and the staged page would be measured with the wrong heights.
       templateShots.dump.jsx does the same rewrite for /templates/. */
    const html = container.innerHTML.replace(/src="\/images\//g, 'src="images/');
    const head = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

    fs.mkdirSync(STAGE, { recursive: true });
    fs.writeFileSync(path.join(STAGE, 'page.html'),
      `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8">
<base href="file:///${PUBLIC}/">
<style>${FONTS}</style><style>${appCss()}</style><style>${head}</style>
<style>
  /* Entrance animations run to their end state: this is a still. */
  *,*::before,*::after { animation-duration: 1ms !important; animation-delay: 0s !important; }
</style>
</head><body>${html}</body></html>`, 'utf8');

    /* Reported so the page's real height is a measured number rather than an
       estimate — "is it too long?" was the whole point of the rebuild. */
    // eslint-disable-next-line no-console
    console.log('PROBE staged page.html bytes:', html.length);

    /* The <details> accordion opens only its first item by default, which is
       what a visitor sees, so no forcing here. */
    for (const [name, w, h] of [['page1280', 1280, 7200], ['page390', 390, 11000]]) {
      fs.writeFileSync(path.join(OUT, `frame-${name}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff;overflow:hidden;}
  iframe{position:absolute;top:0;left:0;width:${w}px;height:${h}px;border:0;}
</style></head><body><iframe src="stage/page.html" scrolling="no"></iframe></body></html>`, 'utf8');
    }
  });
});
