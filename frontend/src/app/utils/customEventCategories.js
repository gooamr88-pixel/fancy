/* ═══════════════════════════════════════════════════════════════
   THE OCCASION CATALOGUE — what kind of event this is.

   Single source of truth for the organizer's picker and field copy AND for
   the guest-facing hero title/tagline/badge and every opening's kicker, so
   the two can never drift out of sync.

   ── This is no longer "Custom Canvas's picker" ────────────────────────────
   It used to be: every other template WAS an occasion (Velvet Ring was an
   engagement, Door of Joy a wedding) and only Custom Canvas asked. That made
   the artwork and the occasion the same decision, so an organizer who wanted
   the knocking-door film for a birthday simply could not have it.

   Now the template decides how the invitation LOOKS and this decides what the
   event IS. Every template shows this picker; `template_data.custom_category`
   stores the answer for all of them; and a template only supplies the DEFAULT
   (see `defaultOccasion` in cinematic/cinematicThemes.js), which is what keeps
   every event created before this change rendering exactly as it did.

   `kind` decides which fields the organizer fills in and how the hero reads:
     'couple'      — the partner1/partner2 fields.
     'honoree'     — generic "who + what's the occasion"
                     (custom_honoree / custom_milestone), copy tailored below.
     'babyShower'  — its own parent/baby-name/due-date fields.

   `key` doubles as the icon name passed to <EventCategoryIcon name={key} />
   (see components/icons/EventCategoryIcon.js) — every key below has a
   matching hand-drawn icon, so no separate icon field is needed here.

   `inviteLabel` / `inviteLabelAr` are OPTIONAL overrides for the kicker that
   sits above the couple's names on the cover. It is built mechanically from
   `label` (see occasionKicker below), which is right for most of these —
   only the ones that read badly as "<label> Invitation" carry an override.

   `taglineEn` / `taglineAr` are the hero line under the names for the
   'couple' kinds. The 'honoree' kinds build theirs from custom_milestone
   instead, so they need none.
   ═══════════════════════════════════════════════════════════════ */
