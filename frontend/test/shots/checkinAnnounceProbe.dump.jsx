/* Stages the dashboard's Fancy Check-in announcement so it can be LOOKED AT.
   Output lands in .visual/checkin-announce/.
     npx vitest run --config vitest.shots.config.mjs test/shots/checkinAnnounceProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/dashboard' }));

/* The live pricing config decides which plans can pair a tablet. Two tiers
   carry the feature here so the fine print has something real to join. */
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

import CheckinAppAnnounce from '../../src/app/dashboard/components/CheckinAppAnnounce';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'checkin-announce');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* The REAL typefaces — the card sets its heading in Cormorant, and a probe
   that falls back to a system serif is not showing the design. */
function fontFaces() {
  const dir = path.join(ROOT, '.next/static/chunks');
  if (!fs.existsSync(dir)) throw new Error('No .next build. Run `npx next build` first.');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const media = encodeURI(path.join(ROOT, '.next/static/media').split(path.sep).join('/'));
  const withFonts = css.replace(/url\(\.\.\/media\//g, `url(file:///${media}/`);
  if (!/@font-face\{font-family:"?Cormorant Garamond"?;/.test(withFonts)) {
    throw new Error('No Cormorant @font-face in the built CSS — the font pipeline moved.');
  }
  return withFonts.match(/@font-face\{[^}]*\}/g).join('\n');
}

const VARS = `
  :root {
    --font-heading: "Aboreto", "Aboreto Fallback";
    --font-body: "Google Sans";
    --font-cormorant: "Cormorant Garamond", "Cormorant Garamond Fallback";
  }
  html, body { margin: 0; padding: 0; background: #F3F4F1; }
  /* The dashboard's own page padding, so the card is measured with the gutter
     it actually has rather than edge to edge. */
  .stage { padding: 24px; }
`;

describe('checkin announce probe', () => {
  it('stages the announcement at both widths', async () => {
    let r;
    await act(async () => { r = render(<CheckinAppAnnounce />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 60)); });

    fs.mkdirSync(OUT, { recursive: true });

    /* THE SRC IS REWRITTEN, NOT BASED.

       The card's screenshot src is the absolute "/images/checkin/welcome.webp"
       the app serves. A <base> was tried first and does NOT fix it: base only
       resolves RELATIVE references, so a leading-slash path still resolves
       against the origin — file:///C:/images/... , the drive root — and the
       image renders as alt text, which looks identical to a genuinely missing
       asset. Both captures of this card came out that way before this.

       So the root-relative prefix is rewritten to a real file: URL, encoded
       because this repo lives under a path with a space in it. */
    const pub = encodeURI(path.join(ROOT, 'public').split(path.sep).join('/'));
    const html = r.container.innerHTML.replace(/src="\//g, `src="file:///${pub}/`);
    if (html.includes('src="/')) throw new Error('A root-relative src survived the rewrite.');

    fs.writeFileSync(path.join(OUT, 'card.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${fontFaces()}</style><style>${GLOBALS}</style><style>${VARS}</style></head>
<body><div class="stage">${html}</div></body></html>`, 'utf8');

    /* Shot through an IFRAME: Chrome on Windows will not open a window under
       ~500px, so --window-size=390 lays out at 500 and crops. */
    for (const w of [390, 440, 1280]) {
      fs.writeFileSync(path.join(OUT, `frame-${w}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:1400px;border:0;background:#F3F4F1;}
</style></head><body><iframe src="card.html" scrolling="no"></iframe></body></html>`, 'utf8');
    }

    // eslint-disable-next-line no-console
    console.log('DUMP-LEN', r.container.innerHTML.length);
  });
});
