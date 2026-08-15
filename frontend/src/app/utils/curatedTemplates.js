/**
 * The three real, currently-selectable event templates — the single source
 * of truth shared by the create-event wizard (Stage1_TemplatesSimulator) and
 * the public /templates marketing gallery. Previously the two lived
 * independently: the wizard's real picker (this array) and the public
 * gallery's own hand-authored list of 16 "templates" (Timeless Elegance,
 * Marrakesh Nights, Kyoto Blossom, etc.) that don't correspond to anything a
 * visitor can actually select at signup — those 13 extra invitation-card
 * *patterns* still render for existing events, but were retired from the
 * picker (see below), so showcasing them as choosable products was
 * misleading. Importing from one place means the two can never drift apart
 * again.
 *
 * All three templates share the same full-page guest experience (see
 * FULL_PAGE_TEMPLATES in EventPageClient.js) with every optional section
 * (story, schedule, venues, accommodation, menu, gift list, FAQ, gallery,
 * dress code, things-to-do, getting-there, invited-to-city)
 * available and independently toggleable — see the "Sections" panel in
 * Stage 2 and enabledSections in HeritageArchPage. Wedding & Engagement
 * additionally expose full custom color pickers (not just the curated
 * presets below) so every template gets equal design, color, and content
 * control.
 */
