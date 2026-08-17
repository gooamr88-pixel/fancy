import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

let reducedMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reducedMotion };
});

import OccasionPicker from '../src/app/components/OccasionPicker';
import {
  CUSTOM_CATEGORIES, CUSTOM_CATEGORY_BY_KEY,
  occasionKicker, occasionLatin, occasionTagline,
} from '../src/app/utils/customEventCategories';
import {
  CINEMATIC_TEMPLATES, CINEMATIC_KEYS,
  getCinematicOccasion, getCinematicCopy,
} from '../src/app/components/templates/cinematic/cinematicThemes';
import { resolveOccasion, occasionMetaFor, defaultOccasionFor } from '../src/app/utils/eventOccasion';
import { buildInvitationCardData } from '../src/app/utils/invitationCardData';
import { TEMPLATES } from '../src/app/utils/curatedTemplates';
import { WEDDING_VARIANT_TEMPLATES } from '../src/app/utils/templateFamilies';
import { getCelebrationPreset } from '../src/app/utils/patternCelebration';

/* ═══════════════════════════════════════════════════════════════════════════
   A TEMPLATE IS A LOOK, NOT AN OCCASION.

   Velvet Ring used to BE an engagement and Door of Joy a wedding: the key
   decided the cover's kicker, the hero's tagline, the invitation card's
   wording and the guest list's side labels. Somebody who wanted the knocking
   door for a birthday could not have it.

   Now the organizer picks the occasion — any of the 25 in
   utils/customEventCategories.js — on any template, and the template supplies
   only a default.

   Two properties matter more than the rest and are asserted hardest:

     1. BACKWARD COMPATIBILITY. Every event created before the picker existed
        has no `custom_category`. Each must resolve to exactly what its
        template always meant, or live invitations change wording overnight.
     2. NO LEAKAGE. A birthday must never inherit a sentence written for a
        wedding, in any of the four places copy is chosen.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

beforeEach(() => { reducedMotion = false; });

/* ════════════════════════════════════════════════════════════════════
   1. Nothing that exists today changes
   ════════════════════════════════════════════════════════════════════ */
