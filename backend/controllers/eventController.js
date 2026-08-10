const { supabase } = require('../config/supabase');
const { deriveBaseSlug, generateUniqueSlug } = require('../utils/slugHelper');
const { generateQRCodeDataURL } = require('../utils/qrHelper');
const { getPublicBaseUrl } = require('../utils/publicUrl');
const { isAcceptedResponse, isDeclinedResponse, isMaybeResponse } = require('../utils/responseHelpers');
const { getPlatformConfig } = require('../utils/configCache');
const { hashEventPassword, verifyEventPassword, isHashedEventPassword } = require('../utils/eventPassword');
const tokenService = require('../services/tokenService');
const logger = require('../utils/logger');

/** Strict UUID matcher — used to validate invitation tokens before querying. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
const CUSTOM_COLOR_KEYS = ['primary', 'secondary', 'accent', 'background'];
// Mirrors the public event page's sanitizeFontName() charset (frontend/src/app/[slug]/EventPageClient.js)
// — that function already strips this client-side before interpolating the font
// name into a raw <style> block, but nothing previously stopped an arbitrary
// string from being persisted in the first place.
const FONT_NAME_REGEX = /^[a-zA-Z0-9 -]{1,60}$/;
const CUSTOM_FONT_KEYS = ['heading', 'body'];

/**
 * Validates the shape of custom_colors/custom_fonts before they're persisted.
 * Returns an error message string, or null if valid.
 */
function validateCustomTheme(customColors, customFonts) {
  if (customColors !== undefined && customColors !== null) {
    if (typeof customColors !== 'object' || Array.isArray(customColors)) {
      return 'customColors must be an object.';
    }
    for (const key of CUSTOM_COLOR_KEYS) {
      const val = customColors[key];
      if (val !== undefined && val !== null && val !== '' && !HEX_COLOR_REGEX.test(val)) {
        return `customColors.${key} must be a valid hex color (e.g. #B8944F).`;
      }
    }
  }
  if (customFonts !== undefined && customFonts !== null) {
    if (typeof customFonts !== 'object' || Array.isArray(customFonts)) {
      return 'customFonts must be an object.';
    }
    for (const key of CUSTOM_FONT_KEYS) {
      const val = customFonts[key];
      if (val !== undefined && val !== null && val !== '' && !FONT_NAME_REGEX.test(val)) {
        return `customFonts.${key} contains invalid characters or is too long.`;
      }
    }
  }
  return null;
}

/**
 * Back-fills the purchased tier ("current plan") onto a paid event that predates
 * tier snapshotting. The plan is resolved in priority order:
 *   1) already on the event           → nothing to do
 *   2) snapshotted on a completed payment (newer payments store it)
 *   3) inferred by matching the completed payment amount to a pricing tier
 * When resolved, the event object is augmented AND the value is persisted (fire-and-
 * forget, idempotent) so every surface — events list, wizard, public page — agrees.
 * Requires event_payments to be embedded on the event (the list/detail queries do).
 */
async function withResolvedTier(rawEvent) {
  if (!rawEvent) return rawEvent;

  // Never leak the access_password hash to the client. Both organizer-facing
  // GET endpoints (getEvent, getEvents) route every event through this
  // function, so masking it here once covers both. Previously the raw scrypt
  // hash was sent to the frontend, which pre-filled it into the settings form
  // and resubmitted it verbatim on every save — updateEvent then re-hashed
  // that hash, silently replacing the real guest password with an unusable
  // hash-of-a-hash and locking guests out with no visible error.
  const { access_password, ...eventWithoutPassword } = rawEvent;
  const event = { ...eventWithoutPassword, has_access_password: !!access_password };

  if (!event.is_paid) {
    // Unpaid events get only the free-tier features.
    const { FREE_TIER_FEATURES } = require('../config/featureRegistry');
    return { ...event, tier_features: [...FREE_TIER_FEATURES] };
  }

  let tierName = event.tier_name || null;
  let tierMaxGuests = event.tier_max_guests;
  let tierRemoveWatermark = !!event.tier_remove_watermark;
  let tierFeatures = [];

  // Same bug class fixed elsewhere in this codebase (EventsTab's manual-payment
  // receipt picker): PostgREST doesn't guarantee event_payments embed order, so
  // picking the first array match instead of sorting by date could resolve an
  // event's "current plan" from an OLDER completed payment (e.g. the original
  // purchase) instead of a later upgrade's payment.
  const payments = Array.isArray(event.event_payments) ? event.event_payments : [];
  const sortedPayments = [...payments].sort((a, b) =>
    new Date(b?.completed_at || b?.created_at || 0) - new Date(a?.completed_at || a?.created_at || 0));
  const completed = sortedPayments.find(p => p && p.status === 'completed') || sortedPayments[0];

  // If we don't have a tierName, try resolving from the completed payment
  if (!tierName && completed) {
    tierName = completed.tier_name || null;
    tierMaxGuests = completed.tier_max_guests ?? null;
    tierRemoveWatermark = !!completed.tier_remove_watermark;
  }

  // If still unresolved or guest limit is missing/null, lookup from the platform configuration
  if (!tierName || tierMaxGuests === null || tierMaxGuests === undefined) {
    if ((completed && completed.amount_cents != null) || tierName) {
      try {
        const cfg = await getPlatformConfig();
        const tiers = cfg.pricing_tiers || [];

        if (tierName) {
          const match = tiers.find(t => t.name.toLowerCase() === tierName.toLowerCase());
          if (match) {
            tierMaxGuests = Number.isFinite(match.max_guests) ? match.max_guests : null;
            tierRemoveWatermark = !!match.remove_watermark;
            tierFeatures = Array.isArray(match.features) ? match.features : [];
          }
        } else if (completed && completed.amount_cents != null) {
          const match = tiers.find(t => Number(t.price_cents) === Number(completed.amount_cents));
          if (match) {
            tierName = match.name;
            tierMaxGuests = Number.isFinite(match.max_guests) ? match.max_guests : null;
            tierRemoveWatermark = !!match.remove_watermark;
            tierFeatures = Array.isArray(match.features) ? match.features : [];
          }
        }
      } catch { /* config unavailable — leave the plan unresolved this time */ }
    }
  }

  // If we have a tierName but haven't resolved features yet, do a separate lookup.
  if (tierName && tierFeatures.length === 0) {
    try {
      const cfg = await getPlatformConfig();
      const tiers = cfg.pricing_tiers || [];
      const match = tiers.find(t => (t.name || '').toLowerCase() === tierName.toLowerCase());
      if (match && Array.isArray(match.features)) {
        tierFeatures = match.features;
      }
    } catch { /* features stay empty — safe fallback */ }
  }

  if (!tierName) return { ...event, tier_features: [] };

  // Self-heal: persist so future reads don't re-derive. Never block/fault the read.
  supabase.from('events').update({ tier_name: tierName, tier_max_guests: tierMaxGuests, tier_remove_watermark: tierRemoveWatermark }).eq('id', event.id)
    .then(() => {}, () => {});

  return { ...event, tier_name: tierName, tier_max_guests: tierMaxGuests, tier_remove_watermark: tierRemoveWatermark, tier_features: tierFeatures };
}


