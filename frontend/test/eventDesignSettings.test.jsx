import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { getTemplateOpening } from '../src/app/utils/templateOpening';
import { TEMPLATES, palettesFor, matchPaletteIndex, RETIRED_TEMPLATE_KEYS } from '../src/app/utils/curatedTemplates';

/* ═══════════════════════════════════════════════════════════════════════════
   The Design tab of an event's settings — the screen you edit a LIVE
   invitation from.

   Three of its controls did nothing, and none of the three said so:

   1. "Seal Name / Monogram" and "Wax & paper tone" are read only by
      InvitationReveal. Velvet Ring opens on a velvet box and Door of Joy on a
      carved door, so on two of the three offered templates those fields wrote
      to `template_data` and were never read — under a heading that called
      every template's arrival an envelope, beside a button labelled "Preview
      the envelope" that mounted an envelope those guests will never see.

   2. "Heading Font" / "Body Font" are applied by a <style> block that sits in
      EventPageClient's LEGACY continuous-scroll branch, after the
      FULL_PAGE_TEMPLATES early return. Every currently-offered template is
      full-page — so the picker fetched an organizer-chosen webfont from
      fonts.googleapis.com on the guest's critical path and then never used it.

   3. For Custom Canvas the screen showed TWO colour controls: four hex fields
      writing `custom_colors` (which buildPalette reads) and a builder panel
      writing `template_data.customDesign` (which only reaches the small
      invitation card). The wizard syncs them. This screen did not.

   A dead control is the worst kind of defect in a settings screen: it costs
   the organizer real time, produces no error, and the page they are trying to
   change is already in front of guests.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/* Comments stripped: this file's own prose names the very strings it bans. */
const code = (rel) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

let SETTINGS;
beforeAll(() => { SETTINGS = code('src/app/dashboard/components/EventSettings.js'); });

describe('the opening a guest actually gets', () => {
  it('the cinematic templates have no wax seal to configure', () => {
    ['ring', 'bab'].forEach((key) => {
      const o = getTemplateOpening(key);
      expect(o.hasSeal, `${key} is offering seal fields it never reads`).toBe(false);
      expect(o.cinematic).toBeTruthy();
    });
  });

  it('everything else opens with the envelope', () => {
    ['custom', 'wedding', 'engagement', 'heritageArch', '', undefined].forEach((key) => {
      const o = getTemplateOpening(key);
      expect(o.hasSeal).toBe(true);
      expect(o.cinematic).toBeNull();
    });
  });

  it('no opening describes itself as something it is not', () => {
    // The specific failure: an organizer on Velvet Ring reading the word
    // "envelope" or "seal" anywhere in the section that configures their
    // velvet box.
    ['ring', 'bab'].forEach((key) => {
      const o = getTemplateOpening(key);
      const prose = [o.title, o.intro, o.toggleLabel, o.toggleHint, o.replayLabel, o.previewLabel].join(' ');
      expect(prose, `${key} still calls its opening an envelope`).not.toMatch(/envelope|seal|wax/i);
    });
  });

  it('each cinematic template names its own object', () => {
    expect(getTemplateOpening('ring').toggleLabel).toMatch(/velvet box/i);
    expect(getTemplateOpening('bab').toggleLabel).toMatch(/door/i);
  });

  it('the settings screen takes every one of those strings from the resolver', () => {
    // Hardcoding any of them here is how the two drift back apart.
    ['opening.title', 'opening.intro', 'opening.toggleLabel', 'opening.replayLabel', 'opening.previewLabel']
      .forEach((expr) => expect(SETTINGS, `${expr} is not read from the resolver`).toContain(`{${expr}}`));
    expect(SETTINGS).toContain('opening.hasSeal &&');
    expect(SETTINGS).not.toContain('Preview the envelope');
  });

  it('the preview mounts the opening the template really has', () => {
    // It used to mount InvitationReveal unconditionally.
    expect(SETTINGS).toContain('VelvetBoxOpening');
    expect(SETTINGS).toContain('KnockDoorOpening');
    expect(SETTINGS).toMatch(/opening\?\.cinematic \?/);
    // The cinematic openings are unconditionally position:fixed and size
    // themselves in dvh/vw, so they need a real viewport to be fixed inside.
    expect(SETTINGS).toContain('PreviewFrame');
  });
});

