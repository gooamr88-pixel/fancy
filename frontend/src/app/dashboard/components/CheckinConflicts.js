'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { toast } from '../../utils/toast';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8', danger: '#B03A2E', warn: '#C8871B', success: '#2E7D5B',
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

/**
 * Conflict resolution and anomalies (amendment A-16 item 5; spec §5.3 L4, §19.5).
 *
 * A conflict means two tablets, both offline, both admitted the same guest. The
 * server kept the first and recorded the second. §5.3 is explicit that this is the
 * intended outcome — "the door is never blocked by uncertainty" — so this screen
 * is not an error log. It is the audited follow-up that makes accepting the
 * duplicate safe.
 *
 * Resolving records that a human looked and decided. It deliberately changes no
 * check-in: the arrival record is what it is, and reversing an admission is the
 * separately-audited undo, done from the tablet or the guest list.
 */
export default function CheckinConflicts({ eventId }) {
  const [conflicts, setConflicts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async (includeResolved) => {
    try {
      const res = await apiFetch(
        `/checkin/events/${eventId}/conflicts${includeResolved ? '?includeResolved=1' : ''}`,
      );
      setConflicts(res?.data?.conflicts || []);
      setAnomalies(res?.data?.anomalies || []);
    } catch (err) {
      toast.error(err.message || 'Could not load conflicts.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      await load(showResolved);
    })();
  }, [eventId, showResolved, load]);

  const resolve = async (conflict) => {
    setBusyId(conflict.id);
    try {
      await apiFetch(`/checkin/events/${eventId}/conflicts/${conflict.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() || null }),
      });
      setNoteFor(null);
      setNote('');
      toast.success('Marked as reviewed.');
      await load(showResolved);
    } catch (err) {
      toast.error(err.message || 'Could not resolve that.');
    } finally {
      setBusyId(null);
    }
  };

  const unresolved = conflicts.filter((c) => !c.resolvedAt);

  return (
    <div className="fx-stack" style={{ gap: '24px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '20px', color: C.charcoal }}>Duplicate admissions</h3>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: C.stone, lineHeight: 1.6 }}>
          When two tablets are both offline, they cannot see each other — so both
          may let the same guest in. That is deliberate: turning a real guest away
          in front of the queue is worse. Every case is recorded here with both
          sides so you can check what happened.
        </p>
      </div>

      <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '14px', color: C.stone }}>
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
        />
        Include ones already reviewed
      </label>

      {loading ? (
        <p style={{ color: C.stone }}>Loading…</p>
      ) : conflicts.length === 0 ? (
        <div style={{
          border: `1px solid ${C.success}`, borderLeft: `4px solid ${C.success}`,
          borderRadius: '12px', padding: '20px', background: C.white,
        }}>
          <p style={{ margin: 0, fontSize: '15px', color: C.success }}>
            No duplicate admissions. Every guest was let in exactly once.
          </p>
        </div>
      ) : (
        <div className="fx-stack" style={{ gap: '12px' }}>
          {conflicts.map((c) => (
            <div
              key={c.id}
              style={{
                background: C.white,
                border: `1px solid ${c.resolvedAt ? C.border : C.warn}`,
                borderLeft: `4px solid ${c.resolvedAt ? C.border : C.warn}`,
                borderRadius: '12px', padding: '20px',
              }}
            >
              <div style={{ fontSize: '17px', color: C.charcoal }}>
                {c.guestName || 'Unknown guest'}
                {c.partyLabel && c.partyLabel !== c.guestName && (
                  <span style={{ color: C.stone, fontSize: '14px' }}> · {c.partyLabel}</span>
                )}
              </div>

              {/* Both sides, side by side. §5.3 L4 requires both timestamps, both
                  operators and both gates — that is exactly what settles the
                  question of what actually happened. */}
              <div className="fx-grid fx-grid--2 fx-grid--gap-sm" style={{ marginTop: '14px' }}>
                <SidePanel
                  title="Counted"
                  tint={C.success}
                  staff={c.kept.staffName}
                  gate={c.kept.gate}
                  at={c.kept.checkedInAt}
                />
                <SidePanel
                  title="Also scanned"
                  tint={C.warn}
                  staff={c.rejected.staffName}
                  gate={c.rejected.gate}
                  at={c.rejected.checkedInAt}
                />
              </div>

              {c.resolvedAt ? (
                <p style={{ margin: '14px 0 0', fontSize: '13px', color: C.stone }}>
                  Reviewed {fmt(c.resolvedAt)}
                  {c.resolutionNote && ` — ${c.resolutionNote}`}
                </p>
              ) : noteFor === c.id ? (
                <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What happened? (optional)"
                    autoFocus
                    style={{
                      flex: '1 1 260px', background: C.white, border: `1px solid ${C.border}`,
                      borderRadius: '8px', padding: '10px 12px', fontSize: '15px', color: C.charcoal,
                    }}
                  />
                  <button
                    onClick={() => resolve(c)}
                    disabled={busyId === c.id}
                    style={{
                      background: C.gold, color: C.white, border: 'none', borderRadius: '8px',
                      padding: '10px 20px', cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    Mark reviewed
                  </button>
                  <button
                    onClick={() => { setNoteFor(null); setNote(''); }}
                    style={{
                      background: 'transparent', color: C.stone, border: `1px solid ${C.border}`,
                      borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNoteFor(c.id); setNote(''); }}
                  style={{
                    marginTop: '14px', background: 'transparent', color: C.charcoal,
                    border: `1px solid ${C.border}`, borderRadius: '8px',
                    padding: '10px 20px', cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  Mark reviewed
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Anomalies (§19.5) ── */}
      {anomalies.length > 0 && (
        <div>
          <h3 style={{ margin: '8px 0 6px', fontSize: '18px', color: C.charcoal }}>Worth a look</h3>
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: C.stone, lineHeight: 1.6 }}>
            These do not change the totals, but they are the things that make a
            total misleading if nobody checks them.
          </p>
          <div className="fx-stack" style={{ gap: '8px' }}>
            {anomalies.map((a) => (
              <div
                key={a.id}
                style={{
                  background: C.softBg, border: `1px solid ${C.border}`,
                  borderRadius: '10px', padding: '14px 18px', fontSize: '14px', color: C.charcoal,
                }}
              >
                <strong>{a.guestName || 'Removed guest'}</strong>
                {' — '}
                {a.kind === 'unverified_scan'
                  ? 'the scanned ticket did not check out. Possibly a photographed or edited pass.'
                  : `admission reversed${a.reason ? `: ${a.reason}` : ''}.`}
                {a.guestRemoved && ' This guest was removed from the list after arriving, so they are in the room but not on it.'}
                <div style={{ color: C.stone, fontSize: '13px', marginTop: '4px' }}>
                  {fmt(a.checkedInAt)}{a.gate ? ` · ${a.gate}` : ''}{a.staffName ? ` · ${a.staffName}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unresolved.length > 0 && (
        <p style={{ fontSize: '13px', color: C.stone, margin: 0 }}>
          {unresolved.length} still to review.
        </p>
      )}
    </div>
  );
}

function SidePanel({ title, tint, staff, gate, at }) {
  return (
    <div style={{
      background: C.softBg, border: `1px solid ${C.border}`,
      borderRadius: '10px', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: tint }}>
        {title}
      </div>
      <div style={{ marginTop: '6px', fontSize: '15px', color: C.charcoal }}>{gate || 'Unknown gate'}</div>
      <div style={{ fontSize: '13px', color: C.stone }}>
        {staff || 'Unattributed'} · {fmt(at)}
      </div>
    </div>
  );
}
