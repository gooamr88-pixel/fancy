/* ═══════════════════════════════════════════════════════════════════════════
   The two responsive checks from AGENTS.md, done accurately.

   The greps that were documented there could not be used. On this tree they
   reported 9 inert `fx-` classes and 21 fixed-column grids; every one of the
   30 was a false positive, and they silently skipped ~20 files on top of that.
   A check nobody can act on is worse than no check: it trains you to ignore
   the output, which is exactly where a real finding goes to die.

   The four things that were wrong, and what this does instead:

   1. WINDOW, NOT ELEMENT. `grep -A3 | grep padding` fires on a `padding` three
      lines below that belongs to a CHILD, and misses a long tag whose style
      object starts on line 5. This walks each opening JSX tag to its own `>`
      (tracking brace depth and quotes) and only compares a className with the
      style object on the SAME tag.

   2. COMMENTS COUNTED AS CODE. Five of the 21 "fixed grids" were the text
      `repeat(3, 1fr)` inside a comment explaining that the fixed grid had been
      REMOVED. Comments are stripped first.

   3. NO NOTION OF A GUARD. A `repeat(N, 1fr)` with a class that a narrow-width
      @media re-declares is correct and common. So is one inside .fx-scroll-x,
      and so is a bounded decorative mosaic (the 72px QR placeholder). Each is
      recognised.

   4. SHELL GLOBBING ATE THE ROUTES. PowerShell's -Include and bash globs both
      treat `[slug]` as a character class, so EVERY dynamic route — the guest
      page, the RSVP wizard, the ticket and short-link routes — was skipped
      without a word. This walks the tree with readdir and never builds a glob.
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('node:fs');
const path = require('node:path');

/** `/* … *\/` and whole-line `//` comments. Enough to stop comment prose being
    read as code, without needing to tokenise strings. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const lineOf = (src, off) => src.slice(0, off).split('\n').length;

/** Every opening JSX tag's own source text, brace- and quote-aware. */
function openingTags(src) {
  const tags = [];
  const re = /<([A-Z][\w.]*|[a-z][\w-]*)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote = null;
    while (i < src.length) {
      const c = src[i];
      if (quote) { if (c === quote && src[i - 1] !== '\\') quote = null; }
      else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
      i++;
    }
    tags.push({ text: src.slice(m.index, i + 1), offset: m.index });
  }
  return tags;
}

/** [start, end) of every @media block, brace-matched. */
function mediaRanges(src) {
  const ranges = [];
  const re = /@media[^{]*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index, i]);
  }
  return ranges;
}

/* A class and the inline keys that make it inert, from the AGENTS.md table.
   `padding:` exactly — a `paddingBottom` alongside .fx-section is a deliberate
   partial override (see the --tight-bottom modifier), not a dead class. */
const INERT_RULES = [
  ['fx-section', /(^|[{,\s])padding\s*:/, 'padding'],
  ['fx-gutter', /(^|[{,\s])padding(Inline)?\s*:/, 'padding'],
  ['fx-container', /(^|[{,\s])maxWidth\s*:|margin\s*:\s*['"`]0 auto/, 'maxWidth / margin:0 auto'],
  ['fx-grid', /gridTemplateColumns\s*:/, 'gridTemplateColumns'],
];

function scanResponsive(root) {
  const files = walk(root);

  /* Every class name any @media block anywhere mentions alongside a
     grid-template-columns. Collected across the whole tree first: a base rule
     in a component and its override in globals.css is a normal split. */
  const gridOverridden = new Set();
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const [a, b] of mediaRanges(src)) {
      const block = src.slice(a, b);
      if (!/grid-template-columns/.test(block)) continue;
      for (const c of block.matchAll(/\.([a-zA-Z][\w-]*)/g)) gridOverridden.add(c[1]);
    }
  }

  const inertClasses = [];
  const fixedGrids = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = stripComments(raw);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const media = mediaRanges(src);

    const tags = /\.jsx?$/.test(file) ? openingTags(src) : [];
    /* The tag an offset falls inside. Looking BACKWARD for a className is the
       same window bug this file exists to replace: on the guest gallery the
       style prop comes first and `className="ep-gallery-grid"` sits AFTER it,
       so a backward scan reads the PREVIOUS element's class and reports a
       correctly-guarded grid. */
    const tagAt = (off) => tags.find((t) => off >= t.offset && off < t.offset + t.text.length);

    if (tags.length) {
      for (const tag of tags) {
        const cls = tag.text.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/);
        const style = tag.text.match(/style=\{\{([\s\S]*)\}\}/);
        if (!cls || !style) continue;
        const names = cls[1] || cls[2] || cls[3] || '';
        for (const [name, keyRe, label] of INERT_RULES) {
          if (!new RegExp(`(^|\\s)${name}(\\s|$|--)`).test(names)) continue;
          if (keyRe.test(style[1])) {
            inertClasses.push(`${rel}:${lineOf(src, tag.offset)}  .${name} is inert — inline ${label} still set`);
          }
        }
      }
    }

    for (const g of src.matchAll(/repeat\(\s*(\d+)\s*,\s*1fr\s*\)/g)) {
      const at = g.index;
      const back = src.slice(Math.max(0, at - 160), at);
      // grid-template-ROWS is not a reflow concern.
      if (/grid-template-rows\s*:[^;]*$/.test(back) || /gridTemplateRows\s*:\s*['"`][^'"`]*$/.test(back)) continue;
      // An override IS the escape hatch.
      if (media.some(([a, b]) => at > a && at < b)) continue;

      const owner = tagAt(at);
      const cls = owner && owner.text.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/);
      const inlineNames = cls ? (cls[1] || cls[2] || cls[3] || '').trim() : '';
      const tagBack = src.slice(Math.max(0, at - 2000), at);
      // A CSS rule's own selector.
      const head = src.slice(Math.max(0, at - 900), at);
      const open = head.lastIndexOf('{');
      const selector = open === -1 ? '' : head.slice(Math.max(head.lastIndexOf('}', open), head.lastIndexOf('{', open - 1)) + 1, open).trim();
      const cssNames = [...selector.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);

      const names = [...inlineNames.split(/\s+/).filter(Boolean), ...cssNames];
      if (names.some((n) => gridOverridden.has(n))) continue;
      if (/fx-scroll-x/.test(inlineNames) || /fx-scroll-x/.test(tagBack.slice(-700))) continue;
      /* A grid inside a box with a hard pixel width is a picture made of divs
         (the landing page's 72px QR mosaic), not a layout that has to reflow —
         its min-content is that width, not N x the widest child. */
      if (owner && /\bwidth:\s*["']?\d+px/.test(owner.text)) continue;

      fixedGrids.push(`${rel}:${lineOf(src, at)}  repeat(${g[1]}, 1fr) with no narrow-width override`);
    }
  }

  return { inertClasses, fixedGrids };
}

module.exports = { scanResponsive, stripComments, openingTags, mediaRanges };

if (require.main === module) {
  const root = path.join(__dirname, '..', 'src');
  const { inertClasses, fixedGrids } = scanResponsive(root);
  const all = [...inertClasses, ...fixedGrids];
  all.forEach((l) => console.log(l));
  console.log(all.length ? `\n${all.length} finding(s)` : 'clean');
  process.exit(all.length ? 1 : 0);
}
