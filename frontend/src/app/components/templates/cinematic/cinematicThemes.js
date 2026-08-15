// Named import, not the default — the same reason revealAssets.js gives: this
// module is read by both a server component (the event page, for the preload
// below) and client ones, and `preload` is a named export in every react-dom
// build while reaching it through the default export is not.
import { preload } from 'react-dom';

/* ═══════════════════════════════════════════════════════════════
   The two cinematic templates, as data.

   Everything that differs between Velvet Ring and Door of Joy lives here:
   the asset paths, the CSS custom properties their shared stylesheet reads,
   the type pairing, the ambient-FX recipe, and the bilingual copy their
   openings and heroes need. cinematic.css holds the composition; this holds
   the identity. Adding a third cinematic template should mean adding an
   entry here plus one opening component — not a new branch in five files.

   The palette keys mirror what src/app/styles/cinematic.css reads. Keep the
   two in step: an unset property there falls back to nothing, which reads as
   a transparent or black element rather than an error.
   ═══════════════════════════════════════════════════════════════ */

export const CINEMATIC_TEMPLATES = {
  /* ── Velvet Ring — engagement ─────────────────────────────────────────
     A photographic velvet box on a dark stage. Tap it and it opens onto the
     ring. Warm reds and gold; every surface below the hero inherits the same
     deep velvet ground, which buildPalette resolves as a dark theme. */
  ring: {
    key: 'ring',
    occasion: 'engagement',
    opening: 'velvetBox',
    hero: 'velvetRing',

    assets: {
      poster: '/templates/ring/video-poster.jpg',
      video: '/templates/ring/box-video.mp4',
      revealed: '/templates/ring/box-open.jpg',
    },

    /* The frame at which the lid is fully back and the stone is lit. Read off
       the footage, not guessed — the reveal is timed to the video's own clock
       so a slow decode delays the cut rather than desynchronising it. */
    revealAtSeconds: 4.35,

    // Seeds buildPalette() for every section below the hero.
    colors: {
      primary: '#8f3c52',
      secondary: '#d4af6a',
      accent: '#d4af6a',
      background: '#2a100b',
    },

    cssVars: {
      '--cine-deep': '#2a100b',
      '--cine-mid': '#4a1a10',
      '--cine-hi': '#6e2c1d',
      '--cine-gold': '#d4af6a',
      '--cine-gold-hi': '#ffe9b0',
      '--cine-gold-dp': '#9d6f2c',
      /* Channel triplets for the same three colours, because several rules
         need them at partial alpha. `color-mix()` would be the tidy way and is
         the wrong one here: it is unsupported below Safari 16.2 / Chrome 111,
         and an unsupported function invalidates the WHOLE declaration. The
         Velvet Ring hero scrim is one such declaration — losing it drops the
         couple's names onto bare photography with no contrast at all, on
         exactly the older handsets least able to cope. `rgba(var(--x-rgb), a)`
         has no such cliff. Keep these in step with the hexes above. */
      '--cine-deep-rgb': '42, 16, 11',
      '--cine-gold-rgb': '212, 175, 106',
      '--cine-gold-hi-rgb': '255, 233, 176',
      '--cine-accent': '#e79aac',
      '--cine-blush': '#eec3c9',
      '--cine-text': '#f9e7ec',
      '--cine-display': 'var(--font-aref), "Aref Ruqaa", serif',
      '--cine-serif': 'var(--font-amiri), "Amiri", serif',
      '--cine-label': 'var(--font-messiri), "El Messiri", sans-serif',
      '--cine-body': 'var(--font-tajawal), "Tajawal", system-ui, sans-serif',
      '--cine-latin': 'var(--font-cormorant), "Cormorant Garamond", serif',
    },

    /* Gold dust and rose petals over a velvet room, plus a sparkle that
       follows the pointer. `trail` is suppressed over content surfaces by the
       pool itself — see AmbientFx. */
    fx: { dust: true, petals: true, trail: true, petalEveryMs: 3800 },

    copy: {
      en: { kicker: 'Engagement Invitation', latin: 'Engagement', hint: 'Touch the box', loading: 'Loading…', preparing: 'Preparing the scene…', scroll: 'Scroll down', sub: 'invite you to share the joy of their engagement' },
      ar: { kicker: 'دعوة خطوبة', latin: 'Engagement', hint: 'المس الصندوق', loading: 'جارٍ التحميل…', preparing: 'يجهَّز المشهد…', scroll: 'مرّر للأسفل', sub: 'يتشرّفان بدعوتكم لمشاركتهما فرحة الخطوبة' },
    },
  },

  /* ── Door of Joy — wedding ────────────────────────────────────────────
     A carved door with purple blossom. Knock three times and it opens onto
     the light. Warm wood, cream stone and lilac; a light theme below. */
  bab: {
    key: 'bab',
    occasion: 'wedding',
    opening: 'knockDoor',
    hero: 'doorOfJoy',

    assets: {
      poster: '/templates/bab/door-poster.jpg',
      video: '/templates/bab/door.mp4',
      heroPoster: '/templates/bab/hero-poster.jpg',
      heroVideo: '/templates/bab/hero.mp4',
      // Absent from the source folder. useOpeningSfx falls through to its
      // synthesiser when a fetch or decode fails, so the opening is never
      // silent; dropping real recordings in at these paths upgrades it with
      // no code change.
      knockSfx: '/templates/bab/knock.wav',
      doorSfx: '/templates/bab/door-open.m4a',
    },

    /* Both leaves stay shut for the first beat of the footage. Firing the
       hinge sound on play() instead would creak at a closed door. */
    doorSfxAtSeconds: 1.3,
    knocksRequired: 3,

    colors: {
      primary: '#7d5694',
      secondary: '#c9a45c',
      accent: '#a97fc0',
      background: '#f6f1e4',
    },

    cssVars: {
      '--cine-deep': '#3d3226',
      '--cine-mid': '#5a3a20',
      '--cine-hi': '#7a4f2c',
      '--cine-gold': '#c9a45c',
      '--cine-gold-hi': '#f0e0b4',
      '--cine-gold-dp': '#96763c',
      // See the note on Velvet Ring's triplets above.
      '--cine-deep-rgb': '61, 50, 38',
      '--cine-gold-rgb': '201, 164, 92',
      '--cine-gold-hi-rgb': '240, 224, 180',
      '--cine-accent': '#a97fc0',
      '--cine-blush': '#d8c2e6',
      '--cine-text': '#4c3a28',
      '--cine-display': 'var(--font-aref), "Aref Ruqaa", serif',
      '--cine-serif': 'var(--font-amiri), "Amiri", serif',
      '--cine-label': 'var(--font-reem), "Reem Kufi", sans-serif',
      '--cine-body': 'var(--font-tajawal), "Tajawal", system-ui, sans-serif',
      '--cine-latin': 'var(--font-cormorant), "Cormorant Garamond", serif',
    },

    // No pointer trail here: the door template's page is light and the
    // sparkle reads as dirt on a cream ground rather than as light.
    fx: { dust: false, petals: true, trail: false, petalEveryMs: 3200, petalGlyphs: ['❀', '✿', '❁', '✽'] },

    copy: {
      en: { kicker: 'Wedding Invitation', hint: 'Knock three times to open', scroll: 'Scroll down', sub: 'We have opened the door to our joy — and it calls to you' },
      ar: { kicker: 'دعوة زفاف', hint: 'دُقّوا على الباب ثلاث دقّاتٍ ليُفتح', scroll: 'مرّر للأسفل', sub: 'فتحنا باب فرحتنا… وطارت البشائر تدعوكم' },
    },
  },
};