describe('colours are chosen from palettes, not typed as hex', () => {
  it('the settings screen has no free-form colour input left', () => {
    expect(SETTINGS, 'a raw <input type="color"> is back in EventSettings').not.toMatch(/type="color"/);
  });

  it('every template offers its own palettes', () => {
    TEMPLATES.forEach((t) => {
      expect(palettesFor(t.key)).toEqual(t.presets);
      expect(palettesFor(t.key).length).toBeGreaterThan(0);
    });
  });

  it('a retired template falls back to its successor rather than to nothing', () => {
    // Between deploying and running the migration, a live event still carries
    // the old key — and an empty colour control is worse than the hex fields.
    RETIRED_TEMPLATE_KEYS.forEach((key) => {
      expect(palettesFor(key).length).toBeGreaterThan(0);
    });
  });

  it('an older style still gets a full set to choose from', () => {
    const legacy = palettesFor('tuscany');
    expect(legacy.length).toBeGreaterThan(0);
    // Deduped by name, so the picker never shows the same palette twice.
    expect(new Set(legacy.map((p) => p.name)).size).toBe(legacy.length);
  });

  it('an event sitting exactly on a palette is recognised as being on it', () => {
    const presets = palettesFor('ring');
    presets.forEach((p, i) => {
      expect(matchPaletteIndex(presets, p)).toBe(i);
      // Case is not meaningful in a hex value; a stored '#D4AF6A' and a
      // preset '#d4af6a' are the same colour.
      expect(matchPaletteIndex(presets, {
        primary: p.primary.toUpperCase(),
        secondary: p.secondary.toUpperCase(),
        background: p.background.toUpperCase(),
      })).toBe(i);
    });
  });

  it('an event on its own colours is reported as matching none', () => {
    expect(matchPaletteIndex(palettesFor('ring'), { primary: '#123456', secondary: '#654321', background: '#abcdef' })).toBe(-1);
    expect(matchPaletteIndex(palettesFor('ring'), null)).toBe(-1);
  });

  it('the Custom builder feeds the page palette, not just the card', () => {
    // `applyPalette` inside CustomBuilder's onChange is the sync the wizard
    // has always had and this screen never did.
    expect(SETTINGS).toMatch(/applyPalette\(next\)/);
  });
});

describe('the font pickers reach the page they claim to', () => {
  const HA = 'src/app/components/templates/heritageArch/HeritageArchPage.js';

  it('the full-page engine reads custom_fonts', () => {
    expect(code(HA)).toMatch(/buildFontVars\(event\.custom_fonts\)/);
  });

  it('it routes them through the variables the sections actually use', () => {
    const src = code(HA);
    expect(src).toContain("'--font-serif'");
    expect(src).toContain("'--font-sans'");
  });

  it('an organizer font never replaces the whole stack', () => {
    // fonts.googleapis.com is unreachable in several countries and behind many
    // corporate proxies. If the webfont never lands the page has to fall back
    // to the brand face, not to the browser default.
    const src = code(HA);
    expect(src).toMatch(/--font-serif'\] = `'\$\{heading\}', var\(--font-heading\)/);
    expect(src).toMatch(/--font-sans'\] = `'\$\{body\}', var\(--font-body\)/);
  });

  it('the family name is sanitised before it reaches a CSS declaration', () => {
    // It comes from an organizer-editable column and is interpolated into a
    // style value.
    expect(code(HA)).toMatch(/sanitizeFontName/);
  });

  it('Custom Canvas is not asked for a heading font twice', () => {
    // CustomBuilder already owns that pick and HeritageArchPage lets it win.
    expect(SETTINGS).toMatch(/!isCustomTemplate && \(\s*<FontPicker/);
  });
});

describe('the design tab is sorted into what each part is', () => {
  it('music is no longer filed under appearance', () => {
    expect(SETTINGS).not.toMatch(/>\s*Appearance\s*</);
    ['Template', 'Colour palette', 'Images', 'Typography', 'Background Music']
      .forEach((h) => expect(SETTINGS, `no "${h}" section`).toContain(h));
  });

  it('the template picker is the same one the wizard shows', () => {
    // It used to draw its own: a text button with a single colour dot and no
    // artwork, on the screen where you change a live event.
    expect(SETTINGS).toContain('TemplateCard');
  });
});
