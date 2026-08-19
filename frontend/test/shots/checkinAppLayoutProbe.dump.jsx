/* Measures /checkin-app's real layout.
   It pairs `fx-grid--3` and `fx-grid--2` with `fx-container--lg`, and --lg is a
   720px READING width — the column presets are sized for --4xl (1200px). This
   reports the column count each grid actually resolves to, and whether any
   container is missing its horizontal gutter. Run with:
     npx vitest run --config vitest.shots.config.mjs test/shots/checkinAppLayoutProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ usePathname: () => '/checkin-app', useSearchParams: () => new URLSearchParams('') }));
vi.mock('../../src/app/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
/* GoldDivider and Icon do not import React — fine under Next's automatic JSX
   runtime, a ReferenceError under this runner's classic transform. Both are
   decorative and contribute nothing to grid width, so stubbing them leaves the
   measurement honest. */
vi.mock('../../src/app/components/GoldDivider', () => ({ default: () => null }));
vi.mock('../../src/app/components/icons/Icon', () => ({ default: () => null }));
/* Navbar and the footer are chrome shared with every page and are measured
   separately (see navbarWidthProbe); what is under test here is the page's own
   sections. */
vi.mock('../../src/app/components/landing/FooterSection', () => ({ default: () => null }));
vi.mock('../../src/app/components/landing/Navbar', () => ({ default: () => null }));

vi.mock('../../src/app/utils/usePublicPricing', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usePublicPricing: () => ({
      tiers: [
        { name: 'Essential', price_cents: 9900, currency: 'USD', max_guests: 100, features: ['Digital invitations'] },
        { name: 'Enterprise', price_cents: 59900, currency: 'USD', max_guests: 1000, features: ['Fancy Check-in app (offline door scanner)'] },
      ],
      error: null,
    }),
  };
});

import CheckinAppPage from '../../src/app/checkin-app/page';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'checkin-app');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
const FX = `
  :root { --font-serif: Georgia; --font-sans: 'Segoe UI'; --font-script: 'Segoe Script'; }
  html, body { margin: 0; padding: 0; }
`;

describe('checkin-app layout probe', () => {
  it('stages the page and a measuring rig per width', async () => {
    let r;
    await act(async () => { r = render(<CheckinAppPage />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 80)); });

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'page.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${GLOBALS}</style><style>${FX}</style></head>
<body>${r.container.innerHTML}</body></html>`, 'utf8');

    for (const w of [390, 1280, 1440]) {
      fs.writeFileSync(path.join(OUT, `frame-${w}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:6200px;border:0;background:#fff;}
</style></head><body><iframe src="page.html" scrolling="no"></iframe></body></html>`, 'utf8');

      fs.writeFileSync(path.join(OUT, `m-${w}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#111;color:#eee;font:12px/1.5 monospace;}
  iframe{width:${w}px;height:6200px;border:0;position:absolute;left:-9999px;}
  pre{padding:10px;white-space:pre-wrap;}
</style></head><body>
<iframe id="f" src="page.html"></iframe><pre id="out">pending</pre>
<script>
function go(){
  var fr=document.getElementById('f'), doc=fr.contentDocument, win=fr.contentWindow;
  /* readyState alone is NOT enough: an iframe's initial about:blank document
     already reports 'complete', so polling on it measures an empty document
     and cheerfully reports "no grids found" as if the page had none. Wait for
     real content too. */
  if(!doc||doc.readyState!=='complete'||!doc.querySelector('.fx-container')){ setTimeout(go,100); return; }
  var VW=win.innerWidth, L=[];
  L.push('checkin-app @ '+VW+'  scrollWidth='+doc.documentElement.scrollWidth);
  L.push('--- grids: class -> resolved column count ---');
  doc.querySelectorAll('.fx-grid').forEach(function(g,i){
    var cs=win.getComputedStyle(g);
    var cols=cs.gridTemplateColumns.split(' ').filter(function(x){return x&&x!=='0px';}).length;
    var cls=(typeof g.className==='string'?g.className:'').trim();
    L.push('  ['+i+'] '+cls+' width='+Math.round(g.getBoundingClientRect().width)+' cols='+cols+' items='+g.children.length);
  });
  L.push('--- fx-container without a gutter (padding-left 0) ---');
  var nogut=[];
  doc.querySelectorAll('.fx-container').forEach(function(c,i){
    var pl=parseFloat(win.getComputedStyle(c).paddingLeft)||0;
    var par=c.parentElement, pp=par?parseFloat(win.getComputedStyle(par).paddingLeft)||0:0;
    var gap=Math.round(c.getBoundingClientRect().left);
    if(pl<1) nogut.push('  ['+i+'] '+(typeof c.className==='string'?c.className:'')+' padL='+pl+' w='+Math.round(c.getBoundingClientRect().width)+' leftEdge='+gap+' parentPadL='+pp);
  });
  L.push(nogut.length?nogut.join(' ~~ '):'none');
  document.getElementById('out').textContent=L.join(' ~ ');
}
setTimeout(go,150);
</script></body></html>`, 'utf8');
    }
    // eslint-disable-next-line no-console
    console.log('DUMP-LEN', r.container.innerHTML.length);
  }, 90000);
});
