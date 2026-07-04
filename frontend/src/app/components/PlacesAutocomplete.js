'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
let googleMapsLoaded = false;
let googleMapsLoadPromise = null;

function loadGoogleMaps() {
  if (googleMapsLoaded) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject('No API key');

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('SSR');
    if (window.google?.maps?.places) { googleMapsLoaded = true; resolve(); return; }
    // Guard against duplicate script tags (e.g. HMR, back-navigation)
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => { googleMapsLoaded = true; resolve(); };
      script.onerror = () => reject('Failed to load Google Maps');
      document.head.appendChild(script);
    } else {
      // Script tag exists but hasn't finished loading yet; poll for readiness
      const interval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(interval);
          googleMapsLoaded = true;
          resolve();
        }
      }, 100);
    }
  });
  return googleMapsLoadPromise;
}

const C = { gold: '#B8944F', charcoal: '#191B1E', ivory: '#F8F4EC', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF' };

export default function PlacesAutocomplete({ value, onChange, onPlaceSelect, placeholder, style }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);

  // Store callback in a ref to avoid stale closures in the Autocomplete listener
  const onPlaceSelectRef = useRef(onPlaceSelect);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);

  // Load Google Maps script on mount
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => { if (!cancelled) setMapsReady(true); })
      .catch(() => { /* graceful degradation — stay as plain input */ });
    return () => { cancelled = true; };
  }, []);

  // Attach Autocomplete once Maps API is ready and input is mounted
  useEffect(() => {
    if (!mapsReady || !inputRef.current || autocompleteRef.current) return;

    try {
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'formatted_address', 'geometry', 'place_id'],
        types: ['establishment', 'geocode'],
      });

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place || !place.geometry) return; // user pressed Enter without selecting

        const placeData = {
          name: place.name || '',
          address: place.formatted_address || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id || '',
        };

        // Let the caller decide how to reflect this back into the controlled `value`
        // (e.g. venue name vs. formatted address) via onPlaceSelect.
        if (onPlaceSelectRef.current) onPlaceSelectRef.current(placeData);
      });

      autocompleteRef.current = ac;
    } catch {
      // Autocomplete init failed — fall back to plain input
    }

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [mapsReady]);

  const handleInputChange = useCallback((e) => {
    if (onChange) onChange(e.target.value);
  }, [onChange]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder || 'Search for a venue or address...'}
        style={style || {}}
        onFocus={(e) => { e.target.style.borderColor = C.gold; }}
        onBlur={(e) => { e.target.style.borderColor = C.border; }}
        autoComplete="off"
      />
      {mapsReady && (
        <div style={{
          marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '10px', color: C.stone, opacity: 0.7,
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke={C.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
          </svg>
          Powered by Google
        </div>
      )}

      {/* Style the Google autocomplete dropdown to match brand */}
      <style jsx global>{`
        .pac-container {
          border-radius: 8px;
          border: 1px solid ${C.border};
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          margin-top: 4px;
          font-family: var(--font-sans);
          z-index: 10000;
        }
        .pac-item {
          padding: 10px 14px;
          font-size: 13px;
          cursor: pointer;
          border-top: 1px solid ${C.border};
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover {
          background: ${C.ivory};
        }
        .pac-item-selected {
          background: rgba(184,148,79,0.06);
        }
        .pac-icon {
          display: none;
        }
        .pac-item-query {
          font-weight: 600;
          color: ${C.charcoal};
        }
        .pac-matched {
          color: ${C.gold};
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
