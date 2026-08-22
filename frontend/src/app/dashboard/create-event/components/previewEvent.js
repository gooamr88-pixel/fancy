import { wallClockToInstant } from '../../../utils/timezone';
import { toTagArray } from '../../components/TagListEditor';

/* ═══════════════════════════════════════════════════════════════
   Wizard state → the `event` shape the guest renderer reads.

   The organizer's event does not exist yet while they are in the wizard —
   there is no row, no id, no slug on the server. The guest page, meanwhile,
   only knows how to read a saved event. This is the adapter between them, and
   it is the reason the preview can show real data instead of demo copy.

   IT MUST MIRROR `ensureDraftEvent`'s PATCH BODY in create-event/page.js.
   That payload is the definition of "what this field means once saved"; if the
   two disagree, the preview is confidently wrong about the one thing it exists
   to be right about — which is exactly the failure it replaces. The key names
   below are deliberately snake_case to match, field for field, and the test
   asserts the two lists against each other so a field added there and
   forgotten here fails loudly.
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   A `<input type="datetime-local">` value, as the SERVER will store it.

   The wizard's date fields produce "2027-05-15T18:30" — a date-time with no
   timezone designator, which is not a moment until someone says whose clock it
   is on. The preview's whole job is to show the organizer the page their
   guests will get, so it has to answer that question the SAME way the server
   will when they hit save: by reading the digits on the organizer's own
   timezone and converting to the instant they name.

   This file previously appended a literal "Z" instead, and that was correct
   for exactly as long as the server did the same thing — back when event dates
   were the typed digits filed as UTC and every guest surface printed them back
   with `timeZone: 'UTC'`. Both halves of that arrangement are now gone.
   Appending Z today would produce a preview off by the organizer's own offset
   from the page it claims to be showing: a 6:30pm San Diego ceremony would
   preview as 11:30am, and an event running to 2am would preview as ending the
   day before — printing "MAY 14 - MAY 14" as its date range.

   Values that already carry an offset (an event loaded back from the API into
   the wizard) are already instants and pass through untouched — re-interpreting
   one of those would move it for real. That guard lives in wallClockToInstant,
   which is the same function the backend uses, so the preview and the save
   path cannot drift apart. */
export function toStoredIso(value, timeZone) {
  if (!value || typeof value !== 'string') return value || null;
  return wallClockToInstant(value, timeZone) || value;
}

export function buildPreviewEvent(state = {}) {
  // The organizer's own clock, threaded in from the wizard. Falls back inside
  // safeZone/wallClockToInstant when the profile has not loaded yet, so the
  // preview renders a plausible time rather than nothing.
  const timeZone = state.timeZone;
  const {
    templateType, title, description, eventDate, eventEndDate,
    locationName, locationAddress, locationLat, locationLng,
    dressCode, rsvpDeadline, coverImageUrl, galleryUrls,
    customColors, templateData, customConfig,
    allowGuestEdits, trackGuestSide, noKidsAllowed, collectDietaryRestrictions,
    customFields, slug,
  } = state;

  // Same merge buildTemplateData() performs before saving, including the
  // meal-options coercion — otherwise a draft that stored them as a comma
  // string would preview as one long option and save as several.
  const td = templateType === 'custom'
    ? { ...(templateData || {}), customDesign: customConfig }
    : { ...(templateData || {}) };
  if ('ha_meal_options' in td) td.ha_meal_options = toTagArray(td.ha_meal_options);

  return {
    // Not a real id, and nothing may treat it as one. The preview passes
    // guestRsvp={null} and never submits, so no code path reaches for it.
    id: 'preview',
    slug: slug || 'preview',
    template_type: templateType,
    title: title || '',
    title_ar: td.title_ar || null,
    description: description || '',
    description_ar: td.description_ar || null,
    // A blank date is the common case early in Stage 2. Left null so the
    // countdown and date sections hide themselves exactly as they would for a
    // guest, rather than rendering "Invalid Date".
    event_date: toStoredIso(eventDate, timeZone),
    event_end_date: toStoredIso(eventEndDate, timeZone),
    location_name: locationName || null,
    location_address: locationAddress || null,
    location_lat: locationLat ?? null,
    location_lng: locationLng ?? null,
    dress_code: dressCode || null,
    // Same conversion: RsvpSection reads this on the event's zone too, and an
    // "RSVP by" date one day out is worse than a wrong hero time.
    rsvp_deadline: toStoredIso(rsvpDeadline, timeZone),
    // The guest surfaces read this to decide which clock to print on, exactly
    // as they do for a saved event — the preview must carry it or it would
    // render on the platform default instead of the organizer's.
    timezone: timeZone || null,
    cover_image_url: coverImageUrl || null,
    gallery_urls: Array.isArray(galleryUrls) ? galleryUrls : [],
    custom_colors: customColors || {},
    template_data: td,
    allow_guest_edits: !!allowGuestEdits,
    track_guest_side: !!trackGuestSide,
    no_kids_allowed: !!noKidsAllowed,
    // Opt-out, matching the backend default: only an explicit false turns the
    // dietary question off.
    collect_dietary_restrictions: collectDietaryRestrictions !== false,
    /* `custom_form_fields`, NOT `custom_fields` — this is the key RsvpSection
       and RsvpWizard both read (see `allCustomFields`). The wizard's own state
       variable is called `customFields`, and getting this wrong is silent:
       the form renders perfectly, just without any of the questions the
       organizer spent Stage 2 building. */
    custom_form_fields: Array.isArray(customFields) ? customFields : [],
    // The envelope is the wizard's own concern, not a saved column; previewing
    // with it enabled is what the organizer expects to see.
    reveal_enabled: true,
    // Music is deliberately absent — see GuestExperiencePreview for why a
    // wizard panel must not start playing audio.
    background_music_url: null,
  };
}

/** The snake_case keys the wizard PATCHes. Used by the drift test. */
export const SAVED_EVENT_KEYS = [
  'slug', 'template_type', 'title', 'description', 'event_date', 'event_end_date',
  'location_name', 'location_address', 'location_lat', 'location_lng',
  'dress_code', 'rsvp_deadline', 'cover_image_url', 'gallery_urls',
  'custom_colors', 'template_data', 'allow_guest_edits', 'track_guest_side',
  'no_kids_allowed', 'collect_dietary_restrictions',
];
