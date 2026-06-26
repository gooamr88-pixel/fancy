'use client';

import { T, card } from './theme';

/**
 * Reusable, responsive data table with the standard pagination contract
 * (Foundation F3/F4 — matches the backend { data, pagination } envelope).
 *
 * @param {{
 *   columns: { key:string, header:string, align?:string, render?:(row:any)=>React.ReactNode }[],
 *   rows: any[],
 *   loading?: boolean,
 *   emptyText?: string,
 *   rowKey?: (row:any, i:number)=>string,
 *   pagination?: { page:number, totalPages:number, total:number },
 *   onPageChange?: (page:number)=>void,
 *   title?: string,
 *   actions?: React.ReactNode,
 * }} props
 */
export default function DataTable({
  columns,
  rows,
  loading,
  emptyText = 'No records found.',
  rowKey,
  pagination,
  onPageChange,
  title,
  actions,
}) {
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          {title && <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>{title}</h3>}
          {actions}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ padding: '14px 20px', textAlign: c.align || 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.text500, fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '48px 20px', textAlign: 'center', color: T.text400 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{ width: '16px', height: '16px', border: `2px solid ${T.border}`, borderTop: `2px solid ${T.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading data…
                  </div>
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '48px 20px', textAlign: 'center', color: T.text400 }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row, i) : i} className="admin-row" style={{ borderBottom: `1px solid ${T.border}`, transition: 'background-color 0.2s' }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ padding: '14px 20px', textAlign: c.align || 'left', color: T.text700, verticalAlign: 'middle' }}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 24px', borderTop: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.text500 }}>
            Page <b>{pagination.page}</b> of <b>{pagination.totalPages}</b> · {pagination.total} records
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <PageBtn disabled={pagination.page <= 1} onClick={() => onPageChange?.(pagination.page - 1)}>
              ← Prev
            </PageBtn>
            <PageBtn disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange?.(pagination.page + 1)}>
              Next →
            </PageBtn>
          </div>
        </div>
      )}
      <style jsx global>{`
        .admin-row:hover {
          background-color: rgba(255, 255, 255, 0.02);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function PageBtn({ disabled, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        background: disabled ? 'transparent' : T.surfaceAlt,
        color: disabled ? T.text400 : T.text700,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text700; } }}
    >
      {children}
    </button>
  );
}
