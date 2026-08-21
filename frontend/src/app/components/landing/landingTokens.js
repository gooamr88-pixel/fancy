/* ═══════════════════════════════════════════════════════════════════════════
   The landing page's shared vocabulary.

   WHY THIS FILE EXISTS

   Before this, every marketing section re-declared the SAME six hex values at
   the top of its own file — `const GOLD = "#B8944F"` appeared in six separate
   components, `IVORY`/`CHARCOAL`/`STONE` in five. Nudging the brand meant a
   find-and-replace across ~5,700 lines and a real chance of missing one, which
   is exactly how a section ends up half a shade off.

   ── The 2026-08-20 pass: what changed and why ─────────────────────────────

   TYPE.  The page used `--font-serif` for every heading. That variable is
   ABORETO — a capitals-only display face that ships a single weight. So every
   headline on the page was a full sentence in caps ("EVERY GUEST, FROM THE
   INVITATION TO THE DOOR."), at weights the font does not have, which the
   browser faked. That one fact accounted for most of why the page read cheap.

   Aboreto is not the problem; using it for sentences was. It is kept here as
   `T.label` for the tracked micro-labels it is genuinely good at, and
   CORMORANT GARAMOND — already loaded by layout.js as `--font-cormorant`,
   300–700, with a real lowercase and a real italic — becomes `T.display`.
   Nothing new is downloaded; the face was already in the bundle and unused on
   this page.

   COLOUR.  The palette was charcoal-and-ivory with two full-dark bands. It is
   now a warm paper scale with ONE ink block (the closing call to action), so
   the invitation photography carries all the colour on the page rather than
   competing with a black background.

   Two things live here and nothing else — the palette and the page's band
   rhythm. NOT here: spacing, radii, containers and type scale. Those are
   already `--fx-*` in globals.css and duplicating them would create the second
   source of truth this file exists to remove.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The brand palette — a warm paper scale, ink, and one gold.
 *
 *  The gold appears TWICE on purpose. `gold` is for fills, hairlines and
 *  ornament; `goldInk` is the darkened one that clears 4.5:1 against paper and
 *  is the only one allowed under text a person has to read. Getting this wrong
 *  is invisible to the author and illegible to the reader. */
export const C = {
  /** The page. A warm off-white, not #FFF — a pure white ground makes the
   *  invitation photography look blue by comparison. */
  paper: '#FCFBF8',
  /** The alternating band. */
  paper2: '#F5F0E6',
  /** Strips, the footer, and anything that needs to sit a step deeper. */
  paper3: '#EFE8DA',
  /** Hairlines. Every rule on the page is 1px of this and nothing else. */
  border: '#E3DBCB',

  /** Headings and primary text. Near-black, warmed — pure #000 on warm paper
   *  reads as a hole. */
  ink: '#191815',
  /** Body copy and captions on paper. */
  inkSoft: '#5C574E',

  /** Ornament, hairlines, and display-size type only — the italic accent word
   *  in the hero is 47–78px, where 3:1 is the standard and this clears it at
   *  3.15. At body size it does NOT pass; use `goldInk`. */
  gold: '#A98A4E',
  /** The readable gold. Labels, numerals, links, anything at text size.
   *
   *  #8A6D34 until 2026-08-20, chosen when the light bands were white. Against
   *  the warm papers this page now uses it measured 4.28:1 on `paper2` and
   *  3.99:1 on `paper3` — both below AA, and invisible to anyone checking by
   *  eye, because a gold that looks fine on white looks equally fine on ivory.
   *
   *  Solved against the DEEPEST paper so one value is safe on all three:
   *  5.45 / 4.97 / 4.63 on paper / paper2 / paper3.
   *  Verified by scripts/landingContrast.js. */
  goldInk: '#7B6438',

  /** Type sitting ON the ink block. */
  ivory: '#F6F2E9',

  /* ── Retained for the invitation/device chrome, which is genuinely dark ──
     These are the bezel gradient stops, not page colours. */
  bezelHi: '#45464C',
  bezelMid: '#1D1D20',
  bezelLo: '#0B0B0C',
};

/** Type roles. Import these rather than reaching for `--font-serif`, which is
 *  Aboreto and will set your sentence in capitals at a weight it does not own.
 *
 *  `display` and `label` both resolve to faces layout.js already loads, so
 *  neither adds a request. */
