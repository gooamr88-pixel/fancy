// Tiny self-contained sound-effect layer for the guest experience — no audio
// files, just a few short synthesized tones via the Web Audio API. Every call
// is best-effort: browsers that block audio (no prior user gesture, or no
// Web Audio support) simply produce silence, never an error.
//
// Browsers only allow audio after a real user gesture. We lazily create ONE
// AudioContext and "unlock" it the first time a sound is requested from
// inside a click handler; once unlocked it stays usable for later calls
// (e.g. a success chime fired from an async submit-completion effect),
// because the context itself — not each individual play — is what's gated.

let ctx = null;
function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(context, { freq, start, duration, type = 'sine', peak = 0.08 }) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A brighter, rising two-note "accept" chime — used when a guest picks "Yes". */
export function playAccept() {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    tone(c, { freq: 660, start: t, duration: 0.14, type: 'triangle', peak: 0.07 });
    tone(c, { freq: 880, start: t + 0.08, duration: 0.18, type: 'triangle', peak: 0.08 });
  } catch { /* silent */ }
}

/** A short descending two-note tone — deliberately the mirror image of
    playAccept's rising chime, so a check-in scanner rejection (already
    used / invalid ticket) is audibly distinct from a success, not just a
    variation of the same "positive" sound. */
export function playError() {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    tone(c, { freq: 392, start: t, duration: 0.16, type: 'sawtooth', peak: 0.06 });
    tone(c, { freq: 293.66, start: t + 0.1, duration: 0.22, type: 'sawtooth', peak: 0.06 });
  } catch { /* silent */ }
}

/** Fires a short haptic buzz on devices that support it — a no-op everywhere
    else (desktop, iOS Safari), so it's always safe to call. */
export function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported — fine */ }
}
