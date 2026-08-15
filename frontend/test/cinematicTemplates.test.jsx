import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

/* framer-motion's useReducedMotion caches its matchMedia result in module
   scope on first call, so overriding window.matchMedia inside a test never
   reaches it once another test has already initialised it. Substituting the
   one hook keeps every other framer-motion export real and makes the
   reduced-motion path deterministic. */
let reducedMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reducedMotion };
});

import VelvetBoxOpening from '../src/app/components/guest/openings/VelvetBoxOpening';
import KnockDoorOpening from '../src/app/components/guest/openings/KnockDoorOpening';
import { watchOpeningVideo, OPENING_TIMINGS } from '../src/app/components/guest/openings/openingSafety';
import { CINEMATIC_TEMPLATES, getCinematicTemplate, CINEMATIC_KEYS } from '../src/app/components/templates/cinematic/cinematicThemes';
import { TEMPLATES, TEMPLATE_PREVIEW_PATTERN } from '../src/app/utils/curatedTemplates';
import { buildPalette } from '../src/app/components/templates/heritageArch/theme';

/* ═══════════════════════════════════════════════════════════════════════════
   The cinematic templates — Velvet Ring and Door of Joy.

   These are contract tests, not appearance tests (jsdom lays out nothing and
   decodes no video). What they pin down is the behaviour that has no visual
   tell until it fails in front of a guest:

     • the guest ALWAYS gets through the opening, whatever the video does
     • the reveal contract (`reveal_replay`, reduced motion) matches the
       envelope's, since the two are interchangeable at the same call site
     • no trace of the source platform survives in the output

   Appearance is covered by the screenshot pass — see the plan.
   ═══════════════════════════════════════════════════════════════════════════ */

const RING = CINEMATIC_TEMPLATES.ring;
const BAB = CINEMATIC_TEMPLATES.bab;

/** jsdom implements no media methods at all; these are the ones we touch. */
function stubMediaElements({ play = () => Promise.resolve() } = {}) {
  window.HTMLMediaElement.prototype.play = vi.fn(play);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
}

beforeEach(() => {
  reducedMotion = false;
  stubMediaElements();
  // AudioContext: the door opening builds one at mount to decode its samples.
  window.AudioContext = vi.fn(() => ({
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    resume: () => Promise.resolve(),
    close: () => {},
    createOscillator: () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 }, connect: () => ({ connect: () => {} }), start() {}, stop() {} }),
    createGain: () => ({ gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect: () => {} }) }),
    createBiquadFilter: () => ({ type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect: () => ({ connect: () => {} }) }),
    createBufferSource: () => ({ buffer: null, playbackRate: { value: 1 }, connect: () => ({ connect: () => {} }), start() {} }),
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    decodeAudioData: () => Promise.reject(new Error('no decoder in jsdom')),
    destination: {},
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

/* ════════════════════════════════════════════════════════════════════
   1. The guest always gets in
   ════════════════════════════════════════════════════════════════════ */