/**
 * Creates a new event in draft state.
 * POST /api/v1/events
 */
const createEvent = async (req, res, next) => {
  const {
    slug, templateType, title, description, eventDate, eventEndDate,
    locationName, locationAddress, locationLat, locationLng, locationPlaceId,
    dressCode, rsvpDeadline, privacyMode, accessPassword,
    coverImageUrl, galleryUrls, customColors, customFonts, templateData,
    eventType, backgroundMusicUrl, notificationPreferences, allowGuestEdits, trackGuestSide, noKidsAllowed,
    collectDietaryRestrictions
  } = req.body;

  if (!templateType) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'templateType is required.'
    });
  }

  // The pay-first flow creates a lightweight placeholder event (template + tier
  // only) before the organizer has entered title/date — fill in safe defaults
  // they'll overwrite on the One-Page Form right after payment confirms.
  const finalTitle = title || 'Untitled Event';
  const finalEventDate = eventDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // If the organizer supplied a slug, it must match the URL-safe format.
  // If omitted, the system auto-generates a unique one (see below).
  if (slug) {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SLUG',
        message: 'Slug must contain only lowercase alphanumeric characters and single dashes.'
      });
    }
  }

  const themeError = validateCustomTheme(customColors, customFonts);
  if (themeError) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: themeError });
  }

  try {
    // Derive orgId from authenticated user instead of trusting client input
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_user_id', req.user.id)
      .single();

    if (orgError || !org) {
      return res.status(403).json({ success: false, error: 'ORG_NOT_FOUND', message: 'No organization found for this user' });
    }
    const orgId = org.id;

    const eventYear = new Date(finalEventDate).getFullYear();
    let finalSlug;

    if (slug) {
      // Organizer chose an explicit slug — respect it, but reject collisions so
      // they stay in control of their URL (offer a suggestion).
      const { data: existingEvents } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .limit(1);

      if (existingEvents && existingEvents.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'SLUG_TAKEN',
          message: 'This event URL is already taken.',
          suggestedSlug: await generateUniqueSlug(supabase, slug, { year: eventYear })
        });
      }
      finalSlug = slug;
    } else {
      // No slug supplied — auto-generate a unique link from the event details.
      const baseSlug = deriveBaseSlug({ title: finalTitle, templateType, templateData });
      finalSlug = await generateUniqueSlug(supabase, baseSlug, { year: eventYear });
    }

    // Build insert payload with all available fields
    const insertPayload = {
      org_id: orgId,
      slug: finalSlug,
      template_type: templateType,
      title: finalTitle,
      description: description || null,
      event_date: finalEventDate,
      event_end_date: eventEndDate || null,
      location_name: locationName || null,
      location_address: locationAddress || null,
      location_lat: locationLat || null,
      location_lng: locationLng || null,
      location_place_id: locationPlaceId || null,
      dress_code: dressCode || null,
      rsvp_deadline: rsvpDeadline || null,
      privacy_mode: privacyMode || 'private',
      // SEC-9: store a scrypt hash, never the plaintext door code.
      access_password: accessPassword ? await hashEventPassword(accessPassword) : null,
      cover_image_url: coverImageUrl || null,
      gallery_urls: galleryUrls || [],
      custom_colors: customColors || {},
      custom_fonts: customFonts || {},
      template_data: templateData || {},
      event_type: eventType || 'wedding',
      background_music_url: backgroundMusicUrl || null,
      notification_preferences: { email: notificationPreferences?.email !== false, whatsapp: false },
      allow_guest_edits: !!allowGuestEdits,
      track_guest_side: !!trackGuestSide,
      no_kids_allowed: !!noKidsAllowed,
      // Opt-out, not opt-in — see the migration comment. Only an explicit
      // `false` turns the question off; anything else (undefined from a
      // caller that predates this field, or a truthy value) keeps it on.
      collect_dietary_restrictions: collectDietaryRestrictions !== false,
      status: 'draft',
      is_paid: false
    };

    let event, error;

    // SEC H5: Insert directly and handle unique constraint violations instead of
    // check-then-insert (TOCTOU race). On collision, append a random suffix and retry.
    const MAX_SLUG_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      ({ data: event, error } = await supabase
        .from('events')
        .insert(insertPayload)
        .select()
        .single());

      // If the insert failed due to an unknown column (e.g. template_data not yet migrated),
      // retry without the potentially missing column
      if (error && (error.code === '42703' || (error.message && error.message.includes('column')))) {
        logger.warn({ code: error.code, message: error.message }, 'createEvent: retrying without template_data (column may not exist yet)');
        const { template_data, ...fallbackPayload } = insertPayload;
        ({ data: event, error } = await supabase
          .from('events')
          .insert(fallbackPayload)
          .select()
          .single());
      }

      // SEC H5: If the insert failed due to a unique constraint violation on slug,
      // append a random suffix and retry instead of failing.
      if (error && (error.code === '23505' || (error.message || '').includes('duplicate key')) && attempt < MAX_SLUG_RETRIES) {
        const suffix = require('crypto').randomBytes(2).toString('hex'); // 4 hex chars
        insertPayload.slug = `${finalSlug}-${suffix}`;
        logger.info({ attempt: attempt + 1, newSlug: insertPayload.slug }, 'createEvent: slug collision, retrying with random suffix');
        error = null;
        continue;
      }

      break; // success or non-retryable error
    }

    if (error) {
      logger.error({
        err: error,
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
        insertPayloadKeys: Object.keys(insertPayload),
        userId: req.user?.id,
        slug: insertPayload.slug,
      }, 'createEvent: Supabase insert failed');

      // Return a more informative error instead of a generic 500
      return res.status(500).json({
        success: false,
        error: 'EVENT_CREATE_FAILED',
        code: error.code || 'UNKNOWN',
        message: error.message || 'Failed to create event. Please try again.',
        hint: error.hint || undefined,
      });
    }

    // Auto-generate and persist the event QR code (encodes the public event link).
    // Best-effort: a failure here (e.g. qr_code_url column not yet migrated) must not
    // block event creation — the dashboard can still render a QR live as a fallback.
    try {
      const eventUrl = `${getPublicBaseUrl()}/${event.slug}`;
      const qrCodeUrl = await generateQRCodeDataURL(eventUrl);
      const { error: qrError } = await supabase
        .from('events')
        .update({ qr_code_url: qrCodeUrl })
        .eq('id', event.id);
      if (qrError) {
        logger.warn({ code: qrError.code, message: qrError.message, eventId: event.id }, 'createEvent: QR persistence skipped');
      } else {
        event.qr_code_url = qrCodeUrl;
      }
    } catch (qrErr) {
      logger.warn({ err: qrErr, eventId: event.id }, 'createEvent: QR generation failed (non-fatal)');
    }

    return res.status(201).json({
      success: true,
      message: 'Event created in draft state. Complete payment to activate.',
      event
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches event by ID (Organizer authorized endpoint)
 * GET /api/v1/events/:eventId
 */
const getEvent = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*, custom_form_fields(*), event_payments(*)')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    return res.json({ success: true, event: await withResolvedTier(event) });
  } catch (err) {
    next(err);
  }
};

