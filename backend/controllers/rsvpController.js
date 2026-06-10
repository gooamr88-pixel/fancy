const { supabase } = require('../config/supabase');
const notificationService = require('../utils/notificationService');
const { parseCSV, generateCSV } = require('../utils/excelHelper');

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
      .select('id, rsvp_deadline, title, is_paid, slug')
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
      // 3. Update existing RSVP record
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
      // 3. Insert new RSVP record
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
    await supabase.channel(`event-${event.id}`).send({
      type: 'broadcast',
      event: 'rsvp_submitted',
      payload: {
        rsvpId: rsvp.id,
        guestName: rsvp.guest_name,
        response: rsvp.response,
        partySize: computedPartySize
      }
    });

    // 7. Trigger confirmation email asynchronously if email exists
    if (email) {
      notificationService.sendConfirmationEmail(event.id, rsvp.id)
        .catch((err) => console.error('Confirmation email err:', err));
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

    // 2. Search guests matching query prefix/substring (public: only non-PII fields)
    const { data, error } = await supabase
      .from('rsvps')
      .select('id, guest_name, response')
      .eq('event_id', event.id)
      .ilike('guest_name', `%${escapeLikePattern(query.trim())}%`)
      .limit(10);

    if (error) throw error;

    return res.json({
      success: true,
      results: data.map(item => ({
        id: item.id,
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
 * GET /api/v1/events/:eventId/rsvps
 */
const getRSVPs = async (req, res, next) => {
  const { eventId } = req.params;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: rsvps, error } = await supabase
      .from('rsvps')
      .select('*, rsvp_guests(*), custom_answers(*), seating_assignments(*)')
      .eq('event_id', eventId)
      .order('submitted_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return res.json({ success: true, rsvps, pagination: { page, limit, count: rsvps.length } });
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
    const { data: rsvps, error } = await supabase
      .from('rsvps')
      .select('guest_name, email, phone, response, party_size, notes')
      .eq('event_id', eventId);

    if (error) throw error;

    const headers = ['guest_name', 'email', 'phone', 'response', 'party_size', 'notes'];
    const csvContent = generateCSV(
      headers,
      rsvps || [],
      (item) => [item.guest_name, item.email, item.phone, item.response, item.party_size, item.notes]
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

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  exportGuestsCSV,
  searchPublicGuests,
  deleteRSVP
};
