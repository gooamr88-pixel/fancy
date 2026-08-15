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

export function buildPreviewEvent(state = {}) {
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
    event_date: eventDate || null,
    event_end_date: eventEndDate || null,
    location_name: locationName || null,
    location_address: locationAddress || null,
    location_lat: locationLat ?? null,
    location_lng: locationLng ?? null,
    dress_code: dressCode || null,
    rsvp_deadline: rsvpDeadline || null,
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
