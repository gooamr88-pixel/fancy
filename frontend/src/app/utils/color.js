// Small dependency-free color-mixing helpers used to derive a full tonal
// palette (light washes, deep shadows, bright highlights) from a single
// organizer-chosen accent color, so shared guest-experience chrome (the
// envelope, the RSVP shell) can feel bespoke to any event theme instead of
// hardcoding one fixed palette.

function hexToRgb(hex) {
  const h = (hex || '#B8944F').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix a hex color toward white by `amount` (0 = unchanged, 1 = white). */
export function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Mix a hex color toward black by `amount` (0 = unchanged, 1 = black). */
export function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Linear-interpolate between two hex colors, t in [0, 1]. */
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}
