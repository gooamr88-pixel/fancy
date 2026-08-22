import { safeZone } from './timezone';
import { WEDDING_VARIANT_TEMPLATES } from './templateFamilies';
import { getCinematicTemplate, getCinematicOccasion } from '../components/templates/cinematic/cinematicThemes';
import { CUSTOM_CATEGORY_BY_KEY } from './customEventCategories';

/* ═══════════════════════════════════════════════════════════════
   InvitationCard data, derived from a saved event.

   Lifted out of [slug]/EventPageClient.js so the organizer's preview builds
   the card the SAME way the guest page does. Importing it from there worked,
   and dragged the entire guest route — GuestUI, GuestAnimations, LegacyChrome,
   the analytics hooks — into the create-event bundle, because importing one
   named export still evaluates the whole module.

   Without a shared builder the preview has to pass nothing, and InvitationCard
   then falls back to its own demo copy: the card in the organizer's hero would
   advertise "The Grand Ballroom · Plaza Hotel, New York" beside the venue
   they actually typed.
   ══════════════════════════════════════════════════════════════ */

function formatEventDateLine(event, isRTL) {
  if (!event?.event_date) return null;
  return new Date(event.event_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: safeZone(event?.timezone),
  });
}

// Renders an HTML <input type="time"> value ("HH:MM", 24h) as a locale time string.
function formatTimeOfDay(value, isRTL) {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return value;
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

// Ceremony/reception can be entered two ways depending on when the event was
// created: the current Venue-search + time-picker fields (`${prefix}_venue_name`
// / `${prefix}_time_of_day`), or the older single free-text field
// (`${prefix}_time` from EventSettings, `${prefix}Location` from the create-event
// wizard) that mixed the time and place into one string. Prefer the structured
// fields; fall back to whichever legacy string exists so older events still display.
function ceremonyReceptionLine(td, prefix, isRTL) {
  const venue = td[`${prefix}_venue_name`];
  const time = formatTimeOfDay(td[`${prefix}_time_of_day`], isRTL);
  if (venue || time) return [time, venue].filter(Boolean).join(isRTL ? ' – ' : ' at ');
  return td[`${prefix}_time`] || td[`${prefix}Location`] || null;
}

// Builds the real-data props for InvitationCard from the live event record,
// replacing the demo placeholder copy (fake names/dates/venues) the card
// otherwise renders for the organizer simulator / marketing showcase.
// Exported so the organizer's preview (GuestExperiencePreview) builds the card
// through the SAME function the guest page uses. Left un-exported, the preview
// had to pass its own data or none — and passing none makes InvitationCard fall
// back to its demo copy, so the card inside the hero would advertise "The Grand
// Ballroom · Plaza Hotel, New York" while the page around it showed the
// organizer's real venue. That contradiction on one screen is the exact defect
// the honest preview exists to remove.
export function buildInvitationCardData(event, isRTL) {
  const td = event?.template_data || {};
  const venueName = event?.location_name || null;
  const venueAddress = event?.location_address || null;
  const venueLine = [venueName, venueAddress].filter(Boolean).join(' · ') || null;
  const dateLine = formatEventDateLine(event, isRTL);
  const dressCode = (isRTL && td.dress_code_ar) || event?.dress_code || null;
  // Arabic title override (stored in template_data by EventSettings)
  const titleAr = td.title_ar || null;

  if (WEDDING_VARIANT_TEMPLATES.includes(event?.template_type)) {
    // The organizer's create-event wizard (Stage2_FormConfiguration) writes
    // partner1/partner2 + ceremonyLocation/receptionLocation; the post-creation
    // edit page (EventSettings) writes bride_name/groom_name + ceremony_time/
    // reception_time into the same template_data column — read both shapes.
    const a = td.groom_name || td.partner1Name || td.partner1;
    const b = td.bride_name || td.partner2Name || td.partner2;
    const namesEn = a && b ? `${a} & ${b}` : (event?.title || null);
    const names = (isRTL && titleAr) ? titleAr : namesEn;
    const monogram = a && b ? `${a[0]}${b[0]}`.toUpperCase() : null;
    const ceremonyLine = ceremonyReceptionLine(td, 'ceremony', isRTL);
    const receptionLine = ceremonyReceptionLine(td, 'reception', isRTL);
    // Tuscan Vineyard's "Save the Date" layout upgrades to a real photo once
    // the organizer has uploaded a cover image; other wedding patterns ignore this.
    const coverImageUrl = event?.template_type === 'tuscany' ? (event?.cover_image_url || null) : undefined;
    return { names, monogram, dateLine, venueLine, venueName, venueAddress, ceremonyLine, receptionLine, coverImageUrl };
  }

  /* Which card copy this event gets is decided by its OCCASION, not by which
     artwork was picked — a birthday on Velvet Ring must not print "at the
     engagement of".

     Only the 'couple' occasions are remapped, and that restriction is
     load-bearing. A `case 'birthday'` arm already exists below and reads
     `td.celebrant` / `td.age`, whereas the occasion catalogue's 'birthday'
     writes `custom_honoree` / `custom_milestone` — routing the occasion to
     that arm by name would render a card with every field blank. Everything
     that is not a couple falls to the `default:` arm, which builds from
     `event.title`; that is what Custom Canvas has always done and it works
     for all of them. */
  const cinematic = getCinematicTemplate(event?.template_type);
  const occasion = getCinematicOccasion(cinematic, td);
  /* Scoped to the cinematic templates, which are the ones that gained an
     occasion. Every other key keeps resolving exactly as it did — Custom
     Canvas included, so its card is not quietly re-pointed by this change.
     `null` rather than the string 'default': no `case` matches it, which is
     how it reaches the default arm. */
  const cardKey = cinematic
    ? (CUSTOM_CATEGORY_BY_KEY[occasion]?.kind === 'couple' ? occasion : null)
    : event?.template_type;

  switch (cardKey) {
    case 'wedding': {
      // The organizer's create-event wizard (Stage2_FormConfiguration) writes
      // partner1/partner2 + ceremonyLocation/receptionLocation; the post-creation
      // edit page (EventSettings) writes bride_name/groom_name + ceremony_time/
      // reception_time into the same template_data column — read both shapes.
      const a = td.groom_name || td.partner1Name || td.partner1;
      const b = td.bride_name || td.partner2Name || td.partner2;
      const namesEn = a && b ? `${a} & ${b}` : (event?.title || null);
      const names = (isRTL && titleAr) ? titleAr : namesEn;
      const monogram = a && b ? `${a[0]}${b[0]}`.toUpperCase() : null;
      const ceremonyLine = ceremonyReceptionLine(td, 'ceremony', isRTL);
      const receptionLine = ceremonyReceptionLine(td, 'reception', isRTL);
      const noKidsText = isRTL ? 'دعوة خاصة بالكبار فقط' : 'No Kids Allowed';
      // Organizer-controlled (dashboard "Adults-Only Notice" toggle) — off
      // by default; previously this rendered unconditionally for every
      // wedding, which wrongly assumed every couple wants it.
      const noKidsNotice = !!event?.no_kids_allowed;
      return { names, monogram, dateLine, venueLine, venueName, venueAddress, ceremonyLine, receptionLine, noKidsText, noKidsNotice };
    }
    // Engagement reuses the exact "serif" card layout wedding uses (see
    // INVITATION_PATTERN_BY_TEMPLATE above) — only the copy differs, since
    // "Request the honor of your presence at the marriage of…" and "The
    // Marriage Celebration" are wrong for two people who aren't married yet.
    // 'ring' is Velvet Ring, the cinematic engagement — same card copy, since
    // the card it captures for "Save the invitation" should read as an
    // engagement, not a marriage.
    case 'engagement':
    case 'ring': {
      const a = td.partner1Name || td.partner1;
      const b = td.partner2Name || td.partner2;
      const namesEn = a && b ? `${a} & ${b}` : (event?.title || null);
      const names = (isRTL && titleAr) ? titleAr : namesEn;
      const monogram = a && b ? `${a[0]}${b[0]}`.toUpperCase() : null;
      const ceremonyLine = ceremonyReceptionLine(td, 'ceremony', isRTL);
      const receptionLine = ceremonyReceptionLine(td, 'reception', isRTL);
      const celebrationLabel = isRTL ? 'حفل الخطوبة' : 'The Engagement Celebration';
      const honorLine1 = isRTL ? 'يسعدنا دعوتكم لحضور' : 'Request the honor of your presence';
      const honorLine2 = isRTL ? 'حفل خطوبة' : 'at the engagement of';
      const noKidsText = isRTL ? 'دعوة خاصة بالكبار فقط' : 'No Kids Allowed';
      const noKidsNotice = !!event?.no_kids_allowed;
      return {
        names, monogram, dateLine, venueLine, venueName, venueAddress, ceremonyLine, receptionLine,
        celebrationLabel, honorLine1, honorLine2, noKidsText, noKidsNotice, dressCode,
      };
    }
    case 'corporate': {
      const headlineEn = event?.title || null;
      const headline = (isRTL && titleAr) ? titleAr : headlineEn;
      const eyebrow = td.company_name || td.companyName || td.company || null;
      return { headline, eyebrow, dateLine };
    }
    case 'birthday': {
      const headlineEn = td.birthdayPersonName || td.celebrant || event?.title || null;
      const headline = (isRTL && titleAr) ? titleAr : headlineEn;
      const subtitle = td.theme || td.partyTheme || null;
      const replyBy = event?.rsvp_deadline
        ? `Kindly reply by ${new Date(event.rsvp_deadline).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', timeZone: safeZone(event?.timezone) })}`
        : null;
      return { headline, subtitle, dateLine, venueLine, replyBy };
    }
    case 'gala': {
      const headlineEn = event?.title || null;
      const headline = (isRTL && titleAr) ? titleAr : headlineEn;
      const honoree = td.honorees || td.honoree || null;
      const eyebrow = honoree ? `Honoring ${honoree}` : null;
      return { headline, eyebrow, dateLine, venueLine };
    }
    // Custom Canvas, plus anything not named above. The adults-only fields ride
    // along here for the same reason HeritageArchPage stopped gating its
    // section on the template type: the organizer set `no_kids_allowed`, and
    // which artwork they happened to pick is not a reason to drop it. Wedding
    // and engagement build their own copies above only because their Arabic
    // wording sits inside those blocks already.
    default: {
      const namesEn = event?.title || null;
      const names = (isRTL && titleAr) ? titleAr : namesEn;
      const noKidsText = isRTL ? 'دعوة خاصة بالكبار فقط' : 'No Kids Allowed';
      const noKidsNotice = !!event?.no_kids_allowed;
      return { names, dateLine, venueLine, dressCode, noKidsText, noKidsNotice };
    }
  }
}
