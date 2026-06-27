'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/apiClient';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

function formatMemberSince(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function OrganizerProfile({ events = [] }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/auth/profile');
      const p = res.profile || res;
      setProfile(p);
      setForm({ name: p.name || '', phone: p.phone || '' });
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name cannot be empty.'); return; }
    setSaving(true);
    try {
      const res = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() }),
      });
      const p = res.profile || res;
      setProfile(prev => ({ ...prev, ...p }));
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const sectionStyle = {
    background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '12px',
    padding: '24px', marginBottom: '20px',
  };
  const sectionTitleStyle = {
    fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: COLORS.charcoal,
    margin: '0 0 20px', paddingBottom: '12px', borderBottom: `1px solid ${COLORS.border}`,
  };
  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: COLORS.stone,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontFamily: 'var(--font-sans)',
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
    fontSize: '14px', fontFamily: 'var(--font-sans)', color: COLORS.charcoal, background: COLORS.white,
    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  };
  const readOnlyStyle = { ...inputStyle, background: COLORS.softBg, color: COLORS.stone, cursor: 'not-allowed' };
  const fieldGroupStyle = { marginBottom: '16px' };
  const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
  const statLabelStyle = { fontSize: '11px', color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-sans)', marginBottom: '6px' };
  const statValueStyle = { fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 700, color: COLORS.charcoal };

  if (loading) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <div style={sectionStyle}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: '48px', background: COLORS.softBg, borderRadius: '8px', marginBottom: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: '#C45E5E', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>{error}</p>
        <button onClick={fetchProfile} style={{
          marginTop: '12px', padding: '8px 20px', background: COLORS.gold, color: COLORS.white,
          border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}>
          Retry
        </button>
      </div>
    );
  }

  const totalEvents = events.length;
  const liveEvents = events.filter(e => e && e.status !== 'draft').length;

  return (
    <div style={{ maxWidth: '720px' }}>

      {/* ═══ ACCOUNT OVERVIEW ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></svg>
            Account Overview
          </span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <div style={statLabelStyle}>Total Events</div>
            <div style={statValueStyle}>{totalEvents}</div>
          </div>
          <div>
            <div style={statLabelStyle}>Live Events</div>
            <div style={statValueStyle}>{liveEvents}</div>
          </div>
          <div>
            <div style={statLabelStyle}>Member Since</div>
            <div style={statValueStyle}>{formatMemberSince(profile?.created_at)}</div>
          </div>
        </div>
      </div>

      {/* ═══ PROFILE INFORMATION ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            Profile Information
          </span>
        </h3>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Organizer Name</label>
          <input value={form.name} onChange={handleChange('name')} placeholder="Your name or business name" style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div style={rowStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Email Address</label>
            <input value={profile?.email || ''} readOnly style={readOnlyStyle} />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Phone Number</label>
            <input value={form.phone} onChange={handleChange('phone')} placeholder="+1 234 567 8900" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
        </div>
      </div>

      {/* ═══ SAVE BUTTON ═══ */}
      <button onClick={handleSave} disabled={saving}
        style={{
          padding: '12px 32px', borderRadius: '10px', border: 'none',
          background: saving ? COLORS.champagne : COLORS.gold, color: COLORS.white,
          fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-sans)',
          cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center',
        }}
        onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = COLORS.goldHover; }}
        onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = COLORS.gold; }}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