/** The template keys that render a cinematic opening instead of the envelope. */
export const CINEMATIC_KEYS = Object.keys(CINEMATIC_TEMPLATES);

/** Definition for a template key, or null for every non-cinematic template. */
export function getCinematicTemplate(templateType) {
  return CINEMATIC_TEMPLATES[templateType] || null;
}

/**
 * Poster frames worth having in cache before the opening paints, requested
 * from the server render so the <link rel=preload> tags leave with the
 * document rather than waiting for the overlay to mount.
 *
 * Stills only. The videos are megabytes and are what the opening streams for
 * itself — preloading those here would compete for bandwidth with the very
 * poster the guest is looking at while they load.
 *
 * The mirror of preloadRevealAssets() (components/guest/revealAssets.js), for
 * the templates that open on a box or a door instead of an envelope. Both are
 * called during render, never from an effect: React hoists them into <head>,
 * and on the server that only happens if it is asked during the render pass.
 */
export function preloadCinematicAssets(templateType) {
  const tpl = getCinematicTemplate(templateType);
  if (!tpl) return;
  const stills = [tpl.assets.poster, tpl.assets.revealed, tpl.assets.heroPoster].filter(Boolean);
  stills.forEach((href, i) => {
    // Only the cover's own first frame is urgent; the rest are needed a
    // beat later and must not be allowed to delay it.
    preload(href, { as: 'image', fetchPriority: i === 0 ? 'high' : 'low' });
  });
}
