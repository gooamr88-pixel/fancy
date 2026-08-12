'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { toast } from '../../utils/toast';
import ConfirmDialog from '../../components/ConfirmDialog';

const C = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  danger: '#B03A2E', success: '#2E7D5B',
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: C.white,
  border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px',
  fontSize: '16px', color: C.charcoal, outline: 'none', fontFamily: 'var(--font-sans)',
};

const ROLES = [
  { value: 'usher', label: 'Usher', help: 'Scan and check guests in.' },
  { value: 'supervisor', label: 'Supervisor', help: 'Also overrides, undoes, and resolves conflicts.' },
];

/**
 * Team management for the check-in app (amendment A-16 item 1, spec §18.5).
 *
 * Door staff are NOT platform users. They never log into this dashboard and hold
 * no account — they exist only as a roster row, and they authenticate on the
 * tablet by picking their name and entering a 4-digit PIN, offline, against a
 * hash that travelled in the event bundle.
 *
 * That is why this screen collects a PIN rather than sending an invitation: there
 * is no email to invite, and no password to set.
 *
 * ── The PIN is write-only ──
 *
 * It is sent once, hashed server-side with a per-staff salt, and never returned.
 * There is no "show PIN" affordance because the server genuinely cannot answer
 * that question. A forgotten PIN is reset, not recovered — and a supervisor can
 * also reset one from the tablet itself when there is no connectivity (§21.8).
 */
export default function TeamManagement({ eventId }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: '', role: 'usher', pin: '' });
  const [resetting, setResetting] = useState(null); // staffId being reset
  const [resetPin, setResetPin] = useState('');
  const [removing, setRemoving] = useState(null); // the member awaiting confirmation

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/checkin/events/${eventId}/staff`);
      setStaff(res?.data?.staff || []);
    } catch (err) {
      toast.error(err.message || 'Could not load the team.');
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

  const pinIsValid = (value) => /^\d{4}$/.test(value);

  const addStaff = async () => {
    if (!form.displayName.trim()) return toast.error('Enter a name.');
    if (!pinIsValid(form.pin)) return toast.error('The PIN must be exactly 4 digits.');

    setSaving(true);
    try {
      await apiFetch(`/checkin/events/${eventId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          role: form.role,
          pin: form.pin,
        }),
      });
      // Cleared immediately so a PIN is never left sitting on screen at a desk.
      setForm({ displayName: '', role: 'usher', pin: '' });
      toast.success(`${form.displayName.trim()} added.`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not add that person.');
    } finally {
      setSaving(false);
    }
  };

  const submitReset = async (staffId, name) => {
    if (!pinIsValid(resetPin)) return toast.error('The PIN must be exactly 4 digits.');

    setSaving(true);
    try {
      await apiFetch(`/checkin/events/${eventId}/staff/${staffId}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({ pin: resetPin }),
      });
      setResetting(null);
      setResetPin('');
      toast.success(`${name}'s PIN reset.`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not reset that PIN.');
    } finally {
      setSaving(false);
    }
  };

  // Throws on failure so ConfirmDialog can restore its buttons and let the
  // organizer retry from the same dialog, rather than closing over an error.
  const deactivate = async ({ id, displayName }) => {
    setSaving(true);
    try {
      await apiFetch(`/checkin/events/${eventId}/staff/${id}`, { method: 'DELETE' });
      toast.success(`${displayName} removed.`);
      setRemoving(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not remove that person.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const active = staff.filter((s) => s.isActive);

  return (
    <div className="fx-stack" style={{ gap: '24px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '20px', color: C.charcoal }}>Door team</h3>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: C.stone, lineHeight: 1.6 }}>
          The people who will check guests in on the night. They sign in on the tablet
          by choosing their name and entering their PIN — no email or password, and it
          works with no internet at the venue.
        </p>
      </div>

      {/* ── Add ── */}
      <div style={{ background: C.softBg, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '20px' }}>
        <div className="fx-grid fx-grid--3 fx-grid--gap-sm">
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: C.stone, marginBottom: '6px' }}>Name</label>
            <input
              style={inputStyle}
              value={form.displayName}
              maxLength={80}
              placeholder="e.g. Amina"
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: C.stone, marginBottom: '6px' }}>Role</label>
            <select
              style={inputStyle}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: C.stone, marginBottom: '6px' }}>
              4-digit PIN
            </label>
            <input
              style={inputStyle}
              value={form.pin}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              // Filtered on input rather than validated on submit: a PIN pad on a
              // tablet has no letters, so a letter here is always a typo.
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
          </div>
        </div>

        <p style={{ margin: '10px 0 0', fontSize: '13px', color: C.stone }}>
          {ROLES.find((r) => r.value === form.role)?.help}
          {' '}The PIN is stored scrambled and cannot be looked up later — if it is
          forgotten, reset it here or from the tablet.
        </p>

        <button
          onClick={addStaff}
          disabled={saving}
          style={{
            marginTop: '16px', background: C.gold, color: C.white, border: 'none',
            borderRadius: '10px', padding: '12px 24px', fontSize: '15px',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          Add to team
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <p style={{ color: C.stone }}>Loading…</p>
      ) : active.length === 0 ? (
        <div style={{
          border: `1px dashed ${C.border}`, borderRadius: '14px',
          padding: '28px', textAlign: 'center', color: C.stone,
        }}>
          <p style={{ margin: 0, fontSize: '15px' }}>
            Nobody on the team yet. Add at least one person before the event —
            a tablet cannot check anyone in without someone to sign in as.
          </p>
        </div>
      ) : (
        <div className="fx-stack" style={{ gap: '10px' }}>
          {active.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px',
                background: C.white, border: `1px solid ${C.border}`,
                borderRadius: '12px', padding: '16px 20px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', color: C.charcoal }}>{member.displayName}</div>
                <div style={{ fontSize: '13px', color: C.stone }}>
                  {ROLES.find((r) => r.value === member.role)?.label || member.role}
                  {member.pinResetAt && ' · PIN reset'}
                </div>
              </div>

              {resetting === member.id ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, width: '110px' }}
                    value={resetPin}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="New PIN"
                    autoFocus
                    onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  <button
                    onClick={() => submitReset(member.id, member.displayName)}
                    disabled={saving}
                    style={{
                      background: C.gold, color: C.white, border: 'none', borderRadius: '8px',
                      padding: '10px 16px', cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setResetting(null); setResetPin(''); }}
                    style={{
                      background: 'transparent', color: C.stone, border: `1px solid ${C.border}`,
                      borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    onClick={() => { setResetting(member.id); setResetPin(''); }}
                    style={{
                      background: 'transparent', color: C.charcoal, border: `1px solid ${C.border}`,
                      borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    Reset PIN
                  </button>
                  <button
                    onClick={() => setRemoving(member)}
                    style={{
                      background: 'transparent', color: C.danger, border: `1px solid ${C.border}`,
                      borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.displayName ?? ''} from the door team?`}
        body="Their name disappears from the tablet's sign-in list and they can no longer check guests in. Arrivals they have already recorded keep their name — the record of who admitted whom is never rewritten."
        confirmLabel="Remove"
        danger
        onConfirm={() => deactivate(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
