'use client';

import { useState } from 'react';
import { publicApiFetch } from '../../../utils/publicApi';

/**
 * "Find my table" — name search for an already-responded party, then the
 * personal seating map (own table + own party, never other guests) for a
 * resolved party id. Used both from step 1 (pre-RSVP lookup) and step 5
 * (post-submit "view where I sit").
 */
export function useSeatingLookup(slug) {
  const [tableQuery, setTableQuery] = useState('');
  const [tableResults, setTableResults] = useState([]);
  const [tableLookingUp, setTableLookingUp] = useState(false);
  const [tableLookupDone, setTableLookupDone] = useState(false);
  const [seatingView, setSeatingView] = useState(null);
  const [seatingLoading, setSeatingLoading] = useState(false);

  const lookupTable = async () => {
    if (!tableQuery.trim()) return;
    setTableLookingUp(true);
    setTableLookupDone(false);
    setSeatingView(null);
    try {
      const data = await publicApiFetch(`/public/events/${slug}/seating/search?query=${encodeURIComponent(tableQuery.trim())}`);
      setTableResults(data.results || []);
    } catch {
      setTableResults([]);
    } finally {
      setTableLookingUp(false);
      setTableLookupDone(true);
    }
  };

  const fetchSeatingMap = async (partyId) => {
    if (!partyId) return;
    setSeatingLoading(true);
    setSeatingView(null);
    try {
      const data = await publicApiFetch(`/public/events/${slug}/seating/guest/${partyId}`);
      setSeatingView({ myTableName: data.myTableName, myTableId: data.myTableId, party: data.party || [], tables: data.tables || [] });
    } catch {
      // leave seatingView null — caller renders nothing extra
    } finally {
      setSeatingLoading(false);
    }
  };

  return {
    tableQuery, setTableQuery, tableResults, tableLookingUp, tableLookupDone,
    seatingView, setSeatingView, seatingLoading, lookupTable, fetchSeatingMap,
  };
}