export const CUSTOM_CATEGORIES = [
  /* Wedding carries NO tagline on purpose. It is the one couple occasion whose
     hero is meant to fall through — to the template's own line (Door of Joy's
     "We have opened the door to our joy") or, off the cinematic templates, to
     HeroSection's built-in couple default. Giving it one here would silently
     outrank both. */
  { key: 'wedding', label: 'Wedding', labelAr: 'زفاف', kind: 'couple' },
  {
    key: 'engagement', label: 'Engagement', labelAr: 'خطوبة', kind: 'couple',
    // HeroSection's couple default is "We are getting married", which is wrong
    // for two people who are not married yet.
    taglineEn: 'We Are Getting Engaged',
    taglineAr: 'تمت خطوبتنا!',
  },
  {
    key: 'birthday', label: 'Birthday', labelAr: 'عيد ميلاد', kind: 'honoree',
    honoreeLabel: "Who's the birthday star?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sarah',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Turning 30',
  },
  {
    key: 'bridalShower', label: 'Bridal Shower', labelAr: 'حفل توديع العزوبية', kind: 'honoree',
    honoreeLabel: "Who's the bride-to-be?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sarah',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Bridal Shower Brunch',
  },
  {
    key: 'anniversary', label: 'Anniversary', labelAr: 'ذكرى سنوية', kind: 'honoree',
    honoreeLabel: "Who's celebrating?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. John & Mary',
    milestoneLabel: "What's the milestone?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. 25th Anniversary',
  },
  {
    key: 'graduation', label: 'Graduation', labelAr: 'حفل تخرج', kind: 'honoree',
    honoreeLabel: "Who's graduating?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Alex',
    milestoneLabel: 'What are they celebrating?', milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Class of 2026',
  },
  {
    key: 'corporate', label: 'Corporate Event', labelAr: 'فعالية رسمية', kind: 'honoree',
    // "Corporate Event Invitation" doubles the word; "Invitation" is enough.
    inviteLabel: 'Invitation',
    honoreeLabel: 'Company / team name', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Acme Inc.',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Annual Kickoff',
  },
  {
    key: 'gala', label: 'Gala / Fundraiser', labelAr: 'حفل خيري', kind: 'honoree',
    // A slashed label cannot be pasted into a sentence.
    inviteLabel: 'Gala Invitation',
    honoreeLabel: 'Event / cause name', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Hope Foundation Gala',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. 10th Annual Fundraiser',
  },
  {
    key: 'celebration', label: 'Celebration', labelAr: 'احتفال', kind: 'honoree',
    honoreeLabel: "Who's being celebrated?", honoreeHint: 'Shown as the name on your guest page — a person, a couple, or a family',
    honoreePlaceholder: 'e.g. Sarah, or The Martinez Family',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name, e.g. Turning 30, 10th Anniversary',
    milestonePlaceholder: 'e.g. Turning 30',
  },
  { key: 'babyShower', label: 'Baby Shower', labelAr: 'استقبال المولود', kind: 'babyShower' },
  {
    key: 'bachelorParty', label: 'Bachelor(ette) Party', labelAr: 'حفلة العزوبية', kind: 'honoree',
    // The parenthetical belongs in a picker, not over the guest's names.
    inviteLabel: 'Party Invitation',
    honoreeLabel: "Who's the guest of honor?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sarah',
    milestoneLabel: "What's the celebration?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Bachelorette Weekend',
  },
  {
    key: 'quinceanera', label: 'Quinceañera / Sweet 16', labelAr: 'كينسينيرا / السادسة عشرة', kind: 'honoree',
    // A slashed label cannot be pasted into a sentence.
    inviteLabel: 'Celebration Invitation', inviteLabelAr: 'دعوة احتفال',
    honoreeLabel: "Who's celebrating?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sofia',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Quinceañera',
  },
  {
    key: 'barMitzvah', label: 'Bar/Bat Mitzvah', labelAr: 'بار متزفا', kind: 'honoree',
    // The picker can offer both; a cover has to commit to one, so it names
    // neither and lets the honoree's own name carry it.
    inviteLabel: 'Mitzvah Invitation', inviteLabelAr: 'دعوة',
    honoreeLabel: "Who's having their Bar/Bat Mitzvah?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Noah',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Becoming a Bar Mitzvah',
  },
  {
    key: 'christening', label: 'Christening / Baptism', labelAr: 'عماد / تعميد', kind: 'honoree',
    // Both labels are slashed; a cover commits to one word in each language.
    inviteLabel: 'Christening Invitation', inviteLabelAr: 'دعوة عماد',
    honoreeLabel: "Who's being christened?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Baby Olivia',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Christening Day',
  },
  {
    key: 'housewarming', label: 'Housewarming', labelAr: 'حفل افتتاح المنزل', kind: 'honoree',
    honoreeLabel: 'Whose new home?', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. The Smiths',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Welcome to Our Home',
  },
  {
    key: 'retirement', label: 'Retirement Party', labelAr: 'حفل تقاعد', kind: 'honoree',
    honoreeLabel: "Who's retiring?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. David',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. 30 Years at Acme Inc.',
  },
  {
    key: 'reunion', label: 'Reunion', labelAr: 'لمّ شمل', kind: 'honoree',
    honoreeLabel: "Who's reuniting?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. The Johnson Family',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Class of 2010',
  },
  {
    key: 'holidayParty', label: 'Holiday Party', labelAr: 'حفلة عيد', kind: 'honoree',
    honoreeLabel: 'Hosted by', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. The Martinez Family',
    milestoneLabel: 'Which holiday?', milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Christmas Party',
  },
  {
    key: 'farewell', label: 'Farewell / Going-Away', labelAr: 'حفلة وداع', kind: 'honoree',
    inviteLabel: 'Farewell Invitation',
    honoreeLabel: "Who's leaving?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Emma',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Off to New Adventures',
  },
  {
    key: 'memorial', label: 'Memorial / Celebration of Life', labelAr: 'تأبين', kind: 'honoree',
    /* Never "Memorial / Celebration of Life Invitation". This is the one
       occasion here where the wrong register is not merely clumsy, so it is
       worded as a gathering rather than as an invitation to an event. */
    inviteLabel: 'In Loving Memory', inviteLabelAr: 'تأبين',
    honoreeLabel: 'In loving memory of', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. John Smith',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Celebrating a Life Well Lived',
  },
  {
    key: 'genderReveal', label: 'Gender Reveal', labelAr: 'كشف نوع الجنين', kind: 'honoree',
    honoreeLabel: "Who's expecting?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sarah & Michael',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Boy or Girl?',
  },
  {
    key: 'vowRenewal', label: 'Vow Renewal', labelAr: 'تجديد النذور', kind: 'couple',
    taglineEn: 'We are renewing our vows',
    taglineAr: 'نجدد نذورنا',
  },
  {
    key: 'religiousHoliday', label: 'Religious Holiday', labelAr: 'مناسبة دينية', kind: 'honoree',
    honoreeLabel: 'Hosted by', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. The Khan Family',
    milestoneLabel: 'Which occasion?', milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Eid Celebration',
  },
  {
    key: 'henna', label: 'Henna / Mehndi Night', labelAr: 'ليلة الحناء', kind: 'honoree',
    inviteLabel: 'Henna Night Invitation',
    honoreeLabel: 'Whose henna night?', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Amina',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Henna Night',
  },
  {
    key: 'sportsEvent', label: 'Sports Event', labelAr: 'فعالية رياضية', kind: 'honoree',
    honoreeLabel: 'Event / team name', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. City League Finals',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Championship Game',
  },
];

