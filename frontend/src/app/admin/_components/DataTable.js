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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          {title && <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text900, margin: 0 }}>{title}</h3>}
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
                  style={{ padding: '11px 18px', textAlign: c.align || 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.text500, fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '36px 18px', textAlign: 'center', color: T.text400 }}>
                  Loading…
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '36px 18px', textAlign: 'center', color: T.text400 }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row, i) : i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ padding: '13px 18px', textAlign: c.align || 'left', color: T.text700 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderTop: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.text500 }}>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
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
    </div>
  );
}

function PageBtn({ disabled, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 14px',
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        background: disabled ? T.surfaceAlt : T.surface,
        color: disabled ? T.text400 : T.text700,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
