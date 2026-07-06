'use client';
import { toast } from '../../utils/toast';

import React, { useState } from 'react';
import PlacesAutocomplete from '../../components/PlacesAutocomplete';
import FontPicker from './FontPicker';
import { supabase } from '../../utils/supabaseClient';
import { DressCodeVisualizer } from '../../components/guest/GuestUI';
import { extractYouTubeId } from '../../utils/youtube';
import RepeatableListEditor from './RepeatableListEditor';

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

/* Image upload + preview, shared by the seal and invitation-background fields. */
function SealUpload({ url, onUpload, onClear, busy, previewFit = 'contain' }) {
  return (
    <>
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: busy ? 'wait' : 'pointer',
        padding: '8px 16px', borderRadius: 8, border: `1px solid ${COLORS.gold}`, color: COLORS.gold,
        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
        opacity: busy ? 0.6 : 1,
      }}>
        {busy ? 'Uploading…' : '⬆ Upload image'}
        <input type="file" accept="image/*" onChange={onUpload} disabled={busy} style={{ display: 'none' }} />
      </label>
      <span style={{ fontSize: 11, color: COLORS.stone, marginLeft: 10, fontFamily: 'var(--font-sans)' }}>PNG, JPG, WebP • Max 8MB</span>
      {url && (
        <div style={{
          borderRadius: 12, overflow: 'hidden', border: `1px solid ${COLORS.border}`,
          height: 140, background: COLORS.softBg, marginTop: 10, position: 'relative',
        }}>
          <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: previewFit }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <button type="button" onClick={onClear} aria-label="Remove image" style={{
            position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
            border: 'none', background: 'rgba(25,27,30,0.75)', color: '#fff', cursor: 'pointer',
            fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      )}
    </>
  );
}

