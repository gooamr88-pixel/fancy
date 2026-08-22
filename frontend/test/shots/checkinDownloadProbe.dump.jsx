/* Stages the check-in setup page's "Fancy Check-in" card so it can be LOOKED AT.
   Output lands in .visual/checkin-download/.
     npx vitest run --config vitest.shots.config.mjs test/shots/checkinDownloadProbe.dump.jsx

   Two variants, because the card now chooses its download link rather than its
   whole message: one where an admin HAS published a release through the gated
   endpoint, and one where nobody ever touched that config — which is the real
   state of production today, and the case that used to render "opening soon". */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/dashboard' }));

const FEATURE = 'Fancy Check-in app (offline door scanner)';
vi.mock('../../src/app/utils/usePublicPricing', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usePublicPricing: () => ({
      tiers: [
        { name: 'Essential', features: ['Basic RSVP forms'] },
        { name: 'Enterprise', features: ['Basic RSVP forms', FEATURE] },
        { name: 'Bespoke', features: ['Basic RSVP forms', FEATURE] },
      ],
      error: null,
    }),
  };
});

/* The release record the component fetches. Swapped per variant below — the
   component reads `available` only to decide WHICH url it hands over, so the
   unconfigured case must still render the full announcement. */
let RELEASE = {};
vi.mock('../../src/app/utils/apiClient', () => ({
  apiFetch: async () => ({ data: RELEASE }),
}));

import CheckinAppDownload from '../../src/app/dashboard/components/CheckinAppDownload';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'checkin-download');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* The REAL typefaces — the card sets its heading in the brand serif, and a
   probe that falls back to a system serif is not showing the design. */
function fontFaces() {
  const dir = path.join(ROOT, '.next/static/chunks');
  if (!fs.existsSync(dir)) throw new Error('No .next build. Run `npx next build` first.');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const media = encodeURI(path.join(ROOT, '.next/static/media').split(path.sep).join('/'));
  const withFonts = css.replace(/url\(\.\.\/media\//g, `url(file:///${media}/`);
  const faces = withFonts.match(/@font-face\{[^}]*\}/g);
  if (!faces) throw new Error('No @font-face in the built CSS — the font pipeline moved.');
  return faces.join('\n');
}

const VARS = `
  :root {
    --font-heading: "Aboreto", "Aboreto Fallback";
    --font-body: "Google Sans";
    --font-cormorant: "Cormorant Garamond", "Cormorant Garamond Fallback";
  }
  html, body { margin: 0; padding: 0; background: #F3F4F1; }
  .stage { padding: 24px; }
`;

async function stage(name, release) {
  RELEASE = release;
  let r;
  await act(async () => { r = render(<CheckinAppDownload eventId="evt-1" />); });
  await act(async () => { await new Promise((res) => setTimeout(res, 60)); });

  fs.mkdirSync(OUT, { recursive: true });

  /* THE SRC IS REWRITTEN, NOT BASED.
     The screenshot src is the absolute "/images/checkin/welcome.webp" the app
     serves. A <base> does NOT fix it — base resolves only RELATIVE references,
     so a leading-slash path still resolves against the origin (file:///C:/...,
     the drive root) and the image renders as alt text, which looks identical
     to a genuinely missing asset. */
  const pub = encodeURI(path.join(ROOT, 'public').split(path.sep).join('/'));
  const html = r.container.innerHTML.replace(/src="\//g, `src="file:///${pub}/`);
  if (html.includes('src="/')) throw new Error('A root-relative src survived the rewrite.');
  if (!html.includes('welcome.webp')) throw new Error('The tablet screenshot is not in the output.');

  fs.writeFileSync(path.join(OUT, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${fontFaces()}</style><style>${GLOBALS}</style><style>${VARS}</style></head>
<body><div class="stage">${html}</div></body></html>`, 'utf8');

  /* Shot through an IFRAME: Chrome on Windows will not open a window under
     ~500px, so --window-size=390 lays out at 500 and crops. */
  for (const w of [390, 1280]) {
    fs.writeFileSync(path.join(OUT, `frame-${name}-${w}.html`),
      `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:1500px;border:0;background:#F3F4F1;}
</style></head><body><iframe src="${name}.html" scrolling="no"></iframe></body></html>`, 'utf8');
  }
  return html;
}

describe('checkin download probe', () => {
  it('stages the announcement, configured and unconfigured', async () => {
    const configured = await stage('configured', {
      available: true, version: '1.4.0', versionCode: 14, minAndroid: '8.0',
      sizeBytes: 62914560,
      sha256: '9f2c4a1e7b3d5086cf1a2b4d6e8f0a1c3e5d7b9f2a4c6e8d0b1f3a5c7e9d1b3f',
      releaseNotes: '', releasedAt: '2026-08-20T10:00:00Z',
    });
    // The gated, audited path when an admin has published through it.
    if (!configured.includes('/checkin-app/download')) {
      throw new Error('A configured release must link the gated download endpoint.');
    }

    const unconfigured = await stage('unconfigured', { available: false });
    // The case that used to say "opening soon". It must now announce, and it
    // must hand over the public APK that actually exists.
    if (!unconfigured.includes('fancyrsvp.com/download/fancy-checkin.apk')) {
      throw new Error('An unconfigured release must fall back to the public APK.');
    }
    if (/opening soon|we will email you/i.test(unconfigured)) {
      throw new Error('The retired coming-soon copy is back.');
    }

    // eslint-disable-next-line no-console
    console.log('DUMP-LEN', configured.length, unconfigured.length);
  });
});
