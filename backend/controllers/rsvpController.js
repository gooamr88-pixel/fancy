const { supabase } = require('../config/supabase');
const notificationService = require('../utils/notificationService');
const { parseCSV, generateCSV } = require('../utils/csvHelper');
const { escapeHtml, getDeclineConfirmationTemplate } = require('../utils/emailTemplates');

/** Escape special characters in user input before using it in a LIKE / ILIKE pattern. */
function escapeLikePattern(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Handles guest RSVP form submissions (supports both inserts and updates).
 * POST /api/v1/public/events/:slug/rsvp
 */
const submitPublicRSVP = async (req, res, next) => {
  const { slug } = req.params;
  const { rsvpId, guestName, email, phone, response, partySize, notes, additionalGuests, primaryGuestMeal, customAnswers } = req.body;

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
      .select('id, org_id, rsvp_deadline, title, is_paid, slug')
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

      // If the existing RSVP has an email, the caller must provide a matching email
      if (existingRsvp.email) {
        if (!email || existingRsvp.email.toLowerCase() !== email.toLowerCase()) {
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
          email,
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
      if (email && email.trim()) {
        const { data: existingRsvp } = await supabase
          .from('rsvps')
          .select('id')
          .eq('event_id', event.id)
          .eq('email', email.trim())
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
          email,
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
    if (email) {
      if (response === 'yes') {
        notificationService.sendConfirmationEmail(event.id, rsvp.id)
          .catch((err) => console.error('Confirmation email err:', err));
      } else if (response === 'no') {
        // Send decline thank-you email
        const declineHtml = getDeclineConfirmationTemplate(rsvp, event);
        notificationService.sendEmailViaBrevo(email, `Thank You – ${escapeHtml(event.title)}`, declineHtml)
          .catch((err) => console.error('Decline email err:', err));
      }
    }

    // 8. Notify organizer of new RSVP
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('email, name')
        .eq('id', event.org_id || '')
        .single();

      if (org && org.email) {
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
              ${email ? '<tr><td style="padding: 8px 15px; color: #64748b; font-size: 13px;">Email</td><td style="padding: 8px 15px; font-size: 15px;">' + escapeHtml(email) + '</td></tr>' : ''}
            </table>
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated notification from Fancy RSVP.</p>
          </div>
        `;
        sendEmailViaBrevo(org.email, `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(event.title)}`, orgEmailHtml)
          .catch(err => console.error('Failed to notify organizer:', err.message));
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
    // 1. Resolve event from slug
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    // 2. Search guests matching query prefix/substring (public: only non-PII fields, no internal IDs)
    const { data, error } = await supabase
      .from('rsvps')
      .select('guest_name, response')
      .eq('event_id', event.id)
      .ilike('guest_name', `%${escapeLikePattern(query.trim())}%`)
      .limit(10);

    if (error) throw error;

    return res.json({
      success: true,
      results: data.map(item => ({
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
  const { response, search, seated, sort } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

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

      query = query.range(from, to);
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

    // Post-filter for seated status
    let filtered = rsvps || [];
    let effectiveTotal = totalCount;
    if (seated === 'true') {
      filtered = filtered.filter(r => r.seating_assignments && r.seating_assignments.length > 0);
      effectiveTotal = null;
    } else if (seated === 'false') {
      filtered = filtered.filter(r => !r.seating_assignments || r.seating_assignments.length === 0);
      effectiveTotal = null;
    }

    return res.json({
      success: true,
      rsvps: filtered,
      pagination: { page, limit, count: filtered.length, total: effectiveTotal ?? totalCount }
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
  const { csvData } = req.body;

  if (!csvData) {
    return res.status(400).json({ success: false, error: 'csvData string is required.' });
  }

  try {
    const parsedRows = parseCSV(csvData);
    if (parsedRows.length === 0) {
      return res.status(400).json({ success: false, error: 'NO_VALID_ROWS', message: 'No valid data rows found in CSV.' });
    }

    if (parsedRows.length > 500) {
      return res.status(400).json({ success: false, error: 'CSV_TOO_LARGE', message: 'CSV import limited to 500 rows per batch. Please split your file.' });
    }

    const insertRows = parsedRows.map(row => ({
      event_id: eventId,
      guest_name: row.guest_name || 'Unnamed Guest',
      email: row.email || null,
      phone: row.phone || null,
      response: 'pending',
      party_size: parseInt(row.party_size) || 1,
      notes: row.notes || null
    }));

    const { data: inserted, error } = await supabase
      .from('rsvps')
      .insert(insertRows)
      .select('id, guest_name');

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${inserted.length} guest records in pending state.`,
      importedCount: inserted.length,
      guests: inserted
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

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=event-${eventId}-rsvps.csv`);
    return res.send(csvContent);
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
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (response !== undefined) {
      if (!['yes', 'no', 'pending'].includes(response)) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'response must be yes, no, or pending.' });
      }
      updates.response = response;
    }
    if (partySize !== undefined) {
      const size = parseInt(partySize);
      if (isNaN(size) || size < 1 || size > 50) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 50.' });
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
        email: email || null,
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

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  exportGuestsCSV,
  searchPublicGuests,
  deleteRSVP,
  updateRSVP,
  addGuestManually
};
