'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/apiClient';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  danger: '#C45E5E', dangerHover: '#a84c4c', success: '#4C9A6C'
};

function formatMemberSince(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getDeviceIcon(label = '') {
  const lowercase = label.toLowerCase();
  const isMobile = lowercase.includes('phone') || lowercase.includes('mobile') || lowercase.includes('android') || lowercase.includes('ios') || lowercase.includes('iphone');
  if (isMobile) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export default function OrganizerProfile({ events = [] }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    bio: '',
    website: '',
    logo_url: '',
    socialLinks: { instagram: '', twitter: '', linkedin: '' }
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/auth/profile');
      const p = res.profile || res;
      setProfile(p);
      setForm({
        name: p.name || '',
        phone: p.phone || '',
        bio: p.bio || '',
        website: p.website || '',
        logo_url: p.logo_url || '',
        socialLinks: p.social_links || { instagram: '', twitter: '', linkedin: '' }
      });
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await apiFetch('/auth/sessions');
      setSessions(res.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSessions();
  }, [fetchProfile, fetchSessions]);

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  
  const handleSocialChange = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [field]: val
      }
    }));
  };

  const handlePasswordChange = (field) => (e) => setPasswordForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name cannot be empty.'); return; }
    setSaving(true);
    try {
      const res = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          bio: form.bio.trim() || null,
          website: form.website.trim() || null,
          logo_url: form.logo_url.trim() || null,
          social_links: form.socialLinks
        }),
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) { toast.error('Current password is required.'); return; }
    if (passwordForm.newPassword.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match.'); return; }

    setChangingPassword(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      toast.success('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to log out this device?')) return;
    try {
      await apiFetch(`/auth/sessions/${sessionId}/revoke`, { method: 'POST' });
      toast.success('Device logged out successfully.');
      fetchSessions();
    } catch (err) {
      toast.error(err.message || 'Failed to log out device.');
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
  const textareaStyle = {
    ...inputStyle, minHeight: '80px', resize: 'vertical',
  };
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
    <div style={{ maxWidth: '720px', paddingBottom: '40px' }}>

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
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

      {/* ═══ ORGANIZER BRANDING ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            Organizer Branding
          </span>
        </h3>

        <div style={rowStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Logo / Avatar URL</label>
            <input value={form.logo_url} onChange={handleChange('logo_url')} placeholder="https://example.com/logo.png" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Brand Website</label>
            <input value={form.website} onChange={handleChange('website')} placeholder="https://yourbrand.com" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Organizer Bio</label>
          <textarea value={form.bio} onChange={handleChange('bio')} placeholder="Tell attendees about yourself, your company, and the types of events you host..." style={textareaStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>
      </div>

      {/* ═══ SOCIAL LINKS ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            Social Profiles
          </span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Instagram</label>
            <input value={form.socialLinks.instagram || ''} onChange={handleSocialChange('instagram')} placeholder="username" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Twitter / X</label>
            <input value={form.socialLinks.twitter || ''} onChange={handleSocialChange('twitter')} placeholder="username" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>LinkedIn</label>
            <input value={form.socialLinks.linkedin || ''} onChange={handleSocialChange('linkedin')} placeholder="company/name" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
        </div>
      </div>

      {/* ═══ SAVE BUTTON ═══ */}
      <div style={{ marginBottom: '32px' }}>
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
          {saving ? 'Saving…' : 'Save Profile Changes'}
        </button>
      </div>

      {/* ═══ SECURITY & PASSWORD ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Security & Password
          </span>
        </h3>
        <form onSubmit={handleChangePassword}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Current Password</label>
            <input type="password" value={passwordForm.currentPassword} onChange={handlePasswordChange('currentPassword')} placeholder="••••••••" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
          <div style={rowStyle}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>New Password</label>
              <input type="password" value={passwordForm.newPassword} onChange={handlePasswordChange('newPassword')} placeholder="••••••••" style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Confirm New Password</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={handlePasswordChange('confirmPassword')} placeholder="••••••••" style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>
          </div>
          <button type="submit" disabled={changingPassword}
            style={{
              marginTop: '8px', padding: '10px 24px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
              background: COLORS.white, color: COLORS.charcoal,
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: changingPassword ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
            onMouseEnter={(e) => { if (!changingPassword) { e.currentTarget.style.background = COLORS.softBg; e.currentTarget.style.borderColor = COLORS.gold; } }}
            onMouseLeave={(e) => { if (!changingPassword) { e.currentTarget.style.background = COLORS.white; e.currentTarget.style.borderColor = COLORS.border; } }}
          >
            {changingPassword ? 'Updating Password…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ═══ CONNECTED DEVICES & SESSIONS ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
            Connected Devices
          </span>
        </h3>
        <p style={{ fontSize: '12px', color: COLORS.stone, fontFamily: 'var(--font-sans)', marginTop: '-10px', marginBottom: '20px' }}>
          These devices are currently logged into your account. You can log out of individual sessions.
        </p>

        {loadingSessions && sessions.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: COLORS.stone, fontSize: '13px' }}>Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: COLORS.stone, fontSize: '13px' }}>No active sessions found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map((s) => {
              const active = s.isActive;
              // If session is revoked, skip rendering or display as inactive
              if (!active) return null;

              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                  background: s.isCurrent ? COLORS.softBg : COLORS.white,
                  fontFamily: 'var(--font-sans)', fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      background: COLORS.white, border: `1px solid ${COLORS.border}`,
                      borderRadius: '6px', width: '36px', height: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {getDeviceIcon(s.device_label)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: COLORS.charcoal, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {s.device_label || 'Unknown Device'}
                        {s.isCurrent && (
                          <span style={{
                            background: '#E6F4EA', color: COLORS.success, fontSize: '10px',
                            fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase'
                          }}>
                            This Device
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: COLORS.stone, marginTop: '2px' }}>
                        IP: {s.ip || 'Unknown'} • Active: {s.isCurrent ? 'Now' : formatRelativeTime(s.last_seen_at)}
                      </div>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => handleRevokeSession(s.id)}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', border: `1px solid ${COLORS.border}`,
                        background: COLORS.white, color: COLORS.danger, fontWeight: 600, fontSize: '11px',
                        cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.danger; e.currentTarget.style.background = '#FDF2F2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.white; }}
                    >
                      Log Out
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
