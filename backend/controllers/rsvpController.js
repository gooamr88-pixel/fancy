const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const notificationService = require('../utils/notificationService');
const guestService = require('../services/guestService');
const tokenService = require('../services/tokenService');
const { parseCSV, generateCSV } = require('../utils/csvHelper');
const { escapeHtml, getDeclineConfirmationTemplate, getNewRsvpOrganizerTemplate } = require('../utils/emailTemplates');
const { isEventLiveForGuests } = require('../utils/eventAccess');
const { normalizeToE164 } = require('../utils/phone');
const { normalizeEmail, escapeLikePattern } = require('../utils/normalize');
const { broadcast } = require('../utils/realtime');
const { sendOk, sendFail, sendRpcFailure } = require('../utils/responseEnvelope');

/**
 * Handles guest RSVP form submissions (insert or update).
 * All gating/validation/dedup/child-row writes happen atomically inside the
 * submit_rsvp_v2() RPC (see GuestService) — this handler only validates cheap
 * shape constraints up front, then fires the best-effort notification fanout
 * (confirmation/decline email, organizer notify, realtime broadcast).
 * POST /api/v1/public/events/:slug/rsvp
 */
const submitPublicRSVP = async (req, res, next) => {
  const { slug } = req.params;
  const { partyId, guestName, email, phone, response, partySize, notes, additionalGuests, primaryGuestMeal, customAnswers, decline_reason, maybe_confirm_by } = req.body;

  const normalizedPhone = phone && String(phone).trim() ? normalizeToE164(phone) : null;
  if (phone && String(phone).trim() && !normalizedPhone) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).' });
  }

  if (!guestName || !response) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'guestName and response are required.' });
  }

  if (Array.isArray(additionalGuests) && additionalGuests.length > guestService.MAX_ADDITIONAL_GUESTS) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Too many additional guests submitted.' });
  }
  if (Array.isArray(customAnswers) && customAnswers.length > guestService.MAX_CUSTOM_ANSWERS) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Too many custom answers submitted.' });
  }

  if (response === 'yes') {
    const size = partySize || 1;
    if (size > 1) {
      if (!Array.isArray(additionalGuests) || additionalGuests.length < size - 1) {
        return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `Please provide details for all ${size - 1} additional guests.` });
      }
      for (let idx = 0; idx < size - 1; idx++) {
        const g = additionalGuests[idx];
        if (!g || !g.fullName || !g.fullName.trim()) {
          return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: `Guest #${idx + 2} must have a valid full name.` });
        }
      }
    }
  }

  // Soft-normalise each companion's phone to E.164 if it parses; if not, drop
  // the raw value rather than persist mixed formats that break the organizer's
  // search/dedup later. age_group + gender are validated again by the RPC's
  // CHECK constraints, so out-of-vocab values come back as NULL on insert.
  const sanitizedAdditional = Array.isArray(additionalGuests)
    ? additionalGuests.map((g) => {
        if (!g) return g;
        const raw = typeof g.phone === 'string' ? g.phone.trim() : '';
        const normalised = raw ? normalizeToE164(raw) : null;
        return { ...g, phone: normalised || null };
      })
    : [];

  try {
    const result = await guestService.submitPublicRsvp({
      slug, partyId, guestName, email, phone: normalizedPhone, response,
      partySize: partySize || 1, notes, primaryMeal: primaryGuestMeal,
      additionalGuests: sanitizedAdditional,
      customAnswers: Array.isArray(customAnswers) ? customAnswers : [],
      declineReason: decline_reason, maybeConfirmBy: maybe_confirm_by,
    });

    if (!result || result.success === false) {
      return sendRpcFailure(res, result);
    }

    const eventId = result.event_id;
    const computedPartySize = result.party_size;

    broadcast(eventId, 'rsvp_submitted', {
      partyId: result.party_id, guestName, response: result.response, partySize: computedPartySize,
    });

    // Confirmation / decline email (best-effort)
    if (result.response === 'yes') {
      if (result.guest_email) {
        notificationService.sendConfirmationEmail(eventId, result.party_id)
          .catch((err) => logger.error({ err }, 'Confirmation email error'));
      }
      if (Array.isArray(sanitizedAdditional)) {
        sanitizedAdditional.forEach((companion) => {
          if (companion && companion.email && companion.email.trim()) {
            notificationService.sendCompanionConfirmationEmail({
              companionName: companion.fullName,
              mainGuestName: guestName,
              eventTitle: result.event_title,
              eventDate: result.event_date,
              eventSlug: result.event_slug,
              companionEmail: companion.email.trim(),
            }).catch((err) => logger.error({ err, companionEmail: companion.email }, 'Companion confirmation email error'));
          }
        });
      }
    } else if (result.response === 'no' && result.guest_email) {
      const declineHtml = getDeclineConfirmationTemplate(
        { guest_name: guestName },
        { title: result.event_title, event_date: result.event_date, slug: result.event_slug },
      );
      notificationService.sendEmailViaBrevo(result.guest_email, `Thank You – ${escapeHtml(result.event_title)}`, declineHtml)
        .catch((err) => logger.error({ err }, 'Decline email error'));
    }

    // Notify organizer of the new RSVP (best-effort).
    try {
      const prefs = result.notification_preferences;
      const isEmailPref = !prefs || prefs.email !== false;
      const isWhatsappPref = !!prefs?.whatsapp;
      const respLabel = result.response === 'yes' ? 'Attending' : result.response === 'maybe' ? 'Maybe' : 'Declined';

      if (isEmailPref && result.org_email) {
        const orgEmailHtml = getNewRsvpOrganizerTemplate({
          eventTitle: result.event_title, guestName, response: result.response, partySize: computedPartySize, email,
        });
        notificationService.sendEmailViaBrevo(result.org_email, `New RSVP: ${escapeHtml(guestName)} - ${escapeHtml(result.event_title)}`, orgEmailHtml)
          .catch((err) => logger.error({ err }, 'Failed to notify organizer via email'));
      }

      if (isWhatsappPref && result.org_phone) {
        const { getTwilioClient } = require('../utils/twilioClient');
        const twilio = getTwilioClient();
        const messageText = `New RSVP Received for ${result.event_title}: ${guestName} has replied ${result.response === 'yes' ? 'Attending (Party of ' + computedPartySize + ')' : respLabel}. — Fancy RSVP`;
        if (twilio) {
          twilio.messages.create({ body: messageText, from: 'whatsapp:+14155238886', to: `whatsapp:${result.org_phone}` })
            .catch((err) => logger.error({ err }, 'Failed to notify organizer via WhatsApp'));
        } else {
          logger.info(`[MOCK WHATSAPP NOTIFICATION] To: ${result.org_phone} | Content: ${messageText}`);
        }
      }
    } catch (orgNotifyErr) {
      logger.error({ err: orgNotifyErr }, 'Organizer notification error');
    }

    return sendOk(res, { partyId: result.party_id, message: result.is_update ? 'RSVP updated successfully.' : 'RSVP submitted successfully.' }, { status: 201 });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a single party invitation by its party id (public endpoint).
 * GET /api/v1/public/rsvp/guest/:guestId
 */
const getGuestById = async (req, res, next) => {
  const { guestId: partyId } = req.params;
  try {
    const resolved = await guestService.getPartyForPublicResolve(partyId);
    if (!resolved) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    if (!isEventLiveForGuests(resolved.event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    return sendOk(res, {
      slug: resolved.event.slug,
      seatingLocked: !resolved.seatingRevealed,
      revealAt: resolved.revealAt,
      guest: {
        id: resolved.id,
        guest_name: resolved.label,
        party_size: resolved.partySize,
        response: resolved.response,
        table_name: resolved.tableName,
      },
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
  const term = (query || '').trim();
  if (term.length < 2) return sendOk(res, { results: [] });

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, is_paid, status').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const results = await guestService.searchPartiesPublic(event.id, term, 10);
    return sendOk(res, { results });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists parties for an event (organizer dashboard endpoint).
 * GET /api/v1/events/:eventId/rsvps
 */
const getRSVPs = async (req, res, next) => {
  const { eventId } = req.params;
  const { response, search, seated, sort, meal, customFieldId, customFieldValue } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  try {
    const { parties, pagination } = await guestService.listParties(eventId, {
      response, search, seated, sort, meal, customFieldId, customFieldValue, page, limit,
    });
    return sendOk(res, { rsvps: parties }, { meta: { pagination } });
  } catch (err) {
    next(err);
  }
};

/**
 * Imports guest records in bulk from a CSV/XLSX payload.
 * POST /api/v1/events/:eventId/rsvps/import
 */
const importGuestsCSV = async (req, res, next) => {
  const { eventId } = req.params;
  const { csvData, fileData, fileName } = req.body;

  if (!csvData && !fileData) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'csvData or fileData string is required.' });
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
            if (header) rowObj[header] = cell.text ? cell.text.trim() : '';
          });
          const mappedRow = {
            guest_name: rowObj.guest_name || rowObj.name || rowObj.guest || '',
            email: rowObj.email || '',
            phone: rowObj.phone || '',
            notes: rowObj.notes || rowObj.note || '',
            party_size: rowObj.party_size || '',
          };
          if (mappedRow.guest_name) parsedRows.push(mappedRow);
        });
      } else {
        parsedRows = parseCSV(buffer.toString('utf-8'));
      }
    } else {
      parsedRows = parseCSV(csvData);
    }

    if (parsedRows.length === 0) {
      return sendFail(res, { status: 400, error: 'NO_VALID_ROWS', message: 'No valid data rows found.' });
    }
    if (parsedRows.length > 500) {
      return sendFail(res, { status: 400, error: 'FILE_TOO_LARGE', message: 'Import limited to 500 rows per batch. Please split your file.' });
    }

    // Dedup within the file by email (case-insensitive); rows without an email are
    // always kept — the per-event unique index only collides on non-null emails.
    const seenEmails = new Set();
    let skippedInFile = 0;
    const dedupedRows = [];
    for (const row of parsedRows) {
      const emailKey = normalizeEmail(row.email);
      if (emailKey) {
        if (seenEmails.has(emailKey)) { skippedInFile++; continue; }
        seenEmails.add(emailKey);
      }
      const parsedSize = parseInt(row.party_size, 10);
      dedupedRows.push({
        guest_name: row.guest_name || 'Unnamed Guest',
        email: emailKey,
        phone: normalizeToE164(row.phone),
        notes: row.notes || null,
        party_size: Number.isInteger(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, 20) : 1,
      });
    }

    const { imported, skippedExisting, errors } = await guestService.importGuests(eventId, req.user?.id || null, dedupedRows);
    const skippedCount = skippedInFile + skippedExisting;

    return sendOk(res, {
      message: `Imported ${imported.length} guest record(s) in pending state`
        + (skippedCount ? `; skipped ${skippedCount} duplicate(s)` : '')
        + (errors.length ? `; ${errors.length} failed` : '') + '.',
      importedCount: imported.length, skippedCount, errorCount: errors.length, errors, guests: imported,
    }, { status: 201 });
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
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    const rows = await guestService.exportParties(eventId, { attendingOnly, sort });
    const headers = ['guest_name', 'email', 'phone', 'response', 'party_size', 'table_name', 'meal_selections', 'checked_in', 'checked_in_at', 'check_in_method', 'notes'];
    const csvContent = generateCSV(headers, rows, (item) => [
      item.guest_name, item.email, item.phone, item.response, item.party_size,
      item.table_name, item.meal_selections, item.checked_in, item.checked_in_at, item.check_in_method, item.notes,
    ]);

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
  const attendingOnly = req.query.attending === 'true';
  const sort = ['name', 'table'].includes(req.query.sort) ? req.query.sort : null;

  try {
    const rows = await guestService.exportParties(eventId, { attendingOnly, sort });

    const { data: tables, error: tablesError } = await supabase.from('tables').select('*').eq('event_id', eventId);
    if (tablesError) throw tablesError;

    const { data: checkins, error: checkinsError } = await supabase
      .from('check_ins').select('*, rsvp_parties(label)').eq('event_id', eventId);
    if (checkinsError) throw checkinsError;

    // Shape rows the way generateExcelExport expects (mirrors the pre-rebuild rsvp shape).
    const guestRows = rows.map((r) => ({
      guest_name: r.guest_name, email: r.email, phone: r.phone, response: r.response,
      party_size: r.party_size, notes: r.notes,
      rsvp_guests: (r.guests || []).map((g) => ({ meal_selection: g.meal_selection, is_primary: g.is_primary_contact })),
      seating_assignments: r.table_name ? [{ tables: { table_name: r.table_name } }] : [],
    }));

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
 * Deletes a single party and its related data.
 * DELETE /api/v1/events/:eventId/rsvps/:rsvpId
 */
const deleteRSVP = async (req, res, next) => {
  try {
    const { eventId, partyId } = req.params;
    await guestService.deleteParty(eventId, partyId);
    return sendOk(res, { message: 'RSVP deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates a single party record (organizer edit).
 * PATCH /api/v1/events/:eventId/rsvps/:rsvpId
 */
const updateRSVP = async (req, res, next) => {
  const { eventId, partyId } = req.params;
  const { guestName, email, phone, response, partySize, notes, primaryGuestMeal, additionalGuests } = req.body;

  try {
    if (response !== undefined && !['yes', 'no', 'maybe', 'pending', 'waitlist'].includes(response)) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'response must be yes, no, maybe, pending, or waitlist.' });
    }
    if (partySize !== undefined) {
      const size = parseInt(partySize);
      if (isNaN(size) || size < 1 || size > 20) {
        return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'partySize must be between 1 and 20.' });
      }
    }
    if (phone !== undefined && phone && String(phone).trim() && !normalizeToE164(phone)) {
      return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'Enter a valid phone number in international format (e.g. +1 555 123 4567).' });
    }

    const party = await guestService.updateParty(eventId, partyId, {
      guestName, email, phone, response, partySize, notes, primaryMeal: primaryGuestMeal, additionalGuests,
    });
    if (!party) return sendFail(res, { status: 404, error: 'RSVP_NOT_FOUND' });

    broadcast(eventId, 'rsvp_updated', { partyId, guestName: party.label, response: party.response });
    return sendOk(res, { message: 'RSVP updated successfully.', rsvp: party });
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
  const { guestName, email, phone, response, partyId, partySize, notes } = req.body;

  if (!guestName || !guestName.trim()) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'guestName is required.' });
  }
  const guestResponse = response && ['yes', 'no', 'maybe', 'pending', 'waitlist'].includes(response) ? response : 'pending';

  try {
    const result = await guestService.addGuest({
      eventId, actorUserId: req.user?.id, fullName: guestName.trim(),
      phone: phone ? normalizeToE164(phone) : null, email: normalizeEmail(email), partyId, response: guestResponse,
      partySize: partySize ? parseInt(partySize, 10) : 1, notes: notes ? String(notes).trim() : null,
    });

    if (!result || result.success === false) return sendRpcFailure(res, result);

    broadcast(eventId, 'rsvp_submitted', { partyId: result.party_id, guestName: guestName.trim(), response: guestResponse });
    return sendOk(res, { message: 'Guest added successfully.', partyId: result.party_id, guestId: result.guest_id }, { status: 201 });
  } catch (err) {
    next(err);
  }
};

