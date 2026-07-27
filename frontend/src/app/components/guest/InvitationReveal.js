"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { lighten, darken, alpha, mix, luminance } from "../../utils/color";
import { useGuestAnalytics } from "../../utils/useGuestAnalytics";
import Icon from "../icons/Icon";
import { REVEAL_ASSETS, REVEAL_ASSETS_CRITICAL } from "./revealAssets";

/* ═══════════════════════════════════════════════════════════════════════════
   InvitationReveal — "The Unsealing"

   ONE cinematic opening shared by both guest reveals:

     • mode="invitation"  first thing a guest sees on the event page /[slug].
     • mode="rsvp"        gates the RSVP route; per-session "seen" memory.

   This is a faithful reproduction of the reference design (the Tilda T396
   export kept in the `opening-envelope` design folder, record 2339662043) —
   not a reinterpretation of it. A full-bleed envelope, larger than the
   viewport and cropped by it, built from four overlapping flap photographs
   with a wax seal at the centre and "tap to open" printed on the paper just
   below it. Tap the seal: the label and flourish clear, the seal presses in
   and then breaks open, and the flaps leave in the order it was holding them
   — the sealed top flap, then the sides (fading as they go), then the bottom.

   EVERY position and size below is transcribed from that export rather than
   re-derived, and lives in one table (LAYERS) so it stays checkable against
   the source. See the ARTBOARD block.

   The TIMING is deliberately not the reference's — its 1.6s linear, all-at-
   once release has been rebuilt into a ~2.07s staggered one. The MOTION block
   sets out what changed and why.

   THE ONE DEPARTURE FROM THE REFERENCE — deliberate, and the reason this is
   a component and not a static page: the reference bakes its wax seal,
   engraving and all, into a single rendered image per invitation. Ours ships
   a BLANK seal and draws the organizer's own monogram over it as an SVG
   engraving ("Seal Name / Monogram" in the dashboard → template_data
   .seal_text, auto-derived from the couple/event name when left empty), so
   one shared image personalises itself per event with no asset pipeline.

   Two smaller, unavoidable substitutions: the reference's display face
   ("Template1") is a Tilda-hosted font that is not part of the export — it
   already falls back to Arial there — so the tap label uses the platform's
   own self-hosted serif; and the skip control and language chip are ours,
   required by the contract below and by bilingual events, and sit outside
   the artboard where the reference has nothing.

   CONTRACT (kept stable for callers + tests):
     • data-testid="guest-envelope-reveal" on the root
     • data-testid="guest-envelope-skip" on the always-available skip control
     • calls onComplete() exactly once when finished or skipped
   ═══════════════════════════════════════════════════════════════════════════ */

const isArabic = (s) => typeof s === "string" && /[؀-ۿ]/.test(s);

/* The artwork itself lives in revealAssets.js, which both guest routes import
   to preload it during render. It is at the resolution the reference displays
   it: the flaps are painted as large as 1000x800 CSS px, so anything
   downscaled renders visibly soft at that size.

   How long to wait for the artwork before showing the envelope regardless.
   A partly-drawn envelope is worse than a beat of empty stationery, but a
   guest stuck staring at nothing is worse than either — so the gate is short
   and always opens. With the routes preloading, it is normally already open
   by the time this mounts. */
const ASSET_GATE_MS = 1500;

/* ═══════════════════════════════════════════════════════════════════════════
   TONES — the one way the artwork bends to the event.

   The flaps and the wax are photographs, and photographs do not take an
   arbitrary colour. Handing this a raw hex from custom_colors and tinting to
   match would wreck exactly what makes the envelope look real: a flat colour
   overlay kills the paper grain and the lighting falloff, and the result
   reads as a coloured rectangle rather than as paper.

   So these are curated presets, not a colour picker, and each is a CSS filter
   rather than an overlay. A filter re-tones the pixels that are already
   there — every highlight, fold shadow and fibre survives it, because it is
   shifting hue and saturation rather than painting over them. Paper and wax
   are tuned separately: the same shift that flatters cream card stock turns
   gold wax muddy.

   'classic' is an explicit no-op rather than an absent value, so the default
   path renders byte-identically to having no tone system at all.
   ═══════════════════════════════════════════════════════════════════════════ */
export const REVEAL_TONES = {
  classic: { label: "Classic gold", swatch: "#C9A55E", paper: null, wax: null },
  ivory: { label: "Cool ivory", swatch: "#E4E2DA", paper: "saturate(.55) brightness(1.02)", wax: "saturate(.72) brightness(1.04)" },
  blush: { label: "Blush rose", swatch: "#D8A2A0", paper: "sepia(.2) hue-rotate(-22deg) saturate(1.18)", wax: "sepia(.34) hue-rotate(-24deg) saturate(1.22)" },
  sage: { label: "Sage green", swatch: "#9DAE8C", paper: "sepia(.24) hue-rotate(44deg) saturate(.88)", wax: "sepia(.38) hue-rotate(40deg) saturate(.92)" },
};
const DEFAULT_TONE = "classic";

function buildToneCSS() {
  return Object.entries(REVEAL_TONES).map(([key, t]) => {
    const rules = [];
    if (t.paper) rules.push(`.ir3-root[data-tone="${key}"] .ir3-paper img{filter:${t.paper}}`);
    if (t.wax) rules.push(`.ir3-root[data-tone="${key}"] .ir3-sl img{filter:${t.wax}}`);
    return rules.join("\n");
  }).filter(Boolean).join("\n");
}

/* ═══════════════════════════════════════════════════════════════════════════
   ARTBOARD — the reference design, transcribed.

   The reference is a Tilda "zero block": a fixed 1200x850 artboard of
   absolutely-positioned elements, with per-breakpoint overrides. Its x values
   are measured from the LEFT EDGE OF THE LAYOUT GRID, not from the centre,
   which is why rendering one needs that breakpoint's grid half-width:

       left = 50% - half + x

   Keeping x in the export's own coordinate system (instead of pre-resolving
   it to an offset from centre) is what makes every number below directly
   checkable against `opening-envelope-section.html` — d.x is the element's
   data-field-left-value, s960.x its data-field-left-res-960-value, and so on.

   Overrides are emitted as-is, so the CSS cascades exactly the way the
   export's does: a breakpoint that omits y keeps the y from the one above it.
   ═══════════════════════════════════════════════════════════════════════════ */

const ARTBOARD_H = 850;

/* max: the media query's max-width (null = the unqualified base block).
   half: that breakpoint's grid half-width. key: the LAYERS override to use. */