export const CUSTOM_CATEGORY_BY_KEY = Object.fromEntries(CUSTOM_CATEGORIES.map((c) => [c.key, c]));

/**
 * The line above the names on a cover — "Wedding Invitation" / "دعوة زفاف".
 *
 * Built from the category rather than stored per template. Every cinematic
 * template used to hardcode its own ("Engagement Invitation" on Velvet Ring),
 * which is exactly what made a template mean an occasion: to offer 25
 * occasions × 3 templates × 2 languages that way would be 150 strings to keep
 * in step, and the first one to drift would tell a guest the wrong thing.
 *
 * The mechanical form is right for most of the catalogue and reproduces
 * today's strings exactly for wedding and engagement. `inviteLabel` overrides
 * the few that read badly — see the note on the catalogue above.
 *
 * Returns '' for an unknown key so a caller renders nothing rather than
 * "undefined Invitation".
 */
export function occasionKicker(categoryKey, isRTL = false) {
  const meta = CUSTOM_CATEGORY_BY_KEY[categoryKey];
  if (!meta) return '';
  if (isRTL) return meta.inviteLabelAr || `دعوة ${meta.labelAr}`;
  return meta.inviteLabel || `${meta.label} Invitation`;
}

/**
 * The short Latin word set across a cover as an ornament (Velvet Ring sets
 * "Engagement" in small caps under the kicker). Latin by construction — the
 * slot is decorative and never holds Arabic — so it is the English label with
 * any slash or parenthetical stripped, and empty when that leaves nothing
 * worth setting.
 */
export function occasionLatin(categoryKey) {
  const meta = CUSTOM_CATEGORY_BY_KEY[categoryKey];
  if (!meta) return '';
  const word = meta.label.replace(/\s*[/(].*$/, '').trim();
  return word.length <= 14 ? word : '';
}

/**
 * The hero line under the names, for the categories that have a fixed one.
 *
 * Only the 'couple' kinds do: an 'honoree' event builds its tagline from the
 * organizer's own `custom_milestone`, and a baby shower from the baby's name.
 * Returns null when the category has none, so the caller can fall back.
 */
export function occasionTagline(categoryKey, isRTL = false) {
  const meta = CUSTOM_CATEGORY_BY_KEY[categoryKey];
  if (!meta) return null;
  return (isRTL ? meta.taglineAr : meta.taglineEn) || null;
}