export const T = {
  /** Headings, numerals, pull quotes. Cormorant Garamond — has a true
   *  lowercase and italic, which is where all of its elegance lives.
   *  Weights available: 300 400 500 600 700. */
  display: 'var(--font-cormorant), Georgia, "Noto Naskh Arabic", serif',
  /** Tracked micro-labels ONLY — two or three words, uppercase, wide letter
   *  spacing. This is Aboreto, which has NO lowercase: never put a sentence
   *  in it. */
  label: 'var(--font-heading), "Aboreto", Georgia, serif',
  /** Body, buttons, captions. */
  body: 'var(--font-sans)',
};

/** Text colours for copy sitting on the INK block, pre-mixed so the one dark
 *  surface on the page does not grow three different greys. */
export const ON_INK = {
  title: C.ivory,
  body: 'rgba(246, 242, 233, 0.66)',
  muted: 'rgba(246, 242, 233, 0.44)',
  hairline: 'rgba(246, 242, 233, 0.20)',
};

/* THERE IS NO `BAND` EXPORT, AND THAT IS DELIBERATE.

   One existed until 2026-08-20: `{ light: C.paper, warm: C.paper2, deep:
   C.paper3 }`. Nothing ever imported it — every section reaches for C.paper /
   C.paper2 / C.paper3 directly — so it was a second set of names for three
   values that already had names, in the one file whose whole purpose is to
   stop exactly that. It is the thing this docstring warns about, sitting
   inside the file that warns about it.

   The mapping it encoded (which BAND_ORDER tone means which token) now lives
   in the ONE place that consumes it: the "each band actually paints the tone
   it declares" test in landingHomepage.test.jsx.

   The single dark surface on the page — the closing call to action — is
   `C.ink`, used as a BLOCK inside a light band rather than as a full-bleed
   band, which is what keeps it reading as punctuation and not a theme switch.
*/

/** The page's declared rhythm, top to bottom. page.js asserts against this so
 *  a section cannot be reordered into two consecutive bands of one tone
 *  without the arrangement being visible in one place.
 *
 *  The order answers a stranger's questions in the order they ask them:
 *  what is this → what does my guest get → why should I care → what would I
 *  do → what do I get → what else is in it → what else do you make → has
 *  anyone else done this → my last objection, then the button. */
export const BAND_ORDER = [
  'hero:light',
  'invitations:warm',
  // Third, not seventh: the reader has just been shown three invitations, and
  // "can I hold one" is the next thought rather than the one after four bands
  // of software. It swapped places with the statement band, so the light/warm
  // alternation below is unchanged. See the note on it in page.js.
  'printed:light',
  'how-it-works:warm',
  'dashboard:light',
  'capabilities:warm',
  'statement:light',
  'proof:deep',
  'faq-cta:light',
  'footer:deep',
];

/** Shared shadow ramp. Three steps, not eleven improvised ones.
 *
 *  `device` and `window` are the two that matter: a product screenshot with a
 *  1px border reads as a screengrab somebody pasted in, and the same pixels
 *  under a long, low shadow read as software. */
export const SHADOW = {
  card: '0 1px 2px rgba(25, 24, 21, 0.04), 0 8px 24px -12px rgba(25, 24, 21, 0.10)',
  lift: '0 2px 6px rgba(25, 24, 21, 0.05), 0 20px 44px -20px rgba(25, 24, 21, 0.18)',
  /** An invitation held as an object — long, soft, and with a faint edge so it
   *  does not look like a pasted rectangle. */
  device:
    '0 46px 92px -26px rgba(25, 24, 21, 0.50), 0 10px 24px -10px rgba(25, 24, 21, 0.22), 0 0 0 1px rgba(25, 24, 21, 0.06)',
  /** A browser window holding a screenshot. */
  window:
    '0 54px 110px -34px rgba(25, 24, 21, 0.45), 0 14px 34px -14px rgba(25, 24, 21, 0.18)',
};

/** The dark bezel a phone/tablet screenshot sits in. One definition, because
 *  three sections draw one and they were drifting apart. */
export const BEZEL = `linear-gradient(155deg, ${C.bezelHi}, ${C.bezelMid} 55%, ${C.bezelLo})`;
