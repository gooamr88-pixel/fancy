'use client';

import { useState } from 'react';
import { publicApiFetch } from '../../../utils/publicApi';

/** Name-search against the public guest-list lookup (step 1's "find my invitation"). */
export function usePartySearch(slug) {
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const search = async (name) => {
    if (!name.trim()) return;
    setSearching(true);
    try {
      const data = await publicApiFetch(`/public/events/${slug}/rsvp/search?query=${encodeURIComponent(name.trim())}`);
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
      setSearchPerformed(true);
    }
  };

  const reset = () => { setSearchPerformed(false); setSearchResults([]); };

  return { searchResults, searching, searchPerformed, search, reset };
}
