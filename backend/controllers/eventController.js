const { supabase } = require('../config/supabase');

/**
 * Creates a new event in draft state.
 * POST /api/v1/events
 */
const createEvent = async (req, res, next) => {
  const { slug, templateType, title, description, eventDate, locationName, locationAddress } = req.body;

  if (!slug || !templateType || !title || !eventDate) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'slug, templateType, title, and eventDate are required fields.'
    });
  }

  // URL Slug format validation (lowercase, alphanumeric, dashes)
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SLUG',
      message: 'Slug must contain only lowercase alphanumeric characters and single dashes.'
    });
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

    // Check slug availability
    const { data: existingEvent } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingEvent) {
      // Recommend alternative slug
      const suggestedSlug = `${slug}-${new Date(eventDate).getFullYear()}`;
      return res.status(409).json({
        success: false,
        error: 'SLUG_TAKEN',
        message: 'This event URL is already taken.',
        suggestedSlug
      });
    }

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        org_id: orgId,
        slug,
        template_type: templateType,
        title,
        description,
        event_date: eventDate,
        location_name: locationName,
        location_address: locationAddress,
        status: 'draft',
        is_paid: false
      })
      .select()
      .single();

    if (error) throw error;

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
      .select('*, rsvp_form_fields(*)')
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
        title,
        description,
        event_date,
        location_name,
        location_address,
        dress_code,
        rsvp_deadline,
        privacy_mode,
        cover_image_url,
        gallery_urls,
        custom_colors,
        custom_fonts,
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

    // Privacy mode enforcement
    if (event.privacy_mode === 'private') {
      return res.status(403).json({
        success: false,
        error: 'EVENT_PRIVATE',
        message: 'This event is private. Access requires a direct invitation link.'
      });
    }

    if (event.privacy_mode === 'password') {
      const providedPassword = req.query.password || req.headers['x-event-password'];
      if (!providedPassword || providedPassword !== event.access_password) {
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

    return res.json({ success: true, event: publicEvent });
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
    'custom_fonts'
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
      filteredUpdates[field] = req.body[field];
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

  try {
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
      if (rsvp.response === 'yes') {
        stats.attendingParties++;
        stats.attendingGuests += rsvp.party_size;
      } else if (rsvp.response === 'no') {
        stats.declinedParties++;
        stats.declinedGuests += rsvp.party_size;
      } else {
        stats.pendingParties++;
        stats.pendingGuests += rsvp.party_size;
      }
    });

    stats.totalExpectedGuests = stats.attendingGuests;

    // 2. Fetch meals count summary
    const { data: attendingRsvps } = await supabase
      .from('rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('response', 'yes');
      
    const attendingRsvpIds = (attendingRsvps || []).map(r => r.id);
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
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('org_id', org.id)
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
      .select('*, organizations(name, email)')
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
