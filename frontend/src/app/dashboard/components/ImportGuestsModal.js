'use client';

import React, { useState, useRef } from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';
import Icon from '../../components/icons/Icon';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

function parseCSVRows(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  });
}

export default function ImportGuestsModal({ isOpen, onClose, eventId, event, onImportComplete }) {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Reset the form whenever the modal transitions open (mirrors the previous
  // `useEffect(..., [isOpen])` — resetting during render instead of in an
  // effect avoids the setState-in-effect cascading-render pattern).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFileContent(''); setFileName(''); setPreview([]); setTotalRows(0);
      setError(''); setResult(null); setLoading(false); setDragOver(false);
    }
  }

  // A11Y-9: shared focus-trap/initial-focus/focus-restore/scroll-lock/Escape hook.
  const dialogRef = useModalA11y(isOpen, { onClose });

  if (!isOpen) return null;

  const processFile = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');
    const isXlsx = name.endsWith('.xlsx');
    if (!isCsv && !isXlsx) {
      setError('Please select a .csv or .xlsx file'); return;
    }
    setError('');
    setFileName(file.name);

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setFileContent(text);
        const rows = parseCSVRows(text);
        const dataRows = rows.length > 1 ? rows.slice(1) : rows;
        setTotalRows(dataRows.length);
        setPreview(rows.slice(0, 6)); // header + 5 data rows
      };
      reader.onerror = () => setError('Failed to read file');
      reader.readAsText(file);
    } else if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        setFileContent(base64);
        setTotalRows(0); // Cannot count/preview an .xlsx binary client-side without a parser library
        setPreview([]);
      };
      reader.onerror = () => setError('Failed to read file');
      reader.readAsArrayBuffer(file);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleSubmit = async () => {
    if (!fileContent) { setError('Please select a file first.'); return; }
    setLoading(true); setError('');
    try {
      const isXlsx = fileName.toLowerCase().endsWith('.xlsx');
      const bodyPayload = isXlsx 
        ? { fileData: fileContent, fileName } 
        : { csvData: fileContent };

      const res = await fetch(`${apiUrl}/events/${eventId}/rsvps/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Import failed');
      setResult(data.data);
      onImportComplete?.();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = {
    fontSize: '10px', fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase',
    letterSpacing: '0.08em', fontFamily: 'var(--font-sans)',
  };

  const isWedding = event?.event_type === 'wedding';
  const sideHint = event?.track_guest_side
    ? (isWedding ? 'side (optional — groom/bride)' : "side (optional — partner1/partner2)")
    : 'side (optional — partner1/partner2 or groom/bride)';
  const isXlsxSelected = fileName.toLowerCase().endsWith('.xlsx');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(25, 27, 30, 0.45)', backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease', padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-guests-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white, borderRadius: '16px', width: '100%', maxWidth: '560px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(232,226,214,0.5)',
          animation: 'slideUp 0.25s ease', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        }}>
          <div>
            <h2 id="import-guests-modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: COLORS.charcoal, margin: 0 }}>
              Import Guests
            </h2>
            <p style={{ fontSize: '12px', color: COLORS.stone, margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
              Upload a CSV file with guest data
            </p>
          </div>
          <button
            onClick={onClose} aria-label="Close modal"
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: COLORS.ivory,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.stone, transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EDE8DD'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

          {/* Success result */}
          {result ? (
            <div style={{
              textAlign: 'center', padding: '32px 16px',
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', background: '#F0FDF4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: COLORS.charcoal, margin: '0 0 8px' }}>
                Import Complete
              </h3>
              <p style={{ fontSize: '14px', color: COLORS.stone, fontFamily: 'var(--font-sans)', margin: '0 0 4px' }}>
                <strong style={{ color: COLORS.gold }}>{result.importedCount ?? totalRows}</strong> guests imported successfully
              </p>
              {result.skippedCount > 0 && (
                <p style={{ fontSize: '12px', color: COLORS.stone, marginTop: '4px', fontFamily: 'var(--font-sans)' }}>
                  {result.skippedCount} duplicate{result.skippedCount === 1 ? '' : 's'} skipped
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div style={{ marginTop: '12px', textAlign: 'left' }}>
                  <p style={{ fontSize: '12px', color: '#C45E5E', fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: '6px' }}>
                    {result.errors.length} row{result.errors.length === 1 ? '' : 's'} failed to import:
                  </p>
                  <div style={{
                    maxHeight: '160px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2',
                  }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', fontSize: '12px', fontFamily: 'var(--font-sans)',
                        borderBottom: i < result.errors.length - 1 ? '1px solid #FECACA' : 'none',
                      }}>
                        <strong style={{ color: COLORS.charcoal }}>{e.guest_name || 'Unnamed row'}: </strong>
                        <span style={{ color: '#C45E5E' }}>{e.error || 'Unknown error'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p style={{ fontSize: '13px', color: COLORS.stone, marginTop: '16px', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                Ready to invite them? Send personalized SMS invitations now, or share your link / QR code from the dashboard.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => {
                  try { if (eventId) localStorage.setItem('active_event_id', eventId); } catch { /* ignore */ }
                  window.location.href = '/dashboard/campaigns';
                }} style={{
                  padding: '10px 24px', borderRadius: '8px', border: 'none',
                  background: COLORS.gold, color: COLORS.white, fontSize: '13px', fontWeight: 700,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.goldHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.gold; }}
                >Send Invitations</button>
                <button onClick={onClose} style={{
                  padding: '10px 24px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                  background: COLORS.white, color: COLORS.stone, fontSize: '13px', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
                >Done</button>
              </div>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? COLORS.gold : COLORS.border}`,
                  borderRadius: '12px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#FFFDF5' : COLORS.softBg, transition: 'all 0.2s',
                }}
              >
                <input ref={fileRef} type="file" accept=".csv, .xlsx" onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', background: COLORS.ivory,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                  color: COLORS.gold,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                {fileName ? (
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: COLORS.charcoal, fontFamily: 'var(--font-sans)', margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Icon name="document" size={14} strokeWidth={1.6} /> {fileName}
                    </p>
                    <p style={{ fontSize: '12px', color: COLORS.stone, fontFamily: 'var(--font-sans)', margin: 0 }}>
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: COLORS.charcoal, fontFamily: 'var(--font-sans)', margin: '0 0 4px' }}>
                      Drop your CSV or Excel file here or <span style={{ color: COLORS.gold, fontWeight: 600 }}>browse</span>
                    </p>
                    <p style={{ fontSize: '12px', color: COLORS.stone, fontFamily: 'var(--font-sans)', margin: 0 }}>
                      Accepts .csv or .xlsx files · Columns: guest_name, email, phone, party_size, notes, {sideHint}
                    </p>
                  </div>
                )}
              </div>

              {/* Excel files can't be parsed/previewed client-side without adding a
                  parser dependency — say so plainly instead of showing nothing,
                  so it doesn't look broken next to the CSV path's live preview. */}
              {isXlsxSelected && preview.length === 0 && (
                <div style={{
                  marginTop: '16px', padding: '10px 14px', borderRadius: '8px', background: COLORS.softBg,
                  border: `1px solid ${COLORS.border}`, color: COLORS.stone, fontSize: '12px', fontFamily: 'var(--font-sans)',
                }}>
                  A row-by-row preview isn&apos;t available for Excel files. Your data will be validated when you click Import — for a live preview before importing, save the file as .csv instead.
                </div>
              )}

              {/* Preview */}
              {preview.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={labelStyle}>Preview</span>
                    <span style={{ ...labelStyle, color: COLORS.gold }}>
                      {totalRows} data row{totalRows !== 1 ? 's' : ''} found
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
                      <thead>
                        {preview[0] && (
                          <tr>
                            {preview[0].map((cell, i) => (
                              <th key={i} style={{
                                padding: '8px 12px', textAlign: 'left', background: COLORS.ivory,
                                fontWeight: 600, color: COLORS.stone, borderBottom: `1px solid ${COLORS.border}`,
                                whiteSpace: 'nowrap', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}>{cell}</th>
                            ))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {preview.slice(1).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{
                                padding: '7px 12px', borderBottom: `1px solid ${COLORS.border}`,
                                color: COLORS.charcoal, whiteSpace: 'nowrap', maxWidth: '150px',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalRows > 5 && (
                    <p style={{ fontSize: '11px', color: COLORS.stone, marginTop: '6px', fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
                      …and {totalRows - 5} more row{totalRows - 5 !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  marginTop: '16px', padding: '10px 14px', borderRadius: '8px', background: '#FEF2F2',
                  border: '1px solid #FECACA', color: '#C45E5E', fontSize: '13px', fontFamily: 'var(--font-sans)',
                }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px',
            borderTop: `1px solid ${COLORS.border}`, flexShrink: 0,
          }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
              background: COLORS.white, color: COLORS.stone, fontSize: '13px', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.ivory; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
            >Cancel</button>
            <button onClick={handleSubmit} disabled={loading || !fileContent}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: (loading || !fileContent) ? COLORS.champagne : COLORS.gold,
                color: COLORS.white, fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                cursor: (loading || !fileContent) ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: !fileContent ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { if (!loading && fileContent) e.currentTarget.style.background = COLORS.goldHover; }}
              onMouseLeave={(e) => { if (!loading && fileContent) e.currentTarget.style.background = COLORS.gold; }}
            >
              {loading && (
                <span style={{
                  width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: COLORS.white, borderRadius: '50%', display: 'inline-block',
                  animation: 'spin 0.6s linear infinite',
                }} />
              )}
              {loading ? 'Importing…' : `Import ${totalRows > 0 ? totalRows + ' ' : ''}Guests`}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