/**
 * Verifies a guest by exact name + last 4 phone digits and returns ONLY their
 * own seating map. Replaces the old name-search, which returned every party
 * matching a name (and a usable id), letting anyone browse strangers' tables
 * and companion lists. A non-match returns `{ verified: false }` with 200 — we
 * never reveal whether the name exists or which factor failed.
 * POST /api/v1/public/events/:slug/seating/verify
 */
const verifyPublicSeating = async (req, res, next) => {
  const { slug } = req.params;
  const { name, phoneLast4 } = req.body;

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, is_paid, status, event_date').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });
    if (!guestService.isSeatingRevealed(event.event_date)) {
      return sendOk(res, { locked: true, revealAt: guestService.seatingRevealAtISO(event.event_date), verified: false });
    }

    const seating = await guestService.verifyGuestSeating(event.id, name, phoneLast4);
    if (!seating) return sendOk(res, { verified: false });

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id).order('sort_order', { ascending: true });
    if (tablesError) throw tablesError;

    return sendOk(res, {
      verified: true,
      guest: { id: seating.party.id, guest_name: seating.party.label, party_size: seating.party.partySize, response: seating.party.response },
      myTableId: seating.myTableId, myTableName: seating.myTableName,
      party: seating.companions, tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns a single guest's personal seating view: venue layout + own table +
 * own party's companions. Never exposes other parties.
 * GET /api/v1/public/events/:slug/seating/guest/:guestId
 */
const getGuestSeatingMap = async (req, res, next) => {
  const { slug, guestId: partyId } = req.params;

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, is_paid, status, event_date').eq('slug', slug).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'EVENT_NOT_FOUND' });
    if (!isEventLiveForGuests({ ...event, slug })) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });
    if (!guestService.isSeatingRevealed(event.event_date)) {
      return sendOk(res, {
        locked: true, revealAt: guestService.seatingRevealAtISO(event.event_date),
        myTableId: null, myTableName: null, party: [], tables: [],
      });
    }

    const seating = await guestService.getPartySeatingMap(event.id, partyId);
    if (!seating) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, table_name, element_type, shape, position_x, position_y, width, height, rotation, color, max_capacity')
      .eq('event_id', event.id).order('sort_order', { ascending: true });
    if (tablesError) throw tablesError;

    return sendOk(res, {
      guest: { id: seating.party.id, guest_name: seating.party.label, party_size: seating.party.partySize, response: seating.party.response },
      myTableId: seating.myTableId, myTableName: seating.myTableName,
      party: seating.companions, tables: tables || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolves a signed invitation token into the guest + event context that
 * powers the public RSVP confirmation page. Read-only — does not record a
 * response, so email-link pre-fetching by security scanners is harmless.
 * GET /api/v1/public/rsvp/invite?token=...
 */
const getRsvpInvite = async (req, res, next) => {
  const { token } = req.query;
  if (!token) return sendFail(res, { status: 400, error: 'TOKEN_REQUIRED' });

  let payload;
  try {
    payload = tokenService.verifyRsvpInvite(token);
  } catch {
    return sendFail(res, { status: 401, error: 'INVALID_TOKEN', message: 'This invitation link is invalid or has expired.' });
  }

  try {
    const { data: party, error } = await supabase
      .from('rsvp_parties')
      .select('id, label, response, guests(id, full_name, is_primary_contact, meal_selection, dietary_notes, phone, age_group, relationship, gender), events!inner(id, title, event_date, slug, location_name, location_address, is_paid, status, rsvp_deadline)')
      .eq('id', payload.partyId)
      .eq('event_id', payload.eventId)
      .single();

    if (error || !party) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });

    const event = party.events;
    if (!isEventLiveForGuests(event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });

    const deadlinePassed = !!event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline);

    const allGuests = party.guests || [];
    // Companions already on file pre-fill the confirmation form instead of asking the
    // responder to retype every member of their own party from a blank field.
    const companions = allGuests.filter((g) => !g.is_primary_contact);

    return sendOk(res, {
      intendedResponse: payload.response ? tokenService.mapIntentToResponse(payload.response) : null,
      deadlinePassed,
      guest: {
        id: party.id, guest_name: party.label, party_size: allGuests.length || 1, response: party.response,
        additionalGuests: companions.map((g) => ({
          id: g.id,
          fullName: g.full_name || '',
          mealSelection: g.meal_selection || '',
          dietaryNotes: g.dietary_notes || '',
          phone: g.phone || '',
          ageGroup: g.age_group || '',
          relationship: g.relationship || '',
          gender: g.gender || '',
        })),
      },
      event: { title: event.title, event_date: event.event_date, slug: event.slug, location: event.location_name || event.location_address || null },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Records a guest's RSVP response from a signed invitation token (the
 * one-click email flow). Delegates the lock + write to update_party_response
 * (see GuestService); this handler only resolves the token, fires the
 * confirmation/decline email, and broadcasts.
 * POST /api/v1/public/rsvp/respond
 */
const respondViaToken = async (req, res, next) => {
  const { token, response: bodyResponse, partySize } = req.body || {};
  if (!token) return sendFail(res, { status: 400, error: 'TOKEN_REQUIRED' });

  let payload;
  try {
    payload = tokenService.verifyRsvpInvite(token);
  } catch {
    return sendFail(res, { status: 401, error: 'INVALID_TOKEN', message: 'This invitation link is invalid or has expired.' });
  }

  const mapped = tokenService.mapIntentToResponse(bodyResponse || payload.response);
  if (!mapped) {
    return sendFail(res, { status: 400, error: 'VALIDATION_ERROR', message: 'A valid response (accepted, declined, or maybe) is required.' });
  }

  try {
    const { data: event, error: eventError } = await supabase
      .from('events').select('id, title, event_date, slug, is_paid, status, rsvp_deadline, notification_preferences')
      .eq('id', payload.eventId).single();
    if (eventError || !event) return sendFail(res, { status: 404, error: 'GUEST_NOT_FOUND' });
    if (!isEventLiveForGuests(event)) return sendFail(res, { status: 404, error: 'EVENT_INACTIVE' });
    if (event.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
      return sendFail(res, { status: 400, error: 'DEADLINE_PASSED', message: 'The RSVP deadline for this event has passed.' });
    }

    let computedPartySize;
    if (mapped === 'yes') {
      const size = parseInt(partySize);
      computedPartySize = (!isNaN(size) && size >= 1 && size <= 20) ? size : undefined;
    }

    const result = await guestService.respondToInvite({
      eventId: event.id, partyId: payload.partyId, response: mapped, partySize: computedPartySize, actor: 'guest', source: 'email',
    });

    if (!result || result.success === false) return sendRpcFailure(res, result, 409);

    const { data: party } = await supabase
      .from('rsvp_parties').select('id, label, guests(is_primary_contact, email)').eq('id', payload.partyId).single();
    const primaryEmail = (party?.guests || []).find((g) => g.is_primary_contact)?.email || null;
    const guestName = party?.label;

    broadcast(event.id, 'rsvp_updated', { partyId: payload.partyId, guestName, response: mapped, partySize: computedPartySize });

    if (primaryEmail) {
      if (mapped === 'yes') {
        notificationService.sendConfirmationEmail(event.id, payload.partyId).catch((err) => logger.error({ err }, 'Confirmation email error'));
      } else if (mapped === 'no') {
        const declineHtml = getDeclineConfirmationTemplate({ guest_name: guestName, id: payload.partyId }, event);
        notificationService.sendEmailViaBrevo(primaryEmail, `Thank You – ${escapeHtml(event.title)}`, declineHtml)
          .catch((err) => logger.error({ err }, 'Decline email error'));
      }
    }

    return sendOk(res, { message: 'Your response has been recorded.', response: mapped, guestName, eventSlug: event.slug, partyId: payload.partyId });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns aggregated RSVP statistics for the organizer dashboard cards.
 * GET /api/v1/events/:eventId/rsvps/stats
 */
const getRsvpStats = async (req, res, next) => {
  const { eventId } = req.params;
  try {
    const stats = await guestService.getStats(eventId);
    return sendOk(res, { stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitPublicRSVP,
  getRSVPs,
  importGuestsCSV,
  getRsvpInvite,
  respondViaToken,
  getRsvpStats,
  exportGuestsCSV,
  exportGuestsExcel,
  searchPublicGuests,
  getGuestById,
  deleteRSVP,
  updateRSVP,
  addGuestManually,
  verifyPublicSeating,
  getGuestSeatingMap,
  // Exported for unit testing of the ILIKE-injection escaping.
  escapeLikePattern,
};