export const TEMPLATES = [
  {
    key: 'wedding', label: 'Royale Wedding', tier: 'Wedding',
    tagline: 'Cinematic · Gold',
    desc: 'A high-end, cinematic wedding invitation with glassmorphism, elegant gold accents and a dynamic reveal — comparable to premium invitation platforms.',
    presets: [
      { name: 'Royale Gold', primary: '#B8944F', secondary: '#D7BE80', accent: '#B8944F', background: '#FFFDF7' },
      { name: 'Emerald Ivy', primary: '#1B6B3A', secondary: '#A3D5A5', accent: '#1B6B3A', background: '#F5FAF7' },
      { name: 'Burgundy Velvet', primary: '#800020', secondary: '#F2C9D0', accent: '#800020', background: '#FFF8F9' },
    ],
    specs: ['Cinematic Envelope Reveal', 'Modern Glassmorphism', 'Gold Accents', 'RSVP + Meal Selection', 'Every Section Toggleable'],
    fields: ['Partner Names', 'Love Story', 'Ceremony & Reception', 'Gift Registry'],
  },
  {
    // A duplicate of the Wedding theme — same cinematic envelope reveal and
    // "serif" invitation card artwork/layout (see TEMPLATE_PREVIEW_PATTERN
    // below and INVITATION_PATTERN_BY_TEMPLATE in EventPageClient.js) — with
    // copy adapted for an engagement instead of a wedding day.
    key: 'engagement', label: 'Eternal Love', tier: 'Engagement',
    tagline: 'Cinematic · Gold',
    desc: 'The same high-end, cinematic invitation as Royale Wedding — glassmorphism, elegant gold accents, and a dynamic reveal — with every detail worded for your engagement instead of your wedding day.',
    presets: [
      { name: 'Blush Gold', primary: '#D4A574', secondary: '#F5E6D3', accent: '#D4A574', background: '#FFFCF8' },
      { name: 'Champagne Sparkle', primary: '#C5A059', secondary: '#FDF0CD', accent: '#C5A059', background: '#FFFDF5' },
      { name: 'Sage Garden', primary: '#6B8E6B', secondary: '#D5E8D5', accent: '#6B8E6B', background: '#F8FAF8' },
    ],
    specs: ['Cinematic Envelope Reveal', 'Modern Glassmorphism', 'Gold Accents', 'Interactive RSVP', 'Every Section Toggleable'],
    fields: ['Partner Names', 'Proposal Story', 'Gift Registry'],
  },
  /* ── The cinematic pair ──────────────────────────────────────────────
     These two differ from the three above in exactly one place: the
     opening and the hero. A guest taps a velvet box or knocks on a door
     instead of breaking a wax seal, and the fold is photographic rather
     than stationery. Everything below the fold is the same full-page
     engine, the same organizer-configured sections, and the same RSVP —
     recoloured to each one's palette. See components/templates/cinematic/.

     Their presets lead with the template's native palette, because that is
     the colour story the photography was shot in; the alternates are there
     for organizers who want to shift it, not because the first is a
     placeholder. */
  {
    key: 'ring', label: 'Velvet Ring', tier: 'Engagement',
    tagline: 'Cinematic · Velvet & Gold',
    desc: 'A velvet ring box on a darkened stage. Your guests touch it, the lid opens on film, and the invitation dissolves out of the light — then the whole page carries gold dust and drifting petals as they scroll.',
    presets: [
      { name: 'Velvet Rose', primary: '#8f3c52', secondary: '#d4af6a', accent: '#d4af6a', background: '#2a100b' },
      { name: 'Midnight Gold', primary: '#6b3b5a', secondary: '#e0c07d', accent: '#e0c07d', background: '#1d0f18' },
      { name: 'Deep Garnet', primary: '#7d2438', secondary: '#c9973f', accent: '#c9973f', background: '#25090c' },
    ],
    specs: ['Cinematic Box Opening', 'Gold Dust & Petals Throughout', 'Arabic Display Typography', 'Interactive RSVP', 'Every Section Toggleable'],
    fields: ['Partner Names', 'Proposal Story', 'Gift Registry'],
  },
  {
    key: 'bab', label: 'Door of Joy', tier: 'Wedding',
    tagline: 'Cinematic · Wood & Lilac',
    desc: 'A carved door your guests knock on three times — it answers, swings open on the light beyond, and doves lift from the garden gate behind your names. Blossom drifts down the page as they read.',
    presets: [
      { name: 'Lilac Bloom', primary: '#7d5694', secondary: '#c9a45c', accent: '#a97fc0', background: '#f6f1e4' },
      { name: 'Olive Courtyard', primary: '#5c6b4a', secondary: '#c9a45c', accent: '#7d8f66', background: '#f4f1e2' },
      { name: 'Rose Stone', primary: '#9c5a63', secondary: '#c9a45c', accent: '#c98a93', background: '#f8f2ea' },
    ],
    specs: ['Knock-to-Enter Opening', 'Sound & Haptics', 'Living Hero Video', 'Arabic Display Typography', 'Every Section Toggleable'],
    fields: ['Partner Names', 'Love Story', 'Ceremony & Reception', 'Gift Registry'],
  },
  {
    key: 'custom', label: 'Custom Canvas', tier: 'Build your own',
    tagline: 'Fully editable',
    desc: 'A clean slate for any occasion — wedding, engagement, birthday, baby shower, or something entirely your own. Choose your colors, typography and cover image, then build the page section by section from the same full feature set every curated template shares.',
    presets: [
      { name: 'Clean Linen', primary: '#8B7355', secondary: '#D4C5A9', accent: '#8B7355', background: '#FAF8F5' },
      { name: 'Warm Cream', primary: '#A0845C', secondary: '#E8D5B7', accent: '#A0845C', background: '#FFFCF5' },
      { name: 'Obsidian Slate', primary: '#475569', secondary: '#94A3B8', accent: '#475569', background: '#F8FAFC' },
    ],
    specs: ['Editable Colors & Fonts', 'Custom Cover Image', 'Every Feature, Toggle Anything', 'Full-Page Guest Experience'],
    fields: ['Any Section You Choose'],
  },
];

/** Curated InvitationCard preview pattern + fallback accent per real template key. */
export const TEMPLATE_PREVIEW_PATTERN = {
  wedding: 'serif',
  engagement: 'serif',
  // The cinematic pair keep their own hero photography rather than showing a
  // stationery card at the fold, but the card still exists — it is what the
  // "Save the invitation" button captures (see cinematic/HeroCardDownload.js)
  // — so it needs a pattern like every other template.
  ring: 'serif',
  bab: 'serif',
  custom: 'custom',
};
