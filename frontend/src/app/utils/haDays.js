/* The full-page guest experience's schedule/venue list is a flexible
   N-day array (template_data.ha_days) — an event can be a single day, two
   days, three, or more. Events saved before this became dynamic stored a
   fixed ha_schedule_day1/day2 + ha_venue_day1/day2_* shape instead; getHaDays
   reads the new array when present and otherwise synthesizes it from those
   legacy fields, so old events keep rendering and keep editing correctly
   without a data migration. */
export function getHaDays(td) {
  if (Array.isArray(td?.ha_days) && td.ha_days.length > 0) return td.ha_days;

  const days = [];
  const schedule1 = Array.isArray(td?.ha_schedule_day1) ? td.ha_schedule_day1 : [];
  const hasVenue1 = !!(td?.ha_venue_day1_name || td?.ha_venue_day1_address);
  if (schedule1.length > 0 || hasVenue1) {
    days.push({
      label: 'Day 1',
      schedule: schedule1,
      venue: {
        name: td.ha_venue_day1_name || '',
        address: td.ha_venue_day1_address || '',
        lat: td.ha_venue_day1_lat ?? null,
        lng: td.ha_venue_day1_lng ?? null,
        image: td.ha_venue_day1_image || '',
      },
    });
  }
  const schedule2 = Array.isArray(td?.ha_schedule_day2) ? td.ha_schedule_day2 : [];
  const hasVenue2 = !!(td?.ha_venue_day2_name || td?.ha_venue_day2_address);
  if (schedule2.length > 0 || hasVenue2) {
    days.push({
      label: 'Day 2',
      schedule: schedule2,
      venue: {
        name: td.ha_venue_day2_name || '',
        address: td.ha_venue_day2_address || '',
        lat: td.ha_venue_day2_lat ?? null,
        lng: td.ha_venue_day2_lng ?? null,
        image: td.ha_venue_day2_image || '',
      },
    });
  }
  return days;
}
