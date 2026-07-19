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
  custom: 'custom',
};
