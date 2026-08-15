'use client';

/* ═══════════════════════════════════════════════════════════════
   A pooled particle emitter.

   Three constraints shape this, all of them about a mid-range phone holding
   60fps while an invitation is also decoding video and laying out a page:

     • HARD CAP. Never more than `max` particles alive at once. A burst
       fired while the ambient drift is already saturated is dropped, not
       queued — a dropped sparkle is invisible, a stuttering page is not.
     • SELF-REAPING. Each particle removes itself on `animationend`, so
       there is no sweep interval and no leak if one is orphaned mid-flight.
     • COMPOSITOR ONLY. Position arrives as the custom properties --x/--y
       and --tx/--ty which the keyframes in cinematic.css interpolate through
       transform. Nothing here touches top/left, so nothing triggers layout.

   Deliberately imperative and framework-free: these elements are created and
   destroyed dozens of times a second and must never enter React's tree.
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_MAX = 40;

export function createFxPool(layer, { max = DEFAULT_MAX } = {}) {
  let live = 0;
  let destroyed = false;

  function spawn(kind, x, y, opts = {}) {
    if (destroyed || !layer || live >= max) return;

    const el = document.createElement('span');
    el.className = `cine-p cine-p--${kind}`;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    if (opts.tx != null) el.style.setProperty('--tx', `${opts.tx}px`);
    if (opts.ty != null) el.style.setProperty('--ty', `${opts.ty}px`);
    if (opts.duration) el.style.animationDuration = `${opts.duration}s`;
    if (opts.size) { el.style.width = `${opts.size}px`; el.style.height = `${opts.size}px`; }
    if (opts.fontSize) el.style.fontSize = `${opts.fontSize}px`;
    if (opts.color) el.style.color = opts.color;
    if (opts.text) el.textContent = opts.text;

    live += 1;
    el.addEventListener('animationend', () => {
      live -= 1;
      el.remove();
    }, { once: true });

    layer.appendChild(el);
  }

  /* Radiating gold — the moment something opens. Flattened vertically and
     lifted, so it reads as light thrown off a surface rather than a
     firework. */
  function burstSparks(x, y, count = 16, spread = 150) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const radius = spread * (0.55 + Math.random() * 0.65);
      spawn('spark', x, y, {
        tx: x + Math.cos(angle) * radius,
        ty: y + Math.sin(angle) * radius * 0.85 - 24,
      });
    }
  }

  /* Petals fall from above the origin, not from it — they should already be
     in motion by the time they cross the point of interest. */
  function burstPetals(x, y, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const startX = x + (Math.random() - 0.5) * 140;
      spawn('petal', startX, y - 30 - Math.random() * 40, {
        tx: startX + (Math.random() - 0.5) * 120,
        ty: y + 180 + Math.random() * 160,
        duration: 2.2 + Math.random() * 1.6,
      });
    }
  }

  /* The easter egg. Hearts thrown upward in a fan, with a twinkle every
     third so the cluster has some light in it. */
  function burstHearts(x, y) {
    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI * (0.15 + Math.random() * 0.7);
      const radius = 46 + Math.random() * 60;
      spawn(i % 3 === 2 ? 'twinkle' : 'heart', x, y, {
        tx: x + Math.cos(angle) * radius,
        ty: y + Math.sin(angle) * radius,
        duration: 1 + Math.random() * 0.5,
      });
    }
  }

  /* One drifting bloom, released from above the fold and falling past it.
     `glyphs` turns these into typographic flowers (Door of Joy); without it
     they are the drawn petal shape (Velvet Ring). */
  function driftPetal(viewportWidth, viewportHeight, glyphs) {
    const x = Math.random() * viewportWidth;
    const glyph = glyphs?.length ? glyphs[Math.floor(Math.random() * glyphs.length)] : null;
    spawn(glyph ? 'bloom' : 'petal', x, -20, {
      tx: x + (Math.random() - 0.5) * 160,
      ty: viewportHeight + 40,
      duration: 7 + Math.random() * 4,
      text: glyph || undefined,
      fontSize: glyph ? 10 + Math.random() * 15 : undefined,
    });
  }

  function trailSparkle(x, y) {
    spawn('twinkle', x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14, {
      size: 6 + Math.random() * 7,
    });
  }

  return {
    spawn,
    burstSparks,
    burstPetals,
    burstHearts,
    driftPetal,
    trailSparkle,
    get liveCount() { return live; },
    destroy() {
      destroyed = true;
      if (layer) layer.textContent = '';
      live = 0;
    },
  };
}
