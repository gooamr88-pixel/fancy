'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { toast } from '../../utils/toast';
import ConfirmDialog from '../../components/ConfirmDialog';

const C = {
  gold: '#B8944F', charcoal: '#191B1E', stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', softBg: '#FAFAF8', danger: '#B03A2E', warn: '#C8871B', success: '#2E7D5B',
};

/**
 * Emergency controls (amendment A-16 item 7; spec §21.5).
 *
 * The remedy for something misbehaving mid-event — a retry storm, a bad
 * interaction between a deploy and devices in the field — when an app update is
 * impossible because the event is happening now.
 *
 * ── The thing this screen must make unmistakable ──
 *
 * §21.5: "The kill switch can never disable local operation. Its maximum effect is
 * to stop network activity." A tablet with sync switched off keeps scanning,
 * keeps catching duplicates locally, and keeps queueing — it behaves exactly as it
 * does with no signal, which the whole app is built around.
 *
 * That is stated plainly and repeatedly here, because the words "kill switch"
 * invite exactly the wrong assumption, and an organizer who believes this stops
 * the door will never touch it when they should.
 */
export default function CheckinControls({ eventId }) {
  const [controls, setControls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState(null); // { patch, title, body }

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/checkin/events/${eventId}/controls`);
      setControls(res?.data || null);
    } catch (err) {
      toast.error(err.message || 'Could not load controls.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      await load();
    })();
  }, [eventId, load]);

  const apply = async (patch) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/checkin/events/${eventId}/controls`, {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, note: note.trim() || null }),
      });
      setControls(res?.data || null);
      setPendingConfirm(null);
      toast.success('Applied. Tablets pick this up on their next sync.');
    } catch (err) {
      toast.error(err.message || 'Could not apply that.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Switching a control ON is confirmed; switching it OFF is not.
   *
   * Turning one off restores normal behaviour, which is never the dangerous
   * direction — and a confirmation in front of "put it back to normal" is
   * exactly the friction you do not want during the incident it exists for.
   */
  const update = (patch, confirm) => {
    if (confirm) setPendingConfirm({ patch, ...confirm });
    else apply(patch);
  };

  if (loading) return <p style={{ color: C.stone }}>Loading…</p>;

  const anyActive = controls?.syncDisabled || controls?.realtimeDisabled || controls?.pollingOnly;

  return (
    <div className="fx-stack" style={{ gap: '24px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '20px', color: C.charcoal }}>Emergency controls</h3>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: C.stone, lineHeight: 1.6 }}>
          For when something is going wrong during an event and there is no time to
          update the app.
        </p>
      </div>

      {/* The single most important sentence on this screen. */}
      <div style={{
        background: C.softBg, border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${C.success}`, borderRadius: '12px', padding: '18px 20px',
      }}>
        <p style={{ margin: 0, fontSize: '15px', color: C.charcoal, lineHeight: 1.7 }}>
          <strong>None of these stop check-in.</strong> Tablets keep scanning, keep
          catching duplicates they know about, and keep saving every arrival. These
          switches only pause talking to the server — exactly what already happens
          whenever a venue has no signal.
        </p>
      </div>

      {anyActive && (
        <div style={{
          background: C.white, border: `1px solid ${C.warn}`,
          borderLeft: `4px solid ${C.warn}`, borderRadius: '12px', padding: '18px 20px',
        }}>
          <p style={{ margin: 0, fontSize: '15px', color: C.warn }}>
            A control is currently active. Remember to switch it back once the
            problem is dealt with — arrivals will keep queueing on the tablets
            until you do, and they cannot be closed out with work still unsent.
          </p>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why? (recorded in the audit trail)"
        style={{
          width: '100%', boxSizing: 'border-box', background: C.white,
          border: `1px solid ${C.border}`, borderRadius: '10px',
          padding: '12px 14px', fontSize: '15px', color: C.charcoal,
        }}
      />

      <div className="fx-stack" style={{ gap: '12px' }}>
        <ControlRow
          title="Pause sending to the server"
          body="Tablets keep working and keep saving arrivals. Nothing is sent until you switch this back."
          active={!!controls?.syncDisabled}
          busy={busy}
          onToggle={(next) => update(
            { syncDisabled: next },
            next
              ? {
                title: 'Pause sending to the server?',
                body: 'Tablets keep scanning and keep saving every arrival — nothing is lost. But nothing reaches the server until you switch this back, and an event cannot be closed out while tablets still hold unsent check-ins.',
                confirmLabel: 'Pause sending',
              }
              : null,
          )}
        />
        <ControlRow
          title="Polling only"
          body="Tablets fetch updates on a timer instead of listening for them. Slower to notice another gate's check-ins, but steadier on a bad connection."
          active={!!controls?.pollingOnly}
          busy={busy}
          onToggle={(next) => update({ pollingOnly: next })}
        />
        <ControlRow
          title="Turn off live updates"
          body="Stops tablets from holding a live connection. They still fetch on a timer."
          active={!!controls?.realtimeDisabled}
          busy={busy}
          onToggle={(next) => update({ realtimeDisabled: next })}
        />
      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ''}
        body={pendingConfirm?.body ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel ?? 'Apply'}
        onConfirm={() => apply(pendingConfirm.patch)}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}

function ControlRow({ title, body, active, busy, onToggle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      background: C.white, border: `1px solid ${active ? C.warn : C.border}`,
      borderRadius: '12px', padding: '18px 20px',
    }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontSize: '16px', color: C.charcoal }}>
          {title}
          {active && (
            <span style={{ marginLeft: '10px', fontSize: '12px', color: C.warn, textTransform: 'uppercase' }}>
              on
            </span>
          )}
        </div>
        <div style={{ fontSize: '14px', color: C.stone, marginTop: '4px', lineHeight: 1.6 }}>{body}</div>
      </div>
      <button
        onClick={() => onToggle(!active)}
        disabled={busy}
        style={{
          background: active ? C.warn : 'transparent',
          color: active ? C.white : C.charcoal,
          border: `1px solid ${active ? C.warn : C.border}`,
          borderRadius: '8px', padding: '10px 22px',
          cursor: busy ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: busy ? 0.6 : 1,
        }}
      >
        {active ? 'Switch off' : 'Switch on'}
      </button>
    </div>
  );
}
