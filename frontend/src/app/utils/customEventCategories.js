// The Custom Canvas template's "what kind of event is this?" picker (Stage 2
// of event creation) — single source of truth for both the organizer's
// picker/field copy AND the guest-facing hero title/tagline/badge on
// HeritageArchPage, so the two can never drift out of sync.
//
// `kind` decides which fields the organizer fills in and how the guest page's
// hero reads:
//  - 'couple'     — reuses the same partner1/partner2 fields the dedicated
//                    Wedding/Engagement templates use.
//  - 'honoree'     — generic "who + what's the occasion" fields
//                    (custom_honoree / custom_milestone), with copy tailored
//                    per category.
//  - 'babyShower'  — its own parent/baby-name/due-date fields.
// `key` doubles as the icon name passed to <EventCategoryIcon name={key} />
// (see components/icons/EventCategoryIcon.js) — every key below has a
// matching hand-drawn icon, so no separate icon field is needed here.
export const CUSTOM_CATEGORIES = [
  { key: 'wedding', label: 'Wedding', labelAr: 'زفاف', kind: 'couple' },
  { key: 'engagement', label: 'Engagement', labelAr: 'خطوبة', kind: 'couple' },
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
    honoreeLabel: 'Company / team name', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Acme Inc.',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Annual Kickoff',
  },
  {
    key: 'gala', label: 'Gala / Fundraiser', labelAr: 'حفل خيري', kind: 'honoree',
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
    honoreeLabel: "Who's the guest of honor?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sarah',
    milestoneLabel: "What's the celebration?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Bachelorette Weekend',
  },
  {
    key: 'quinceanera', label: 'Quinceañera / Sweet 16', labelAr: 'كينسينيرا / السادسة عشرة', kind: 'honoree',
    honoreeLabel: "Who's celebrating?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Sofia',
    milestoneLabel: "What's the occasion?", milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Quinceañera',
  },
  {
    key: 'barMitzvah', label: 'Bar/Bat Mitzvah', labelAr: 'بار متزفا', kind: 'honoree',
    honoreeLabel: "Who's having their Bar/Bat Mitzvah?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Noah',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Becoming a Bar Mitzvah',
  },
  {
    key: 'christening', label: 'Christening / Baptism', labelAr: 'عماد / تعميد', kind: 'honoree',
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
    honoreeLabel: "Who's leaving?", honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. Emma',
    milestoneLabel: 'Shown as the tagline under the name', milestoneHint: '',
    milestonePlaceholder: 'e.g. Off to New Adventures',
  },
  {
    key: 'memorial', label: 'Memorial / Celebration of Life', labelAr: 'تأبين', kind: 'honoree',
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
  { key: 'vowRenewal', label: 'Vow Renewal', labelAr: 'تجديد النذور', kind: 'couple' },
  {
    key: 'religiousHoliday', label: 'Religious Holiday', labelAr: 'مناسبة دينية', kind: 'honoree',
    honoreeLabel: 'Hosted by', honoreeHint: 'Shown as the name on your guest page',
    honoreePlaceholder: 'e.g. The Khan Family',
    milestoneLabel: 'Which occasion?', milestoneHint: 'Shown as the tagline under the name',
    milestonePlaceholder: 'e.g. Eid Celebration',
  },
  {
    key: 'henna', label: 'Henna / Mehndi Night', labelAr: 'ليلة الحناء', kind: 'honoree',
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