const SCREENS = [
  { max: null, half: 600, key: "d" },
  { max: 1199, half: 480, key: "s960" },
  { max: 959, half: 320, key: "s640" },
  { max: 639, half: 240, key: "s480" },
  { max: 479, half: 160, key: "s320" },
];

/* DOM order is the export's own element order, and with no z-index anywhere
   it is also the paint order: the two side flaps, then the bottom flap over
   them, then the embossed top flap over everything — the order an envelope is
   actually folded. The flourish, seal and label print on top of the paper.

   move/fade/anim are the OPEN CHOREOGRAPHY, and are the one part of this
   table that is NOT the export's. The reference fires its steps on a linear
   `ea:'0'` with every flap released at the same instant, 800ms after the tap,
   and the whole thing over in 1.6s. See the MOTION block below for what
   replaced it and why. */
const LAYERS = [
  {
    cls: "fr", asset: "flapPlain", rot: 90,
    d: { x: 421, y: 25, w: 867, h: 800 },
    s960: { x: 295 }, s640: { x: 135 }, s480: { x: 55 },
    s320: { x: -75, y: 83, w: 856, h: 684 },
    move: { x: 559, ms: 1350, delay: 700, ease: "leave" },
    fade: { ms: 300, delay: 1750, ease: "leave" },
  },
  {
    cls: "fl", asset: "flapPlain", rot: 270,
    d: { x: -87, y: 25, w: 867, h: 800 },
    s960: { x: -205 }, s640: { x: -360 }, s480: { x: -441 },
    s320: { x: -475, y: 105, w: 856, h: 640 },
    move: { x: -559, ms: 1350, delay: 700, ease: "leave" },
    fade: { ms: 300, delay: 1750, ease: "leave" },
  },
  {
    cls: "fb", asset: "flapPlain", rot: 180,
    d: { x: 100, y: 221, w: 1000, h: 785 },
    s960: { x: -25 }, s640: { x: -185 }, s480: { x: -265 },
    s320: { x: -247, w: 815, h: 787 },
    // This flap never fades, so it has to actually leave: 221 is its topmost
    // artboard edge at rest (the same on every breakpoint).
    move: { y: 606, ms: 1250, delay: 820, ease: "leave" },
    clearBelow: 221,
  },
  {
    cls: "ft", asset: "flapDeco", rot: 0,
    d: { x: 105, y: -98, w: 991, h: 583 },
    s960: { x: -15, y: -102, h: 586 },
    s640: { x: -175, y: -116, h: 593 },
    s480: { x: -255, w: 992, h: 598 },
    s320: { x: -244, y: -99, w: 807, h: 569 },
    // 485 = its lowest artboard edge at rest (y + h), taken from the base
    // breakpoint because that is the largest of the five.
    move: { y: -430, ms: 1250, delay: 560, ease: "leave" },
    clearAbove: 485,
  },
  {
    cls: "fw", asset: "flourish",
    d: { x: 506, y: 510, w: 188, h: 45 },
    s960: { x: 386 }, s640: { x: 226 }, s480: { x: 146 }, s320: { x: 66 },
    fade: { ms: 360, delay: 0, ease: "leave" },
  },
  {
    cls: "sl", kind: "seal",
    d: { x: 520, y: 310, w: 160, h: 160 },
    s960: { x: 400 }, s640: { x: 235 }, s480: { x: 155 }, s320: { x: 80 },
    anim: { name: "ir3-seal-break", ms: 1250, delay: 0 },
  },
  {
    cls: "tx", kind: "text",
    d: { x: 492, y: 468, w: 217 },
    s960: { x: 372 }, s640: { x: 212 }, s480: { x: 132 }, s320: { x: 52 },
    fade: { ms: 360, delay: 0, ease: "leave" },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   MOTION — the one place this departs from the reference on purpose.

   The reference opens in 1.6s on linear easing with all four flaps released
   at the same instant. Slowing that down verbatim only makes the flaws
   louder: linear motion has no weight (paper does not travel at a constant
   speed), and four things starting together is one event, not a sequence.
   Every extra millisecond of a flat animation reads as lag.

   So the choreography is rebuilt around three rules:

   1. NEVER A DEAD FRAME. Something is moving from the instant of the tap:
      the label and flourish clear (0–360ms) while the seal presses and
      breaks (0–1250ms), and the flaps are already in flight (from 560ms)
      before the seal has finished dissolving. Overlapping beats are what
      make a slow sequence read as unhurried instead of stalled — the
      reference's own 800ms of stillness before any flap moves is exactly
      what got the earlier port called broken.

   2. THE SEAL ANSWERS THE TAP IMMEDIATELY. It compresses within ~110ms —
      touch feedback fast enough to feel physical — and only then releases
      and swells away. The reference waits 350ms before the seal reacts at
      all. (See the ir3-seal-break keyframes.)

   3. THE FLAPS LEAVE IN THE ORDER THE SEAL WAS HOLDING THEM: the sealed top
      flap first, then the sides, then the bottom, ~130ms apart, each on an
      accelerating curve so it starts with the weight of paper and is gone at
      speed. Objects leaving the frame accelerate; only arriving objects
      decelerate.

   Total ≈ 2.07s, against the reference's 1.6s.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE = {
  // Accelerate-out. Anything leaving the frame uses this: it begins with
  // visible resistance and ends at full speed, so the exit never looks braked.
  leave: "cubic-bezier(.4,0,1,1)",
};

/* The reference's flap travel was tuned for its own ~850px-tall section, and
   the two flaps that never fade (top and bottom) simply do not clear a taller
   viewport — they stop with a band of paper still on screen. So each of those
   travels the reference's distance OR exactly far enough to clear the
   viewport, whichever is further; on screens up to ~740px tall the reference's
   own number already wins and is used verbatim.

   50vh, not 50dvh: dvh is the better measure but is not universally
   supported, and an unsupported max() would drop the whole declaration and
   leave the flap sitting still. vh resolves to the LARGER viewport height, so
   erring toward it only ever overshoots — which is invisible off-screen. */
function flyDistanceY(l) {
  const half = ARTBOARD_H / 2;
  if (l.clearAbove !== undefined) return `calc(-1 * max(${Math.abs(l.move.y)}px, ${l.clearAbove - half}px + 50vh))`;
  if (l.clearBelow !== undefined) return `max(${l.move.y}px, calc(${half - l.clearBelow}px + 50vh))`;
  return `${l.move.y}px`;
}

/* How long the sequence actually runs, read off the table rather than
   restated, so re-timing any step above can never leave the handoff out of
   sync with the animation. */
const OPEN_DURATION = Math.max(
  ...LAYERS.flatMap((l) => [l.move, l.fade, l.anim].filter(Boolean).map((s) => s.delay + s.ms))
);

/* The page underneath is cross-faded in slightly BEFORE the last flap lands,
   so the handoff is a dissolve between two moving states rather than a cut
   that waits for everything to come to a stop first. */
const HANDOFF_OVERLAP = 220;

function buildArtboardCSS() {
  return SCREENS.map(({ max, half, key }) => {
    const rules = LAYERS.map((l) => {
      const v = l[key];
      if (!v) return "";
      const d = [];
      if (v.x !== undefined) d.push(`left:calc(50% - ${half}px + ${v.x}px)`);
      if (v.y !== undefined) d.push(`top:${v.y}px`);
      if (v.w !== undefined) d.push(`width:${v.w}px`);
      if (v.h !== undefined) d.push(`height:${v.h}px`);
      return d.length ? `.ir3-${l.cls}{${d.join(";")}}` : "";
    }).filter(Boolean).join("");
    // @container, not @media. The reference's breakpoints are viewport
    // breakpoints, but this component is no longer only ever the viewport:
    // the dashboard renders it inside a phone-sized preview box so the
    // organizer designs against the same envelope the guest opens. A media
    // query would ask the real browser window how wide it is and lay a
    // 320px-wide preview out with the 1200px grid — every element positioned
    // hundreds of px outside its box. Asking the CONTAINER instead makes the
    // full-screen overlay and the preview box behave identically, because
    // full screen is simply the case where the container is the viewport.
    return max === null ? rules : `@container ir3 (max-width:${max}px){${rules}}`;
  }).join("\n");
}

function buildMotionCSS() {
  return LAYERS.map((l) => {
    const transitions = [];
    const opened = [];
    if (l.move) {
      transitions.push(`transform ${l.move.ms}ms ${EASE[l.move.ease]} ${l.move.delay}ms`);
      if (l.move.x) opened.push(`--mx:${l.move.x}px`);
      if (l.move.y) opened.push(`--my:${flyDistanceY(l)}`);
    }
    if (l.fade) {
      transitions.push(`opacity ${l.fade.ms}ms ${EASE[l.fade.ease]} ${l.fade.delay}ms`);
      opened.push("opacity:0");
    }
    // Anything needing more than one keyframe (only the seal, which presses
    // before it swells) runs as an animation instead — `both` so it holds its
    // final frame rather than snapping back once it ends.
    if (l.anim) opened.push(`animation:${l.anim.name} ${l.anim.ms}ms linear ${l.anim.delay}ms both`);
    if (!transitions.length && !opened.length) return "";
    const rest = transitions.length ? `.ir3-${l.cls}{transition:${transitions.join(",")}}` : "";
    return `${rest}.ir3-root.is-open .ir3-${l.cls}{${opened.join(";")}}`;
  }).filter(Boolean).join("\n");
}

/* The rotation lives on the inner .ir3-atom, never on the positioned layer —
   exactly as the export splits it (`.tn-elem` is animated, `.tn-atom` is
   rotated). Keeping them on separate elements is what lets the slide-apart
   transform stay in plain screen space instead of having to be composed with
   each flap's own rotation. */
function buildRotationCSS() {
  return LAYERS.filter((l) => l.rot).map((l) => `.ir3-${l.cls} .ir3-atom{transform:rotate(${l.rot}deg)}`).join("\n");
}

/* The engraved-monogram look on the wax seal: a mid-gold fill with a light
   highlight above and a darker shadow below, so the organizer's text reads as
   raised gold pressed into the wax rather than flat type sitting on a photo.
   Kept as plain objects (not a CSS class) because the reduced-motion fallback
   below returns before REVEAL_CSS is injected and so can't rely on one. */
const SEAL_TEXT_SVG_STYLE = {
  position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
  // Set here (and inherited by the <text> below) rather than as a font-family
  // presentation attribute — var() is not reliably supported inside SVG
  // presentation attributes, but works fine in an inline style.
  fontFamily: "var(--font-serif), Georgia, serif",
};

/* ═══════════════════════════════════════════════════════════════════════════
   SealMonogram — the organizer's initials, struck into the wax.

   This is the one thing the reference design bakes into its artwork and we
   generate, so it is also the one place our version can look cheaper than
   the reference. The previous approach — a flat #8d6c2c fill with two
   hairline CSS drop-shadows — gave it away: real metal is never one colour
   across a stroke, and a shadow offset a fraction of a pixel reads as a
   printing error rather than depth. It looked like type sitting ON a
   photograph of wax, which is exactly what it was.

   Three things replace it, and they are cumulative rather than alternatives:

     1. A GRADIENT fill, so each stroke is bright where it faces the light
        and deep where it turns away. This alone does most of the work, and
        it is the layer that survives if everything below fails.
     2. A real BEVEL: the glyph alpha is blurred into a height field and lit
        with feSpecularLighting, so the highlight follows the actual curve of
        each letterform instead of being a copy of it nudged upward. This is
        what a filter can do that a drop-shadow fundamentally cannot.
     3. A CONTACT SHADOW around — not under — the glyph, composited `out` of
        its own alpha so it only darkens the wax the letter is standing on.

   Lighting is 225°/55° to match the reveal's own key light from the upper
   left, and the relief is RAISED, not incised: a wax seal is struck with a
   recessed die, so the design comes out standing proud of the wax. The
   reference's own seal reads the same way.

   Filter primitives are in the 0–100 viewBox's user units, so the whole
   thing scales with the seal — the same markup serves the 160px seal on the
   envelope and the 76px one on the static card. And if feSpecularLighting is
   unavailable or fails, the text still renders with its gradient: a graceful
   step down, never a blank.
   ═══════════════════════════════════════════════════════════════════════════ */
function SealMonogram({ text, fontSize }) {
  // Scoped per instance: two seals in one document must not share filter ids.
  const uid = useId();
  const gradId = `sealGold-${uid}`;
  const reliefId = `sealRelief-${uid}`;

  // An Arabic monogram in a Latin-only serif falls back to whatever the
  // system offers; the seal is the one place that is most obvious.
  const style = isArabic(text)
    ? { ...SEAL_TEXT_SVG_STYLE, fontFamily: "var(--font-serif-ar), Georgia, serif" }
    : SEAL_TEXT_SVG_STYLE;

  return (
    <svg viewBox="0 0 100 100" aria-hidden style={style}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d79b" />
          <stop offset="34%" stopColor="#cda85a" />
          <stop offset="63%" stopColor="#a37f2c" />
          <stop offset="100%" stopColor="#7d5f1c" />
        </linearGradient>

        {/* sRGB, not the linearRGB default: the lighting primitives are being
            matched to a photograph, and linear light blows the highlight out
            into a white smear across the stroke. */}
        <filter id={reliefId} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          {/* The height field. A tight blur keeps the bevel to the very edge
              of each stroke — widen it and the letters turn to soft putty. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="bump" />

          <feSpecularLighting in="bump" surfaceScale="2.6" specularConstant="1" specularExponent="20" lightingColor="#fffaef" result="spec">
            <feDistantLight azimuth="225" elevation="55" />
          </feSpecularLighting>
          {/* Clip the highlight to the glyph — feSpecularLighting fills its
              whole region, and unclipped it fogs the wax around the text. */}
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOnGlyph" />

          {/* Add the highlight to the gradient-filled text. */}
          <feComposite in="SourceGraphic" in2="specOnGlyph" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit" />

          {/* Contact shadow: offset down-right (away from the key light),
              then punched OUT of the glyph's own alpha so it darkens only the
              wax beside the letter, never the letter itself. */}
          <feOffset in="SourceAlpha" dx="0.3" dy="0.5" result="shOff" />
          <feGaussianBlur in="shOff" stdDeviation="0.45" result="shBlur" />
          <feFlood floodColor="#4a3108" floodOpacity="0.55" result="shColor" />
          <feComposite in="shColor" in2="shBlur" operator="in" result="shShaped" />
          <feComposite in="shShaped" in2="SourceAlpha" operator="out" result="shOutside" />

          <feMerge>
            <feMergeNode in="shOutside" />
            <feMergeNode in="lit" />
          </feMerge>
        </filter>
      </defs>

      <text
        x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fontSize={fontSize} fontWeight="600" letterSpacing="0.5"
        fill={`url(#${gradId})`} filter={`url(#${reliefId})`}
      >
        {text}
      </text>
    </svg>
  );
}

/* ─── Name + monogram derivation from real event data ─── */
function deriveIdentity(event, lang) {
  const td = event?.template_data || {};
  const a = (td.groom_name || td.partner1Name || td.partner1 || td.celebrant || td.honoree || td.company || "").trim();
  const b = (td.bride_name || td.partner2Name || td.partner2 || "").trim();

  let full;
  if (a && b) full = `${a} & ${b}`;
  else if (a) full = a;
  else full = (lang === "ar" && (event?.title_ar || td.title_ar)) ? (event?.title_ar || td.title_ar) : (event?.title || "");

  // What gets engraved on the wax. The organizer's own "Seal Name / Monogram"
  // (template_data.seal_text, set in the dashboard) always wins; everything
  // below is only the auto-fallback for organizers who left it blank.
  let sealText = (td.seal_text || "").trim();
  if (!sealText) {
    const arabicSource = [a, b, event?.title_ar, td.title_ar, event?.title].find((s) => isArabic(s));
    if (arabicSource) {
      sealText = arabicSource.trim().split(/\s+/).filter(Boolean)[0] || arabicSource.trim();
    } else if (a && b) {
      sealText = `${a[0]}${b[0]}`.toUpperCase();
    } else if (a) {
      sealText = a.slice(0, 2).toUpperCase();
    } else {
      // Only words that START with a letter. Splitting on whitespace alone
      // made "Aria & Julian" — the single most likely shape of a wedding
      // title — engrave "A&" on the wax, because the ampersand counted as the
      // second word and contributed its own first character.
      const words = (event?.title || "").trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
      sealText = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    }
  }
  sealText = sealText || "✦";
  return { full: full || "You're Invited", sealText };
}

/* ─── Palette derived from the event's own custom_colors ───
   The artboard itself is NOT tinted — it is the reference's one photoreal
   look for every event. This palette dresses the two pieces of chrome that
   are ours (skip control, language chip) and the reduced-motion fallback
   card, and is clamped to a legible mid-tone band so any organizer colour
   stays readable rather than washing out or going muddy. */
function buildRevealPalette(customColors) {
  const c = customColors || {};
  let accent = c.primary || c.secondary || "#5f8154";
  let gold = c.secondary || c.accent || "#c6a24d";

  const aLum = luminance(accent);
  if (aLum > 0.72) accent = darken(accent, 0.35);
  else if (aLum < 0.16) accent = lighten(accent, 0.3);

  const gLum = luminance(gold);
  if (gLum > 0.85) gold = darken(gold, 0.2);
  else if (gLum < 0.22) gold = lighten(gold, 0.35);

  return {
    card: "#fbf8ef", cardHi: "#fffefa", cardEdge: mix(gold, "#fbf8ef", 0.3),
    ink: mix(darken(accent, 0.5), "#2c2c20", 0.45), inkSoft: mix(accent, "#5c5c48", 0.55),
    accent, gold, goldHi: lighten(gold, 0.26),
    linerLite: lighten(accent, 0.6), linerMid: accent, linerDeep: darken(accent, 0.32),
    bloom: mix(gold, "#fff8ea", 0.7),
  };
}

export default function InvitationReveal({
  event,
  mode = "invitation",
  guestName = "",
  musicRef,
  sessionKey = null,
  lang: langProp = null,
  onComplete,
  // Renders inside a parent box (the dashboard's phone preview) instead of
  // over the whole window. Same component, same artwork, same choreography —
  // which is the entire point: what the organizer designs against and what
  // the guest opens must not be two different envelopes.
  embedded = false,
}) {
  const prefersReduced = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(langProp || "en");
  const timers = useRef([]);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const P = useMemo(() => buildRevealPalette(event?.custom_colors), [event?.custom_colors]);
  const paletteVars = useMemo(() => ({
    "--card": P.card, "--card-hi": P.cardHi, "--card-edge": P.cardEdge,
    "--ink": P.ink, "--ink-soft": P.inkSoft,
    "--accent": P.accent, "--gold": P.gold, "--gold-hi": P.goldHi,
    "--liner-lite": P.linerLite, "--liner-mid": P.linerMid, "--liner-deep": P.linerDeep,
    "--bloom": P.bloom,
    // Scoped locally to this overlay only — NOT a change to the platform's
    // global --font-serif/--font-script (InvitationCard, HeroSection, etc.
    // keep whatever they already had). CSS custom properties only cascade
    // to descendants of the element they're set on, and this component's
    // root is never an ancestor of the rest of the guest page, so this is
    // scoping by construction, not by convention.
    // Resolved from the SELF-HOSTED next/font variables declared on <html> in
    // layout.js, not from a family name that only exists if a third-party
    // stylesheet loaded. The literal names stay as the fallback so the reveal
    // still renders correctly if a face ever fails to resolve.
    // The literal fallback here tracks whatever layout.js currently assigns
    // to --font-heading (previously Cormorant Garamond, now Aboreto) — it is
    // read live via var(), so the reveal follows the platform's own brand
    // font automatically; the string after it is only what renders in the
    // (essentially theoretical) case where the variable fails to resolve,
    // and is kept in sync so it never names a font the app no longer loads.
    "--font-serif": "var(--font-heading), 'Aboreto', Georgia, 'Times New Roman', serif",
    "--font-script": "var(--font-delafield), 'Mrs Saint Delafield', cursive",
    // Aboreto carries no Arabic, so an Arabic label was silently dropping to
    // whatever the system happened to have — usually a UI sans sitting on
    // stationery. Aref Ruqaa is a real naskh face and is already self-hosted
    // alongside the rest (layout.js, --font-aref).
    "--font-serif-ar": "var(--font-aref), 'Aref Ruqaa', 'Noto Naskh Arabic', Georgia, serif",
  }), [P]);

  // The two reveal display faces are now SELF-HOSTED via next/font in layout.js
  // (Aboreto as --font-heading, Mrs Saint Delafield as --font-delafield).
  // This used to inject a <link> to fonts.googleapis.com on every mount, which made
  // the envelope — the very first thing a guest sees — wait on a third-party host
  // that is blackholed in several countries and by many corporate proxies. A
  // blackholed host hangs rather than failing, and a <head> stylesheet blocks paint
  // while pending, so those guests got a frozen reveal and never reached the
  // invitation at all. Nothing to load at runtime now.

  const td = event?.template_data || {};
  // Unknown or missing values fall back to classic rather than rendering an
  // untinted `data-tone` nobody has a rule for — an event carrying a tone key
  // from a future build must not lose its envelope.
  const tone = REVEAL_TONES[td.reveal_tone] ? td.reveal_tone : DEFAULT_TONE;
  const hasArabic = !!(event?.title_ar || td.title_ar || isArabic(event?.title));
  const identity = useMemo(() => deriveIdentity(event, lang), [event, lang]);
  // A known guest (resolved from their personal link/token — private events,
  // or a public event's per-guest invite) is personalised via the reduced-motion
  // card's welcome line — the seal is deliberately NOT personalised per guest:
  // it carries the couple/event's own monogram, the same for every guest, the
  // way a real wax seal would.
  const sealText = identity.sealText;
  // Same 0–100 units as the SVG overlay's viewBox, so the engraving scales
  // with the seal at any button size. Longer text steps down through the
  // ladder instead of overflowing the wax face.
  const sealFontSize = sealText.length <= 2 ? 26 : sealText.length <= 4 ? 19 : sealText.length <= 7 ? 13.5 : sealText.length <= 10 ? 10 : 8;

  /* Per-session "seen" memory (rsvp mode). */
  const seenKey = sessionKey ? `fancy_envelope_seen_${sessionKey}` : null;
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  const markSeen = useCallback(() => {
    if (!seenKey || typeof window === "undefined") return;
    try { window.sessionStorage.setItem(seenKey, "1"); } catch { /* unavailable */ }
  }, [seenKey]);
  const [alreadySeen] = useState(
    () => !!(seenKey && typeof window !== "undefined" && (() => { try { return window.sessionStorage.getItem(seenKey) === "1"; } catch { return false; } })())
  );
  useEffect(() => {
    if (alreadySeen) onCompleteRef.current && onCompleteRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = {
    en: { eyebrow: "You are invited", tap: "Tap to open", enter: "View invitation", join: "request the honour of your presence" },
    ar: { eyebrow: "أنت مدعو", tap: "اضغط للفتح", enter: "عرض الدعوة", join: "يشرّفنا حضوركم" },
  }[lang];
  const isRTL = lang === "ar";
  const arTitle = event?.title_ar || td.title_ar;
  const displayTitle = isRTL && arTitle ? arTitle : identity.full;
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  /* ─── Instrumentation ───
     The reveal stands between every guest and the invitation, and until now
     nothing measured it: the only event this page ever sent was page_view, so
     "did guests actually open it, and how long did they hesitate first?" —
     the question that decides whether the tap affordance and the motion
     timing are right — had no answer but taste.

     The hook reads the slug straight off the event, so neither caller has to
     wire anything, and it already no-ops on demo slugs and on the server.
     `mode` finally earns its keep here: invitation-page and RSVP-gate reveals
     are different funnels and must not be pooled.

     Every helper is idempotent via a ref rather than local state: React
     double-invokes effects in development, and a funnel that double-counts
     its own denominator is worse than no funnel. */
  // Never from an embedded preview. Today every embedded caller passes a
  // 'demo' slug, which the hook already ignores — but that is a convention a
  // future caller can forget, and forgetting it would quietly file an
  // organizer's own preview taps as guest opens and corrupt the funnel this
  // exists to measure. Withholding the slug makes it structural instead.
  const { trackEvent } = useGuestAnalytics(embedded ? null : event?.slug);
  const shownAtRef = useRef(0);
  const trackedShownRef = useRef(false);
  const trackedExitRef = useRef(false);

  const sinceShown = useCallback(
    () => (shownAtRef.current ? Date.now() - shownAtRef.current : null),
    []
  );
  const trackShown = useCallback((via) => {
    if (trackedShownRef.current) return;
    trackedShownRef.current = true;
    shownAtRef.current = Date.now();
    trackEvent("reveal_shown", { mode, via });
  }, [mode, trackEvent]);
  /* One exit per reveal: a guest who taps the seal and then hits skip mid-
     animation must not count as both an open and a skip. */
  const trackExit = useCallback((type, extra) => {
    if (trackedExitRef.current) return;
    trackedExitRef.current = true;
    trackEvent(type, { mode, msToTap: sinceShown(), ...extra });
  }, [mode, sinceShown, trackEvent]);

  /* ─── Sequence control ─── */
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const after = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    markSeen();
    onComplete && onComplete();
  }, [markSeen, onComplete]);

  // One flag drives the whole sequence: every element's own delay and duration
  // is already declared in LAYERS, so tapping the seal only has to say "go".
  const openSeal = useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    trackExit("reveal_opened");
    musicRef?.current?.play().catch((err) => console.error("Background music playback failed:", err));
    setOpen(true);
    after(OPEN_DURATION - HANDOFF_OVERLAP, finish);
  }, [after, finish, musicRef, trackExit]);

  /* Distinct from finish(), which is also how a completed reveal ends. Only
     the skip control routes through here, so the two never blur together in
     the funnel. */
  const skip = useCallback(() => {
    trackExit("reveal_skipped");
    finish();
  }, [finish, trackExit]);

  useEffect(() => clearTimers, [clearTimers]);

  /* ─── Focus & keyboard ───
     This is a modal dialog that covers the entire page and whose only way
     forward is a single unlabelled circle of wax. It had role="dialog" and
     nothing else: focus stayed wherever it was on the page behind, Tab walked
     straight out of the overlay into content the guest cannot see, and there
     was no keyboard way past it at all — the skip control had to be found by
     tabbing blind.

     Deliberately NOT applied when embedded: the dashboard preview sits inside
     a settings form, and stealing focus (or swallowing Escape and Tab) there
     would trap an organizer inside a preview of their own invitation. */
  const dialogRef = useRef(null);
  const sealRef = useRef(null);
  // Held in a ref so the listener below subscribes once, instead of on every
  // render — `skip` changes identity whenever the caller passes a fresh
  // onComplete, which is most renders.
  const skipRef = useRef(skip);
  useEffect(() => { skipRef.current = skip; });

  useEffect(() => {
    if (embedded || alreadySeen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); skipRef.current(); return; }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      // getClientRects rather than offsetParent: the overlay's own children
      // are positioned, and offsetParent reports null for fixed elements.
      const focusables = Array.from(
        root.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.getClientRects().length > 0);
      if (focusables.length < 2) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [embedded, alreadySeen]);

  /* ─── Artwork gate ───
     "pending" holds the envelope back until its images have actually decoded,
     so it never fades in half-drawn; "failed" means the artwork isn't coming
     and the static card below takes over rather than leaving a white screen
     with an invisible tap target on it — the single worst failure this
     component can have, since the seal IS the only way forward.

     decode() rather than onload alone: onload fires when the bytes are in,
     decode() when the pixels are ready to paint, and it is the gap between
     those two that shows as a flash of half-drawn envelope. */
  const [artwork, setArtwork] = useState("pending");
  useEffect(() => {
    if (alreadySeen) return undefined;
    // The static card needs no artwork, so it is "shown" the moment it renders.
    if (prefersReduced) { trackShown("reduced-motion"); return undefined; }

    let settled = false;
    const settle = (next, via) => {
      if (settled) return;
      settled = true;
      setArtwork(next);
      if (next === "failed") trackEvent("reveal_failed", { mode });
      trackShown(via);
    };
    // Always opens: a slow connection must not be able to strand a guest.
    const gate = setTimeout(() => settle("ready", "timeout"), ASSET_GATE_MS);
    Promise.all(REVEAL_ASSETS_CRITICAL.map((src) => new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => (img.decode ? img.decode().then(resolve, resolve) : resolve());
      img.onerror = reject;
      img.src = src;
    })))
      .then(() => settle("ready", "decoded"))
      .catch(() => settle("failed", "artwork-failed"));
    return () => { settled = true; clearTimeout(gate); };
  }, [prefersReduced, alreadySeen, mode, trackEvent, trackShown]);

  // Focus the DIALOG, not the seal. Focusing the seal directly was the more
  // obvious move and was wrong twice over: it made browsers paint the seal's
  // focus ring the instant the reveal appeared, so every guest — including
  // the ones who never touch a keyboard — met the wax with a ring around it;
  // and it skipped the dialog itself, which is the thing a screen reader
  // needs to land on to announce what just took over the screen. Moving focus
  // to the container is the standard modal pattern: the announcement happens,
  // Tab still reaches the seal first, and the ring only ever appears for
  // someone actually navigating by keyboard.
  useEffect(() => {
    if (embedded || alreadySeen) return;
    if (prefersReduced || artwork === "ready") dialogRef.current?.focus({ preventScroll: true });
  }, [embedded, alreadySeen, prefersReduced, artwork]);

  if (alreadySeen) return null;

  /* ═══ Static card — no choreography. Serves two different situations:
         a guest who asked for reduced motion, and a guest whose envelope
         artwork failed to load at all. In the second case the wax image is
         gone too, so the monogram is engraved onto a drawn gold disc instead
         of onto a broken image. ═══ */
  const artworkFailed = artwork === "failed";
  if (prefersReduced || artworkFailed) {
    return (
      <motion.div
        data-testid="guest-envelope-reveal" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal={!embedded} aria-label="Open your invitation"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
        dir={isRTL ? "rtl" : "ltr"}
        style={{
          ...overlayBase,
          // Same containment switch as the animated path — embedded, this card
          // belongs to the preview box, not to the window.
          ...(embedded ? { position: "absolute", zIndex: 1 } : null),
          ...paletteVars,
          background: `radial-gradient(120% 90% at 50% -6%, ${P.cardHi}, ${P.card} 62%)`,
        }}
      >
        <button type="button" data-testid="guest-envelope-skip" onClick={skip} aria-label="Skip invitation" style={skipStyle(P)}>
          Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
        </button>
        <div style={{
          position: "relative", width: "100%", maxWidth: 420, textAlign: "center", padding: "44px 30px",
          borderRadius: 8, color: P.ink, backgroundColor: P.card,
          backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${P.cardHi}, ${P.card} 76%)`,
          border: `1px solid ${alpha(P.gold, 0.4)}`,
          boxShadow: "0 40px 90px -30px rgba(40,30,16,.45), inset 0 0 0 1px rgba(255,255,255,.4)",
          maxHeight: "calc(100dvh - 48px)", overflowY: "auto",
        }}>
          <div style={{
            width: 76, height: 76, margin: "0 auto 18px", position: "relative",
            ...(artworkFailed ? {
              borderRadius: "50%",
              background: `radial-gradient(72% 72% at 34% 28%, ${P.goldHi}, ${P.gold} 62%, ${darken(P.gold, 0.28)})`,
              boxShadow: `inset 0 -2px 5px ${alpha(darken(P.gold, 0.45), 0.5)}, inset 0 2px 4px rgba(255,255,255,.45), 0 6px 14px ${alpha(P.gold, 0.3)}`,
            } : null),
          }}>
            {!artworkFailed && <img src={REVEAL_ASSETS.seal} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
            <SealMonogram text={sealText} fontSize={sealFontSize} />
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: isRTL ? "normal" : "0.36em", textTransform: isRTL ? "none" : "uppercase", color: P.accent, fontWeight: 700 }}>{guestName ? (isRTL ? `مرحباً ${guestName}` : `Welcome, ${guestName}`) : copy.eyebrow}</div>
          <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(26px,7vw,38px)", margin: "12px 0 6px", color: P.ink, fontWeight: 500 }}>{displayTitle}</h1>
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: 14, color: P.inkSoft, margin: 0 }}>{copy.join}</p>
          {dateStr && <div style={{ marginTop: 18, fontSize: 12, letterSpacing: isRTL ? "normal" : "0.2em", textTransform: isRTL ? "none" : "uppercase", color: P.inkSoft, fontWeight: 600 }}>{dateStr}</div>}
          {/* The card's own call to action, not a skip: this IS the intended
              way through on this path, so it counts as an open — and it is
              what the focus effect targets on this path. */}
          <button type="button" ref={sealRef} onClick={() => { trackExit("reveal_opened", { static: true }); musicRef?.current?.play().catch(() => {}); finish(); }} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 24, padding: "14px 32px", borderRadius: 999,
            border: "none", background: `linear-gradient(180deg, ${P.goldHi}, ${P.gold})`, color: "#2c2010",
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: isRTL ? "normal" : "0.14em", textTransform: isRTL ? "none" : "uppercase", cursor: "pointer",
            boxShadow: `0 12px 28px ${alpha(P.gold, 0.35)}, inset 0 1px 0 rgba(255,255,255,.5)`,
          }}>
            {copy.enter} <span aria-hidden style={{ marginInlineStart: 8 }}>{isRTL ? "←" : "→"}</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-testid="guest-envelope-reveal" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal={!embedded} aria-label="Open your invitation"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } }}
      transition={{ duration: 0.5 }}
      dir={isRTL ? "rtl" : "ltr"}
      className={`ir3-root${embedded ? " is-embedded" : ""}${artwork === "ready" ? " is-ready" : ""}${open ? " is-open" : ""}`}
      data-tone={tone}
      style={paletteVars}
    >
      <style dangerouslySetInnerHTML={{ __html: REVEAL_CSS }} />

      {/* Ours, not the reference's: kept outside the artboard so nothing in the
          transcribed layout has to make room for them. */}
      <div style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineEnd: 16, zIndex: 20 }}>
        <button type="button" className="ir3-langchip" onClick={() => hasArabic && setLang((l) => (l === "en" ? "ar" : "en"))} aria-label={hasArabic ? "Toggle language" : "Language"} style={langChipStyle(!!hasArabic, P)}>
          <Icon name="globe" size={14} strokeWidth={1.6} style={{ opacity: 0.7 }} />
          <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{lang === "en" ? "EN" : "ع"}</span>
        </button>
      </div>

      <button type="button" className="ir3-skip" data-testid="guest-envelope-skip" onClick={skip} aria-label="Skip invitation animation" style={skipStyle(P)}>
        Skip <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>›</span>
      </button>

      {/* The 1200x850 artboard, centred in the viewport. The envelope is drawn
          larger than it on every side and is meant to be cropped — full-bleed
          paper running off the screen, not a card sitting in the middle of
          it. */}
      <div className="ir3-artboard">
        <div className="ir3-layer ir3-paper ir3-fr"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-paper ir3-fl"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-paper ir3-fb"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapPlain} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-paper ir3-ft"><span className="ir3-atom"><img src={REVEAL_ASSETS.flapDeco} alt="" aria-hidden="true" /></span></div>
        <div className="ir3-layer ir3-fw"><span className="ir3-atom"><img src={REVEAL_ASSETS.flourish} alt="" aria-hidden="true" /></span></div>

        <button
          type="button"
          ref={sealRef}
          className="ir3-layer ir3-sl"
          onClick={openSeal}
          aria-label="Tap to open your invitation"
        >
          <span className="ir3-atom ir3-seal-face" aria-hidden="true">
            <img src={REVEAL_ASSETS.seal} alt="" />
            {/* The organizer's monogram, struck into the wax — the one thing
                here the reference bakes into its artwork and we don't. Drawn in
                the same 0–100 space as the seal image so it tracks it at every
                size. */}
            <SealMonogram text={sealText} fontSize={sealFontSize} />
          </span>
        </button>

        <div className="ir3-layer ir3-tx">{copy.tap}</div>
      </div>
    </motion.div>
  );
}

/* ─── shared styles ─── */
const overlayBase = {
  position: "fixed", inset: 0, zIndex: 1000, overflow: "hidden",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  fontFamily: "var(--font-sans)",
  padding: "max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))",
};
const skipStyle = (P) => ({
  position: "absolute", top: "max(16px, env(safe-area-inset-top))", insetInlineStart: 20, zIndex: 20,
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", minHeight: 44, borderRadius: 999,
  border: `1px solid ${alpha(P.gold, 0.4)}`, background: "rgba(255,255,255,.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  color: P.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", fontFamily: "var(--font-sans)",
});
const langChipStyle = (active, P) => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", minHeight: 44, borderRadius: 999,
  border: `1px solid ${alpha(P.gold, 0.35)}`, background: "rgba(255,255,255,.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  color: P.ink, fontSize: 13, fontFamily: "var(--font-sans)", cursor: active ? "pointer" : "default",
});

const REVEAL_CSS = `
.ir3-root{
  position:fixed; inset:0; z-index:1000; overflow:hidden;
  background:#fff;
  font-family:var(--font-sans);
  /* The query container every artboard breakpoint below is measured against.
     Full screen, this is the viewport and nothing changes; embedded, it is
     the preview box. */
  container-type:inline-size; container-name:ir3;
}
/* Embedded (dashboard preview): the same reveal, sized by its parent instead
   of by the window. Absolute rather than fixed so it fills the phone screen
   it is placed in, and out of the overlay z-layer so it cannot sit on top of
   dashboard chrome. */
.ir3-root.is-embedded{ position:absolute; z-index:1; }

/* The reference's artboard: a fixed 1200x850 coordinate space, centred in the
   viewport. Its own children are positioned in artboard px, so nothing here
   needs a viewport-relative unit.

   It deliberately does NOT clip, even though the reference's does: there the
   artboard is a page section and its 850px edge IS the edge of what you see,
   but here the overlay fills the screen, so clipping at 850 would draw a hard
   horizontal seam across the paper on any viewport taller than that. The
   equivalent of the reference's crop, for a full-screen overlay, is the
   viewport itself — which .ir3-root already clips to. */
.ir3-artboard{
  position:absolute; left:0; right:0; top:50%;
  height:${ARTBOARD_H}px; margin-top:${-ARTBOARD_H / 2}px;
  /* Held back until the artwork has decoded, so the envelope never appears
     half-drawn. The overlay itself is already opaque by then — the page
     underneath is covered from the first frame either way, which is why this
     can afford to wait.

     visibility, not opacity alone: an opacity:0 seal is still a focusable
     button, so a keyboard or screen-reader user could reach and press a seal
     that isn't on screen yet. visibility:hidden takes it out of the focus and
     accessibility trees too, and isn't transitioned here so it simply flips
     on once — this gate only ever opens. */
  opacity:0; visibility:hidden; transition:opacity .45s ease;
}
.ir3-root.is-ready .ir3-artboard{ opacity:1; visibility:visible; }

/* --mx/--my are what the open sequence animates; every layer starts at rest
   and the generated .is-open rules below supply that layer's own destination,
   duration, easing and delay. */
.ir3-layer{
  position:absolute; margin:0; padding:0; border:0;
  transform:translate(var(--mx,0px),var(--my,0px));
  /* These boxes are hundreds of px across and several of them are painted
     above the seal, so only the seal itself may take a pointer — otherwise
     the label's box alone would swallow taps along the seal's bottom edge. */
  pointer-events:none;
}
.ir3-atom{ display:block; width:100%; height:100%; }
/* object-fit:fill is deliberate, not an oversight: the reference paints these
   triangles at box sizes that do not match the artwork's own aspect ratio,
   and that stretch is part of how its envelope is shaped. */
.ir3-layer img{ display:block; width:100%; height:100%; object-fit:fill; }

.ir3-tx{
  color:#866739; text-align:center;
  font-family:var(--font-serif), Georgia, serif;
  font-size:20px; line-height:1.55; font-weight:400;
}
/* Arabic gets a face that actually has Arabic in it, and a touch more line
   height — naskh ascenders and descenders need the room. */
[dir="rtl"] .ir3-tx{ font-family:var(--font-serif-ar), Georgia, serif; line-height:1.75; }

/* border-radius on a button with no background sounds pointless — it matters
   because the FOCUS RING follows the border box. The seal is a round piece of
   wax inside a square 160x160 button, so without this any ring is drawn as a
   rectangle boxing the wax in, which reads as a stray outline rather than as
   focus. Round, it hugs the seal and looks deliberate. */
.ir3-sl{
  background:none; cursor:pointer; pointer-events:auto;
  border-radius:50%; -webkit-tap-highlight-color:transparent;
}
.ir3-seal-face{ position:relative; }
/* No circular clip on the wax: its silhouette is a hand-pressed wavy edge and
   the artwork carries its own transparency, so masking it to a circle would
   shave exactly the detail that makes it read as wax. */
.ir3-root.is-open .ir3-sl{ pointer-events:none; }

/* The seal breaking. Three beats, each carrying its own easing so the shape
   of the motion lives in the keyframes and the animation itself can stay
   linear — a single curve spread across multiple stops would be re-applied
   between every pair and come out lumpy.

     0 → 9%    presses IN, accelerating. Immediate, physical answer to the tap.
     9 → 40%   releases and blooms past its own size, on a long decelerate —
               the wax giving way.
     40 → 100% keeps swelling as it dissolves, so it reads as lifting toward
               the viewer rather than simply being switched off.

   Scale here overrides .ir3-layer's translate() entirely, which is fine: the
   seal is the one layer that never travels. */
@keyframes ir3-seal-break{
  0%   { transform:scale(1);     opacity:1;  animation-timing-function:cubic-bezier(.4,0,1,1); }
  9%   { transform:scale(.952);  opacity:1;  animation-timing-function:cubic-bezier(.16,.84,.44,1); }
  40%  { transform:scale(1.13);  opacity:.9; animation-timing-function:cubic-bezier(.33,0,.67,1); }
  100% { transform:scale(1.34);  opacity:0; }
}

/* On-brand gold focus rings on every interactive element in this overlay. */
.ir3-skip:focus-visible, .ir3-langchip:focus-visible, .ir3-sl:focus-visible{
  outline:2px solid var(--gold); outline-offset:3px;
}
/* The dialog is focused on open so the overlay is announced; it is a
   container, not a control, so it must never draw a ring of its own. */
.ir3-root:focus, .ir3-root:focus-visible{ outline:none; }

/* The two chips are translucent with a blur behind them. Anyone who has asked
   the OS for less transparency has asked for exactly that not to happen —
   and !important is needed because both carry inline styles. */
@media (prefers-reduced-transparency: reduce){
  .ir3-skip, .ir3-langchip{
    background:#fff !important;
    -webkit-backdrop-filter:none !important; backdrop-filter:none !important;
  }
}

/* Forced colours (Windows high contrast). The envelope itself is photography
   and survives untouched, but everything drawn in CSS loses its colour — most
   importantly the seal, which has no border of its own and would become an
   invisible target that the whole experience depends on finding. */
@media (forced-colors: active){
  .ir3-root{ background:Canvas !important; }
  .ir3-tx{ color:CanvasText !important; }
  .ir3-skip, .ir3-langchip{
    background:ButtonFace !important; color:ButtonText !important;
    border:1px solid ButtonBorder !important;
  }
  .ir3-sl{ outline:2px solid ButtonBorder; outline-offset:2px; border-radius:50%; }
  .ir3-skip:focus-visible, .ir3-langchip:focus-visible, .ir3-sl:focus-visible{
    outline:3px solid Highlight !important;
  }
}

/* Users who asked for reduced motion get the static fallback card above and
   never reach this stylesheet; this is belt-and-braces for anyone who flips
   the setting mid-reveal. */
@media (prefers-reduced-motion:reduce){
  .ir3-layer{
    transition-duration:.001ms !important; transition-delay:0s !important;
    animation-duration:.001ms !important; animation-delay:0s !important;
  }
}

${buildRotationCSS()}

${buildArtboardCSS()}

${buildMotionCSS()}

${buildToneCSS()}
`;
