const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const notificationService = require('../utils/notificationService');
const { parseCSV, generateCSV } = require('../utils/csvHelper');
const { escapeHtml, getDeclineConfirmationTemplate } = require('../utils/emailTemplates');

/** Escape special characters in user input before using it in a LIKE / ILIKE pattern. */
function escapeLikePattern(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/** Guest-facing seating becomes visible only within this window before event start. */
const SEATING_REVEAL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/** True once we're within 24h of the event start (seating may be shown to guests). */
function isSeatingRevealed(eventDate) {
  if (!eventDate) return false;
  const start = new Date(eventDate).getTime();
  if (Number.isNaN(start)) return false;
  return Date.now() >= start - SEATING_REVEAL_WINDOW_MS;
}

/** ISO timestamp of the moment seating unlocks (event start − 24h), or null. */
function seatingRevealAtISO(eventDate) {
  const start = new Date(eventDate).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start - SEATING_REVEAL_WINDOW_MS).toISOString();
}

/** Locale-aware natural comparator: "Table 2" < "Table 10", and orders Arabic names. */
function naturalCompare(a, b) {
  return String(a == null ? '' : a)
    .localeCompare(String(b == null ? '' : b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sort RSVP rows for export.
 *  - 'name'  → alphabetical by guest name (A→Z / أ→ي)
 *  - 'table' → grouped/sequenced by table name (unassigned last; A→Z within a table)
 */
function sortRsvpsForExport(rows, sort) {
  const tableNameOf = (r) => {
    const sa = r.seating_assignments;
    const first = Array.isArray(sa) ? sa[0] : sa;
    return first?.tables?.table_name || '';
  };
  const list = [...(rows || [])];
  if (sort === 'table') {
    list.sort((a, b) => {
      const ta = tableNameOf(a), tb = tableNameOf(b);
      if (!ta && tb) return 1;   // unassigned sinks to the bottom
      if (ta && !tb) return -1;
      const cmp = naturalCompare(ta, tb);
      return cmp !== 0 ? cmp : naturalCompare(a.guest_name, b.guest_name);
    });
  } else {
    list.sort((a, b) => naturalCompare(a.guest_name, b.guest_name));
  }
  return list;
}

/**
 * Handles guest RSVP form submissions (supports both inserts and updates).
 * POST /api/v1/public/events/:slug/rsvp
 */
const submitPublicRSVP = async (req, res, next) => {
  const { slug } = req.params;
  const { rsvpId, guestName, email, phone, response, partySize, notes, additionalGuests, primaryGuestMeal, customAnswers } = req.body;

  // Normalize email once so duplicate detection, ownership checks, and the stored
  // value all agree (matches updateRSVP / addGuestManually and the partial unique
  // index). Without this, "John@x.com" and "john@x.com" slip past the dup guard.
  const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : null;

  if (!guestName || !response) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'guestName and response are required.'
    });
  }

  try {
    // 1. Resolve event from slug
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, org_id, rsvp_deadline, title, is_paid, slug, notification_preferences')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    // Block RSVPs if the event is unpaid and not a demo
    if (!event.is_paid && event.slug !== 'demo') {
      return res.status(402).json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: 'This event page is inactive because payment has not been completed.'
      });
    }

    // 2. Check RSVP deadline
    if (event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
      return res.status(400).json({
        success: false,
        error: 'DEADLINE_PASSED',
        message: 'The RSVP deadline for this event has passed.'
      });
    }

    // Validate additional guests names if attending with a party size > 1
    if (response === 'yes') {
      // Validate meal selections against options if field exists
      const { data: mealField } = await supabase
        .from('rsvp_form_fields')
        .select('options, is_required')
        .eq('event_id', event.id)
        .eq('field_key', 'meal_selection')
        .maybeSingle();

      if (mealField) {
        const mealOptions = Array.isArray(mealField.options) ? mealField.options : [];
        const isMealRequired = !!mealField.is_required;

        if (mealOptions.length > 0 || isMealRequired) {
          // Validate primary guest meal
          if (isMealRequired && (!primaryGuestMeal || !primaryGuestMeal.trim())) {
            return res.status(400).json({
              success: false,
              error: 'VALIDATION_ERROR',
              message: 'Meal selection is required for the primary guest.'
            });
          }
          if (primaryGuestMeal && mealOptions.length > 0 && !mealOptions.includes(primaryGuestMeal)) {
            return res.status(400).json({
              success: false,
              error: 'VALIDATION_ERROR',
              message: `Meal selection '${primaryGuestMeal}' is invalid. Valid options are: ${mealOptions.join(', ')}`
            });
          }

          // Validate additional guests meals
          const size = partySize || 1;
          if (size > 1 && additionalGuests && Array.isArray(additionalGuests)) {
            for (let idx = 0; idx < size - 1; idx++) {
              const g = additionalGuests[idx];
              const meal = g?.mealSelection;
              if (isMealRequired && (!meal || !meal.trim())) {
                return res.status(400).json({
                  success: false,
                  error: 'VALIDATION_ERROR',
                  message: `Meal selection is required for Guest #${idx + 2} (${g?.fullName || 'Additional Guest'}).`
                });
              }
              if (meal && mealOptions.length > 0 && !mealOptions.includes(meal)) {
                return res.status(400).json({
                  success: false,
                  error: 'VALIDATION_ERROR',
                  message: `Meal selection '${meal}' for Guest #${idx + 2} is invalid. Valid options are: ${mealOptions.join(', ')}`
                });
              }
            }
          }
        }
      }

      const size = partySize || 1;
      if (size > 1) {
        if (!additionalGuests || !Array.isArray(additionalGuests) || additionalGuests.length < size - 1) {
          return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: `Please provide details for all ${size - 1} additional guests.`
          });
        }
        for (let idx = 0; idx < size - 1; idx++) {
          const g = additionalGuests[idx];
          if (!g || !g.fullName || !g.fullName.trim()) {
            return res.status(400).json({
              success: false,
              error: 'VALIDATION_ERROR',
              message: `Guest #${idx + 2} must have a valid full name.`
            });
          }
        }
      }
    }

    const computedPartySize = response === 'yes' ? (partySize || 1) : 1;
    let rsvp;

    if (rsvpId) {
      // 3a. Always verify the caller owns this RSVP (email must match original submission)
      const { data: existingRsvp } = await supabase
        .from('rsvps')
        .select('email')
        .eq('id', rsvpId)
        .eq('event_id', event.id)
        .single();

      if (!existingRsvp) {
        return res.status(404).json({
          success: false,
          error: 'RSVP_NOT_FOUND',
          message: 'The RSVP record was not found.'
        });
      }

      // Ownership enforcement.
      //  • If the record HAS an email, the caller must supply a matching email — this
      //    proves ownership for self-service (search-then-update) edits.
      //  • If the record has NO email (host-imported guest), the only way to obtain its
      //    rsvpId is the host's private invitation link: the rsvpId is itself the
      //    capability token. The public name-search deliberately does NOT expose ids
      //    for null-email records (see searchPublicGuests), so this is not the IDOR
      //    vector it would otherwise be, and it lets invited guests respond.
      if (existingRsvp.email) {
        if (!normalizedEmail || existingRsvp.email.toLowerCase() !== normalizedEmail) {
          return res.status(403).json({
            success: false,
            error: 'RSVP_OWNERSHIP_FAILED',
            message: 'Email does not match the original RSVP submission. You cannot modify this RSVP.'
          });
        }
      }

      // 3b. Update existing RSVP record
      const { data: updatedRsvp, error: rsvpError } = await supabase
        .from('rsvps')
        .update({
          guest_name: guestName,
          email: normalizedEmail,
          phone,
          response,
          party_size: computedPartySize,
          notes,
          updated_at: new Date()
        })
        .eq('id', rsvpId)
        .eq('event_id', event.id)
        .select()
        .single();

      if (rsvpError) throw rsvpError;
      rsvp = updatedRsvp;

      // Clean up child records to allow clean updates
      await supabase.from('rsvp_guests').delete().eq('rsvp_id', rsvp.id);
      await supabase.from('custom_answers').delete().eq('rsvp_id', rsvp.id);

      // If updating response to 'no', remove seating assignments
      if (response === 'no') {
        await supabase.from('seating_assignments').delete().eq('rsvp_id', rsvp.id);
      }
    } else {
      // 3. Check for duplicate RSVP
      if (normalizedEmail) {
        const { data: existingRsvp } = await supabase
          .from('rsvps')
          .select('id')
          .eq('event_id', event.id)
          .eq('email', normalizedEmail)
          .neq('response', 'no')
          .limit(1);

        if (existingRsvp && existingRsvp.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'DUPLICATE_RSVP',
            message: 'An RSVP with this email already exists for this event. Use the search page to update your existing RSVP.'
          });
        }
      }

      // 4. Insert new RSVP record
      const { data: insertedRsvp, error: rsvpError } = await supabase
        .from('rsvps')
        .insert({
          event_id: event.id,
          guest_name: guestName,
          email: normalizedEmail,
          phone,
          response,
          party_size: computedPartySize,
          notes
        })
        .select()
        .single();

      if (rsvpError) throw rsvpError;
      rsvp = insertedRsvp;
    }

    // 4. Insert detailed guest records if attending
    if (response === 'yes') {
      const guestRows = [];

      // Add primary guest
      guestRows.push({
        rsvp_id: rsvp.id,
        full_name: guestName,
        is_primary: true,
        meal_selection: primaryGuestMeal || null
      });

      // Add party members
      if (additionalGuests && Array.isArray(additionalGuests)) {
        additionalGuests.forEach(g => {
          guestRows.push({
            rsvp_id: rsvp.id,
            full_name: g.fullName,
            is_primary: false,
            meal_selection: g.mealSelection || null,
            dietary_notes: g.dietaryNotes || null
          });
        });
      }

      const { error: guestInsertError } = await supabase
        .from('rsvp_guests')
        .insert(guestRows);

      if (guestInsertError) throw guestInsertError;

      // 5. Insert custom answers if provided
      if (customAnswers && Array.isArray(customAnswers) && customAnswers.length > 0) {
        const answerRows = customAnswers.map(ans => ({
          rsvp_id: rsvp.id,
          field_id: ans.fieldId,
          answer_value: ans.value
        }));

        await supabase.from('custom_answers').insert(answerRows);
      }
    }

    // Insert activity log entry
    await supabase.from('activity_logs').insert({
      event_id: event.id,
      action: 'rsvp_submitted',
      entity_type: 'rsvp',
      entity_id: rsvp.id,
      metadata: { guest_name: guestName, response, party_size: computedPartySize }
    });

    // 6. Broadcast RSVP update via real-time channel
    const rsvpChannel = supabase.channel(`event-${event.id}`);
    await rsvpChannel.send({
      type: 'broadcast',
      event: 'rsvp_submitted',
      payload: {
        rsvpId: rsvp.id,
        guestName: rsvp.guest_name,
        response: rsvp.response,
        partySize: computedPartySize
      }
    });
    supabase.removeChannel(rsvpChannel);

    // 7. Trigger confirmation or decline email asynchronously if email exists
    if (normalizedEmail) {
      if (response === 'yes') {
        notificationService.sendConfirmationEmail(event.id, rsvp.id)
          .catch((err) => console.error('Confirmation email err:', err));
      } else if (response === 'no') {
        // Send decline thank-you email
        const declineHtml = getDeclineConfirmationTemplate(rsvp, event);
        notificationService.sendEmailViaBrevo(normalizedEmail, `Thank You – ${escapeHtml(event.title)}`, declineHtml)
          .catch((err) => console.error('Decline email err:', err));
      }
    }

    // 8. Notify organizer of new RSVP
    try {
      const isEmailPref = !event.notification_preferences || event.notification_preferences.email !== false;
      const isWhatsappPref = !!event.notification_preferences?.whatsapp;

      if (isEmailPref || isWhatsappPref) {
        const { data: org } = await supabase
          .from('organizations')
          .select('email, name, phone')
          .eq('id', event.org_id || '')
          .single();

        if (org) {
          if (isEmailPref && org.email) {
            const { sendEmailViaBrevo } = require('../utils/notificationService');
            const orgEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <span style="font-size: 12px; font-weight: bold; color: #10b981; text-transform: uppercase; letter-spacing: 0.15em;">NEW RSVP RECEIVED</span>
                  <h2 style="color: #0b0f19; margin: 5px 0 0 0; font-family: Georgia, serif; font-weight: normal;">${escapeHtml(event.title)}</h2>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;" />
                <p style="color: #334155; font-size: 15px; line-height: 1.6;"><strong>${escapeHtml(guestName)}</strong> has ${response === 'yes' ? 'accepted' : response === 'no' ? 'declined' : 'submitted an RSVP for'} your event invitation.</p>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 8px; margin: 20px 0; padding: 15px;">
                  <tr><td style="padding: 8px 15px; color: #64748b; font-size: 13px;">Response</td><td style="padding: 8px 15px; font-size: 15px; font-weight: 600; color: ${response === 'yes' ? '#10b981' : '#ef4444'};">${response === 'yes' ? 'Attending' : 'Declined'}</td></tr>
                  <tr><td style="padding: 8px 15px; color: #64748b; font-size: 13px;">Party Size</td><td style="padding: 8px 15px; font-size: 15px;">${computedPartySize}</td></tr>
                  ${normalizedEmail ? '<tr><td style="padding: 8px 15px; color: #64748b; font-size: 13px;">Email</td><td style="padding: 8px 15px; font-size: 15px;">' + escapeHtml(normalizedEmail) + '</td></tr>' : ''}
                </table>
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated notification from Fancy RSVP.</p>
              </div>
            `;
            sendEmailViaBrevo(org.email, `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(event.title)}`, orgEmailHtml)
              .catch(err => console.error('Failed to notify organizer via email:', err.message));
          }

          if (isWhatsappPref && org.phone) {
            const { getTwilioClient } = require('../utils/twilioClient');
            const twilio = getTwilioClient();
            const messageText = `New RSVP Received for ${event.title}: ${guestName} has replied ${response === 'yes' ? 'Attending (Party of ' + computedPartySize + ')' : 'Declined'}. — Fancy RSVP`;

            if (twilio) {
              twilio.messages.create({
                body: messageText,
                from: 'whatsapp:+14155238886',
                to: `whatsapp:${org.phone}`
              }).catch(err => console.error('Failed to notify organizer via WhatsApp:', err.message));
            } else {
              logger.info(`[MOCK WHATSAPP NOTIFICATION] To: ${org.phone} | Content: ${messageText}`);
            }
          }
        }
      }
    } catch (orgNotifyErr) {
      console.error('Organizer notification error:', orgNotifyErr.message);
    }

    return res.status(201).json({
      success: true,
      message: rsvpId ? 'RSVP updated successfully.' : 'RSVP submitted successfully.',
      rsvpId: rsvp.id
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a single guest invitation by its RSVP id (public endpoint).
 * Powers the personalized invitation link (`/events/rsvp/:guestId`) and the
 * token-prefill branch of the public RSVP page (`/:slug?g=:guestId`).
 * GET /api/v1/public/rsvp/guest/:guestId
 */
const getGuestById = async (req, res, next) => {
  const { guestId } = req.params;

  try {
    const { data: rsvp, error } = await supabase
      .from('rsvps')
      .select(`
        id, guest_name, email, phone, party_size, notes, response,
        events!inner(slug, is_paid, status, event_date),
        seating_assignments(tables(table_name))
      `)
      .eq('id', guestId)
      .single();

    if (error || !rsvp) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND' });
    }

    // Only expose invitations for live (paid + active) event pages.
    if (!rsvp.events.is_paid || rsvp.events.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }

    // Withhold the table assignment until 24h before the event (seating reveal window).
    const seatingRevealed = isSeatingRevealed(rsvp.events.event_date);
    const tableName = seatingRevealed ? (rsvp.seating_assignments?.[0]?.tables?.table_name || null) : null;

    return res.json({
      success: true,
      slug: rsvp.events.slug,
      seatingLocked: !seatingRevealed,
      revealAt: seatingRevealed ? null : seatingRevealAtISO(rsvp.events.event_date),
      guest: {
        id: rsvp.id,
        guest_name: rsvp.guest_name,
        email: rsvp.email,
        phone: rsvp.phone,
        party_size: rsvp.party_size,
        notes: rsvp.notes,
        response: rsvp.response,
        table_name: tableName
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches pre-registered guest invitations by name (public endpoint).
 * GET /api/v1/public/events/:slug/rsvp/search
 */
const searchPublicGuests = async (req, res, next) => {
  const { slug } = req.params;
  const { query } = req.query;

  if (!query || !query.trim()) {
    return res.json({ success: true, results: [] });
  }

  try {
    // 1. Resolve event from slug. Only live (paid + active) events expose a guest
    // list — never a draft/unpaid/refunded event, to avoid leaking the invitee
    // roster of an event that isn't yet (or no longer) public.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }

    // 2. Search guests matching query prefix/substring.
    const { data, error } = await supabase
      .from('rsvps')
      .select('id, guest_name, response, email')
      .eq('event_id', event.id)
      .ilike('guest_name', `%${escapeLikePattern(query.trim())}%`)
      .limit(10);

    if (error) throw error;

    return res.json({
      success: true,
      results: data.map(item => ({
        // Only expose the rsvpId when the record has an email — updating such a record
        // still requires a matching email, so the id is safe to surface. For null-email
        // (host-imported) guests we withhold the id: their only authorized entry point
        // is the host's private invitation link (which carries the id directly).
        id: item.email ? item.id : null,
        guestName: item.guest_name,
        response: item.response
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists RSVPs for an event (Organizer dashboard endpoint).
 * Supports server-side filtering by response, search, seated status, and sorting.
 * GET /api/v1/events/:eventId/rsvps
 */
const getRSVPs = async (req, res, next) => {
  const { eventId } = req.params;
  const { response, search, seated, sort, meal, customFieldId, customFieldValue } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // The seated/meal/custom-answer filters run against embedded relations that we
  // can't paginate server-side here. When any is active we fetch a bounded superset
  // and do the filtering + pagination in JS — otherwise the filter would only see
  // the current page and return incomplete, inconsistently-counted results.
  const hasPostFilter =
    seated === 'true' || seated === 'false' ||
    !!(meal && meal.trim()) ||
    !!customFieldId;
  const POST_FILTER_FETCH_CAP = 5000;

  try {
    // Build fallback chain: try full select + submitted_at, then full + created_at, then simple + created_at
    const fullSelect = '*, rsvp_guests(*), custom_answers(*), seating_assignments(id, table_id, tables(table_name))';
    const simpleSelect = '*, rsvp_guests(*), custom_answers(*)';
    const fallbacks = [
      { sel: fullSelect, sortCol: 'submitted_at' },
      { sel: fullSelect, sortCol: 'created_at' },
      { sel: simpleSelect, sortCol: 'created_at' },
    ];

    let rsvps, queryError, totalCount;

    for (const { sel, sortCol } of fallbacks) {
      let query = supabase
        .from('rsvps')
        .select(sel, { count: 'exact' })
        .eq('event_id', eventId);

      // Apply filters
      if (response && ['yes', 'no', 'pending'].includes(response)) {
        query = query.eq('response', response);
      }
      if (search && search.trim()) {
        query = query.ilike('guest_name', `%${escapeLikePattern(search.trim())}%`);
      }

      // Apply sorting
      switch (sort) {
        case 'name_asc':
          query = query.order('guest_name', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('guest_name', { ascending: false });
          break;
        case 'date_asc':
          query = query.order(sortCol, { ascending: true });
          break;
        default:
          query = query.order(sortCol, { ascending: false });
      }

      query = hasPostFilter ? query.limit(POST_FILTER_FETCH_CAP) : query.range(from, to);
      const result = await query;

      if (!result.error) {
        rsvps = result.data;
        totalCount = result.count;
        queryError = null;
        break;
      }

      queryError = result.error;
      // If it's a column/relation error, try next fallback
      const msg = result.error.message || '';
      const code = result.error.code || '';
      if (code === '42703' || code === 'PGRST200' || msg.includes('column') || msg.includes('relation')) {
        continue;
      }
      // Other errors — throw immediately
      throw result.error;
    }

    if (queryError) throw queryError;

    // Apply post-filters. When hasPostFilter is set, `rsvps` is the bounded
    // superset (not a single page), so filtering here covers the whole dataset.
    let filtered = rsvps || [];

    if (seated === 'true') {
      filtered = filtered.filter(r => r.seating_assignments && r.seating_assignments.length > 0);
    } else if (seated === 'false') {
      filtered = filtered.filter(r => !r.seating_assignments || r.seating_assignments.length === 0);
    }

    if (meal && meal.trim()) {
      filtered = filtered.filter(r =>
        r.rsvp_guests && r.rsvp_guests.some(g => g.meal_selection === meal.trim())
      );
    }

    if (customFieldId) {
      filtered = filtered.filter(r =>
        r.custom_answers && r.custom_answers.some(ans =>
          ans.field_id === customFieldId &&
          (!customFieldValue || String(ans.answer_value).trim().toLowerCase() === String(customFieldValue).trim().toLowerCase())
        )
      );
    }

    let pageItems, total;
    if (hasPostFilter) {
      // `filtered` is the full matching set → its length is the real total, and we
      // paginate it in JS so the returned page and count are consistent.
      total = filtered.length;
      pageItems = filtered.slice(from, to + 1);
    } else {
      // No post-filter: the DB already applied range pagination and an exact count.
      pageItems = filtered;
      total = totalCount;
    }

    return res.json({
      success: true,
      rsvps: pageItems,
      pagination: { page, limit, count: pageItems.length, total }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Imports guest records in bulk from a CSV text string.
 * POST /api/v1/events/:eventId/rsvps/import
 */
const importGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  const { csvData, fileData, fileName } = req.body;

  if (!csvData && !fileData) {
    return res.status(400).json({ success: false, error: 'csvData or fileData string is required.' });
  }

  try {
    let parsedRows = [];

    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      const isExcel = fileName && fileName.toLowerCase().endsWith('.xlsx');

      if (isExcel) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        const headers = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.text ? cell.text.trim().toLowerCase().replace(/\s+/g, '_') : '';
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowObj = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              rowObj[header] = cell.text ? cell.text.trim() : '';
            }
          });

          // support flexible field headers
          const mappedRow = {
            guest_name: rowObj.guest_name || rowObj.name || rowObj.guest || '',
            email: rowObj.email || '',
            phone: rowObj.phone || '',
            party_size: parseInt(rowObj.party_size || rowObj.size || rowObj.count || '1') || 1,
            notes: rowObj.notes || rowObj.note || ''
          };

          if (mappedRow.guest_name) {
            parsedRows.push(mappedRow);
          }
        });
      } else {
        const csvText = buffer.toString('utf-8');
        parsedRows = parseCSV(csvText);
      }
    } else {
      parsedRows = parseCSV(csvData);
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ success: false, error: 'NO_VALID_ROWS', message: 'No valid data rows found.' });
    }

    if (parsedRows.length > 500) {
      return res.status(400).json({ success: false, error: 'FILE_TOO_LARGE', message: 'Import limited to 500 rows per batch. Please split your file.' });
    }

    // Dedup within the file by email (case-insensitive). Rows without an email are
    // always kept — the partial unique index only collides on non-null emails.
    const seenEmails = new Set();
    let skippedInFile = 0;
    const dedupedRows = [];
    for (const row of parsedRows) {
      const emailKey = (row.email || '').trim().toLowerCase();
      if (emailKey) {
        if (seenEmails.has(emailKey)) { skippedInFile++; continue; }
        seenEmails.add(emailKey);
      }
      dedupedRows.push(row);
    }

    const toInsertRow = (row) => ({
      event_id: eventId,
      guest_name: row.guest_name || 'Unnamed Guest',
      // Lowercase on write so stored emails agree with the in-file dedup key, the
      // RSVP duplicate-detection lookups, and the partial unique index (which is
      // case-sensitive). Without this, "John@x.com" and "john@x.com" both slip in.
      email: row.email ? row.email.trim().toLowerCase() : null,
      phone: row.phone || null,
      response: 'pending',
      party_size: parseInt(row.party_size) || 1,
      notes: row.notes || null
    });

    // Insert in chunks. Any chunk-level error (a duplicate-key 23505 against an
    // already-imported/already-RSVP'd email, or any other constraint violation)
    // aborts the whole chunk, so we retry that chunk row-by-row: good rows still
    // import, duplicates are skipped, and only genuinely bad rows are collected
    // as errors. This keeps a single malformed row from failing the whole batch.
    const CHUNK = 100;
    const imported = [];
    let skippedExisting = 0;
    const errors = [];

    for (let i = 0; i < dedupedRows.length; i += CHUNK) {
      const chunk = dedupedRows.slice(i, i + CHUNK).map(toInsertRow);
      const { data, error } = await supabase
        .from('rsvps')
        .insert(chunk)
        .select('id, guest_name');

      if (!error) {
        imported.push(...data);
        continue;
      }

      // Chunk failed — retry each row individually to isolate the offenders.
      for (const single of chunk) {
        const { data: one, error: oneErr } = await supabase
          .from('rsvps')
          .insert(single)
          .select('id, guest_name')
          .single();
        if (!oneErr) imported.push(one);
        else if (oneErr.code === '23505') skippedExisting++;
        else errors.push({ guest_name: single.guest_name, error: oneErr.message });
      }
    }

    const skippedCount = skippedInFile + skippedExisting;

    return res.status(201).json({
      success: true,
      message: `Imported ${imported.length} guest record(s) in pending state`
        + (skippedCount ? `; skipped ${skippedCount} duplicate(s)` : '')
        + (errors.length ? `; ${errors.length} failed` : '')
        + '.',
      importedCount: imported.length,
      skippedCount,
      errorCount: errors.length,
      errors,
      guests: imported
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Exports RSVPs dataset to a downloadable CSV stream.
 * GET /api/v1/events/:eventId/rsvps/export
 */
const exportGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  // Optional export controls (used by the "attending guest list" export):
  //   ?attending=true  → only guests who responded 'yes'
  //   ?sort=name|table → alphabetical by name, or grouped/sequenced by table
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    // Try full query with check_ins, fall back without
    const fullSelect = `
      guest_name, email, phone, response, party_size, notes,
      rsvp_guests(meal_selection),
      seating_assignments(table_id, tables(table_name)),
      check_ins(checked_in_at, method)
    `;
    const simpleSelect = `
      guest_name, email, phone, response, party_size, notes,
      rsvp_guests(meal_selection)
    `;

    let rsvps;
    for (const selectStr of [fullSelect, simpleSelect]) {
      const { data, error } = await supabase
        .from('rsvps')
        .select(selectStr)
        .eq('event_id', eventId)
        .limit(10000);

      if (!error) {
        rsvps = data || [];
        break;
      }
      // If it's a relation/column error, try simpler query
      if (error.code === '42703' || error.code === 'PGRST200'
          || (error.message && (error.message.includes('column') || error.message.includes('relation')))) {
        continue;
      }
      throw error;
    }

    if (!rsvps) rsvps = [];

    // Apply the attending filter and chosen ordering before serializing.
    if (attendingOnly) rsvps = rsvps.filter(r => r.response === 'yes');
    if (sort) rsvps = sortRsvpsForExport(rsvps, sort);

    const headers = ['guest_name', 'email', 'phone', 'response', 'party_size', 'table_name', 'meal_selections', 'checked_in', 'checked_in_at', 'check_in_method', 'notes'];
    const csvContent = generateCSV(
      headers,
      rsvps,
      (item) => {
        const meals = (item.rsvp_guests || [])
          .map(g => g.meal_selection)
          .filter(Boolean)
          .join('; ');

        const tableName = item.seating_assignments && item.seating_assignments.length > 0
          ? item.seating_assignments[0].tables?.table_name || ''
          : '';

        const checkedIn = item.check_ins && item.check_ins.length > 0 ? 'Yes' : 'No';
        const checkedInAt = item.check_ins && item.check_ins.length > 0
          ? item.check_ins[0].checked_in_at
          : '';
        const checkInMethod = item.check_ins && item.check_ins.length > 0
          ? item.check_ins[0].method
          : '';

        return [
          item.guest_name,
          item.email,
          item.phone,
          item.response,
          item.party_size,
          tableName,
          meals,
          checkedIn,
          checkedInAt,
          checkInMethod,
          item.notes
        ];
      }
    );

    const csvName = `event-${eventId}-${attendingOnly ? 'attending' : 'rsvps'}${sort ? '-by-' + sort : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${csvName}`);
    return res.send(csvContent);
  } catch (err) {
    next(err);
  }
};

/**
 * Exports RSVPs dataset to a downloadable Excel (.xlsx) file.
 * GET /api/v1/events/:eventId/rsvps/export-excel
 */
const exportGuestsExcel = async (req, res, next) => {
  const { eventId } = req.params;
  // Same export controls as the CSV export (attending filter + name/table sort).
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    // 1. Fetch RSVPs
    const { data: rsvps, error: rsvpsError } = await supabase
      .from('rsvps')
      .select(`
        id, guest_name, email, phone, response, party_size, notes,
        rsvp_guests(meal_selection, is_primary),
        seating_assignments(table_id, tables(table_name))
      `)
      .eq('event_id', eventId);

    if (rsvpsError) throw rsvpsError;

    // 2. Fetch tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('event_id', eventId);

    if (tablesError) throw tablesError;

    // 3. Fetch checkins
    const { data: checkins, error: checkinsError } = await supabase
      .from('check_ins')
      .select(`
        *,
        rsvps(guest_name)
      `)
      .eq('event_id', eventId);

    if (checkinsError) throw checkinsError;

    // Filter/sort the Guest List sheet rows (the Seating & Meal sheets stay complete).
    let guestRows = rsvps || [];
    if (attendingOnly) guestRows = guestRows.filter(r => r.response === 'yes');
    if (sort) guestRows = sortRsvpsForExport(guestRows, sort);

    const { generateExcelExport } = require('../utils/excelHelper');
    const excelBuffer = await generateExcelExport(guestRows, tables || [], checkins || []);

    const xlsxName = `event-${eventId}-${attendingOnly ? 'attending' : 'rsvps'}${sort ? '-by-' + sort : ''}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${xlsxName}`);
    return res.send(excelBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a single RSVP and its related data.
 * DELETE /api/v1/events/:eventId/rsvps/:rsvpId
 */
const deleteRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { rsvpId } = req.params;

    // First unassign seat if any
    await supabase
      .from('seating_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('rsvp_id', rsvpId);

    // Delete RSVP (cascades to rsvp_guests, custom_answers)
    const { error } = await supabase
      .from('rsvps')
      .delete()
      .eq('id', rsvpId)
      .eq('event_id', eventId);

    if (error) throw error;

    res.json({ success: true, message: 'RSVP deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates a single RSVP record (organizer edit).
 * PATCH /api/v1/events/:eventId/rsvps/:rsvpId
 */
const updateRSVP = async (req, res, next) => {
  const { eventId, rsvpId } = req.params;
  const { guestName, email, phone, response, partySize, notes, primaryGuestMeal, additionalGuests } = req.body;

  try {
    // Build update payload
    const updates = {};
    if (guestName !== undefined) updates.guest_name = guestName.trim();
    // Normalize email on write so it matches the duplicate-detection lookups
    // (which compare trimmed/lowercased) and the partial unique index.
    if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;
    if (phone !== undefined) updates.phone = phone;
    if (response !== undefined) {
      if (!['yes', 'no', 'pending'].includes(response)) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'response must be yes, no, or pending.' });
      }
      updates.response = response;
    }
    if (partySize !== undefined) {
      const size = parseInt(partySize);
      if (isNaN(size) || size < 1 || size > 20) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 20.' });
      }
      updates.party_size = size;
    }
    if (notes !== undefined) updates.notes = notes;
    updates.updated_at = new Date();

    // Update RSVP
    const { data: rsvp, error } = await supabase
      .from('rsvps')
      .update(updates)
      .eq('id', rsvpId)
      .eq('event_id', eventId)
      .select('*, rsvp_guests(*), seating_assignments(id, table_id, tables(table_name))')
      .single();

    if (error) throw error;
    if (!rsvp) return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND' });

    // If response changed to 'no', remove seating assignments
    if (updates.response === 'no') {
      await supabase.from('seating_assignments').delete().eq('rsvp_id', rsvpId).eq('event_id', eventId);
    }

    // If additional guests or meal are provided, rebuild rsvp_guests
    if (additionalGuests !== undefined || primaryGuestMeal !== undefined) {
      await supabase.from('rsvp_guests').delete().eq('rsvp_id', rsvpId);

      const guestRows = [{
        rsvp_id: rsvpId,
        full_name: rsvp.guest_name,
        is_primary: true,
        meal_selection: primaryGuestMeal || null
      }];

      if (additionalGuests && Array.isArray(additionalGuests)) {
        additionalGuests.forEach(g => {
          guestRows.push({
            rsvp_id: rsvpId,
            full_name: g.fullName,
            is_primary: false,
            meal_selection: g.mealSelection || null,
            dietary_notes: g.dietaryNotes || null
          });
        });
      }

      await supabase.from('rsvp_guests').insert(guestRows);
    }

    // Broadcast update
    const updateChannel = supabase.channel(`event-${eventId}`);
    await updateChannel.send({
      type: 'broadcast',
      event: 'rsvp_updated',
      payload: { rsvpId, guestName: rsvp.guest_name, response: rsvp.response }
    });
    supabase.removeChannel(updateChannel);

    return res.json({ success: true, message: 'RSVP updated successfully.', rsvp });
  } catch (err) {
    next(err);
  }
};

/**
 * Manually adds a guest record from the organizer dashboard.
 * POST /api/v1/events/:eventId/rsvps
 */
const addGuestManually = async (req, res, next) => {
  const { eventId } = req.params;
  const { guestName, email, phone, partySize, notes, response } = req.body;

  if (!guestName || !guestName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'guestName is required.'
    });
  }

  const guestResponse = response && ['yes', 'no', 'pending'].includes(response) ? response : 'pending';
  const computedPartySize = parseInt(partySize) || 1;

  if (computedPartySize < 1 || computedPartySize > 20) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'partySize must be between 1 and 20.'
    });
  }

  try {
    // 1. Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, org_id, title')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    // 2. Insert RSVP record
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .insert({
        event_id: eventId,
        guest_name: guestName.trim(),
        email: email ? email.trim().toLowerCase() : null,
        phone: phone || null,
        response: guestResponse,
        party_size: computedPartySize,
        notes: notes || null
      })
      .select()
      .single();

    if (rsvpError) throw rsvpError;

    // 2.2 Insert primary guest into rsvp_guests if response is yes
    if (guestResponse === 'yes') {
      const { error: guestInsertError } = await supabase
        .from('rsvp_guests')
        .insert({
          rsvp_id: rsvp.id,
          full_name: guestName.trim(),
          is_primary: true,
          meal_selection: null
        });
      if (guestInsertError) throw guestInsertError;
    }

    // 3. Log activity
    await supabase
      .from('activity_logs')
      .insert({
        event_id: eventId,
        action: 'guest_added_manually',
        metadata: {
          description: `Organizer manually added guest: ${guestName.trim()} (response: ${guestResponse}, party size: ${computedPartySize})`
        }
      })
      .then(() => {})
      .catch(err => console.error('Activity log insert error:', err.message));

    // 4. Broadcast RSVP update via real-time channel
    const rsvpChannel = supabase.channel(`event-${eventId}`);
    await rsvpChannel.send({
      type: 'broadcast',
      event: 'rsvp_submitted',
      payload: {
        rsvpId: rsvp.id,
        guestName: rsvp.guest_name,
        response: rsvp.response,
        partySize: computedPartySize
      }
    });
    supabase.removeChannel(rsvpChannel);

    return res.status(201).json({
      success: true,
      message: 'Guest added successfully.',
      rsvp
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Searches guest seating assignment by name (public endpoint).
 * GET /api/v1/public/events/:slug/seating/search
 */
const searchPublicSeating = async (req, res, next) => {
  const { slug } = req.params;
  const { query } = req.query;

  if (!query || !query.trim()) {
    return res.json({ success: true, results: [] });
  }

  try {
    // 1. Resolve event from slug. Restrict the "find your table" lookup to live
    // (paid + active) events so the guest/seating roster of a draft/unpaid/private
    // event can't be enumerated by anyone who guesses the slug.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status, event_date')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }
    // Seating is hidden from guests until 24h before the event begins.
    if (!isSeatingRevealed(event.event_date)) {
      return res.json({ success: true, locked: true, revealAt: seatingRevealAtISO(event.event_date), results: [] });
    }

    // 2. Search guests matching query substring, join with seating_assignments and tables
    const { data, error } = await supabase
      .from('rsvps')
      .select(`
        id,
        guest_name,
        response,
        party_size,
        seating_assignments (
          table_id,
          tables (
            table_name
          )
        )
      `)
      .eq('event_id', event.id)
      .eq('response', 'yes') // only attending guests can check seating
      .ilike('guest_name', `%${escapeLikePattern(query.trim())}%`)
      .limit(10);

    if (error) throw error;

    return res.json({
      success: true,
      results: data.map(item => {
        const seating = item.seating_assignments?.[0] || item.seating_assignments;
        // Handle if it is an array or object due to postgrest format
        const resolvedSeating = Array.isArray(seating) ? seating[0] : seating;
        const tableName = resolvedSeating?.tables?.table_name || 'Unassigned';
        return {
          // Deliberately NOT exposing the rsvp id here. This endpoint is unauthenticated
          // and would otherwise let anyone enumerate EVERY attending guest's id (the
          // per-guest capability token), which unlocks that guest's contact PII via the
          // invitation-token paths. Guests still see their own table by name; the visual
          // map (which needs the id) is reachable from their own post-RSVP confirmation.
          guestName: item.guest_name,
          partySize: item.party_size,
          tableName,
          hasTable: !!resolvedSeating?.table_id
        };
      })
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns a single guest's personal seating view: the full venue LAYOUT (table
 * geometry only) plus which table is theirs and the names of their OWN party.
 * Deliberately never exposes who else is seated at any table — a guest sees the
 * room and their spot, and the companions they brought, but not other parties.
 * GET /api/v1/public/events/:slug/seating/guest/:guestId
 */
const getGuestSeatingMap = async (req, res, next) => {
  const { slug, guestId } = req.params;

  try {
    // 1. Resolve event and ensure it is live (paid + active).
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_paid, status, event_date')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }
    if (!event.is_paid || event.status !== 'active') {
      return res.status(404).json({ success: false, error: 'EVENT_INACTIVE' });
    }
    // The seating chart stays hidden from guests until 24h before the event begins,
    // regardless of when the organizer built it. (Organizer dashboard uses the
    // authenticated /events/:eventId/* endpoints and is unaffected.)
    if (!isSeatingRevealed(event.event_date)) {
      return res.json({
        success: true, locked: true, revealAt: seatingRevealAtISO(event.event_date),
        myTableId: null, myTableName: null, party: [], tables: [],
      });
    }

    // 2. Resolve the guest's RSVP (must belong to this event) + their own party.
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .select(`
        id, guest_name, party_size, response,
        seating_assignments(table_id, tables(table_name)),
        rsvp_guests(full_name, is_primary, meal_selection)
      `)
      .eq('id', guestId)
      .eq('event_id', event.id)
      .single();

    if (rsvpError || !rsvp) {
      return res.status(404).json({ success: false, error: 'GUEST_NOT_FOUND' });
    }

    const assignment = Array.isArray(rsvp.seating_assignments)
      ? rsvp.seating_assignments[0]
      : rsvp.seating_assignments;
    const myTableId = assignment?.table_id || null;
    const myTableName = assignment?.tables?.table_name || null;

    // 3. Venue layout — geometry only, no occupant identities.
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true });

    if (tablesError) throw tablesError;

    // 4. The guest's own companions (the people THEY brought) — never other parties.
    const party = (rsvp.rsvp_guests || [])
      .slice()
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(g => ({ name: g.full_name, meal: g.meal_selection || null, isPrimary: !!g.is_primary }))
      .filter(g => g.name);

    return res.json({
      success: true,
      guest: {
        id: rsvp.id,
        guest_name: rsvp.guest_name,
        party_size: rsvp.party_size,
        response: rsvp.response,
      },
      myTableId,
      myTableName,
      party,
      tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  exportGuestsCSV,
  exportGuestsExcel,
  searchPublicGuests,
  getGuestById,
  deleteRSVP,
  updateRSVP,
  addGuestManually,
  searchPublicSeating,
  getGuestSeatingMap,
  // Exported for unit testing of the ILIKE-injection escaping.
  escapeLikePattern
};
