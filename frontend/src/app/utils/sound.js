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

/** A soft, short "pop" — used for lightweight taps (maybe/no, form steps). */
export function playTap() {
  const c = getCtx();
  if (!c) return;
  try { tone(c, { freq: 520, start: c.currentTime, duration: 0.09, type: 'sine', peak: 0.05 }); } catch { /* silent */ }
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

/** A rising sweep + sparkle — used once, the instant the wax seal is tapped
    and starts to melt open. */
export function playSealOpen() {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    // Rising sweep — a single oscillator gliding upward, like the light beam igniting.
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.55);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.62);
    // A trailing sparkle chime as the light blooms.
    tone(c, { freq: 1318.5, start: t + 0.45, duration: 0.35, type: 'triangle', peak: 0.05 });
    tone(c, { freq: 1760, start: t + 0.55, duration: 0.35, type: 'triangle', peak: 0.04 });
  } catch { /* silent */ }
}

/** A short triumphant ascending arpeggio — used once, on final RSVP success. */
export function playCelebration() {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      tone(c, { freq, start: t + i * 0.09, duration: 0.28, type: 'triangle', peak: 0.075 });
    });
  } catch { /* silent */ }
}
