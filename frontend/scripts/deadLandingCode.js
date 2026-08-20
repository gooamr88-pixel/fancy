#!/usr/bin/env node
/**
 * Reports files and exported names under src/app/components/landing that
 * nothing imports.
 *
 * Walks the tree rather than globbing, because both bash and PowerShell read
 * `[slug]` as a character class and silently skip those routes — which is how
 * the guest page went unscanned by every check in AGENTS.md for months.
 *
 *   node scripts/deadLandingCode.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const TEST = path.join(__dirname, '..', 'test');
const LANDING = path.join(SRC, 'app', 'components', 'landing');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

/* THE CORPUS MUST INCLUDE test/.
   Scanning only src/ reported BAND_ORDER as dead. It is not: page.js is
   asserted against it by landingHomepage.test.jsx and the screenshot probe
   renders from it. A "dead code" report that names a value three tests depend
   on is worse than no report, because the obvious next step is to delete it. */
/* COMMENTS ARE NOT USES.
   Without this, the checker reported the `BAND` export as live because one
   test's comment happened to contain the word — so a genuinely dead export
   that duplicated three tokens survived a clean run. A dead-code checker that
   counts prose is a checker that says "clean" for the wrong reason. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const allFiles = [...walk(SRC), ...(fs.existsSync(TEST) ? walk(TEST) : [])];
const corpus = new Map(allFiles.map((f) => [f, stripComments(fs.readFileSync(f, 'utf8'))]));

const landingFiles = walk(LANDING);
const deadFiles = [];
const deadExports = [];

for (const file of landingFiles) {
  const stem = path.basename(file).replace(/\.jsx?$/, '');

  // Who imports this module? Match the specifier ending in the stem.
  const importers = [...corpus.entries()].filter(([other, src]) => {
    if (other === file) return false;
    return new RegExp(`from\\s+['"][^'"]*/${stem}['"]`).test(src)
      || new RegExp(`from\\s+['"]\\./${stem}['"]`).test(src);
  });

  if (importers.length === 0) {
    deadFiles.push(path.relative(SRC, file));
    continue;
  }

  // Named exports nobody names.
  const src = corpus.get(file);
  const names = [...src.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/g)]
    .map((m) => m[1]);

  for (const name of names) {
    const used = importers.some(([, s]) => new RegExp(`\\b${name}\\b`).test(s));

    /* An export used by its OWN module is not dead — HOMEPAGE_CAPABILITY_KEYS
       is exported for the /features page and also drives HOMEPAGE_CAPABILITIES
       three lines below it. Count uses after the declaration itself. */
    const declaration = new RegExp(`export\\s+(?:const|function|class)\\s+${name}\\b`);
    const selfUses = [...src.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length
      - (declaration.test(src) ? 1 : 0);

    if (!used && selfUses <= 0) deadExports.push(`${path.relative(SRC, file)} → ${name}`);
  }
}

if (!deadFiles.length && !deadExports.length) {
  console.log('ok — nothing unreferenced under components/landing');
  process.exit(0);
}

if (deadFiles.length) {
  console.log(`${deadFiles.length} unreferenced file(s):`);
  deadFiles.forEach((f) => console.log(`  ${f}`));
}
if (deadExports.length) {
  console.log(`\n${deadExports.length} unreferenced export(s):`);
  deadExports.forEach((e) => console.log(`  ${e}`));
}
process.exit(0);
