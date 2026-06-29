'use client';

import { useState } from 'react';
import { publicApiFetch } from '../../../utils/publicApi';

/**
 * "Find my table" — identity-verified lookup. The guest proves who they are
 * with their exact name + the last 4 digits of their phone, and the server
 * returns ONLY their own seating map in one call (no enumerable party list).
 * Also exposes fetchSeatingMap(partyId) for the post-submit "view where I sit"
 * flow in step 5, where the party id is already known and trusted.
 */
export function useSeatingLookup(slug) {
  const [verifyName, setVerifyName] = useState('');
  const [verifyLast4, setVerifyLast4] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [seatingView, setSeatingView] = useState(null);
  const [seatingLoading, setSeatingLoading] = useState(false);

  const verifyTable = async () => {
    if (!verifyName.trim() || !/^\d{4}$/.test(verifyLast4)) return;
    setVerifying(true);
    setVerifyFailed(false);
    setSeatingView(null);
    try {
      const data = await publicApiFetch(`/public/events/${slug}/seating/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: verifyName.trim(), phoneLast4: verifyLast4 }),
      });
      if (data.verified) {
        setSeatingView({ myTableName: data.myTableName, myTableId: data.myTableId, party: data.party || [], tables: data.tables || [] });
      } else {
        setVerifyFailed(true);
      }
    } catch {
      setVerifyFailed(true);
    } finally {
      setVerifying(false);
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
    verifyName, setVerifyName, verifyLast4, setVerifyLast4,
    verifying, verifyFailed, setVerifyFailed,
    seatingView, setSeatingView, seatingLoading, verifyTable, fetchSeatingMap,
  };
}
