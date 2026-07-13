'use client';

import { T, card } from './theme';
import Icon from '../../components/icons/Icon';

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
 *   onRefresh?: () => void,  // renders a "↻ Refresh" button — most admin list
 *                            // views only ever refetch after an action (approve/
 *                            // delete) or a page change, with no way to manually
 *                            // pull the latest data (e.g. after another admin's
 *                            // change, or a webhook landing) without a full reload.
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
  onRefresh,
}) {
  // Loading/empty states are just a centered message in one cell — fine at any
  // width. Only actual data rows suffer the "raw table needs 2D scrolling on a
  // phone" problem this component is shared by ~10 admin list screens, so the
  // fix lives here once: swap to a stacked label/value card per row on mobile
  // instead of forcing horizontal scroll to reach the last column.
  const hasRows = !loading && !!rows && rows.length > 0;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {(title || actions || onRefresh) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          {title && <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>{title}</h3>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {actions}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Refresh"
                style={{
                  padding: '7px 14px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                  background: T.surfaceAlt, color: T.text700, fontSize: 12.5, fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
                Refresh
              </button>
            )}
          </div>
        </div>
      )}

      <div className={hasRows ? 'admin-table-wrap-rows' : undefined} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ padding: '14px 20px', textAlign: c.align || 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.text500, fontWeight: 700 }}
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
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Icon name="emptyMailbox" size={22} color={T.text400} strokeWidth={1.4} /></div>
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

      {hasRows && (
        <div className="admin-cards-wrap" style={{ display: 'none', flexDirection: 'column', gap: 10, padding: 16 }}>
          {rows.map((row, i) => (
            <div key={rowKey ? rowKey(row, i) : i} style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columns.map((c) => {
                const value = c.render ? c.render(row) : row[c.key];
                return (
                  <div key={c.key} style={{ display: 'flex', justifyContent: c.header ? 'space-between' : 'flex-start', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {c.header && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.text500, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                        {c.header}
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: T.text700, textAlign: c.header ? 'right' : 'left' }}>{value}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

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
          background-color: ${T.surfaceAlt};
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .admin-table-wrap-rows { display: none; }
          .admin-cards-wrap { display: flex !important; }
        }
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