describe('cinematic openings — the guest always gets through', () => {
  it('velvet box: a video that never produces a frame still opens the invitation', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    render(<VelvetBoxOpening template={RING} names="Aria & Julian" onComplete={onComplete} />);

    // Readiness is armed by the 7s hard arm even though jsdom fires no
    // canplay — this is the rung that stops a tap being ignored forever.
    await act(async () => { vi.advanceTimersByTime(OPENING_TIMINGS.readyHardArmMs + 10); });
    fireEvent.click(screen.getByTestId('cine-opening-tap'));

    // Nothing ever plays. The 6s never-started rung takes the stills path,
    // which finishes on its own.
    await act(async () => { vi.advanceTimersByTime(20000); });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('velvet box: a frozen video is detected on the wall clock and revealed anyway', async () => {
    // The failure no event reports: currentTime stops advancing, `playing`
    // already fired, no `error`, no `ended`. Without the watchdog the guest
    // sits on a half-open box until the 14s ceiling.
    const video = {
      currentTime: 1.0,
      listeners: {},
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      removeEventListener() {},
      pause() {},
      emit(type) { (this.listeners[type] || []).forEach((fn) => fn()); },
    };

    vi.useFakeTimers();
    const onReveal = vi.fn();
    const onFallback = vi.fn();
    watchOpeningVideo(video, { revealAt: 4.35, onReveal, onFallback });

    video.emit('playing');
    // Advance well past the frozen window while currentTime never moves.
    vi.advanceTimersByTime(OPENING_TIMINGS.frozenWindowMs + OPENING_TIMINGS.pollMs * 4);

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onFallback).not.toHaveBeenCalled();
    // Never both, and never twice.
    vi.advanceTimersByTime(OPENING_TIMINGS.absoluteCeilingMs);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('velvet box: a video that plays normally reveals at the configured frame', () => {
    const video = {
      currentTime: 0.1,
      listeners: {},
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      removeEventListener() {},
      pause() {},
      emit(type) { (this.listeners[type] || []).forEach((fn) => fn()); },
    };

    vi.useFakeTimers();
    const onReveal = vi.fn();
    watchOpeningVideo(video, { revealAt: RING.revealAtSeconds, onReveal, onFallback: vi.fn() });
    video.emit('playing');

    // Still short of the reveal frame — nothing yet.
    video.currentTime = 3.0;
    vi.advanceTimersByTime(OPENING_TIMINGS.pollMs * 2);
    expect(onReveal).not.toHaveBeenCalled();

    video.currentTime = RING.revealAtSeconds + 0.01;
    vi.advanceTimersByTime(OPENING_TIMINGS.pollMs * 2);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('door of joy: three knocks open it; fewer do not', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<KnockDoorOpening template={BAB} names="Mohammed & Zainab" onComplete={onComplete} />);

    const tap = screen.getByTestId('cine-opening-tap');
    fireEvent.pointerDown(tap);
    fireEvent.pointerDown(tap);
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.pointerDown(tap);
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('door of joy: the knock dots track progress', () => {
    const { container } = render(<KnockDoorOpening template={BAB} names="A & B" onComplete={vi.fn()} />);
    const dots = () => container.querySelectorAll('.cine-door__dot.is-hit');

    expect(dots()).toHaveLength(0);
    fireEvent.pointerDown(screen.getByTestId('cine-opening-tap'));
    expect(dots()).toHaveLength(1);
    fireEvent.pointerDown(screen.getByTestId('cine-opening-tap'));
    expect(dots()).toHaveLength(2);
  });
});

/* ════════════════════════════════════════════════════════════════════
   2. The same reveal contract as the envelope
   ════════════════════════════════════════════════════════════════════ */
describe('cinematic openings — reveal contract', () => {
  it('reduced motion completes without ever calling play()', async () => {
    reducedMotion = true;
    vi.useFakeTimers();
    const onComplete = vi.fn();

    render(<VelvetBoxOpening template={RING} names="Aria & Julian" onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId('cine-opening-tap'));
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('a sessionKey lets a returning guest straight through', async () => {
    window.sessionStorage.setItem('cine-opening:my-event', '1');
    const onComplete = vi.fn();

    await act(async () => {
      render(<VelvetBoxOpening template={RING} names="A & B" sessionKey="my-event" onComplete={onComplete} />);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('no sessionKey means the opening replays every visit', async () => {
    const onComplete = vi.fn();
    await act(async () => {
      render(<VelvetBoxOpening template={RING} names="A & B" sessionKey={null} onComplete={onComplete} />);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('the opening fires the caller-supplied gesture hook synchronously on the tap', async () => {
    // iOS grants audio permission to the gesture's own call stack. If this
    // ever moves into a timeout or a promise, music stops working on iPhones
    // and nothing else changes — so the synchronicity is the assertion.
    const onGesture = vi.fn();
    vi.useFakeTimers();

    render(<VelvetBoxOpening template={RING} names="A & B" onComplete={vi.fn()} onGesture={onGesture} />);
    await act(async () => { vi.advanceTimersByTime(OPENING_TIMINGS.readyHardArmMs + 10); });

    fireEvent.click(screen.getByTestId('cine-opening-tap'));
    expect(onGesture).toHaveBeenCalledTimes(1);
  });

  it('door of joy preloads its hero video on the FIRST knock, not the third', () => {
    const onFirstKnock = vi.fn();
    render(<KnockDoorOpening template={BAB} names="A & B" onComplete={vi.fn()} onFirstKnock={onFirstKnock} />);

    fireEvent.pointerDown(screen.getByTestId('cine-opening-tap'));
    expect(onFirstKnock).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(screen.getByTestId('cine-opening-tap'));
    expect(onFirstKnock).toHaveBeenCalledTimes(1);
  });
});

/* ════════════════════════════════════════════════════════════════════
   3. Registration and palettes
   ════════════════════════════════════════════════════════════════════ */
describe('cinematic templates — registration', () => {
  it('both are selectable in the organizer picker', () => {
    const keys = TEMPLATES.map((t) => t.key);
    expect(keys).toContain('ring');
    expect(keys).toContain('bab');
  });

  it('every registered cinematic key has a card pattern and a definition', () => {
    CINEMATIC_KEYS.forEach((key) => {
      expect(TEMPLATE_PREVIEW_PATTERN[key], `${key} has no invitation-card pattern`).toBeTruthy();
      const tpl = getCinematicTemplate(key);
      expect(tpl.assets.poster).toMatch(/^\/templates\//);
      expect(tpl.assets.video).toMatch(/^\/templates\//);
      expect(tpl.copy.en).toBeTruthy();
      expect(tpl.copy.ar).toBeTruthy();
    });
  });

  it('each ships every CSS custom property cinematic.css reads', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/styles/cinematic.css'), 'utf8');
    const used = new Set([...css.matchAll(/var\((--cine-[a-z-]+)/g)].map((m) => m[1]));
    // Set by the pool per-particle rather than by the theme.
    used.delete('--cine-blush');

    CINEMATIC_KEYS.forEach((key) => {
      const declared = new Set(Object.keys(getCinematicTemplate(key).cssVars));
      const missing = [...used].filter((v) => !declared.has(v));
      expect(missing, `${key} never sets ${missing.join(', ')}`).toEqual([]);
    });
  });

  it('sections recolor from the template palette when the event has no custom colors', () => {
    // An event created through the API, or before the organizer opened the
    // colour picker, must still look like the template it claims to be.
    const ringPalette = buildPalette({}, 'ring');
    expect(ringPalette.background).toBe(RING.colors.background);

    const babPalette = buildPalette({}, 'bab');
    expect(babPalette.background).toBe(BAB.colors.background);

    // An organizer's own choice still wins.
    const chosen = buildPalette({ background: '#123456' }, 'ring');
    expect(chosen.background).toBe('#123456');
  });

  it('non-cinematic templates are untouched by the fallback', () => {
    expect(getCinematicTemplate('wedding')).toBeNull();
    expect(getCinematicTemplate('custom')).toBeNull();
    expect(buildPalette({}, 'heritageArch').background).toBeTruthy();
  });
});

/* ════════════════════════════════════════════════════════════════════
   4. Nothing from the source platform survives
   ════════════════════════════════════════════════════════════════════ */
describe('cinematic templates — no third-party residue', () => {
  const SOURCE_DIR = 'src/app/components';
  const FORBIDDEN = [
    'da3wa',              // the source platform's own namespace
    'connect.facebook.net',
    'googletagmanager',
    'fonts.googleapis.com', // must be self-hosted — a blocked font host hangs the invitation
  ];

  function filesUnder(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(full);
      return entry.name.endsWith('.js') || entry.name.endsWith('.css') ? [full] : [];
    });
  }

  it('the cinematic and opening sources are clean', () => {
    const roots = [
      path.join(process.cwd(), SOURCE_DIR, 'templates/cinematic'),
      path.join(process.cwd(), SOURCE_DIR, 'guest/openings'),
      path.join(process.cwd(), SOURCE_DIR, 'guest/fx'),
    ];
    const offenders = [];
    roots.flatMap(filesUnder).forEach((file) => {
      const text = fs.readFileSync(file, 'utf8').toLowerCase();
      FORBIDDEN.forEach((needle) => {
        if (text.includes(needle)) offenders.push(`${path.basename(file)} contains "${needle}"`);
      });
    });
    expect(offenders).toEqual([]);
  });

  it('cinematic.css declares no bare element rule and never reuses the fx- prefix', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'src/app/styles/cinematic.css'), 'utf8');
    // Comments stripped first: the file's own header explains why the prefix
    // is `cine-` and names .fx-layer / .fx-section as the collisions it is
    // avoiding. Matching the prose would fail the check the prose describes.
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

    // A bare html/body/* rule here would leak into every page that imports
    // globals.css — this stylesheet must only ever reach its own subtree.
    const bare = css.match(/^\s*(html|body|\*)\s*(,|\{)/gm) || [];
    expect(bare).toEqual([]);

    // .fx-* belongs to the responsive primitives in globals.css. A collision
    // would break layout silently in both directions.
    const selectors = css.match(/\.fx-[a-z-]+/g) || [];
    expect(selectors).toEqual([]);
  });

  it('uses no color-mix(), whose absence silently deletes whole declarations', () => {
    /* color-mix is unsupported below Safari 16.2 / Chrome 111, and an
       unsupported function invalidates the ENTIRE declaration rather than
       just that colour. The Velvet Ring hero scrim is one gradient built from
       five of them: losing it drops the couple's names onto bare photography
       with no contrast, on exactly the older handsets least able to cope, and
       nothing errors. rgba(var(--x-rgb), a) has no such cliff. */
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/styles/cinematic.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toContain('color-mix');
  });

  it('every --cine-*-rgb the stylesheet reads is a real channel triplet', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/styles/cinematic.css'), 'utf8');
    const used = new Set([...css.matchAll(/var\((--cine-[a-z-]+-rgb)\)/g)].map((m) => m[1]));
    CINEMATIC_KEYS.forEach((key) => {
      const vars = getCinematicTemplate(key).cssVars;
      used.forEach((name) => {
        expect(vars[name], `${key} never sets ${name}`).toBeTruthy();
        // "r, g, b" — anything else produces an invalid rgba() and the same
        // silent dropped-declaration failure color-mix caused.
        expect(vars[name]).toMatch(/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/);
      });
    });
  });

  it('every media condition sits on the four-value breakpoint scale', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/styles/cinematic.css'), 'utf8');
    const widths = [...css.matchAll(/\((?:max|min)-width:\s*([0-9.]+)px\)/g)].map((m) => m[1]);
    const allowed = ['639.98', '640', '767.98', '768', '1023.98', '1024', '1279.98', '1280'];
    widths.forEach((w) => expect(allowed, `${w}px is off the scale`).toContain(w));
  });
});

/* ════════════════════════════════════════════════════════════════════
   5. The modules this work rewired still load
   ════════════════════════════════════════════════════════════════════ */
describe('rewired modules still load', () => {
  /* Wiring the two templates in meant editing the guest router, the page
     engine and the hero it used to always render — three files no test
     imports, in a repo with no typecheck and no lint step. A stale import or
     a dangling identifier in any of them is a blank invitation for every
     guest on every template, and nothing else here would catch it. Importing
     them executes their module scope, which is exactly what that class of
     mistake breaks. */
  it.each([
    ['EventPageClient', () => import('../src/app/[slug]/EventPageClient')],
    ['HeritageArchPage', () => import('../src/app/components/templates/heritageArch/HeritageArchPage')],
    ['HeroSection', () => import('../src/app/components/templates/heritageArch/sections/HeroSection')],
    ['theme', () => import('../src/app/components/templates/heritageArch/theme')],
    ['MobilePreview', () => import('../src/app/components/templates/MobilePreview')],
    ['AmbientFx', () => import('../src/app/components/guest/fx/AmbientFx')],
    ['HeroCardDownload', () => import('../src/app/components/templates/cinematic/HeroCardDownload')],
    ['curatedTemplates', () => import('../src/app/utils/curatedTemplates')],
  ])('%s imports cleanly', async (_name, load) => {
    const mod = await load();
    expect(mod).toBeTruthy();
  });
});

/* ════════════════════════════════════════════════════════════════════
   6. The retired hero-video upload leaves nothing behind
   ════════════════════════════════════════════════════════════════════ */
describe('organizer hero-video upload — fully retired', () => {
  it('no source file still references it', () => {
    function walk(dir) {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.(js|jsx|css)$/.test(entry.name) ? [full] : [];
      });
    }
    const offenders = walk(path.join(process.cwd(), 'src')).filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return /HeroVideoBackground|ha_hero_video_url|heroVideoUploading|HERO_VIDEO_MAX/.test(text);
    });
    expect(offenders.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });
});
