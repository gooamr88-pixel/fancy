import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  TEMPLATES,
  TEMPLATE_PREVIEW_PATTERN,
  RETIRED_TEMPLATE_KEYS,
  RETIRED_TEMPLATE_SUCCESSOR,
} from '../src/app/utils/curatedTemplates';

/* ═══════════════════════════════════════════════════════════════════════════
   The template picker.

   Two defects motivate this file, and both were live and silent.

   1. EVERY CARD DREW THE SAME PICTURE. TemplateCard rendered
      <InvitationCard template={{ pattern: template.pattern }} />, and no entry
      in curatedTemplates.js has ever had a `pattern` key — the mapping lives
      in TEMPLATE_PREVIEW_PATTERN, keyed separately. So `pattern` was undefined
      on every card, InvitationCard fell through to its `default:` arm, and all
      five templates showed the same "Aria & Julian · The Grand Ballroom, New
      York" card tinted a different colour. Nothing threw. The picker asked
      organizers to choose between identical thumbnails for months.

      A wrong key name cannot be caught by a renderer that has a sensible
      default for every wrong key, so it has to be caught here.

   2. HARDCODED TEMPLATE KEYS OUTLIVED THEIR TEMPLATES. The wizard opened on
      `useState('engagement')` and seeded `selectedPresets` from a literal
      naming three keys. Retiring 'engagement' would have left the wizard
      opening on a template absent from its own list; adding 'ring' and 'bab'
      had already left them with no preset entry.

   Everything below is derived from the data rather than restated, so a
   template added or retired tomorrow is checked by the same assertions.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** InvitationCard's switch arms — the only pattern names that draw anything. */
let REAL_PATTERNS;
beforeAll(() => {
  const src = read('src/app/components/templates/InvitationCard.js');
  REAL_PATTERNS = new Set(
    [...src.matchAll(/^\s{4}case "([a-zA-Z]+)":/gm)].map((m) => m[1]),
  );
  // Guard the guard: if the switch is ever restructured, this regex silently
  // matching nothing would make every assertion below vacuously pass.
  expect(REAL_PATTERNS.size).toBeGreaterThan(5);
});

describe('every template in the picker shows its own artwork', () => {
  it.each(TEMPLATES.map((t) => [t.key, t]))('%s declares a preview', (_key, template) => {
    expect(template.preview, `${template.key} has no preview — its card would fall back to the generic one`).toBeTruthy();
    expect(['poster', 'card']).toContain(template.preview.kind);
  });

  it('every poster names a file that is actually shipped', () => {
    const missing = TEMPLATES
      .filter((t) => t.preview?.kind === 'poster')
      .filter((t) => !fs.existsSync(path.join(ROOT, 'public', t.preview.src.replace(/^\//, ''))))
      .map((t) => `${t.key} → ${t.preview.src}`);
    // A 404 here is a card with a broken-image icon in it, which is worse than
    // the generic card it replaced.
    expect(missing).toEqual([]);
  });

  it('every card-kind preview maps to a pattern InvitationCard actually draws', () => {
    const offenders = TEMPLATES
      .filter((t) => t.preview?.kind === 'card')
      .filter((t) => !REAL_PATTERNS.has(TEMPLATE_PREVIEW_PATTERN[t.key]))
      .map((t) => `${t.key} → ${TEMPLATE_PREVIEW_PATTERN[t.key]}`);
    expect(offenders).toEqual([]);
  });

  it('no two templates show the same artwork', () => {
    // The failure this file exists for, stated directly: five cards, one
    // picture. Identical previews are always a bug, never a decision.
    const shown = TEMPLATES.map((t) => (t.preview.kind === 'poster' ? t.preview.src : `card:${t.key}`));
    expect(new Set(shown).size).toBe(TEMPLATES.length);
  });

  it('TemplateCard never reads the `pattern` key that does not exist', () => {
    const src = read('src/app/dashboard/create-event/components/TemplateCard.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/template\.pattern/);
    // The correct source, so this cannot be satisfied by dropping the card.
    expect(src).toContain('TEMPLATE_PREVIEW_PATTERN');
  });
});

describe('the wizard derives its template state instead of naming keys', () => {
  const src = () => read('src/app/dashboard/create-event/page.js');

  it('opens on the first template in the list, whatever that is', () => {
    expect(src()).toContain('useState(TEMPLATES[0].key)');
  });

  it('seeds a preset slot for every template, not for a hardcoded three', () => {
    const code = src();
    expect(code).toMatch(/TEMPLATES\.map\(\(t\) => \[t\.key, 0\]\)/);
    // The literal that used to be here, naming two now-retired templates.
    expect(code).not.toMatch(/engagement: 0, wedding: 0, custom: 0/);
  });
});

describe('the retired templates are retired from the picker only', () => {
  it('neither is selectable', () => {
    const keys = TEMPLATES.map((t) => t.key);
    RETIRED_TEMPLATE_KEYS.forEach((key) => expect(keys).not.toContain(key));
  });

  it('both still resolve an invitation-card pattern, for events that still use them', () => {
    /* The migration is a deliberate, separately-applied step. Between deploying
       this code and running it, every Royale Wedding and Eternal Love event in
       the database still carries its old key and still has to render. */
    RETIRED_TEMPLATE_KEYS.forEach((key) => {
      expect(TEMPLATE_PREVIEW_PATTERN[key], `${key} lost its card pattern`).toBeTruthy();
      expect(REAL_PATTERNS.has(TEMPLATE_PREVIEW_PATTERN[key])).toBe(true);
    });
  });

  it('each successor is a template that actually exists', () => {
    const keys = TEMPLATES.map((t) => t.key);
    Object.entries(RETIRED_TEMPLATE_SUCCESSOR).forEach(([from, to]) => {
      expect(RETIRED_TEMPLATE_KEYS).toContain(from);
      expect(keys, `${from} is migrated to ${to}, which is not in the picker`).toContain(to);
    });
  });

  it('the SQL migration moves rows exactly where the constant says', () => {
    // Two statements of the same intent in two languages; a mismatch means the
    // database and the app disagree about what an event is.
    const sql = read('../supabase/migrations/20260824000000_retire_wedding_engagement_templates.sql');
    Object.entries(RETIRED_TEMPLATE_SUCCESSOR).forEach(([from, to]) => {
      const statement = new RegExp(
        `SET\\s+template_type\\s*=\\s*'${to}'\\s+WHERE\\s+template_type\\s*=\\s*'${from}'`,
        'i',
      );
      expect(sql, `the migration does not move '${from}' to '${to}'`).toMatch(statement);
    });
  });

  it('a draft saved on a retired template resumes on its successor', () => {
    // Otherwise the picker shows nothing selected and the specs strip
    // describes a template Stage 2 is not configuring.
    const code = read('src/app/dashboard/create-event/page.js');
    expect(code).toMatch(/RETIRED_TEMPLATE_SUCCESSOR\[ev\.template_type\] \|\| ev\.template_type/);
  });
});
