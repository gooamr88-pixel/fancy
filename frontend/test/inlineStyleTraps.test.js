import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE ONE RULE IN AGENTS.md, ENFORCED.
 *
 *   "A class can never beat an inline style."
 *
 * It is stated for `padding` and `gridTemplateColumns`, and it is just as true
 * for a CUSTOM PROPERTY — which is where it keeps going wrong, because feeding
 * `--fx-pad-x` looks like the composable, non-`!important` thing to do rather
 * than an override.
 *
 * Three organizer screens had written a mobile rule against exactly that:
 *
 *   .content-container { --fx-pad-x: 16px }   dashboard/page.js
 *   .s3-page           { --fx-pad-x: 16px }   Stage3_Distribution.js
 *   .sp-page           { --fx-pad-x: 16px }   StagePayment.js
 *
 * All three were dead, because the same property was declared inline on the same
 * element. Every one of those screens kept its DESKTOP gutter on a phone: 32px a
 * side on the dashboard, so a 320px screen had 256px of usable width where the
 * arithmetic in AGENTS.md assumes 280px.
 *
 * There is no symptom. It does not warn, it does not error, the build passes and
 * the styles look present in the source. The only thing that catches it is
 * reading both halves at once — so that is what this does.
 *
 * Static, so it needs no browser and no dev server.
 */

// fileURLToPath, not URL.pathname — on Windows the latter yields "/C:/…", which
// join() then resolves to "C:\src".
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js') || name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

const FILES = walk(SRC).map((path) => ({ path, src: readFileSync(path, 'utf8') }));

/** `style={{ ... '--foo': ... }}` — a custom property set inline. */
const INLINE_CUSTOM_PROP = /'(--[a-z][\w-]*)'\s*:/g;
/** `.cls { --foo: … }` inside a <style jsx> block in the same file. */
const cssDeclares = (src, prop) => new RegExp(`^\\s*${prop}\\s*:`, 'm').test(src);

describe('inline styles that silently defeat a CSS rule', () => {
  test('no file sets a custom property inline AND targets it from CSS', () => {
    const conflicts = [];

    for (const { path, src } of FILES) {
      const inline = new Set([...src.matchAll(INLINE_CUSTOM_PROP)].map((m) => m[1]));
      for (const prop of inline) {
        // The inline declaration always wins, so a rule for the same property in
        // the same file is dead code that reads as if it works.
        if (cssDeclares(src, prop)) {
          conflicts.push(`${path.replace(SRC, 'src')} — ${prop} is set inline AND in CSS; the CSS rule is inert`);
        }
      }
    }

    expect(conflicts).toEqual([]);
  });

  test('the organizer surfaces get their gutter from a class, not from inline px', () => {
    // Pinning --fx-pad-x to a fixed px also throws away the fluid clamp on :root
    // that narrows the gutter on small screens by itself — so the override made
    // phones tighter and desktops roomier, which is backwards on both counts.
    const offenders = FILES
      .filter(({ path }) => path.includes('dashboard'))
      .filter(({ src }) => /'--fx-pad-x'\s*:/.test(src))
      .map(({ path }) => path.replace(SRC, 'src'));

    expect(offenders).toEqual([]);
  });

  /**
   * The general case: ANY responsive rule beaten by an inline declaration.
   *
   * The custom-property version above is one instance. The same mistake had also
   * been made with plain `padding` and `flex`:
   *
   *   .share-tab-card { padding: 16px }  — beaten by inline `padding: 28`
   *   .gp-qr-stub     { flex: 1 1 auto } — beaten by inline `flex: '0 0 35%'`
   *
   * The guest pass is the instructive one. Its media block carries a comment
   * explaining that a shrunken QR code "risks becoming unscannable at the door",
   * and then the rule that would have stopped the shrinking could not apply.
   */
  test('no mobile rule is beaten by an inline declaration on the same element', () => {
    /** grid-template-columns -> gridTemplateColumns */
    const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    /** An inline shorthand also sets the longhands a rule might target. */
    const SHORTHAND_OF = {
      paddingLeft: 'padding', paddingRight: 'padding', paddingTop: 'padding', paddingBottom: 'padding',
      marginLeft: 'margin', marginRight: 'margin', marginTop: 'margin', marginBottom: 'margin',
      rowGap: 'gap', columnGap: 'gap',
    };

    const dead = [];

    for (const { path, src } of FILES) {
      if (!src.includes('<style jsx>')) continue;

      for (const [, body] of src.matchAll(/@media[^{]*\{([\s\S]*?)\n\s*\}\s*\n/g)) {
        for (const [, cls, , decls] of body.matchAll(/\.([\w-]+)([^{]*)\{([^}]*)\}/g)) {
          for (const d of decls.split(';')) {
            const m = d.match(/^\s*([a-z-]+)\s*:\s*([^;]+)$/);
            if (!m) continue;
            const [, prop, value] = m;
            if (/!important/.test(value)) continue; // an important rule does win
            if (prop.startsWith('--')) continue;    // covered by the test above
            const js = camel(prop);

            // Read the WHOLE opening tag. Scanning forward from className alone
            // walks past the tag when the author wrote style={{}} first, and
            // picks up the next element's declarations.
            const tagRe = new RegExp(`<[A-Za-z][\\w.]*\\s[^>]*?\\b${cls}\\b[^>]*?>`, 'g');
            for (const el of src.matchAll(tagRe)) {
              const tag = el[0];
              if (!new RegExp(`className=(?:"[^"]*\\b${cls}\\b|\\{\`[^\`]*\\b${cls}\\b)`).test(tag)) continue;
              const styleM = tag.match(/style=\{\{([\s\S]*?)\}\}/);
              if (!styleM) continue;
              const beaten = [js, SHORTHAND_OF[js]].filter(Boolean)
                .filter((k) => new RegExp(`(^|[\\s,{])${k}\\s*:`).test(styleM[1]));
              if (beaten.length) {
                const line = src.slice(0, el.index).split('\n').length;
                dead.push(`${path.replace(SRC, 'src')}:${line} — .${cls} { ${prop} } loses to inline "${beaten[0]}"`);
              }
            }
          }
        }
      }
    }

    expect([...new Set(dead)]).toEqual([]);
  });

  test('the gutter presets define both a desktop and a phone value', () => {
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');

    for (const preset of ['.fx-gutter--lg', '.fx-gutter--sm']) {
      // Defined at all…
      expect(css).toContain(`${preset} { --fx-pad-x:`);
      // …and again inside the mobile block, or the phone keeps the desktop value,
      // which is the entire bug this file exists to prevent.
      const mobileBlock = css.slice(css.indexOf('@media (max-width: 1023.98px)', css.indexOf('.fx-gutter--lg')));
      expect(mobileBlock.slice(0, 200)).toContain(preset);
    }
  });
});
