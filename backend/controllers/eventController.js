const { supabase } = require('../config/supabase');
const { deriveBaseSlug, generateUniqueSlug } = require('../utils/slugHelper');
const { generateQRCodeDataURL } = require('../utils/qrHelper');
<<<<<<< HEAD
const { getPublicBaseUrl } = require('../utils/publicUrl');
=======
const { isAcceptedResponse, isDeclinedResponse } = require('../utils/responseHelpers');
>>>>>>> a7831309379500d099c90f8cdde056a56d9a894d
const logger = require('../utils/logger');

/** Strict UUID matcher — used to validate invitation tokens before querying. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    eventType, backgroundMusicUrl
  } = req.body;

  if (!templateType || !title || !eventDate) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'templateType, title, and eventDate are required fields.'
    });
  }

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

    const eventYear = new Date(eventDate).getFullYear();
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
      const baseSlug = deriveBaseSlug({ title, templateType, templateData });
      finalSlug = await generateUniqueSlug(supabase, baseSlug, { year: eventYear });
    }

    // Build insert payload with all available fields
    const insertPayload = {
      org_id: orgId,
      slug: finalSlug,
      template_type: templateType,
      title,
      description: description || null,
      event_date: eventDate,
      event_end_date: eventEndDate || null,
      location_name: locationName || null,
      location_address: locationAddress || null,
      location_lat: locationLat || null,
      location_lng: locationLng || null,
      location_place_id: locationPlaceId || null,
      dress_code: dressCode || null,
      rsvp_deadline: rsvpDeadline || null,
      privacy_mode: privacyMode || 'private',
      access_password: accessPassword || null,
      cover_image_url: coverImageUrl || null,
      gallery_urls: galleryUrls || [],
      custom_colors: customColors || {},
      custom_fonts: customFonts || {},
      template_data: templateData || {},
      event_type: eventType || 'wedding',
      background_music_url: backgroundMusicUrl || null,
      status: 'draft',
      is_paid: false
    };

    let event, error;

    // Attempt insert
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

    if (error) {
      logger.error({
        err: error,
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
        insertPayloadKeys: Object.keys(insertPayload),
        userId: req.user?.id,
        slug: finalSlug,
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
      .select('*, rsvp_form_fields(*), event_payments(*)')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    return res.json({ success: true, event });
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
        rsvp_form_fields(*)
      `)
      .eq('slug', slug)
      .single();

    if (error || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }

    if (!event.is_paid && event.slug !== 'demo') {
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: 'This event page is currently offline pending payment activation.'
      });
    }

    // ─── Invitation Token Bypass ───
    // An optional rsvp_id query param acts as a per-guest invitation token. When it
    // strictly resolves to an RSVP belonging to THIS event, we (a) unlock private
    // events and (b) return that guest's own RSVP so the form can be pre-filled.
    // It never widens access to other events (event_id is enforced) and is validated
    // as a UUID before hitting the DB to avoid malformed-input errors.
    const invitationRsvpId = req.query.rsvp_id;
    let guestRsvp = null;
    if (invitationRsvpId && UUID_REGEX.test(invitationRsvpId)) {
      const { data: rsvpRecord } = await supabase
        .from('rsvps')
        .select('id, guest_name, email, phone, response, party_size, notes')
        .eq('id', invitationRsvpId)
        .eq('event_id', event.id)
        .maybeSingle();
      if (rsvpRecord) guestRsvp = rsvpRecord;
    }

    // Privacy mode enforcement
    if (event.privacy_mode === 'private') {
      // A valid invitation token (rsvp_id linked to this event) bypasses the lock.
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

      const crypto = require('crypto');
      const providedBuf = Buffer.from(String(providedPassword || ''), 'utf8');
      const storedBuf = Buffer.from(event.access_password, 'utf8');
      const maxLen = Math.max(providedBuf.length, storedBuf.length, 1);
      const paddedProvided = Buffer.alloc(maxLen); providedBuf.copy(paddedProvided);
      const paddedStored = Buffer.alloc(maxLen); storedBuf.copy(paddedStored);
      const isMatch = providedBuf.length === storedBuf.length && crypto.timingSafeEqual(paddedProvided, paddedStored);

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
    'notification_preferences'
  ];

  // Status can only be set to 'paused' or 'completed' by organizer.
  // 'active' status requires payment and is set by the webhook.
  if (req.body.status && ['paused', 'completed'].includes(req.body.status)) {
    allowedFields.push('status');
  } else if (req.body.status === 'active') {
    return res.status(403).json({
      success: false,
      error: 'STATUS_FORBIDDEN',
      message: 'Event status cannot be set to active manually. It is activated upon payment.'
    });
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

    const { data: event, error } = await supabase
      .from('events')
      .update({ ...filteredUpdates, updated_at: new Date() })
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Event updated successfully.',
      event
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
    // 1. Fetch RSVPs aggregations
    const { data: rsvps, error: rsvpError } = await supabase
      .from('rsvps')
      .select('response, party_size')
      .eq('event_id', eventId);

    if (rsvpError) throw rsvpError;

    let stats = {
      invitedParties: rsvps.length,
      attendingParties: 0,
      attendingGuests: 0,
      declinedParties: 0,
      declinedGuests: 0,
      pendingParties: 0,
      pendingGuests: 0,
      totalExpectedGuests: 0,
      checkedInGuests: 0,
      seatingAssignedGuests: 0
    };

    rsvps.forEach(rsvp => {
      const size = rsvp.party_size || 1;
      if (isAcceptedResponse(rsvp.response)) {
        stats.attendingParties++;
        stats.attendingGuests += size;
      } else if (isDeclinedResponse(rsvp.response)) {
        stats.declinedParties++;
        stats.declinedGuests += size;
      } else {
        stats.pendingParties++;
        stats.pendingGuests += size;
      }
    });

    stats.totalExpectedGuests = stats.attendingGuests;

    // 2. Fetch meals count summary (normalize response check to match aggregation above)
    const { data: attendingRsvps } = await supabase
      .from('rsvps')
      .select('id, response')
      .eq('event_id', eventId);

    const attendingRsvpIds = (attendingRsvps || [])
      .filter(r => isAcceptedResponse(r.response))
      .map(r => r.id);
    let meals = [];
    if (attendingRsvpIds.length > 0) {
      const { data: fetchedMeals } = await supabase
        .from('rsvp_guests')
        .select('meal_selection')
        .in('rsvp_id', attendingRsvpIds);
      meals = fetchedMeals || [];
    }
    
    const mealSummary = {};
    if (meals) {
      meals.forEach(m => {
        const meal = m.meal_selection || 'No Selection';
        mealSummary[meal] = (mealSummary[meal] || 0) + 1;
      });
    }

    // 3. Fetch check-in arrival stats
    const { count: checkedInCount } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
    
    stats.checkedInGuests = checkedInCount || 0;

    // 4. Seating progress
    const { data: seatingAssignments } = await supabase
      .from('seating_assignments')
      .select('rsvps(party_size)')
      .eq('event_id', eventId);
    
    if (seatingAssignments) {
      seatingAssignments.forEach(sa => {
        if (sa.rsvps) {
          stats.seatingAssignedGuests += sa.rsvps.party_size;
        }
      });
    }

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

    const items = events || [];
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
    const { data: events, error } = await supabase
      .from('events')
      .select('*, organizations(name, email), event_payments(*)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const items = events || [];
    return res.json({
      success: true,
      events: items,
      pagination: { page, limit, count: items.length }
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
  getActivityLog
};
