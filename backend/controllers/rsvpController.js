const { supabase } = require('../config/supabase');
const { sendConfirmationEmail } = require('./notificationController');
const { parseCSV, generateCSV } = require('../utils/excelHelper');

/**
 * Handles guest RSVP form submissions.
 * POST /api/v1/public/events/:slug/rsvp
 */
const submitPublicRSVP = async (req, res, next) => {
  const { slug } = req.params;
  const { guestName, email, phone, response, partySize, notes, additionalGuests, primaryGuestMeal, customAnswers } = req.body;

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
      .select('id, rsvp_deadline, title')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND' });
    }

    // 2. Check RSVP deadline
    if (event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
      return res.status(400).json({
        success: false,
        error: 'DEADLINE_PASSED',
        message: 'The RSVP deadline for this event has passed.'
      });
    }

    // 3. Insert into rsvps table
    const computedPartySize = response === 'yes' ? (partySize || 1) : 1;

    const { data: rsvp, error: rsvpError } = await supabase
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
      // Create mock req/res objects for direct execution
      const mockReq = { params: { eventId: event.id }, body: { rsvpId: rsvp.id } };
      const mockRes = { json: () => {}, status: () => ({ json: () => {} }) };
      sendConfirmationEmail(mockReq, mockRes, (err) => console.error('Confirmation email err:', err));
    }

    return res.status(201).json({
      success: true,
      message: 'RSVP submitted successfully.',
      rsvpId: rsvp.id
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

  try {
    const { data: rsvps, error } = await supabase
      .from('rsvps')
      .select('*, rsvp_guests(*), custom_answers(*), seating_assignments(*)')
      .eq('event_id', eventId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return res.json({ success: true, rsvps });
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

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  exportGuestsCSV
};
