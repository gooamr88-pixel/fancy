/* ═══════════════════════════════════════════════════════════════════════════
   The Fancy Check-in screens shown on /checkin-app, rendered from the app's
   own design source.

   WHY THIS EXISTS RATHER THAN A FOLDER OF PNGs

   The door app has never been photographed — there is no device screenshot
   anywhere in this repository. What there is, is
   `docs/Checkin-Result-Screens-Mockup.html`: the mockup the owner approved
   axis by axis (content, type, colour, motion) and which was then built into
   Kotlin. Its `.tablet` blocks are the genuine screens — real layout, real
   palette, real copy.

   So the marketing artwork is GENERATED from that file instead of drawn
   beside it. Redesign the screens and re-run this, and the page cannot go on
   showing an app that no longer exists. Draw them by hand and it silently can.

   The output is committed (like the template photography): a build must not
   depend on a headless browser.

   ── Regenerating ─────────────────────────────────────────────────────────
     node scripts/renderCheckinScreens.js          # writes the staging HTML
   then, per screen printed above, e.g. on Windows:
     & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new \
       --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
       --window-size=1400,875 --virtual-time-budget=9000 \
       --screenshot=<out>.png <staged>.html
   1400x875 is 16:10 — the `.tablet` aspect, and the app's own locked
   landscape. `--force-device-scale-factor=2` is what keeps the type crisp on
   a retina screen; without it these look soft next to the rest of the page.
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'docs', 'Checkin-Result-Screens-Mockup.html');
const STAGE = path.join(ROOT, '.visual', 'checkin', 'stage');

/** The screens worth showing, and what each is called on disk. */
const WANTED = [
  ['g-welcome', 'welcome'],
  ['g-vip', 'vip'],
  ['g-notfound', 'notfound'],
];

/**
 * The outerHTML of `<div class="tablet …">`, brace-counted rather than
 * regex-matched to its close.
 *
 * These blocks nest divs four deep. A lazy `[\s\S]*?</div>` stops at the
 * FIRST close tag and returns a fragment that renders as a broken half-card —
 * which looks enough like a design decision to ship unnoticed.
 */
function extractTablets(html) {
  const out = [];
  const open = /<div class="tablet ([a-z-]+)"[^>]*>/g;
  let m;
  while ((m = open.exec(html))) {
    let i = open.lastIndex;
    let depth = 1;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth += 1; i = nextOpen + 4; } else {
        depth -= 1;
        i = nextClose + 6;
      }
    }
    out.push({ key: m[1], html: html.slice(m.index, i) });
  }
  return out;
}

function main() {
  const src = fs.readFileSync(SOURCE, 'utf8');
  const styles = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((s) => s[1]).join('\n');
  if (!styles) throw new Error('no <style> found in the mockup — has it been restructured?');

  const tablets = extractTablets(src);
  fs.mkdirSync(STAGE, { recursive: true });

  const made = [];
  for (const [cls, name] of WANTED) {
    const found = tablets.find((t) => t.key === cls);
    if (!found) throw new Error(`.tablet.${cls} is gone from the mockup — update WANTED`);

    /* The tablet is the WHOLE viewport here: no page chrome, no margin, and
       the screenshot is then just the window. `.tablet` sizes itself from its
       container and uses container queries for type, so the wrapper has to
       carry a real width — `100vw/100vh` rather than `auto`.

       Animations are forced to their end state. They use `both`, so they do
       settle on their own, but pinning it means a slow machine cannot
       capture a half-risen card. */
    const page = `<!doctype html><html><head><meta charset="utf-8"><style>
${styles}
  html, body { margin: 0; padding: 0; background: transparent; }
  .shot { width: 100vw; height: 100vh; }
  .shot .tablet { width: 100%; height: 100%; aspect-ratio: auto; box-shadow: none; }
  .anim > * { animation: none !important; opacity: 1 !important; transform: none !important; }
</style></head><body><div class="shot">${found.html}</div></body></html>`;

    const file = path.join(STAGE, `${name}.html`);
    fs.writeFileSync(file, page, 'utf8');
    made.push({ name, file });
  }

  const outDir = path.join(ROOT, 'frontend', 'public', 'images', 'checkin');
  process.stdout.write(`staged ${made.length} screens in ${STAGE}\n`);
  for (const { name, file } of made) {
    process.stdout.write(`  ${name}: ${file}  ->  ${path.join(outDir, `${name}.png`)}\n`);
  }
}

main();