/**
 * Public endpoint to fetch event page data by Slug.
 * GET /api/v1/public/events/:slug
 */
const getPublicEventBySlug = async (req, res, next) => {
  const { slug } = req.params;

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select(`
        id,
        slug,
        template_type,
        event_type,
        title,
        description,
        event_date,
        event_end_date,
        location_name,
        location_address,
        location_lat,
        location_lng,
        dress_code,
        rsvp_deadline,
        privacy_mode,
        access_password,
        cover_image_url,
        gallery_urls,
        custom_colors,
        custom_fonts,
        background_music_url,
        template_data,
        is_paid,
        status,
        allow_guest_edits,
        track_guest_side,
        no_kids_allowed,
        collect_dietary_restrictions,
        reveal_enabled,
        reveal_replay,
        tier_remove_watermark,
        updated_at,
        custom_form_fields(*)
      `)
      .eq('slug', slug)
      .single();

    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    // When the frontend passes ?exclude=<eventId>, it means the organizer is editing
    // that event and wants to keep its existing slug. Treat as "not found" so the
    // slug checker marks it as available.
    const excludeId = req.query.exclude;
    if (excludeId && event.id === excludeId) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    const isDemo = event.slug === 'demo';

    if (!event.is_paid && !isDemo) {
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: 'This event page is currently offline pending payment activation.'
      });
    }

    // Paid but not yet approved — held until a Super Admin promotes it to 'active'.
    if (!isDemo && event.status === 'pending_review') {
      return res.status(403).json({
        success: false,
        error: 'EVENT_UNDER_REVIEW',
        message: 'This event is awaiting review and will be live shortly.'
      });
    }

    /**
     * A cancelled event answers differently from a merely closed one.
     *
     * Someone arriving here is a guest holding a link from a text or an email,
     * and they are almost certainly checking because they heard something. A flat
     * "no longer available" makes them wonder whether the link broke; naming the
     * cancellation, and carrying the organizer's own words when they left any, is
     * the entire reason the cancelled state exists rather than a DELETE.
     *
     * Still a 403 — the event is genuinely not open — but with an error code the
     * front end can render as a real page instead of a dead end.
     */
    if (!isDemo && event.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        error: 'EVENT_CANCELLED',
        message: 'This event has been cancelled.',
        event: {
          title: event.title,
          cancelledAt: event.cancelled_at || null,
          reason: event.cancellation_reason || null,
        },
      });
    }

    // INV-1: any other non-active state (paused / completed / draft) is "closed".
    // This makes the organizer's "Close Event" action actually stop guests — the
    // landing page, RSVP form, resolver, and seating now all agree (see
    // utils/eventAccess.isEventLiveForGuests).
    if (!isDemo && event.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'EVENT_CLOSED',
        message: 'This event is no longer available.'
      });
    }

    // ─── Invitation Token Bypass ───
    // An optional party_id query param acts as a per-guest invitation token. When it
    // strictly resolves to a party belonging to THIS event, we (a) unlock private
    // events and (b) return that party's own RSVP so the form can be pre-filled.
    // It never widens access to other events (event_id is enforced) and is validated
    // as a UUID before hitting the DB to avoid malformed-input errors.
    const invitationPartyId = req.query.party_id;
    let guestRsvp = null;
    if (invitationPartyId && UUID_REGEX.test(invitationPartyId)) {
      const { data: partyRecord } = await supabase
        .from('rsvp_parties')
        .select('id, label, response, notes, side, created_by_organizer, guests(id, full_name, is_primary_contact, email, phone, meal_selection, dietary_notes)')
        .eq('id', invitationPartyId)
        .eq('event_id', event.id)
        .maybeSingle();
      if (partyRecord) {
        const allGuests = partyRecord.guests || [];
        const primary = allGuests.find((g) => g.is_primary_contact) || {};
        // Companions already on file (e.g. entered by the organizer during guest import)
        // so the confirmation form pre-fills their names/meals instead of asking the
        // responder to retype every member of their own party from a blank field.
        const companions = allGuests.filter((g) => !g.is_primary_contact);
        const partySize = allGuests.length || 1;
        guestRsvp = {
          id: partyRecord.id, guest_name: partyRecord.label, email: primary.email || null, phone: primary.phone || null,
          response: partyRecord.response, party_size: partySize, notes: partyRecord.notes,
          primary_meal: primary.meal_selection || null, primary_dietary_notes: primary.dietary_notes || null, side: partyRecord.side || null,
          // Organizer-added guests (CSV import / manual "Add Guest") skip the
          // 24h seating-reveal wait — see RsvpWizard.js's seatingRevealed calc.
          createdByOrganizer: partyRecord.created_by_organizer === true,
          additionalGuests: companions.map((g) => ({
            id: g.id, fullName: g.full_name || '', email: g.email || '', phone: g.phone || '',
            mealSelection: g.meal_selection || '', dietaryNotes: g.dietary_notes || '',
          })),
          // Lets a returning "yes" guest see/save their real entrance QR from the
          // locked card, not just in the fleeting moment right after they submit.
          qrToken: tokenService.signQrTicketForResponse({
            response: partyRecord.response, partyId: partyRecord.id, eventId: event.id,
            tableName: null, partySize, eventDate: event.event_date,
          }),
        };
      }
    }

    // Privacy mode enforcement
    if (event.privacy_mode === 'private') {
      // A valid invitation token (party_id linked to this event) bypasses the lock.
      if (!guestRsvp) {
        return res.status(403).json({
          success: false,
          error: 'EVENT_PRIVATE',
          message: 'This event is private. Access requires a direct invitation link.'
        });
      }
      // Token valid → fall through and serve the event.
    }

    if (event.privacy_mode === 'password') {
      // Only accept password via header — never via query string (avoids URL logging)
      const providedPassword = req.headers['x-event-password'];

      // If the event has no access_password configured, reject with a clear error
      if (!event.access_password) {
        return res.status(503).json({
          success: false,
          error: 'PASSWORD_NOT_CONFIGURED',
          message: 'This event is password-protected but no password has been set yet. Please contact the organizer.',
          requiresPassword: true
        });
      }

      // SEC-9: passwords are stored hashed (scrypt). verifyEventPassword does a
      // constant-time compare and transparently handles any legacy plaintext value.
      const isMatch = await verifyEventPassword(providedPassword, event.access_password);

      if (!isMatch) {
        // Don't expose whether event exists, just return password required
        return res.status(401).json({
          success: false,
          error: 'PASSWORD_REQUIRED',
          message: 'This event requires a password to access.',
          requiresPassword: true
        });
      }
    }

    // Strip sensitive fields from public response
    const { access_password, is_paid, ...publicEvent } = event;

    // guestRsvp is included only when a valid invitation token resolved to this event.
    return res.json({ success: true, event: publicEvent, guestRsvp });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates event settings.
 * PATCH /api/v1/events/:eventId
 */
