const ExcelJS = require('exceljs');
const { sanitizeCsvValue } = require('./csvHelper');

const generateExcelExport = async (rsvps, tables, checkIns) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fancy RSVP';
  workbook.created = new Date();

  // 1. Sheet 1: Guest List
  const guestSheet = workbook.addWorksheet('Guest List');
  guestSheet.columns = [
    { header: 'Guest Name', key: 'guest_name', width: 25 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Response', key: 'response', width: 12 },
    { header: 'Party Size', key: 'party_size', width: 12 },
    { header: 'Assigned Table', key: 'table_name', width: 20 },
    { header: 'Primary Meal Selection', key: 'primary_meal', width: 25 },
    { header: 'Notes', key: 'notes', width: 30 }
  ];

  // Make header row bold and styled
  const headerRow = guestSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB8944F' } // Fancy Gold
  };

  rsvps.forEach(r => {
    const tableName = r.seating_assignments?.[0]?.tables?.table_name || 'Unassigned';
    
    // Find primary guest meal selection from r.rsvp_guests
    const primaryGuest = r.rsvp_guests?.find(g => g.is_primary);
    const primaryMeal = primaryGuest?.meal_selection || 'None';

    guestSheet.addRow({
      guest_name: sanitizeCsvValue(r.guest_name),
      email: sanitizeCsvValue(r.email) || 'N/A',
      phone: sanitizeCsvValue(r.phone) || 'N/A',
      response: r.response,
      party_size: r.party_size,
      table_name: sanitizeCsvValue(tableName),
      primary_meal: sanitizeCsvValue(primaryMeal),
      notes: sanitizeCsvValue(r.notes) || ''
    });
  });

  // 2. Sheet 2: Seating List
  const seatingSheet = workbook.addWorksheet('Seating List');
  seatingSheet.columns = [
    { header: 'Table Name', key: 'table_name', width: 20 },
    { header: 'Shape', key: 'shape', width: 12 },
    { header: 'Max Capacity', key: 'max_capacity', width: 15 },
    { header: 'Occupied Seats', key: 'occupied', width: 15 },
    { header: 'Assigned Guests', key: 'guests', width: 50 }
  ];
  
  const seatingHeader = seatingSheet.getRow(1);
  seatingHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  seatingHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF191B1E' } // Dark Charcoal
  };

  tables.forEach(t => {
    // Find all guests assigned to this table
    const assignedGuests = rsvps.filter(r => r.seating_assignments?.[0]?.table_id === t.id);
    const guestNames = assignedGuests.map(r => `${r.guest_name} (Party of ${r.party_size})`).join(', ');
    const occupiedSeats = assignedGuests.reduce((sum, r) => sum + r.party_size, 0);

    seatingSheet.addRow({
      table_name: sanitizeCsvValue(t.table_name),
      shape: t.shape,
      max_capacity: t.max_capacity,
      occupied: occupiedSeats,
      guests: sanitizeCsvValue(guestNames) || 'None'
    });
  });

  // 3. Sheet 3: Meal Summary
  const mealSheet = workbook.addWorksheet('Meal Summary');
  mealSheet.columns = [
    { header: 'Meal Option', key: 'meal_type', width: 30 },
    { header: 'Total Ordered Count', key: 'count', width: 20 }
  ];

  const mealHeader = mealSheet.getRow(1);
  mealHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  mealHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4A7C59' } // Dark Sage Green
  };

  const mealCounts = {};
  rsvps.forEach(r => {
    if (r.response === 'yes' && r.rsvp_guests) {
      r.rsvp_guests.forEach(g => {
        if (g.meal_selection) {
          mealCounts[g.meal_selection] = (mealCounts[g.meal_selection] || 0) + 1;
        }
      });
    }
  });

  Object.entries(mealCounts).forEach(([meal, count]) => {
    mealSheet.addRow({
      meal_type: sanitizeCsvValue(meal),
      count: count
    });
  });

  // 4. Sheet 4: Check-in Log
  const checkinSheet = workbook.addWorksheet('Check-in Log');
  checkinSheet.columns = [
    { header: 'Guest Name', key: 'guest_name', width: 25 },
    { header: 'Checked In At', key: 'checked_in_at', width: 25 },
    { header: 'Method', key: 'method', width: 15 },
    { header: 'Party Checked In', key: 'party_count', width: 18 },
    { header: 'Checked In By', key: 'checked_in_by', width: 20 }
  ];

  const checkinHeader = checkinSheet.getRow(1);
  checkinHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  checkinHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF8B7EC8' } // Soft Purple
  };

  checkIns.forEach(c => {
    const guestName = c.rsvps?.guest_name || 'Unknown Guest';
    checkinSheet.addRow({
      guest_name: sanitizeCsvValue(guestName),
      checked_in_at: new Date(c.checked_in_at).toLocaleString(),
      method: c.method === 'qr_scan' ? 'QR Code Scan' : c.method === 'self_service' ? 'Self-Service Kiosk' : 'Manual Search',
      party_count: c.party_count_arrived || 1,
      checked_in_by: sanitizeCsvValue(c.checked_in_by) || 'Staff'
    });
  });

  return await workbook.xlsx.writeBuffer();
};

module.exports = {
  generateExcelExport
};
