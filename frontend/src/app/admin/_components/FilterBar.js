'use client';

import { useEffect, useState } from 'react';
import { T } from './theme';

/**
 * Search + filter row for list views (Design Requirements — Filters/Search).
 * The search input is debounced (300ms) before calling onSearch.
 *
 * @param {{ onSearch?: (q:string)=>void, placeholder?: string, children?: React.ReactNode }} props
 */
export default function FilterBar({ onSearch, placeholder = 'Search…', children }) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!onSearch) return;
    const id = setTimeout(() => onSearch(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q, onSearch]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {onSearch && (
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.text500, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="admin-search-input"
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              fontSize: 13.5,
              background: T.surface,
              color: T.text900,
              outline: 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}
      {children}
      <style jsx global>{`
        .admin-search-input:focus {
          border-color: ${T.primary} !important;
          box-shadow: 0 0 0 3px ${T.primarySoft} !important;
          background-color: ${T.surfaceAlt} !important;
        }
        .admin-search-input::placeholder {
          color: ${T.text400};
        }
      `}</style>
    </div>
  );
}