describe('events created before the occasion picker are untouched', () => {
  const BEFORE = { ring: 'engagement', bab: 'wedding', swans: 'wedding' };

  it.each(Object.entries(BEFORE))('%s still resolves to %s with no stored answer', (key, expected) => {
    const tpl = CINEMATIC_TEMPLATES[key];
    expect(getCinematicOccasion(tpl, {})).toBe(expected);
    expect(getCinematicOccasion(tpl, undefined)).toBe(expected);
    expect(getCinematicOccasion(tpl, { custom_category: '' })).toBe(expected);
  });

  it('and still prints the same kicker it always did', () => {
    expect(getCinematicCopy(CINEMATIC_TEMPLATES.ring, {}).kicker).toBe('Engagement Invitation');
    expect(getCinematicCopy(CINEMATIC_TEMPLATES.ring, { isRTL: true }).kicker).toBe('دعوة خطوبة');
    expect(getCinematicCopy(CINEMATIC_TEMPLATES.bab, {}).kicker).toBe('Wedding Invitation');
    expect(getCinematicCopy(CINEMATIC_TEMPLATES.bab, { isRTL: true }).kicker).toBe('دعوة زفاف');
  });

  it('Door of Joy keeps its own line on its own occasion', () => {
    // The template's voice, not the occasion's — it is about the door.
    expect(getCinematicCopy(CINEMATIC_TEMPLATES.bab, { occasion: 'wedding' }).sub)
      .toBe(CINEMATIC_TEMPLATES.bab.copy.en.sub);
  });

  it('every template declares a default, or an old row resolves to nothing', () => {
    CINEMATIC_KEYS.forEach((key) => {
      const { defaultOccasion } = CINEMATIC_TEMPLATES[key];
      expect(defaultOccasion, `${key} has no defaultOccasion`).toBeTruthy();
      expect(CUSTOM_CATEGORY_BY_KEY[defaultOccasion], `${key}'s default is not a real occasion`).toBeTruthy();
    });
  });

  it('EVERY full-page template resolves to a real occasion, retired ones included', () => {
    /* The regression this caught: the retired Engagement template has no
       cinematic entry and is not a wedding variant, so the hand-written
       fallback chain left it with NO occasion — and therefore no partner-name
       fields on either editor. An event created as Engagement lost its
       couple's names from every edit surface, silently.

       'custom' is excluded on purpose: it has always required an explicit
       answer and shows no couple fields until it gets one. */
    const FULL_PAGE = ['wedding', 'engagement', ...CINEMATIC_KEYS, ...WEDDING_VARIANT_TEMPLATES];
    FULL_PAGE.forEach((key) => {
      const occasion = resolveOccasion(key, {});
      expect(occasion, `${key} resolves to no occasion at all`).toBeTruthy();
      expect(CUSTOM_CATEGORY_BY_KEY[occasion], `${key} resolves to an unknown occasion`).toBeTruthy();
    });
  });

  it('the retired couple templates still collect a couple', () => {
    ['wedding', 'engagement'].forEach((key) => {
      expect(occasionMetaFor(key, {})?.kind, `${key} no longer shows couple fields`).toBe('couple');
    });
    expect(resolveOccasion('engagement', {})).toBe('engagement');
    expect(resolveOccasion('wedding', {})).toBe('wedding');
  });

  it('Custom Canvas still requires an explicit answer', () => {
    expect(resolveOccasion('custom', {})).toBe('');
    expect(resolveOccasion('custom', { custom_category: 'birthday' })).toBe('birthday');
  });

  it('a stale or hand-edited occasion key falls back instead of resolving to nothing', () => {
    // template_type and template_data are both free-form; an unknown key must
    // not reach the field UI, which would render no fields at all.
    expect(resolveOccasion('ring', { custom_category: 'nonsense' })).toBe('engagement');
    expect(resolveOccasion('ring', { custom_category: '' })).toBe('engagement');
    expect(resolveOccasion('not-a-template', {})).toBe('');
  });

  it('one resolver, not a chain copied into every screen', () => {
    /* Three hand-written copies is what let Engagement fall through on two
       screens and be fixed on neither. */
    ['src/app/dashboard/create-event/components/Stage2_FormConfiguration.js',
      'src/app/dashboard/components/EventSettings.js',
      'src/app/components/templates/heritageArch/HeritageArchPage.js',
      'src/app/dashboard/create-event/page.js'].forEach((file) => {
      const src = read(file);
      expect(src, `${file} does not use the shared resolver`).toMatch(/resolveOccasion\(/);
      expect(src, `${file} still hand-rolls the defaultOccasion fallback`)
        .not.toMatch(/\?\.defaultOccasion/);
    });
  });
});

/* ════════════════════════════════════════════════════════════════════
   2. Any occasion, on any template
   ════════════════════════════════════════════════════════════════════ */
describe('the organizer\'s answer wins on every template', () => {
  it('a birthday on Velvet Ring is a birthday', () => {
    const ring = CINEMATIC_TEMPLATES.ring;
    expect(getCinematicOccasion(ring, { custom_category: 'birthday' })).toBe('birthday');
    expect(getCinematicCopy(ring, { occasion: 'birthday' }).kicker).toBe('Birthday Invitation');
    expect(getCinematicCopy(ring, { occasion: 'birthday', isRTL: true }).kicker).toBe('دعوة عيد ميلاد');
  });

  it('every occasion produces a kicker on every template, in both languages', () => {
    /* The mechanical build is what makes 25 × 3 × 2 possible without anybody
       writing 150 strings — so every combination has to actually produce one. */
    CINEMATIC_KEYS.forEach((key) => {
      CUSTOM_CATEGORIES.forEach(({ key: occasion }) => {
        [false, true].forEach((isRTL) => {
          const { kicker } = getCinematicCopy(CINEMATIC_TEMPLATES[key], { isRTL, occasion });
          expect(kicker, `${key} + ${occasion} (${isRTL ? 'ar' : 'en'}) has no kicker`).toBeTruthy();
        });
      });
    });
  });

  it('no template\'s own line leaks onto an occasion it was not written for', () => {
    /* The one that would embarrass: Door of Joy telling a baby shower it has
       "opened the door to our joy". `sub` is the template's voice and is used
       ONLY on its own occasion. */
    CINEMATIC_KEYS.forEach((key) => {
      const tpl = CINEMATIC_TEMPLATES[key];
      if (!tpl.copy.en.sub) return;
      CUSTOM_CATEGORIES
        .filter((c) => c.key !== tpl.defaultOccasion)
        .forEach((c) => {
          expect(getCinematicCopy(tpl, { occasion: c.key }).sub,
            `${key} leaked its own line onto ${c.key}`).not.toBe(tpl.copy.en.sub);
        });
    });
  });

  it('the kicker never reads as machine-assembled', () => {
    // "Gala / Fundraiser Invitation" and "Memorial / Celebration of Life
    // Invitation" are why `inviteLabel` exists.
    /* BOTH languages. Several labelAr values are slashed too ("عماد / تعميد"),
       and checking only English is how the Arabic cover keeps the slash. */
    CUSTOM_CATEGORIES.forEach(({ key }) => {
      [false, true].forEach((isRTL) => {
        const label = isRTL ? 'ar' : 'en';
        const k = occasionKicker(key, isRTL);
        expect(k, `${key} (${label}): a slash survived into the kicker`).not.toMatch(/\//);
        expect(k, `${key} (${label}): a parenthetical survived into the kicker`).not.toMatch(/[()]/);
        expect(k.length, `${key} (${label}): kicker is too long for a cover`).toBeLessThanOrEqual(34);
      });
    });
  });

  it('the Latin ornament stays a single clean word or nothing', () => {
    CUSTOM_CATEGORIES.forEach(({ key }) => {
      const latin = occasionLatin(key);
      if (!latin) return;
      expect(latin, `${key}: Latin ornament is not a bare word`).not.toMatch(/[/()]/);
    });
  });

  it('unknown occasions fall back rather than blanking the cover', () => {
    /* A stale key is what a hand-edited row or a half-applied migration
       leaves behind; a cover with an empty line above the names looks broken
       rather than plain. */
    [undefined, null, '', 'both', 'nonsense'].forEach((occasion) => {
      const copy = getCinematicCopy(CINEMATIC_TEMPLATES.ring, { occasion });
      expect(copy.kicker, `occasion=${occasion} produced no kicker`).toBe('Engagement Invitation');
    });
  });
});

/* ════════════════════════════════════════════════════════════════════
   3. The occasion reaches everything that keys off it
   ════════════════════════════════════════════════════════════════════ */
describe('the occasion reaches the rest of the product', () => {
  it('the invitation card follows the occasion, not the artwork', () => {
    const base = { title: 'A & B', event_date: '2027-05-07T18:00:00Z' };
    const td = { partner1: 'Adam', partner2: 'Mira' };

    // Door of Joy, but an engagement.
    const engagement = buildInvitationCardData(
      { ...base, template_type: 'bab', template_data: { ...td, custom_category: 'engagement' } }, false,
    );
    expect(engagement.honorLine2).toBe('at the engagement of');

    // Velvet Ring, but a wedding.
    const wedding = buildInvitationCardData(
      { ...base, template_type: 'ring', template_data: { ...td, custom_category: 'wedding' } }, false,
    );
    expect(wedding.celebrationLabel).toBeUndefined();
    expect(wedding.names).toBe('Adam & Mira');
  });

  it('a non-couple occasion never gets couple card copy', () => {
    /* And specifically NOT the legacy `case 'birthday'` arm, which reads
       td.celebrant / td.age — keys the occasion catalogue never writes, so
       routing there by name would render a card with every field blank. */
    const card = buildInvitationCardData({
      title: "Sarah's 30th", event_date: '2027-05-07T18:00:00Z', template_type: 'ring',
      template_data: { custom_category: 'birthday', custom_honoree: 'Sarah', custom_milestone: 'Turning 30' },
    }, false);
    expect(card.honorLine2).toBeUndefined();
    expect(card.celebrationLabel).toBeUndefined();
    expect(card.names).toBe("Sarah's 30th");
  });

  it('event_type is derived from the occasion, for every template', () => {
    /* event_type — not template_type — is what utils/sideLabel.js,
       RsvpSection's meal picker, the RSVP wizard, EditGuestModal,
       SendInvitationModal and the CSV export all read. If it kept saying
       'ring', a birthday would still be labelled "Partner 1's Side". */
    const wizard = read('src/app/dashboard/create-event/page.js');
    expect(wizard).toMatch(/function deriveEventType\(/);
    // Through the shared resolver, so what is WRITTEN here can never disagree
    // with what the guest page and the editors RENDER.
    expect(wizard).toMatch(/return resolveOccasion\(templateType, templateData\)/);
    // Both the POST and the PATCH path, or a resumed draft disagrees with the
    // event it created.
    expect([...wizard.matchAll(/deriveEventType\(templateType, buildTemplateData\(\)\)/g)].length).toBe(2);

    // Settings keeps them in step afterwards.
    const settings = read('src/app/dashboard/components/EventSettings.js');
    expect(settings).toMatch(/setForm\(prev => \(\{ \.\.\.prev, event_type: key \}\)\)/);
  });

  it('the guest-side label follows the occasion, not the artwork', () => {
    /* utils/sideLabel.js prints "Groom's Side" only when event_type is
       'wedding'. The wizard's toggle promised that label from the TEMPLATE,
       so a wedding on Velvet Ring offered "Groom's Side" in Step 2 and then
       showed "Partner 1's Side" on every guest card. */
    const stage2 = read('src/app/dashboard/create-event/components/Stage2_FormConfiguration.js');
    expect(stage2).toMatch(/occasionChoice === 'wedding' \? "Tag guests as Groom's Side/);
    expect(stage2).not.toMatch(/WEDDING_STYLE_TEMPLATE_KEYS\.includes\(templateType\) \? "Tag guests/);
  });

  it('the retired continuous-scroll categories are not offered an occasion', () => {
    // They have no hero, no badge and no honoree fields to drive; setting one
    // would rewrite event_type for a page that cannot show it.
    ['corporate', 'birthday', 'gala'].forEach((key) => {
      expect(defaultOccasionFor(key), `${key} should imply no occasion`).toBe('');
    });
    const stage2 = read('src/app/dashboard/create-event/components/Stage2_FormConfiguration.js');
    expect(stage2).toMatch(/\{isFullPage\(templateType\) && \(\s*<OccasionPicker/);
  });

  it('the legacy category blocks are gated on the template, not event_type', () => {
    /* They render celebrant/age, company/agenda and honoree/program. Gated on
       event_type they would fire for an occasion of the same name — so a
       birthday on Velvet Ring showed the legacy celebrant field AND the
       occasion's honoree field, two inputs for one name writing different
       keys. */
    const settings = read('src/app/dashboard/components/EventSettings.js');
    ['corporate', 'birthday', 'gala'].forEach((key) => {
      expect(settings, `${key} is still gated on event_type`)
        .not.toMatch(new RegExp(`form\\.event_type === '${key}' &&`));
      expect(settings).toContain(`isLegacyCategoryTemplate('${key}')`);
    });
  });

  it('every cinematic template celebrates in its own colours', () => {
    /* getCelebrationPreset is keyed by template_type and had no entry for any
       of them, so the confetti on "Yes" — the one moment meant to feel like
       THIS invitation — was the generic gold default on all three. */
    CINEMATIC_KEYS.forEach((key) => {
      const preset = getCelebrationPreset(key);
      expect(preset.colors, `${key} falls back to the generic burst`).toBeTruthy();
      // And in the template's own palette, not somebody else's.
      const own = CINEMATIC_TEMPLATES[key].colors;
      const shared = preset.colors.map((c) => c.toLowerCase());
      expect(shared.some((c) => Object.values(own).map((v) => v.toLowerCase()).includes(c)),
        `${key}'s confetti shares no colour with its own palette`).toBe(true);
    });
  });

  it('no cinematic template is on the wedding-variant list any more', () => {
    // Being on it means "this artwork IS a wedding" — the wedding card copy,
    // the label and the Groom's/Bride's Side wording, whatever the organizer
    // is celebrating. That is the coupling this change removes.
    CINEMATIC_KEYS.forEach((key) => {
      expect(WEDDING_VARIANT_TEMPLATES, `${key} is still hardcoded as a wedding`).not.toContain(key);
    });
  });
});

/* ════════════════════════════════════════════════════════════════════
   4. The picker itself
   ════════════════════════════════════════════════════════════════════ */
describe('one occasion picker, offered on every template', () => {
  it('renders every occasion in the catalogue', () => {
    render(<OccasionPicker value="wedding" onChange={() => {}} />);
    CUSTOM_CATEGORIES.forEach(({ key }) => {
      expect(screen.getByTestId(`occasion-${key}`), `${key} is missing from the picker`).toBeTruthy();
    });
  });

  it('marks exactly one tile as chosen, and reports the key back', () => {
    const onChange = vi.fn();
    render(<OccasionPicker value="birthday" onChange={onChange} />);
    expect(screen.getByTestId('occasion-birthday').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('occasion-wedding').getAttribute('aria-pressed')).toBe('false');
    screen.getByTestId('occasion-gala').click();
    expect(onChange).toHaveBeenCalledWith('gala');
  });

  it('is a labelled group of pressed buttons, not a radiogroup it cannot honour', () => {
    /* role="radiogroup" promises arrow-key navigation and one tab stop.
       Claiming it without roving tabindex leaves a screen-reader user
       pressing arrows at a group that does not respond. */
    render(<OccasionPicker value="" onChange={() => {}} />);
    const group = screen.getByTestId('occasion-picker');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByTestId('occasion-wedding').getAttribute('role')).toBeNull();
  });

  it('both organizer screens use the shared component, not their own copy', () => {
    /* This grid existed three times — the wizard, Settings, and a two-tile
       variant — which is three places for the catalogue to drift from the
       product. */
    ['src/app/dashboard/create-event/components/Stage2_FormConfiguration.js',
      'src/app/dashboard/components/EventSettings.js'].forEach((file) => {
      const src = read(file);
      expect(src, `${file} does not use OccasionPicker`).toContain('<OccasionPicker');
      expect(src, `${file} still maps CUSTOM_CATEGORIES itself`).not.toMatch(/CUSTOM_CATEGORIES\.map/);
    });
  });

  it('every template in the picker offers the occasion choice', () => {
    // No template is gated out of it — that gate is what the change removes.
    const stage2 = read('src/app/dashboard/create-event/components/Stage2_FormConfiguration.js');
    expect(stage2).not.toMatch(/templateType === 'custom' && \(\s*<OccasionPicker/);
    expect(TEMPLATES.length).toBeGreaterThan(1);
  });
});

/* ════════════════════════════════════════════════════════════════════
   5. The catalogue is internally consistent
   ════════════════════════════════════════════════════════════════════ */
describe('the occasion catalogue', () => {
  it('gives every occasion a kind the field UI knows how to render', () => {
    const KNOWN = new Set(['couple', 'honoree', 'babyShower']);
    CUSTOM_CATEGORIES.forEach(({ key, kind }) => {
      expect(KNOWN.has(kind), `${key} has an unrenderable kind "${kind}"`).toBe(true);
    });
  });

  it('gives every honoree occasion its own field copy', () => {
    CUSTOM_CATEGORIES.filter((c) => c.kind === 'honoree').forEach((c) => {
      expect(c.honoreeLabel, `${c.key} has no honoree label`).toBeTruthy();
      expect(c.milestoneLabel, `${c.key} has no milestone label`).toBeTruthy();
    });
  });

  it('leaves wedding without a tagline on purpose', () => {
    /* Wedding is the one couple occasion meant to fall through — to the
       template's own line, or to HeroSection's built-in couple default.
       Giving it one here silently outranks both. */
    expect(occasionTagline('wedding', false)).toBeNull();
    expect(occasionTagline('engagement', false)).toBe('We Are Getting Engaged');
    expect(occasionTagline('vowRenewal', false)).toBe('We are renewing our vows');
  });

  it('has a unique key per occasion', () => {
    const keys = CUSTOM_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