const updateEvent = async (req, res, next) => {
  const { eventId } = req.params;

  const allowedFields = [
    'slug',
    'template_type',
    'title',
    'description',
    'event_date',
    'event_end_date',
    'location_name',
    'location_address',
    'location_lat',
    'location_lng',
    'location_place_id',
    'dress_code',
    'rsvp_deadline',
    'privacy_mode',
    'access_password',
    'cover_image_url',
    'gallery_urls',
    'custom_colors',
    'custom_fonts',
    'template_data',
    'event_type',
    'background_music_url',
    'notification_preferences',
    'allow_guest_edits',
    'track_guest_side',
    'no_kids_allowed',
    'collect_dietary_restrictions',
    // The sealed-envelope reveal. Both default true in the schema, so an
    // organizer who never opens the setting keeps exactly today's behaviour.
    'reveal_enabled',
    'reveal_replay'
  ];

  // Status transitions the organizer may request:
  //   • → 'paused' / 'completed' : always allowed.
  //   • → 'active'               : ONLY as a RESUME of an already-paid, currently-paused
  //                                event. First activation still happens via the Stripe
  //                                webhook, so an organizer can never self-activate an
  //                                unpaid event — but they can lift a pause they applied.
  if (req.body.status && ['paused', 'completed'].includes(req.body.status)) {
    allowedFields.push('status');
  } else if (req.body.status === 'active') {
    let isResume = false;
    try {
      const { data: ev } = await supabase
        .from('events')
        .select('status, is_paid')
        .eq('id', eventId)
        .single();
      // Fail closed: only a paid event currently in 'paused' may return to 'active'.
      isResume = !!(ev && ev.is_paid === true && ev.status === 'paused');
    } catch {
      isResume = false;
    }
    if (!isResume) {
      return res.status(403).json({
        success: false,
        error: 'STATUS_FORBIDDEN',
        message: 'Event status cannot be set to active manually. It is activated upon payment.'
      });
    }
    allowedFields.push('status'); // legitimate paused → active resume
  }

  const filteredUpdates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      let val = req.body[field];
      // Normalize empty strings to null for date and numeric fields to prevent database syntax errors
      if (val === '') {
        if (['rsvp_deadline', 'event_end_date', 'location_lat', 'location_lng'].includes(field)) {
          val = null;
        }
      }
      filteredUpdates[field] = val;
    }
  }

  // SEC-9: never persist a plaintext access password. Hash a supplied value; an
  // empty value clears protection. Defense-in-depth: getEvent/getEvents now mask
  // the hash from the client entirely (see withResolvedTier), but if a stored
  // hash ever reaches this endpoint verbatim regardless, re-hashing it would
  // silently replace the real password with an unusable hash-of-a-hash — reject
  // instead of corrupting it.
  if (filteredUpdates.access_password !== undefined) {
    if (filteredUpdates.access_password && isHashedEventPassword(filteredUpdates.access_password)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid access password value.',
      });
    }
    filteredUpdates.access_password = filteredUpdates.access_password
      ? await hashEventPassword(filteredUpdates.access_password)
      : null;
  }

  // Handle URL Slug format validation if the slug is being updated
  if (filteredUpdates.slug) {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(filteredUpdates.slug)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SLUG',
        message: 'Slug must contain only lowercase alphanumeric characters and single dashes.'
      });
    }
  }

  const themeError = validateCustomTheme(filteredUpdates.custom_colors, filteredUpdates.custom_fonts);
  if (themeError) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: themeError });
  }

  // Date ordering: end date must be after the start date, and the RSVP
  // deadline must not be after the event itself. Previously unchecked
  // anywhere (client or server) — an event could be saved ending before it
  // started, or with a deadline weeks after the event happened.
  if (filteredUpdates.event_end_date !== undefined || filteredUpdates.rsvp_deadline !== undefined) {
    let effectiveEventDate = filteredUpdates.event_date;
    if (effectiveEventDate === undefined) {
      const { data: current } = await supabase.from('events').select('event_date').eq('id', eventId).single();
      effectiveEventDate = current?.event_date;
    }
    if (effectiveEventDate) {
      if (filteredUpdates.event_end_date && new Date(filteredUpdates.event_end_date) < new Date(effectiveEventDate)) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'The event end date must be after the start date.'
        });
      }
      if (filteredUpdates.rsvp_deadline && new Date(filteredUpdates.rsvp_deadline) > new Date(effectiveEventDate)) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'The RSVP deadline must be on or before the event date.'
        });
      }
    }
  }

  try {
    // Slug uniqueness check if slug is being updated
    if (filteredUpdates.slug) {
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('slug', filteredUpdates.slug)
        .neq('id', eventId)
        .limit(1);

      if (existingEvent && existingEvent.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'SLUG_TAKEN',
          message: 'This event URL slug is already taken by another event.'
        });
      }
    }

    // Snapshot the date/venue before the write so we can tell if they materially
    // changed (and therefore whether attending guests should be notified).
    let priorWhen = null, priorWhere = null;
    if (filteredUpdates.event_date !== undefined || filteredUpdates.location_name !== undefined || filteredUpdates.location_address !== undefined) {
      const { data: before } = await supabase
        .from('events').select('event_date, location_name, location_address').eq('id', eventId).single();
      if (before) { priorWhen = before.event_date; priorWhere = before.location_name || before.location_address || null; }
    }

    const { data: event, error } = await supabase
      .from('events')
      .update({ ...filteredUpdates, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      // The pre-check above (line ~650) has a TOCTOU race — two concurrent PATCHes
      // to the same new slug can both pass the check and only one wins at the DB's
      // unique constraint. Convert that into the same friendly SLUG_TAKEN response
      // instead of letting it fall through as a raw 500.
      if (filteredUpdates.slug && (error.code === '23505' || (error.message || '').includes('duplicate key'))) {
        return res.status(409).json({
          success: false,
          error: 'SLUG_TAKEN',
          message: 'This event URL slug is already taken by another event.'
        });
      }
      throw error;
    }

    /**
     * PROPOSE, DO NOT BLAST.
     *
     * This used to dispatch the guest notification straight from here. That was
     * tolerable while it was email-only — an unwanted email is free and mildly
     * annoying. It is not tolerable now that the same moment can text several
     * hundred people: saving a typo'd venue, noticing, and saving the correction
     * would spend an organizer's allowance twice before any dialog appeared.
     *
     * So the PATCH reports what changed and how many it would reach, and the
     * organizer confirms on POST /notify-change. The changeKey travels with the
     * proposal so a stale dialog cannot blast about a change that has since been
     * superseded — see notifyGuestsOfChange.
     */
    let changeNotice = null;
    if (event && event.status === 'active') {
      const newWhere = event.location_name || event.location_address || null;
      const dateChanged = priorWhen !== null && String(priorWhen) !== String(event.event_date);
      const venueChanged = (filteredUpdates.location_name !== undefined || filteredUpdates.location_address !== undefined) && priorWhere !== newWhere;
      if (dateChanged || venueChanged) {
        const changed = [];
        if (dateChanged) changed.push('date');
        if (venueChanged) changed.push('venue');
        changeNotice = {
          changed,
          changeKey: computeChangeKey(event),
          ...(await countNotifiableGuests(eventId)),
        };
      }
    }

    return res.json({
      success: true,
      message: 'Event updated successfully.',
      event,
      // null unless a live event's date or venue actually moved. The dashboard
      // opens its confirm dialog on this being present.
      changeNotice,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * The dedupe key for one set of event details.
 *
 * Deliberately identical to the hash emailScheduler builds, and computed from the
 * SAME two fields, because the two have to agree: the PATCH hands this to the
 * dashboard, the dashboard hands it back on confirm, and the scheduler recomputes
 * it to build the per-guest ref. If they ever diverge, a confirm would either
 * blast a second time or silently do nothing.
 */
function computeChangeKey(event) {
  const where = event.location_name || event.location_address || '';
  return require('crypto').createHash('sha1')
    .update(`${event.event_date}|${where}`).digest('hex').slice(0, 12);
}

/**
 * How many guests a notification would actually reach, split by channel.
 *
 * The confirm dialog exists to make a broadcast a decision rather than an
 * accident, and a decision needs numbers. "118 guests will be emailed, 74 will
 * also get a text" is a decision; "notify guests?" is a coin flip.
 *
 * Counts only — no rows are read into memory, because this runs on a PATCH that
 * an organizer may repeat many times while editing.
 */
async function countNotifiableGuests(eventId) {
  try {
    const [{ count: parties }, { count: reachable }] = await Promise.all([
      supabase.from('rsvp_parties').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).in('response', ['yes', 'maybe']),
      supabase.from('rsvp_parties').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).in('response', ['yes', 'maybe']).eq('sms_consent', true),
    ]);
    return { parties: parties || 0, smsReachable: reachable || 0 };
  } catch {
    // A failed count must not block the save that triggered it. The dialog can
    // still ask; it just cannot promise a number.
    return { parties: null, smsReachable: null };
  }
}

/**
 * Tell guests about a change the organizer has already made and confirmed.
 * POST /api/v1/events/:eventId/notify-change   body: { changeKey, channels? }
 */
const notifyGuestsOfChange = async (req, res, next) => {
  const { eventId } = req.params;
  const { changeKey, channels } = req.body || {};
  const wanted = Array.isArray(channels) && channels.length ? channels : ['email', 'sms'];

  try {
    const { data: event, error } = await supabase
      .from('events').select('id, status, event_date, location_name, location_address').eq('id', eventId).single();
    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    /**
     * The stale-dialog guard.
     *
     * An organizer can leave the confirm open, change the venue again in another
     * tab, and then press Send. Without this they would broadcast the FIRST
     * change's key — deduping against a state that no longer exists, and telling
     * guests to expect a venue nobody is using. Recomputing and comparing turns
     * that into a 409 they can act on.
     */
    const current = computeChangeKey(event);
    if (changeKey && changeKey !== current) {
      return res.status(409).json({
        success: false,
        error: 'CHANGE_SUPERSEDED',
        message: 'These details changed again since you opened this. Review them and send once more.',
      });
    }

    const result = await require('../services/emailScheduler')
      .notifyGuestsOfEventChange(eventId, { includeSms: wanted.includes('sms'), force: true });

    return res.json({
      success: true,
      emailed: result.sent,
      texted: result.texted,
      message: `Told ${result.sent} ${result.sent === 1 ? 'guest' : 'guests'} by email`
        + (result.texted ? `, and ${result.texted} by text` : '') + '.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Call the event off.
 * POST /api/v1/events/:eventId/cancel   body: { reason?, notify? }
 *
 * A DEDICATED endpoint, not a status string in updateEvent's allowedFields, and
 * that separation is deliberate. Cancelling is irreversible from a guest's point
 * of view — once several hundred people have been told, un-telling them is not a
 * thing that exists. It must never become reachable by a generic PATCH that has
 * no confirmation semantics and no notification step.
 */
const cancelEvent = async (req, res, next) => {
  const { eventId } = req.params;
  const { reason = null, notify = true, channels } = req.body || {};

  // The organizer's channel choice is HONOURED, not assumed.
  //
  // This used to hardcode includeSms: true and ignore `channels` entirely — so an
  // organizer who deliberately unticked "also send a text" in the confirm dialog
  // had every consenting guest texted anyway, spending their balance against the
  // explicit choice they had just made. Defaulting to both when nothing is
  // specified is right; overriding a stated preference is not.
  const wanted = Array.isArray(channels) && channels.length ? channels : ['email', 'sms'];

  try {
    const { data: event, error } = await supabase
      .from('events').select('id, title, status, is_paid').eq('id', eventId).single();
    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (event.status === 'cancelled') {
      return res.status(409).json({
        success: false, error: 'ALREADY_CANCELLED',
        message: 'This event has already been cancelled.',
      });
    }
    if (event.status === 'draft') {
      return res.status(400).json({
        success: false, error: 'NOT_LIVE',
        message: 'This event was never published, so there is nothing to cancel. Delete it instead.',
      });
    }

    const { error: updateErr } = await supabase
      .from('events')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason ? String(reason).slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    if (updateErr) throw updateErr;

    // Everything else follows from the status: isEventLiveForGuests returns false
    // so the RSVP form closes, and every scheduler job filters on 'active' so
    // reminders and reports stop on their own.

    let emailed = 0, texted = 0;
    if (notify) {
      // force: true — this is the one notification that must survive
      // EMAIL_AUTOMATION_ENABLED being unset. An organizer who cancels and is
      // told "done" while nobody was contacted is the worst failure this feature
      // can have, and it would be completely silent.
      const result = await require('../services/emailScheduler')
        .notifyGuestsOfEventChange(eventId, { includeSms: wanted.includes('sms'), force: true });
      emailed = result.sent;
      texted = result.texted;
    }

    await supabase.from('activity_logs').insert({
      event_id: eventId,
      action: 'event_cancelled',
      entity_type: 'event',
      entity_id: eventId,
      metadata: { reason: reason || null, emailed, texted },
    }).then(() => {}, () => {});

    return res.json({
      success: true,
      emailed,
      texted,
      message: notify
        ? `Event cancelled. ${emailed} ${emailed === 1 ? 'guest was' : 'guests were'} emailed`
          + (texted ? `, and ${texted} texted` : '') + '.'
        : 'Event cancelled. No guests were notified.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch organizer dashboard metrics (statistics) for an event.
 * GET /api/v1/events/:eventId/stats
 */
const getEventStats = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    // 1. ONE rsvp_parties read (with embedded guests) powers both the response
    //    stats and the meal breakdown — party_size is derived from the guest count.
    const { data: parties, error: partyError } = await supabase
      .from('rsvp_parties')
      .select('id, response, companion_meal_counts, guests(id, meal_selection)')
      .eq('event_id', eventId);

    if (partyError) throw partyError;

    let stats = {
      invitedParties: parties.length,
      invitationsSent: 0,
      attendingParties: 0,
      attendingGuests: 0,
      declinedParties: 0,
      declinedGuests: 0,
      maybeParties: 0,
      maybeGuests: 0,
      pendingParties: 0,
      pendingGuests: 0,
      totalExpectedGuests: 0,
      checkedInGuests: 0,
      seatingAssignedGuests: 0
    };

    const mealSummary = {};
    parties.forEach(party => {
      const size = (party.guests || []).length || 1;
      if (isAcceptedResponse(party.response)) {
        stats.attendingParties++;
        stats.attendingGuests += size;
        // This total is what the caterer cooks to, so it has to count BOTH
        // sources. A named meal_selection is in practice the primary contact's;
        // companions are names only and their meals arrive as a per-party tally
        // (companion_meal_counts). Counting guest rows alone would report every
        // companion as "No Selection" and under-order every real dish.
        let counted = 0;
        (party.guests || []).forEach(g => {
          if (!g.meal_selection) return;
          mealSummary[g.meal_selection] = (mealSummary[g.meal_selection] || 0) + 1;
          counted++;
        });
        Object.entries(party.companion_meal_counts || {}).forEach(([meal, n]) => {
          const qty = Number(n);
          if (!Number.isFinite(qty) || qty <= 0) return;
          mealSummary[meal] = (mealSummary[meal] || 0) + qty;
          counted += qty;
        });
        // Whoever is left is genuinely unaccounted for — a guest the organizer
        // still has to chase, and the number they need to see.
        if (counted < size) mealSummary['No Selection'] = (mealSummary['No Selection'] || 0) + (size - counted);
      } else if (isDeclinedResponse(party.response)) {
        stats.declinedParties++;
        stats.declinedGuests += size;
      } else if (isMaybeResponse(party.response)) {
        stats.maybeParties++;
        stats.maybeGuests += size;
      } else {
        stats.pendingParties++;
        stats.pendingGuests += size;
      }
    });

    stats.totalExpectedGuests = stats.attendingGuests;

    // 2. Invitations-sent (distinct parties), check-in count and seating progress
    //    are independent — fetch them concurrently.
    const [invitationsRes, checkinRes, seatingRes] = await Promise.all([
      supabase.from('invitations').select('party_id').eq('event_id', eventId).in('status', ['sent', 'delivered', 'opened', 'responded']),
      // Undone check-ins are soft-deleted since migration 20260814000000 —
      // excluded so the dashboard's arrival counter matches the room.
      supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('event_id', eventId).is('deleted_at', null),
      supabase.from('seating_assignments').select('rsvp_parties(guests(id))').eq('event_id', eventId),
    ]);

    stats.invitationsSent = new Set((invitationsRes.data || []).map(i => i.party_id)).size;
    stats.checkedInGuests = checkinRes.count || 0;

    (seatingRes.data || []).forEach(sa => {
      if (sa.rsvp_parties) stats.seatingAssignedGuests += (sa.rsvp_parties.guests || []).length || 0;
    });

    return res.json({
      success: true,
      stats: {
        ...stats,
        mealSummary
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all events for the authenticated organizer.
 * GET /api/v1/events
 */
const getEvents = async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const userId = req.user.id;

    // 1. Fetch user's organization
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_user_id', userId)
      .limit(1);

    if (orgError) throw orgError;

    const org = orgs && orgs[0];
    if (!org) {
      return res.json({
        success: true,
        events: [],
        pagination: { page, limit, count: 0 }
      });
    }

    // 2. Fetch events matching organization id
    const { data: events, error, count } = await supabase
      .from('events')
      .select('*, event_payments(*)', { count: 'exact' })
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Resolve the "current plan" for paid events that predate tier snapshotting so
    // the Events section shows the right plan/guest cap instead of a blank/unlimited.
    const items = await Promise.all((events || []).map(withResolvedTier));
    return res.json({
      success: true,
      events: items,
      pagination: { page, limit, count: items.length, total: count }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin gets all events on the platform.
 * GET /api/v1/admin/events
 */
const getAdminEvents = async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: events, error, count: totalCount } = await supabase
      .from('events')
      .select('*, organizations(name, email), event_payments(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const items = events || [];
    return res.json({
      success: true,
      events: items,
      pagination: { page, limit, count: items.length, total: totalCount }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes an event and all related data (cascades via FK ON DELETE CASCADE).
 * DELETE /api/v1/events/:eventId
 */
const deleteEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const force = req.query.force === 'true' || req.query.force === '1';

    /**
     * A LIVE EVENT WITH GUESTS CANNOT BE DELETED SILENTLY.
     *
     * This is a hard delete that cascades through every related table, and until
     * now it was also the only way to call an event off. So an organizer whose
     * venue flooded pressed Delete, several hundred people were never told
     * anything, and every RSVP, seating chart and consent record went with them —
     * including the records we are required to be able to produce.
     *
     * Cancelling is what they actually want: guests get told, the RSVP form
     * closes, and the history survives. Delete stays available for the case it
     * was designed for — clearing out something nobody was ever invited to — and
     * `?force=true` remains for an organizer who genuinely means it.
     */
    if (!force) {
      const { data: event } = await supabase
        .from('events').select('status, is_paid').eq('id', eventId).maybeSingle();

      if (event && event.is_paid && (event.status === 'active' || event.status === 'paused')) {
        const { count } = await supabase
          .from('rsvp_parties').select('id', { count: 'exact', head: true })
          .eq('event_id', eventId);

        if ((count || 0) > 0) {
          return res.status(409).json({
            success: false,
            error: 'CANCEL_FIRST',
            guestCount: count,
            message: `This event has ${count} ${count === 1 ? 'guest' : 'guests'}. Cancel it instead — your guests will be told, and the event stays in your records. Deleting removes everything and tells nobody.`,
          });
        }
      }
    }

    // Delete event (cascades to all related tables via FK ON DELETE CASCADE)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    res.json({ success: true, message: 'Event and all related data deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches paginated activity log entries for an event.
 * GET /api/v1/events/:eventId/activity
 */
const getActivityLog = async (req, res, next) => {
  const { eventId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: logs, error, count: totalCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return res.json({
      success: true,
      logs: logs || [],
      pagination: { page, limit, count: (logs || []).length, total: totalCount }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEvent,
  getPublicEventBySlug,
  updateEvent,
  getEventStats,
  getAdminEvents,
  deleteEvent,
  cancelEvent,
  notifyGuestsOfChange,
  getActivityLog
};
