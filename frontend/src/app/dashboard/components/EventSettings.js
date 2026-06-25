'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect } from 'react';
import PlacesAutocomplete from '../../components/PlacesAutocomplete';
import FontPicker from './FontPicker';
import { supabase } from '../../utils/supabaseClient';

const COLORS = {
  gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
};

function toLocalDatetimeString(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function toLocalDateString(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch { return ''; }
}

export default function EventSettings({ eventId, event, onEventUpdated }) {
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', event_end_date: '', location_name: '', location_address: '',
    location_lat: null, location_lng: null, location_place_id: '',
    rsvp_deadline: '', privacy_mode: 'public', access_password: '',
    dress_code: '', cover_image_url: '', primary_color: '#B8944F',
    background_music_url: '',
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    event_type: 'wedding',
    notification_email: true,
    notification_whatsapp: false,
    allow_guest_edits: false
  });
  const [templateData, setTemplateData] = useState({
    groom_name: '', bride_name: '', family_names: '', ceremony_time: '', reception_time: '',
    company_name: '', agenda: '', speakers: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [statusLoading, setStatusLoading] = useState('');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [musicUploading, setMusicUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleMusicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("File size exceeds 8MB. Please use a smaller file or paste an external URL.");
      return;
    }

    setMusicUploading(true);
    try {
      if (!supabase) {
        throw new Error("Supabase client is not initialized.");
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}.${fileExt}`;
      const filePath = `music/${fileName}`;

      const { data, error: uploadErr } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) {
        throw uploadErr;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('event-assets')
        .getPublicUrl(filePath);

      setForm(prev => ({ ...prev, background_music_url: publicUrl }));
      setSuccess(false);
    } catch (err) {
      console.error("Storage upload failed, falling back to base64 encoding:", err);
      // base64 inflates the payload by ~33%; the API server rejects bodies over 5MB.
      // Keep the embedded data URL safely under that limit, otherwise require an external URL.
      if (file.size > 3.5 * 1024 * 1024) {
        toast.error("Couldn't upload to storage, and this file is too large to embed directly (max ~3.5MB). Please use a smaller file or paste an external URL.");
        setMusicUploading(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm(prev => ({ ...prev, background_music_url: event.target.result }));
        setSuccess(false);
        setMusicUploading(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read the audio file. Please try again or paste an external URL.");
        setMusicUploading(false);
      };
      reader.readAsDataURL(file);
      return;
    }
    setMusicUploading(false);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size exceeds 8MB. Please use a smaller file or paste an external URL.');
      return;
    }
    setCoverUploading(true);
    try {
      if (!supabase) throw new Error('Supabase client is not initialized.');
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage
        .from('event-assets')
        .getPublicUrl(filePath);
      setForm(prev => ({ ...prev, cover_image_url: publicUrl }));
      setSuccess(false);
    } catch (err) {
      console.error('Cover image upload failed, falling back to base64:', err);
      if (file.size > 3.5 * 1024 * 1024) {
        toast.error("Couldn't upload to storage, and this file is too large to embed directly (max ~3.5MB). Please use a smaller file or paste an external URL.");
        setCoverUploading(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm(prev => ({ ...prev, cover_image_url: event.target.result }));
        setSuccess(false);
        setCoverUploading(false);
      };
      reader.onerror = () => {
        toast.error('Failed to read the image file. Please try again or paste an external URL.');
        setCoverUploading(false);
      };
      reader.readAsDataURL(file);
      return;
    }
    setCoverUploading(false);
  };

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title || '',
        description: event.description || '',
        event_date: toLocalDatetimeString(event.event_date || event.date),
        event_end_date: toLocalDatetimeString(event.event_end_date || event.end_date),
        location_name: event.location_name || event.venue_name || '',
        location_address: event.location_address || event.venue_address || '',
        location_lat: event.location_lat || null,
        location_lng: event.location_lng || null,
        location_place_id: event.location_place_id || '',
        rsvp_deadline: toLocalDateString(event.rsvp_deadline),
        privacy_mode: event.privacy_mode || 'public',
        access_password: event.access_password || '',
        dress_code: event.dress_code || '',
        cover_image_url: event.cover_image_url || '',
        primary_color: event.primary_color || '#B8944F',
        background_music_url: event.background_music_url || '',
        font_heading: event.custom_fonts?.heading || 'Playfair Display',
        font_body: event.custom_fonts?.body || 'Inter',
        event_type: event.event_type || 'wedding',
        notification_email: event.notification_preferences?.email !== false,
        notification_whatsapp: !!event.notification_preferences?.whatsapp,
        allow_guest_edits: !!event.allow_guest_edits
      });
      setTemplateData({
        groom_name: event.template_data?.groom_name || '',
        bride_name: event.template_data?.bride_name || '',
        family_names: event.template_data?.family_names || '',
        ceremony_time: event.template_data?.ceremony_time || '',
        reception_time: event.template_data?.reception_time || '',
        company_name: event.template_data?.company_name || '',
        agenda: event.template_data?.agenda || '',
        speakers: event.template_data?.speakers || ''
      });
    }
  }, [event]);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      const body = { ...form };
      // Convert all dates to ISO strings for consistent backend parsing
      if (body.event_date) body.event_date = new Date(body.event_date).toISOString();
      if (body.event_end_date) body.event_end_date = new Date(body.event_end_date).toISOString();
      if (body.rsvp_deadline) body.rsvp_deadline = new Date(body.rsvp_deadline).toISOString();
      if (body.privacy_mode !== 'password') delete body.access_password;

      // Pack custom fonts
      body.custom_fonts = {
        heading: body.font_heading,
        body: body.font_body
      };
      delete body.font_heading;
      delete body.font_body;

      // Pack template data
      body.template_data = {
        ...templateData
      };

      // Pack notification preferences
      body.notification_preferences = {
        email: body.notification_email,
        whatsapp: false // WhatsApp notifications not yet available
      };
      delete body.notification_email;
      delete body.notification_whatsapp;

      const res = await fetch(`${apiUrl}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save settings');
      setSuccess(true);
      onEventUpdated?.(data.event || data);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusLoading(newStatus);
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update status');
      onEventUpdated?.(data.event || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusLoading('');
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
  const fieldGroupStyle = { marginBottom: '16px' };
  const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };

  const currentStatus = event?.status || 'active';
  const statusColors = {
    active: '#22C55E', paused: '#F59E0B', completed: '#6B8EAE',
    draft: '#9CA3AF', pending_review: '#B8944F',
  };
  const statusLabels = {
    active: 'Active', paused: 'Paused', completed: 'Completed',
    draft: 'Draft', pending_review: 'Pending Review',
  };
  // Status controls only make sense for a live event; draft/pending_review are
  // pre-publish states handled by the payment + review flow.
  const statusActionable = ['active', 'paused', 'completed'].includes(currentStatus);
  const statusColor = statusColors[currentStatus] || statusColors.active;

  return (
    <div style={{ maxWidth: '720px' }}>

      {/* ═══ EVENT DETAILS ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Event Details
          </span>
        </h3>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Event Title</label>
          <input value={form.title} onChange={handleChange('title')} placeholder="My Event" style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Description</label>
          <textarea value={form.description} onChange={handleChange('description')} rows={3}
            placeholder="Tell guests about your event…" style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div style={rowStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Start Date &amp; Time</label>
            <input type="datetime-local" value={form.event_date} onChange={handleChange('event_date')} style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>End Date &amp; Time</label>
            <input type="datetime-local" value={form.event_end_date} onChange={handleChange('event_end_date')} style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Location Name</label>
            <input value={form.location_name} onChange={handleChange('location_name')} placeholder="Grand Ballroom" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Location Address</label>
            <PlacesAutocomplete
              value={form.location_address}
              onChange={(val) => { setForm(prev => ({ ...prev, location_address: val })); setSuccess(false); }}
              onPlaceSelect={(place) => {
                setForm(prev => ({
                  ...prev,
                  location_address: place.address,
                  location_name: place.name || prev.location_name,
                  location_lat: place.lat,
                  location_lng: place.lng,
                  location_place_id: place.placeId,
                }));
                setSuccess(false);
              }}
              placeholder="Search for a venue or address..."
            />
          </div>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Event Type / Template</label>
          <select value={form.event_type} onChange={handleChange('event_type')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="wedding">💍 Wedding</option>
            <option value="corporate">💼 Corporate Event</option>
            <option value="birthday">🎂 Birthday Party</option>
            <option value="engagement">💎 Engagement Party</option>
            <option value="gala">🍷 Gala / Dinner</option>
            <option value="custom">✨ Custom Event</option>
          </select>
        </div>

        {form.event_type === 'wedding' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Wedding Template Details</h4>
            <div style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Groom's Name</label>
                <input value={templateData.groom_name} onChange={(e) => setTemplateData(prev => ({ ...prev, groom_name: e.target.value }))} placeholder="Groom Name" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Bride's Name</label>
                <input value={templateData.bride_name} onChange={(e) => setTemplateData(prev => ({ ...prev, bride_name: e.target.value }))} placeholder="Bride Name" style={inputStyle} />
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Family Names / Hosts</label>
              <input value={templateData.family_names} onChange={(e) => setTemplateData(prev => ({ ...prev, family_names: e.target.value }))} placeholder="The Smith & Jones Families" style={inputStyle} />
            </div>
            <div style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Ceremony Details/Time</label>
                <input value={templateData.ceremony_time} onChange={(e) => setTemplateData(prev => ({ ...prev, ceremony_time: e.target.value }))} placeholder="e.g. 4:00 PM at St. Mary's Church" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Reception Details/Time</label>
                <input value={templateData.reception_time} onChange={(e) => setTemplateData(prev => ({ ...prev, reception_time: e.target.value }))} placeholder="e.g. 6:00 PM at Grand Ballroom" style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {form.event_type === 'corporate' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Corporate Template Details</h4>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Company Name / Host</label>
              <input value={templateData.company_name} onChange={(e) => setTemplateData(prev => ({ ...prev, company_name: e.target.value }))} placeholder="Acme Corporation" style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Speakers (separated by commas)</label>
              <input value={templateData.speakers} onChange={(e) => setTemplateData(prev => ({ ...prev, speakers: e.target.value }))} placeholder="John Doe (CEO), Jane Smith (VP)" style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Agenda / Timeline</label>
              <textarea value={templateData.agenda} onChange={(e) => setTemplateData(prev => ({ ...prev, agenda: e.target.value }))} placeholder="9:00 AM - Keynote&#10;10:30 AM - Panel Discussion" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
        )}
      </div>

      {/* ═══ RSVP SETTINGS ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            RSVP Settings
          </span>
        </h3>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>RSVP Deadline</label>
          <input type="date" value={form.rsvp_deadline} onChange={handleChange('rsvp_deadline')} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div style={rowStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Privacy Mode</label>
            <select value={form.privacy_mode} onChange={handleChange('privacy_mode')} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="public">🌐 Public</option>
              <option value="private">🔒 Private (Invite Only)</option>
              <option value="password">🔑 Password Protected</option>
            </select>
          </div>
          {form.privacy_mode === 'password' && (
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Access Password</label>
              <input value={form.access_password} onChange={handleChange('access_password')} type="text"
                placeholder="Enter password" style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══ APPEARANCE ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
            Appearance
          </span>
        </h3>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Dress Code</label>
          <input value={form.dress_code} onChange={handleChange('dress_code')} placeholder="Black Tie, Cocktail, Casual…" style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Cover Image</label>
          <input value={form.cover_image_url} onChange={handleChange('cover_image_url')} type="url"
            placeholder="https://example.com/image.jpg" style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <span style={{ flex: 1, borderTop: `1px dashed ${COLORS.border}` }} />
            <span style={{ fontSize: '11px', color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>or upload file</span>
            <span style={{ flex: 1, borderTop: `1px dashed ${COLORS.border}` }} />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.softBg; }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = COLORS.border;
              e.currentTarget.style.background = COLORS.softBg;
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith('image/')) {
                const dt = new DataTransfer();
                dt.items.add(file);
                const input = e.currentTarget.querySelector('input[type="file"]');
                if (input) { input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
              }
            }}
            style={{
              marginTop: '8px', padding: '16px', borderRadius: '12px',
              border: `2px dashed ${COLORS.border}`, background: COLORS.softBg,
              textAlign: 'center', transition: 'all 0.2s', cursor: 'pointer',
            }}
          >
            <input
              type="file" accept="image/*" onChange={handleCoverUpload}
              disabled={coverUploading}
              style={{ display: 'none' }} id="cover-file-upload"
            />
            <label htmlFor="cover-file-upload" style={{
              cursor: coverUploading ? 'wait' : 'pointer', display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: '8px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.stone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="m21 15-5-5L5 21"/>
              </svg>
              <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.stone }}>
                {coverUploading ? 'Uploading…' : 'Drop image here or click to browse'}
              </span>
              <span style={{ fontSize: '10px', color: '#A09A91' }}>JPG, PNG, WebP • Max 8MB</span>
            </label>
          </div>

          {form.cover_image_url && (
            <div style={{
              marginTop: '10px', borderRadius: '12px', overflow: 'hidden',
              border: `1px solid ${COLORS.border}`, height: '140px',
              background: COLORS.softBg, position: 'relative',
            }}>
              <img src={form.cover_image_url} alt="Cover preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 50%)',
              }} />
              <button type="button"
                onClick={() => { setForm(prev => ({ ...prev, cover_image_url: '' })); setSuccess(false); }}
                style={{
                  position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                  borderRadius: '50%', border: 'none', background: 'rgba(25,27,30,0.7)',
                  color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>
          )}
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Primary Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="color" value={form.primary_color} onChange={handleChange('primary_color')}
              style={{
                width: '40px', height: '40px', border: `1px solid ${COLORS.border}`, borderRadius: '8px',
                cursor: 'pointer', padding: '2px', background: COLORS.white,
              }}
            />
            <input value={form.primary_color} onChange={handleChange('primary_color')}
              style={{ ...inputStyle, width: '120px', fontFamily: 'monospace', fontSize: '13px' }}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px', background: form.primary_color,
              border: `1px solid ${COLORS.border}`,
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', marginBottom: '16px' }}>
          <FontPicker
            label="Heading Font"
            value={form.font_heading}
            onChange={(val) => { setForm(prev => ({ ...prev, font_heading: val })); setSuccess(false); }}
          />
          <FontPicker
            label="Body Font"
            value={form.font_body}
            onChange={(val) => { setForm(prev => ({ ...prev, font_body: val })); setSuccess(false); }}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Background Music</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              value={form.background_music_url || ''}
              onChange={(e) => { setForm(prev => ({ ...prev, background_music_url: e.target.value })); setSuccess(false); }}
              type="url"
              placeholder="Paste audio URL (https://example.com/music.mp3)"
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ flex: 1, borderTop: `1px dashed ${COLORS.border}` }} />
              <span style={{ fontSize: '11px', color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>or upload file</span>
              <span style={{ flex: 1, borderTop: `1px dashed ${COLORS.border}` }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="file"
                accept="audio/*"
                onChange={handleMusicUpload}
                disabled={musicUploading}
                style={{ display: 'none' }}
                id="music-file-upload"
              />
              <label
                htmlFor="music-file-upload"
                style={{
                  padding: '8px 16px',
                  backgroundColor: COLORS.softBg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: COLORS.stone,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s',
                  userSelect: 'none'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {musicUploading ? 'Uploading...' : 'Choose Audio File'}
              </label>
              
              {form.background_music_url && (
                <button
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, background_music_url: '' })); setSuccess(false); }}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#C45E5E',
                    fontWeight: 500
                  }}
                >
                  Remove Music
                </button>
              )}
            </div>

            {form.background_music_url && (
              <div style={{ marginTop: '4px' }}>
                <audio 
                  src={form.background_music_url} 
                  controls 
                  style={{ width: '100%', height: '36px', borderRadius: '8px' }} 
                />
              </div>
            )}
          </div>
          <span style={{ fontSize: '11px', color: COLORS.stone, display: 'block', marginTop: '6px' }}>
            Provide a direct audio file URL (.mp3 or .ogg) or upload an audio file to play ambient music on the public event page.
          </span>
        </div>
      </div>

      {/* ═══ NOTIFICATION PREFERENCES ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Notification Preferences
          </span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#191B1E', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={form.notification_email}
              onChange={(e) => { setForm(prev => ({ ...prev, notification_email: e.target.checked })); setSuccess(false); }}
              style={{ width: '16px', height: '16px', accentColor: COLORS.gold, cursor: 'pointer' }}
            />
            Receive email notification when a guest submits an RSVP
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#A8A29E', cursor: 'not-allowed', userSelect: 'none', opacity: 0.6 }}>
            <input
              type="checkbox"
              checked={false}
              disabled
              style={{ width: '16px', height: '16px', cursor: 'not-allowed' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Receive WhatsApp notification when a guest submits an RSVP
              <span style={{
                fontSize: '10px', fontWeight: 600, color: COLORS.gold, background: `${COLORS.gold}15`,
                border: `1px solid ${COLORS.gold}30`, borderRadius: '4px', padding: '2px 6px',
                letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: 1
              }}>
                Coming Soon
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ═══ GUEST RSVP OPTIONS ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Guest RSVP Options
          </span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#191B1E', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={form.allow_guest_edits}
              onChange={(e) => { setForm(prev => ({ ...prev, allow_guest_edits: e.target.checked })); setSuccess(false); }}
              style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: COLORS.gold, cursor: 'pointer' }}
            />
            <span>
              Allow guests to change their response after submitting
              <span style={{ display: 'block', color: '#77736A', fontSize: '12px', marginTop: '3px', fontWeight: 400, lineHeight: 1.5 }}>
                When on, a guest can reopen and update their RSVP from their invitation link until the RSVP deadline. When off, responses are locked and any change must go through you.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ═══ EVENT STATUS ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Event Status
          </span>
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            borderRadius: '20px', background: `${statusColor}18`,
            border: `1px solid ${statusColor}40`,
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
            <span style={{
              fontSize: '13px', fontWeight: 600, color: statusColor, fontFamily: 'var(--font-sans)',
            }}>{statusLabels[currentStatus] || currentStatus}</span>
          </div>
        </div>

        {!statusActionable ? (
          /* Draft / pending_review — status controls aren't applicable pre-publish. */
          <p style={{ fontSize: '13px', color: COLORS.stone, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
            {currentStatus === 'pending_review'
              ? 'Your event is awaiting review and will go live once approved. Pause, resume and complete controls become available once it’s active.'
              : 'Finish setup and complete payment to publish your event. Status controls become available once it’s live.'}
          </p>
        ) : (
          <>
            {/* Make the consequence explicit — pausing/completing takes the event offline. */}
            <p style={{ fontSize: '12px', color: COLORS.stone, lineHeight: 1.6, marginBottom: '14px', fontFamily: 'var(--font-sans)' }}>
              Pausing or completing your event takes it <strong>offline</strong> — guests can no longer view the invitation or RSVP until you resume it.
            </p>

            {confirmComplete ? (
              /* Inline confirmation for the consequential Complete action. */
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '13px', color: COLORS.charcoal, lineHeight: 1.6, margin: '0 0 14px', fontFamily: 'var(--font-sans)' }}>
                  Mark this event as <strong>completed</strong>? It will be taken offline and guests will no longer be able to RSVP. You can bring it back later by resuming it.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => { await handleStatusChange('completed'); setConfirmComplete(false); }}
                    disabled={!!statusLoading}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: '1px solid #6B8EAE',
                      background: '#6B8EAE', color: COLORS.white, fontSize: '12px', fontWeight: 600,
                      fontFamily: 'var(--font-sans)', cursor: statusLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {statusLoading === 'completed' ? 'Completing…' : 'Yes, complete event'}
                  </button>
                  <button
                    onClick={() => setConfirmComplete(false)}
                    disabled={!!statusLoading}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                      background: COLORS.white, color: COLORS.stone, fontSize: '12px', fontWeight: 600,
                      fontFamily: 'var(--font-sans)', cursor: statusLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {currentStatus !== 'paused' && (
                  <button onClick={() => handleStatusChange('paused')} disabled={!!statusLoading}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: '1px solid #F59E0B',
                      background: COLORS.white, color: '#F59E0B', fontSize: '12px', fontWeight: 600,
                      fontFamily: 'var(--font-sans)', cursor: statusLoading ? 'not-allowed' : 'pointer',
                      opacity: statusLoading && statusLoading !== 'paused' ? 0.5 : 1, transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!statusLoading) e.currentTarget.style.background = '#FFFBEB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
                  >
                    {statusLoading === 'paused' ? 'Pausing…' : '⏸ Pause Event'}
                  </button>
                )}
                {currentStatus === 'paused' && (
                  <button onClick={() => handleStatusChange('active')} disabled={!!statusLoading}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: '1px solid #22C55E',
                      background: COLORS.white, color: '#22C55E', fontSize: '12px', fontWeight: 600,
                      fontFamily: 'var(--font-sans)', cursor: statusLoading ? 'not-allowed' : 'pointer',
                      opacity: statusLoading && statusLoading !== 'active' ? 0.5 : 1, transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!statusLoading) e.currentTarget.style.background = '#F0FDF4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
                  >
                    {statusLoading === 'active' ? 'Resuming…' : '▶ Resume Event'}
                  </button>
                )}
                {currentStatus !== 'completed' && (
                  <button onClick={() => setConfirmComplete(true)} disabled={!!statusLoading}
                    style={{
                      padding: '8px 20px', borderRadius: '8px', border: '1px solid #6B8EAE',
                      background: COLORS.white, color: '#6B8EAE', fontSize: '12px', fontWeight: 600,
                      fontFamily: 'var(--font-sans)', cursor: statusLoading ? 'not-allowed' : 'pointer',
                      opacity: statusLoading ? 0.5 : 1, transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!statusLoading) e.currentTarget.style.background = '#EFF6FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
                  >
                    ✓ Complete Event
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ ERROR / SUCCESS ═══ */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#C45E5E', fontSize: '13px', fontFamily: 'var(--font-sans)', marginBottom: '16px',
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0',
          color: '#16A34A', fontSize: '13px', fontFamily: 'var(--font-sans)', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
          Settings saved successfully
        </div>
      )}

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
        {saving && (
          <span style={{
            width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: COLORS.white, borderRadius: '50%', display: 'inline-block',
            animation: 'spin 0.6s linear infinite',
          }} />
        )}
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
