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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      {onSearch && (
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.text400, fontSize: 14 }}>
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              fontSize: 14,
              background: T.surface,
              color: T.text900,
              outline: 'none',
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