export default function EventSettings({ eventId, event, onEventUpdated, onEventDeleted }) {
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', event_end_date: '', location_name: '', location_address: '',
    location_lat: null, location_lng: null, location_place_id: '',
    rsvp_deadline: '', privacy_mode: 'public', access_password: '',
    dress_code: '', cover_image_url: '', primary_color: '#B8944F',
    background_music_url: '', gallery_urls: [],
    font_heading: 'Playfair Display',
    font_body: 'Inter',
    event_type: 'wedding',
    notification_email: true,
    notification_whatsapp: false,
    allow_guest_edits: false,
    track_guest_side: false
  });
  // Key names mirror the create-event wizard's Stage2_FormConfiguration (the
  // canonical writer of these fields) so the digital card never has to guess
  // which naming scheme an event was created with.
  const [templateData, setTemplateData] = useState({
    partner1: '', partner2: '', partner1_email: '', partner2_email: '', family_names: '',
    ceremony_venue_name: '', ceremony_venue_address: '', ceremony_lat: null, ceremony_lng: null, ceremony_place_id: '', ceremony_time_of_day: '',
    reception_venue_name: '', reception_venue_address: '', reception_lat: null, reception_lng: null, reception_place_id: '', reception_time_of_day: '',
    company: '', agenda: '', speakers: '',
    proposalStory: '', giftRegistry: '',
    celebrant: '', age: '', partyTheme: '',
    honoree: '', program: '', sponsorPackages: '',
    seal_text: '', seal_image_url: '', invitation_bg_url: '',
    title_ar: '', description_ar: '', dress_code_ar: '',
    ha_schedule_day1: [], ha_schedule_day2: [],
    ha_venue_day1_image: '', ha_venue_day2_image: '',
    ha_accommodation: [], ha_faq: [], ha_meal_options: '', ha_invited_to_city: '', ha_our_story: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  // Display-only — whether a password is already set, so the (always-blank)
  // input can show "Password is set — leave blank to keep it" instead of
  // looking like no password exists at all.
  const [hasAccessPassword, setHasAccessPassword] = useState(false);
  const [statusLoading, setStatusLoading] = useState('');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [musicUploading, setMusicUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [sealUploading, setSealUploading] = useState(false);
  const [invitationBgUploading, setInvitationBgUploading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const handleMusicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("File size exceeds 8MB. Please use a smaller file.");
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
      // Keep the embedded data URL safely under that limit.
      if (file.size > 3.5 * 1024 * 1024) {
        toast.error("Couldn't upload to storage, and this file is too large to embed directly (max ~3.5MB). Please use a smaller file.");
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
        toast.error("Failed to read the audio file. Please try again.");
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
      toast.error('File size exceeds 8MB. Please use a smaller file.');
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
        toast.error("Couldn't upload to storage, and this file is too large to embed directly (max ~3.5MB). Please use a smaller file.");
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
        toast.error('Failed to read the image file. Please try again.');
        setCoverUploading(false);
      };
      reader.readAsDataURL(file);
      return;
    }
    setCoverUploading(false);
  };

  /* Shared upload path for the gallery/seal/background fields below — tries
     Supabase storage first, falls back to an embedded base64 data URL (capped
     at ~3.5MB) so a misconfigured bucket never silently loses the upload. */
  const uploadFile = async (file, folder) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size exceeds 8MB. Please use a smaller file.');
      return null;
    }
    try {
      if (!supabase) throw new Error('Supabase client is not initialized.');
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('event-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(filePath);
      return publicUrl;
    } catch (err) {
      console.error(`${folder} upload failed, falling back to base64:`, err);
      if (file.size > 3.5 * 1024 * 1024) {
        toast.error("Couldn't upload to storage, and this file is too large to embed directly (max ~3.5MB). Please use a smaller file.");
        return null;
      }
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = () => { toast.error('Failed to read the file. Please try again.'); resolve(null); };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setGalleryUploading(true);
    for (const file of files) {
      const url = await uploadFile(file, 'gallery');
      if (url) {
        setForm(prev => ({ ...prev, gallery_urls: [...prev.gallery_urls, url] }));
        setSuccess(false);
      }
    }
    setGalleryUploading(false);
  };

  const removeGalleryUrl = (index) => {
    setForm(prev => ({ ...prev, gallery_urls: prev.gallery_urls.filter((_, i) => i !== index) }));
    setSuccess(false);
  };

  const handleSealUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSealUploading(true);
    const url = await uploadFile(file, 'seal');
    if (url) { setTemplateData(prev => ({ ...prev, seal_image_url: url })); setSuccess(false); }
    setSealUploading(false);
  };

  const handleInvitationBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInvitationBgUploading(true);
    const url = await uploadFile(file, 'invitation-bg');
    if (url) { setTemplateData(prev => ({ ...prev, invitation_bg_url: url })); setSuccess(false); }
    setInvitationBgUploading(false);
  };

  // Prefill the form whenever the `event` prop is replaced (mirrors the
  // previous `useEffect(..., [event])` exactly — comparing the object
  // reference, same as React's dependency-array comparison, so this refires
  // on the SAME occasions the old effect did, including the resync that
  // happens after a save round-trips through onEventUpdated). Resetting
  // during render instead of in an effect avoids the setState-in-effect
  // cascading-render pattern.
  //
  // prevEvent starts at `null`, NOT `event` — this component unmounts/remounts
  // every time the Settings tab is opened (it's rendered behind a ternary in
  // page.js), so by the time it mounts, `event` is already the loaded object.
  // Seeding prevEvent with that same reference meant `event !== prevEvent` was
  // false on the very first render and the initial prefill never ran, leaving
  // every field at its hardcoded blank default until the next save round-trip.
  const [prevEvent, setPrevEvent] = useState(null);
  if (event !== prevEvent) {
    setPrevEvent(event);
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
        // The server no longer sends the stored password hash at all (see
        // withResolvedTier) — this always starts blank. Pre-filling it with the
        // raw hash used to mean every settings save re-submitted that hash as if
        // it were a new plaintext password, which the backend then re-hashed —
        // silently corrupting the real guest password on every unrelated save.
        access_password: '',
        dress_code: event.dress_code || '',
        cover_image_url: event.cover_image_url || '',
        primary_color: event.custom_colors?.primary || '#B8944F',
        background_music_url: event.background_music_url || '',
        gallery_urls: Array.isArray(event.gallery_urls) ? event.gallery_urls : [],
        font_heading: event.custom_fonts?.heading || 'Playfair Display',
        font_body: event.custom_fonts?.body || 'Inter',
        event_type: event.event_type || 'wedding',
        notification_email: event.notification_preferences?.email !== false,
        notification_whatsapp: !!event.notification_preferences?.whatsapp,
        allow_guest_edits: !!event.allow_guest_edits,
        track_guest_side: !!event.track_guest_side
      });
      setHasAccessPassword(!!event.has_access_password);
      setTemplateData({
        // Fall back to the legacy bride_name/groom_name/ceremony_time/reception_time
        // keys for events saved before this rename, so existing data still loads.
        partner1: event.template_data?.partner1 || event.template_data?.groom_name || '',
        partner2: event.template_data?.partner2 || event.template_data?.bride_name || '',
        partner1_email: event.template_data?.partner1_email || '',
        partner2_email: event.template_data?.partner2_email || '',
        family_names: event.template_data?.family_names || '',
        // No legacy fallback here (unlike the fields above) — the old
        // ceremonyLocation/ceremony_time fields stored one free-text string
        // mixing venue and time together, which can't be reliably split into
        // the new venue-search + time-picker fields. Leaving these blank for
        // events that predate this rename lets the organizer fill them in
        // explicitly; the public page still falls back to the legacy string
        // (see ceremonyReceptionLine in EventPageClient) until they do.
        ceremony_venue_name: event.template_data?.ceremony_venue_name || '',
        ceremony_venue_address: event.template_data?.ceremony_venue_address || '',
        ceremony_lat: event.template_data?.ceremony_lat || null,
        ceremony_lng: event.template_data?.ceremony_lng || null,
        ceremony_place_id: event.template_data?.ceremony_place_id || '',
        ceremony_time_of_day: event.template_data?.ceremony_time_of_day || '',
        reception_venue_name: event.template_data?.reception_venue_name || '',
        reception_venue_address: event.template_data?.reception_venue_address || '',
        reception_lat: event.template_data?.reception_lat || null,
        reception_lng: event.template_data?.reception_lng || null,
        reception_place_id: event.template_data?.reception_place_id || '',
        reception_time_of_day: event.template_data?.reception_time_of_day || '',
        company: event.template_data?.company || event.template_data?.company_name || '',
        agenda: event.template_data?.agenda || '',
        speakers: event.template_data?.speakers || '',
        proposalStory: event.template_data?.proposalStory || '',
        giftRegistry: event.template_data?.giftRegistry || '',
        celebrant: event.template_data?.celebrant || '',
        age: event.template_data?.age || '',
        partyTheme: event.template_data?.partyTheme || '',
        honoree: event.template_data?.honoree || '',
        program: event.template_data?.program || '',
        sponsorPackages: event.template_data?.sponsorPackages || '',
        seal_text: event.template_data?.seal_text || '',
        seal_image_url: event.template_data?.seal_image_url || '',
        invitation_bg_url: event.template_data?.invitation_bg_url || '',
        title_ar: event.template_data?.title_ar || '',
        description_ar: event.template_data?.description_ar || '',
        dress_code_ar: event.template_data?.dress_code_ar || '',
        // Heritage Arch template — full-page multi-day site content.
        ha_schedule_day1: Array.isArray(event.template_data?.ha_schedule_day1) ? event.template_data.ha_schedule_day1 : [],
        ha_schedule_day2: Array.isArray(event.template_data?.ha_schedule_day2) ? event.template_data.ha_schedule_day2 : [],
        ha_venue_day1_image: event.template_data?.ha_venue_day1_image || '',
        ha_venue_day2_image: event.template_data?.ha_venue_day2_image || '',
        ha_accommodation: Array.isArray(event.template_data?.ha_accommodation) ? event.template_data.ha_accommodation : [],
        ha_faq: Array.isArray(event.template_data?.ha_faq) ? event.template_data.ha_faq : [],
        ha_meal_options: event.template_data?.ha_meal_options || '',
        ha_invited_to_city: event.template_data?.ha_invited_to_city || '',
        ha_our_story: event.template_data?.ha_our_story || '',
      });
    }
  }

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setSuccess(false);
  };

  // Ceremony/reception venue pickers behave like the main Location Name field: a
  // plain-address prediction has no distinct `place.name` — falling back to the
  // raw search text there would leave the venue name stale, so fall back to the
  // address's first segment instead.
  const makeTemplatePlaceSelectHandler = (prefix) => (place) => {
    setTemplateData(prev => ({
      ...prev,
      [`${prefix}_venue_name`]: place.name && place.name !== place.address
        ? place.name
        : (place.address ? place.address.split(',')[0] : prev[`${prefix}_venue_name`]),
      [`${prefix}_venue_address`]: place.address,
      [`${prefix}_lat`]: place.lat,
      [`${prefix}_lng`]: place.lng,
      [`${prefix}_place_id`]: place.placeId,
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    // Validate date ordering up front — previously an event could be saved
    // with an end date before its start date, or an RSVP deadline after the
    // event itself, with no warning anywhere (client or server).
    if (form.event_end_date && form.event_date && new Date(form.event_end_date) < new Date(form.event_date)) {
      setError('The end date/time must be after the start date/time.');
      return;
    }
    if (form.rsvp_deadline && form.event_date && new Date(form.rsvp_deadline) > new Date(form.event_date)) {
      setError('The RSVP deadline must be on or before the event date.');
      return;
    }
    setSaving(true); setError(''); setSuccess(false);
    try {
      const body = { ...form };
      // Convert all dates to ISO strings for consistent backend parsing
      if (body.event_date) body.event_date = new Date(body.event_date).toISOString();
      if (body.event_end_date) body.event_end_date = new Date(body.event_end_date).toISOString();
      if (body.rsvp_deadline) body.rsvp_deadline = new Date(body.rsvp_deadline).toISOString();
      // access_password now always starts blank (the server never sends the
      // stored hash back — see withResolvedTier), so only include it when the
      // organizer actually typed a new one; otherwise omit it entirely so
      // updateEvent leaves the existing password untouched. Previously this
      // only checked privacy_mode, so a password-protected event resubmitted
      // whatever was pre-filled (the raw hash) on every unrelated save.
      if (body.privacy_mode !== 'password' || !body.access_password.trim()) delete body.access_password;

      // Pack custom fonts
      body.custom_fonts = {
        heading: body.font_heading,
        body: body.font_body
      };
      delete body.font_heading;
      delete body.font_body;

      // Pack the color picker's flat `primary_color` into the `custom_colors`
      // jsonb column the backend actually persists — the backend's field
      // whitelist has no bare `primary_color` field, so sending it as-is was
      // silently dropped and never saved.
      body.custom_colors = {
        ...event?.custom_colors,
        primary: body.primary_color,
      };
      delete body.primary_color;

      // Pack template data — merge onto the event's existing template_data so
      // fields this form doesn't surface (seal artwork, custom builder config,
      // love story, gift registry, etc.) survive instead of being wiped out.
      body.template_data = {
        ...event?.template_data,
        ...templateData,
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
    // Both this and handleSave render into the same success/error banners
    // below — without clearing them here, a stale "Settings saved
    // successfully" (or a stale error) from an earlier Save could keep
    // showing while a status change is in flight or just completed.
    setStatusLoading(newStatus);
    setError('');
    setSuccess(false);
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
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusLoading('');
    }
  };

  const handleDeleteEvent = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to delete event');
      onEventDeleted?.(eventId);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setDeleting(false);
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
  const hintStyle = { fontSize: '10px', color: COLORS.stone, display: 'block', marginTop: '4px' };

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
          <label style={labelStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🌐 Arabic Title <span style={{ fontSize: '11px', color: '#999', fontWeight: 400 }}>(optional — shown when guest switches to Arabic)</span>
            </span>
          </label>
          <input
            value={templateData.title_ar || ''}
            onChange={(e) => { setTemplateData(prev => ({ ...prev, title_ar: e.target.value })); setSuccess(false); }}
            placeholder="عنوان الفعالية بالعربي"
            dir="rtl"
            style={{ ...inputStyle, fontFamily: "'Noto Sans Arabic', 'Segoe UI', sans-serif" }}
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

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🌐 Arabic Description <span style={{ fontSize: '11px', color: '#999', fontWeight: 400 }}>(optional)</span>
            </span>
          </label>
          <textarea
            value={templateData.description_ar || ''}
            onChange={(e) => { setTemplateData(prev => ({ ...prev, description_ar: e.target.value })); setSuccess(false); }}
            placeholder="وصف الفعالية بالعربي"
            rows={3}
            dir="rtl"
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', fontFamily: "'Noto Sans Arabic', 'Segoe UI', sans-serif" }}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div className="es-row" style={rowStyle}>
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

        <div className="es-row" style={rowStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle} htmlFor="es-location-name">Location Name</label>
            <PlacesAutocomplete
              id="es-location-name"
              value={form.location_name}
              onChange={(val) => { setForm(prev => ({ ...prev, location_name: val })); setSuccess(false); }}
              onPlaceSelect={(place) => {
                setForm(prev => ({
                  ...prev,
                  // Plain-address predictions have no distinct `place.name` (empty,
                  // or identical to the address) — falling back to the previous
                  // Venue value left it stale/blank while Address updated, making
                  // it look like the selection only filled in the address. Fall
                  // back to the address's first segment instead, same as create-event.
                  location_name: place.name && place.name !== place.address
                    ? place.name
                    : (place.address ? place.address.split(',')[0] : prev.location_name),
                  location_address: place.address,
                  location_lat: place.lat,
                  location_lng: place.lng,
                  location_place_id: place.placeId,
                }));
                setSuccess(false);
              }}
              placeholder="Search for a venue..."
            />
            <span style={hintStyle}>Type a name or address and pick a suggestion — or if Google can&apos;t find your venue, just type the name in and enter the address manually on the right</span>
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Location Address</label>
            <input value={form.location_address} onChange={handleChange('location_address')} placeholder="Grand Ballroom, 123 Main St" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
              onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
            />
            <span style={hintStyle}>Auto-filled from the selected venue — or type it in yourself, it&apos;s always editable</span>
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
            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Groom&apos;s Name</label>
                <input value={templateData.partner1} onChange={(e) => setTemplateData(prev => ({ ...prev, partner1: e.target.value }))} placeholder="Groom Name" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Bride&apos;s Name</label>
                <input value={templateData.partner2} onChange={(e) => setTemplateData(prev => ({ ...prev, partner2: e.target.value }))} placeholder="Bride Name" style={inputStyle} />
              </div>
            </div>
            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Groom&apos;s Email</label>
                <input type="email" value={templateData.partner1_email} onChange={(e) => setTemplateData(prev => ({ ...prev, partner1_email: e.target.value }))} placeholder="groom@email.com" style={inputStyle} />
                <span style={hintStyle}>Optional — if set, they&apos;ll also get an email whenever a guest RSVPs</span>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Bride&apos;s Email</label>
                <input type="email" value={templateData.partner2_email} onChange={(e) => setTemplateData(prev => ({ ...prev, partner2_email: e.target.value }))} placeholder="bride@email.com" style={inputStyle} />
                <span style={hintStyle}>Optional — if set, they&apos;ll also get an email whenever a guest RSVPs</span>
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Family Names / Hosts</label>
              <input value={templateData.family_names} onChange={(e) => setTemplateData(prev => ({ ...prev, family_names: e.target.value }))} placeholder="The Smith & Jones Families" style={inputStyle} />
            </div>
            <div className="es-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle} htmlFor="es-ceremony-venue">Ceremony Venue</label>
                <PlacesAutocomplete
                  id="es-ceremony-venue"
                  value={templateData.ceremony_venue_name}
                  onChange={(val) => setTemplateData(prev => ({ ...prev, ceremony_venue_name: val }))}
                  onPlaceSelect={makeTemplatePlaceSelectHandler('ceremony')}
                  placeholder="Search for the ceremony venue..."
                />
                <span style={hintStyle}>Search and pick where the ceremony takes place</span>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Ceremony Time</label>
                <input type="time" value={templateData.ceremony_time_of_day} onChange={(e) => setTemplateData(prev => ({ ...prev, ceremony_time_of_day: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div className="es-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle} htmlFor="es-reception-venue">Reception Venue</label>
                <PlacesAutocomplete
                  id="es-reception-venue"
                  value={templateData.reception_venue_name}
                  onChange={(val) => setTemplateData(prev => ({ ...prev, reception_venue_name: val }))}
                  onPlaceSelect={makeTemplatePlaceSelectHandler('reception')}
                  placeholder="Search for the reception venue..."
                />
                <span style={hintStyle}>Search and pick where the reception takes place</span>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Reception Time</label>
                <input type="time" value={templateData.reception_time_of_day} onChange={(e) => setTemplateData(prev => ({ ...prev, reception_time_of_day: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {event?.template_type === 'heritageArch' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Heritage Arch Template Details</h4>
            <span style={hintStyle}>Day 1&apos;s venue reuses the Ceremony venue above; Day 2&apos;s venue reuses the Reception venue above.</span>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Our Story</label>
              <textarea value={templateData.ha_our_story} onChange={(e) => setTemplateData(prev => ({ ...prev, ha_our_story: e.target.value }))} placeholder="Tell your story…" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Meal Options (comma-separated)</label>
                <input value={templateData.ha_meal_options} onChange={(e) => setTemplateData(prev => ({ ...prev, ha_meal_options: e.target.value }))} placeholder="Caviar, Fish" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>&quot;You&apos;re Invited To&quot; City</label>
                <input value={templateData.ha_invited_to_city} onChange={(e) => setTemplateData(prev => ({ ...prev, ha_invited_to_city: e.target.value }))} placeholder="Miami" style={inputStyle} />
              </div>
            </div>

            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Day 1 Venue Photo URL</label>
                <input value={templateData.ha_venue_day1_image} onChange={(e) => setTemplateData(prev => ({ ...prev, ha_venue_day1_image: e.target.value }))} placeholder="https://…" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Day 2 Venue Photo URL</label>
                <input value={templateData.ha_venue_day2_image} onChange={(e) => setTemplateData(prev => ({ ...prev, ha_venue_day2_image: e.target.value }))} placeholder="https://…" style={inputStyle} />
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Day 1 Schedule</label>
              <RepeatableListEditor
                items={templateData.ha_schedule_day1}
                onChange={(items) => setTemplateData(prev => ({ ...prev, ha_schedule_day1: items }))}
                addLabel="+ Add schedule item"
                emptyLabel="No Day 1 schedule items yet — falls back to a sample schedule on the guest page."
                columns={[
                  { key: 'time', label: 'Time', placeholder: '14:00' },
                  { key: 'label', label: 'Label', placeholder: 'Lunch' },
                  { key: 'icon', label: 'Icon', type: 'select', placeholder: 'Icon', options: [
                    { value: 'plate', label: '🍽️ Plate' }, { value: 'rings', label: '💍 Rings' },
                    { value: 'ornament', label: '🎊 Ornament' }, { value: 'watch', label: '⏰ Watch' }, { value: 'clock', label: '🕯️ Candle' },
                  ] },
                ]}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Day 2 Schedule</label>
              <RepeatableListEditor
                items={templateData.ha_schedule_day2}
                onChange={(items) => setTemplateData(prev => ({ ...prev, ha_schedule_day2: items }))}
                addLabel="+ Add schedule item"
                emptyLabel="No Day 2 schedule items yet — falls back to a sample schedule on the guest page."
                columns={[
                  { key: 'time', label: 'Time', placeholder: '20:00' },
                  { key: 'label', label: 'Label', placeholder: 'Wedding' },
                  { key: 'icon', label: 'Icon', type: 'select', placeholder: 'Icon', options: [
                    { value: 'plate', label: '🍽️ Plate' }, { value: 'rings', label: '💍 Rings' },
                    { value: 'ornament', label: '🎊 Ornament' }, { value: 'watch', label: '⏰ Watch' }, { value: 'clock', label: '🕯️ Candle' },
                  ] },
                ]}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Accommodation</label>
              <RepeatableListEditor
                items={templateData.ha_accommodation}
                onChange={(items) => setTemplateData(prev => ({ ...prev, ha_accommodation: items }))}
                addLabel="+ Add hotel"
                emptyLabel="No hotels yet — falls back to a sample hotel on the guest page."
                columns={[
                  { key: 'name', label: 'Hotel name', placeholder: 'Hotel Costa' },
                  { key: 'price', label: 'Price', placeholder: '$4,100' },
                  { key: 'imageUrl', label: 'Photo URL', placeholder: 'https://…' },
                  { key: 'link', label: 'Booking link', placeholder: 'https://…' },
                  { key: 'description', label: 'Note', type: 'textarea', placeholder: 'Book directly for a discount' },
                ]}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>FAQ</label>
              <RepeatableListEditor
                items={templateData.ha_faq}
                onChange={(items) => setTemplateData(prev => ({ ...prev, ha_faq: items }))}
                addLabel="+ Add question"
                emptyLabel="No FAQ items yet — falls back to sample questions on the guest page."
                columns={[
                  { key: 'question', label: 'Question', placeholder: 'Can I bring my children?' },
                  { key: 'answer', label: 'Answer', type: 'textarea', placeholder: 'Answer shown to guests…' },
                ]}
              />
            </div>
          </div>
        )}

        {form.event_type === 'corporate' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Corporate Template Details</h4>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Company Name / Host</label>
              <input value={templateData.company} onChange={(e) => setTemplateData(prev => ({ ...prev, company: e.target.value }))} placeholder="Acme Corporation" style={inputStyle} />
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

        {form.event_type === 'engagement' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Engagement Template Details</h4>
            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Partner 1 Name</label>
                <input value={templateData.partner1} onChange={(e) => setTemplateData(prev => ({ ...prev, partner1: e.target.value }))} placeholder="First partner name" style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Partner 2 Name</label>
                <input value={templateData.partner2} onChange={(e) => setTemplateData(prev => ({ ...prev, partner2: e.target.value }))} placeholder="Second partner name" style={inputStyle} />
              </div>
            </div>
            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Partner 1 Email</label>
                <input type="email" value={templateData.partner1_email} onChange={(e) => setTemplateData(prev => ({ ...prev, partner1_email: e.target.value }))} style={inputStyle} />
                <span style={hintStyle}>Optional — if set, they&apos;ll also get an email whenever a guest RSVPs</span>
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Partner 2 Email</label>
                <input type="email" value={templateData.partner2_email} onChange={(e) => setTemplateData(prev => ({ ...prev, partner2_email: e.target.value }))} style={inputStyle} />
                <span style={hintStyle}>Optional — if set, they&apos;ll also get an email whenever a guest RSVPs</span>
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>The Proposal Story</label>
              <textarea value={templateData.proposalStory} onChange={(e) => setTemplateData(prev => ({ ...prev, proposalStory: e.target.value }))} placeholder="How did the magic happen…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Gift Registry URL</label>
              <input type="url" value={templateData.giftRegistry} onChange={(e) => setTemplateData(prev => ({ ...prev, giftRegistry: e.target.value }))} placeholder="https://registry.example.com" style={inputStyle} />
            </div>
          </div>
        )}

        {form.event_type === 'birthday' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Birthday Template Details</h4>
            <div className="es-row" style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Celebrant Name</label>
                <input value={templateData.celebrant} onChange={(e) => setTemplateData(prev => ({ ...prev, celebrant: e.target.value }))} style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Age Milestone</label>
                <input value={templateData.age} onChange={(e) => setTemplateData(prev => ({ ...prev, age: e.target.value }))} placeholder="e.g. 30" style={inputStyle} />
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Party Theme / Details</label>
              <input value={templateData.partyTheme} onChange={(e) => setTemplateData(prev => ({ ...prev, partyTheme: e.target.value }))} placeholder="e.g. Masquerade Ball" style={inputStyle} />
            </div>
          </div>
        )}

        {form.event_type === 'gala' && (
          <div style={{ marginTop: '16px', padding: '16px', background: COLORS.softBg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: COLORS.charcoal }}>Gala Template Details</h4>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Guest(s) of Honor / Honoree</label>
              <input value={templateData.honoree} onChange={(e) => setTemplateData(prev => ({ ...prev, honoree: e.target.value }))} style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Evening Program Schedule</label>
              <textarea value={templateData.program} onChange={(e) => setTemplateData(prev => ({ ...prev, program: e.target.value }))} placeholder="Detail the evening's program…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Corporate Sponsor Packages</label>
              <textarea value={templateData.sponsorPackages} onChange={(e) => setTemplateData(prev => ({ ...prev, sponsorPackages: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
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

        <div className="es-row" style={rowStyle}>
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
                placeholder={hasAccessPassword ? 'Password is set — leave blank to keep it' : 'Enter password'}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
                onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
              />
              {!hasAccessPassword && !form.access_password.trim() && (
                <p style={{ fontSize: '11px', color: COLORS.stone, marginTop: '6px' }}>No password set yet — guests won&apos;t be able to access this event until you set one.</p>
              )}
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
          <label style={labelStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🌐 Arabic Dress Code <span style={{ fontSize: '11px', color: '#999', fontWeight: 400 }}>(optional)</span>
            </span>
          </label>
          <input
            value={templateData.dress_code_ar || ''}
            onChange={(e) => { setTemplateData(prev => ({ ...prev, dress_code_ar: e.target.value })); setSuccess(false); }}
            placeholder="ملابس رسمية، كاجوال..."
            dir="rtl"
            style={{ ...inputStyle, fontFamily: "'Noto Sans Arabic', 'Segoe UI', sans-serif" }}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        {form.dress_code && (
          <div style={{
            ...fieldGroupStyle,
            padding: '16px 20px 20px',
            borderRadius: 12,
            background: COLORS.softBg,
            border: `1px solid ${COLORS.border}`
          }}>
            <div style={{ fontSize: 11, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
              ✨ Guest Page Dress Code Preview
            </div>
            <DressCodeVisualizer dressCodeText={form.dress_code} isRTL={false} />
          </div>
        )}

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Cover Image</label>
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
          <label style={labelStyle}>Photo Gallery</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: galleryUploading ? 'wait' : 'pointer',
              padding: '10px 16px', borderRadius: '8px', border: `1px solid ${COLORS.gold}`, color: COLORS.gold,
              fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
              opacity: galleryUploading ? 0.6 : 1,
            }}>
              {galleryUploading ? 'Uploading…' : '⬆ Upload'}
              <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={galleryUploading} style={{ display: 'none' }} />
            </label>
          </div>
          {form.gallery_urls.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
              {form.gallery_urls.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 84, height: 84, borderRadius: '10px', overflow: 'hidden', border: `1px solid ${COLORS.border}`, background: COLORS.softBg }}>
                  <img src={url} alt={`Gallery ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }} />
                  <button type="button" onClick={() => removeGalleryUrl(i)} title="Remove"
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(25,27,30,0.75)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0' }}>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
              <span style={{ fontSize: '11px', color: COLORS.stone, fontWeight: 600 }}>or</span>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>
            <input
              type="url"
              value={form.background_music_url || ''}
              onChange={e => setForm(prev => ({ ...prev, background_music_url: e.target.value }))}
              placeholder="Paste a YouTube link (e.g. https://youtu.be/…)"
              style={inputStyle}
            />

            {form.background_music_url && (
              extractYouTubeId(form.background_music_url) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', padding: '8px 12px', borderRadius: '8px', background: COLORS.softBg, border: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: '16px' }}>▶️</span>
                  <span style={{ fontSize: '12px', color: COLORS.charcoal, flex: 1 }}>YouTube song linked — guests tap the music icon to play it</span>
                </div>
              ) : (
                <div style={{ marginTop: '4px' }}>
                  <audio
                    src={form.background_music_url}
                    controls
                    style={{ width: '100%', height: '36px', borderRadius: '8px' }}
                  />
                </div>
              )
            )}
          </div>
          <span style={{ fontSize: '11px', color: COLORS.stone, display: 'block', marginTop: '6px' }}>
            Upload an audio file, or paste a YouTube link, to play music on the public event page.
          </span>
        </div>
      </div>

      {/* ═══ INVITATION SEAL & STATIONERY ═══ */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>
            Invitation Seal &amp; Stationery
          </span>
        </h3>
        <p style={{ fontSize: '12.5px', color: COLORS.stone, lineHeight: 1.6, margin: '0 0 14px', fontFamily: 'var(--font-sans)' }}>
          These power the cinematic envelope guests unseal when they open the link. Leave blank to use the elegant auto-generated bronze seal and arabesque stationery.
        </p>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Seal Name / Monogram</label>
          <input value={templateData.seal_text} onChange={(e) => setTemplateData(prev => ({ ...prev, seal_text: e.target.value }))}
            placeholder="Auto from event name" maxLength={24} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = COLORS.gold; }}
            onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Custom Seal Artwork</label>
          <SealUpload url={templateData.seal_image_url} onUpload={handleSealUpload} onClear={() => setTemplateData(prev => ({ ...prev, seal_image_url: '' }))} busy={sealUploading} previewFit="contain" />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Invitation Background</label>
          <SealUpload url={templateData.invitation_bg_url} onUpload={handleInvitationBgUpload} onClear={() => setTemplateData(prev => ({ ...prev, invitation_bg_url: '' }))} busy={invitationBgUploading} previewFit="cover" />
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
          <span style={{ fontSize: '11px', color: COLORS.stone, marginLeft: '26px' }}>
            This also controls email alerts to the Groom/Bride emails above, if set.
          </span>

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

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#191B1E', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={form.track_guest_side}
              onChange={(e) => { setForm(prev => ({ ...prev, track_guest_side: e.target.checked })); setSuccess(false); }}
              style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: COLORS.gold, cursor: 'pointer' }}
            />
            <span>
              {form.event_type === 'wedding' ? "Tag guests as Groom's Side / Bride's Side" : "Tag guests as Partner 1's Side / Partner 2's Side"}
              <span style={{ display: 'block', color: '#77736A', fontSize: '12px', marginTop: '3px', fontWeight: 400, lineHeight: 1.5 }}>
                When on, you and your guests can mark which side of the celebration they belong to — shown on guest cards and in RSVP emails.
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

      {/* ═══ DANGER ZONE ═══ */}
      <div style={{ ...sectionStyle, border: '1px solid #FECACA' }}>
        <h3 style={{ ...sectionTitleStyle, color: '#C45E5E', borderBottomColor: '#FECACA' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C45E5E" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Danger Zone
          </span>
        </h3>

        {!deleteConfirmOpen ? (
          <>
            <p style={{ fontSize: '13px', color: COLORS.stone, lineHeight: 1.6, marginBottom: '14px', fontFamily: 'var(--font-sans)' }}>
              Permanently delete this event and all related data — guests, RSVPs, tables, and the activity log. <strong>This cannot be undone.</strong>
            </p>
            <button onClick={() => setDeleteConfirmOpen(true)}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: '1px solid #C45E5E',
                background: COLORS.white, color: '#C45E5E', fontSize: '12px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.white; }}
            >
              🗑 Delete Event
            </button>
          </>
        ) : (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px' }}>
            <p style={{ fontSize: '13px', color: COLORS.charcoal, lineHeight: 1.6, margin: '0 0 12px', fontFamily: 'var(--font-sans)' }}>
              This will permanently delete <strong>&ldquo;{event?.title}&rdquo;</strong> and all of its guests, RSVPs, and data. Type the event title below to confirm.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={event?.title || ''}
              style={{ ...inputStyle, marginBottom: '12px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleDeleteEvent}
                disabled={deleting || deleteConfirmText !== (event?.title || '')}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: '1px solid #C45E5E',
                  background: '#C45E5E', color: COLORS.white, fontSize: '12px', fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: (deleting || deleteConfirmText !== (event?.title || '')) ? 'not-allowed' : 'pointer',
                  opacity: (deleting || deleteConfirmText !== (event?.title || '')) ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {deleting ? 'Deleting…' : 'Permanently delete this event'}
              </button>
              <button
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(''); }}
                disabled={deleting}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                  background: COLORS.white, color: COLORS.stone, fontSize: '12px', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
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
        /* MOB-10: every 2-column row (dates/location/RSVP-privacy) and every
           event-type sub-form (wedding/corporate/engagement/birthday/gala)
           shares this one rowStyle object with no breakpoint at all — the
           largest, most-used settings surface in the dashboard was entirely
           desktop-fixed. Mirrors OrganizerProfile.js's existing breakpoint
           for the same 2-column-row pattern. */
        @media (max-width: 640px) {
          .es-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
