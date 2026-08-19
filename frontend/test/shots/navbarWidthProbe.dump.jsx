/* Measures the desktop navbar at its TIGHTEST rendering width.
   Navbar.js carries an explicit width budget in its own styles ("total ~916 ≤
   943, 27px headroom") computed at a 1024px viewport, with a note to re-check
   on a real viewport before trusting it. A nav link was added for Printed
   Cards, so this is that re-check. Run with:
     npx vitest run --config vitest.shots.config.mjs test/shots/navbarWidthProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useSearchParams: () => new URLSearchParams('') }));
/* Logged OUT is the widest case: it renders "Log In" AND "Get Started",
   where a signed-in visitor gets only "Dashboard". */
vi.mock('../../src/app/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));

import Navbar from '../../src/app/components/landing/Navbar';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'navbar');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
const FX = `
  :root { --font-serif: Georgia; --font-sans: 'Segoe UI'; --font-script: 'Segoe Script'; }
  html, body { margin: 0; padding: 0; }
`;

describe('navbar width probe', () => {
  it('stages the navbar and a measuring rig per width', async () => {
    let r;
    await act(async () => { r = render(<Navbar />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 60)); });

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'nav.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${GLOBALS}</style><style>${FX}</style></head>
<body>${r.container.innerHTML}</body></html>`, 'utf8');

    // 1024 is the tightest width that still renders the DESKTOP nav — below
    // 1023.98px it swaps to the burger. 1100/1280 confirm it stays clean.
    for (const w of [1024, 1100, 1120, 1140, 1160, 1200, 1280]) {
      fs.writeFileSync(path.join(OUT, `m-${w}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#111;color:#eee;font:12px/1.5 monospace;}
  iframe{width:${w}px;height:200px;border:0;position:absolute;left:-9999px;}
  pre{padding:10px;white-space:pre-wrap;}
</style></head><body>
<iframe id="f" src="nav.html"></iframe><pre id="out">pending</pre>
<script>
function go(){
  var fr=document.getElementById('f'), doc=fr.contentDocument, win=fr.contentWindow;
  if(!doc||doc.readyState!=='complete'){ setTimeout(go,100); return; }
  var VW=win.innerWidth, L=[];
  L.push('nav @ '+VW+'  scrollWidth='+doc.documentElement.scrollWidth);
  var nav=doc.querySelector('.desktop-nav');
  if(nav){
    var r=nav.getBoundingClientRect();
    L.push('desktop-nav width='+Math.round(r.width)+' left='+Math.round(r.left)+' right='+Math.round(r.right));
    L.push('links='+nav.querySelectorAll('a').length);
  } else { L.push('desktop-nav NOT FOUND'); }
  var over=[];
  doc.querySelectorAll('*').forEach(function(el){
    var b=el.getBoundingClientRect();
    if(!b.width||!b.height) return;
    if(b.right<=VW+1 && b.left>=-1) return;
    var c=(typeof el.className==='string'?el.className:'').trim().split(/\\s+/)[0];
    over.push(el.tagName.toLowerCase()+'.'+c+' right=+'+Math.round(b.right-VW)+' "'+(el.textContent||'').trim().slice(0,24)+'"');
  });
  L.push('OVERFLOW: '+(over.length?over.slice(0,8).join(' | '):'none'));
  document.getElementById('out').textContent=L.join(' ~ ');
}
setTimeout(go,150);
</script></body></html>`, 'utf8');
    }
    // eslint-disable-next-line no-console
    console.log('DUMP-LEN', r.container.innerHTML.length);
  }, 60000);
});
