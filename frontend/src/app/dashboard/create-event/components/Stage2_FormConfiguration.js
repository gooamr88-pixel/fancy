'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlacesAutocomplete from '../../../../app/components/PlacesAutocomplete';
import InlineFormBuilder from './InlineFormBuilder';

const C = {
  gold: '#B8944F', goldHover: '#a6833f',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  champagne: '#D7BE80', stone: '#77736A',
  border: '#E8E2D6', white: '#FFFFFF', softBg: '#FAFAF8',
  error: '#C45E5E', success: '#3B9B6D',
};

const DRESS_CODES = ['', 'Black Tie', 'Cocktail Attire', 'Semi-Formal', 'Business Casual', 'Smart Casual', 'Casual', 'Festive', 'Traditional'];

const PRIVACY_MODES = [
  { key: 'public', label: 'Public Link', icon: '🌐', desc: 'Anyone with the link can RSVP' },
  { key: 'private', label: 'Private', icon: '🔒', desc: 'Guests must be on your list' },
  { key: 'password', label: 'Passcode', icon: '🔐', desc: 'Requires a passcode to access' },
];

const iStyle = {
  width: '100%', boxSizing: 'border-box',
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '10px 14px',
  fontSize: 14, color: C.charcoal,
  outline: 'none', fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.25s, box-shadow 0.25s',
};
const lblStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.stone, textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 6,
  fontFamily: 'var(--font-sans)',
};
const onFocus = (e) => { e.target.style.borderColor = C.gold; e.target.style.boxShadow = '0 0 0 3px rgba(184,148,79,0.08)'; };
const onBlur = (e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; };

/* ═══ Accordion Section ═══ */
function Section({ title, icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: 'hidden',
      borderLeft: open ? `3px solid ${C.gold}` : `3px solid transparent`,
      transition: 'border-color 0.3s',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 10, padding: '18px 24px', background: 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 16,
          fontWeight: 600, color: C.charcoal, flex: 1,
        }}>{title}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={C.stone} strokeWidth="2" strokeLinecap="round"
          style={{
            transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 24px 24px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ Field wrapper ═══ */
function Field({ label: lbl, required, hint, children, style: wrapStyle }) {
  return (
    <div style={{ marginBottom: 16, ...wrapStyle }}>
      <label style={lblStyle}>
        {lbl}{required && <span style={{ color: C.error, marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 10, color: '#A09A91', display: 'block', marginTop: 4 }}>{hint}</span>}
    </div>
  );
}

export default function Stage2_FormConfiguration({
  templateType, templates,
  title, setTitle, slug, setSlug,
  slugStatus, suggestedSlug,
  description, setDescription,
  eventDate, setEventDate,
  eventEndDate, setEventEndDate,
  locationName, setLocationName,
  locationAddress, setLocationAddress,
  onPlaceSelect,
  templateData, setTemplateData,
  dressCode, setDressCode,
  rsvpDeadline, setRsvpDeadline,
  privacyMode, setPrivacyMode,
  accessPassword, setAccessPassword,
  coverImageUrl, setCoverImageUrl, onCoverImageUpload, coverImageUploading,
  backgroundMusicUrl, setBackgroundMusicUrl, onMusicUpload, musicUploading,
  galleryUrls = [], onGalleryUpload, galleryUploading, onAddGalleryUrl, onRemoveGalleryUrl,
  customFields, onFieldsChange,
  onNext, onBack,
}) {
  const tpl = templates.find(t => t.key === templateType) || templates[0];
  const td = (key) => templateData[key] || '';
  const setTd = (key) => (val) => setTemplateData(d => ({ ...d, [key]: val }));
  const [galleryInput, setGalleryInput] = useState('');

  return (
    <div style={{ padding: '40px 24px 120px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.15)',
          borderRadius: 20, padding: '5px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step 2 of 3
          </span>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 28,
          fontWeight: 600, color: C.charcoal, margin: 0,
        }}>Configure Your Event</h2>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 14,
          color: C.stone, margin: '8px 0 0',
        }}>
          {tpl.icon} Using <strong>{tpl.label}</strong> template • Fill in the details for your event
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ═══ Section A: Core Details ═══ */}
        <Section title="Core Event Details" icon="📅">
          <Field label="Event Title" required>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="My Beautiful Event" style={iStyle}
              onFocus={onFocus} onBlur={onBlur} />
          </Field>

          <Field label="Event URL" required hint={
            slugStatus === 'checking' ? '⏳ Checking availability...' :
            slugStatus === 'available' ? '✅ This URL is available!' :
            slugStatus === 'taken' ? `❌ Taken. Try: ${suggestedSlug}` : null
          }>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{
                background: C.ivory, border: `1px solid ${C.border}`,
                borderRight: 'none', borderRadius: '8px 0 0 8px',
                padding: '10px 12px', fontSize: 13,
                color: C.stone, fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
              }}>fancyrsvp.com/</span>
              <input type="text" value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-event"
                style={{ ...iStyle, borderRadius: '0 8px 8px 0', flex: 1 }}
                onFocus={onFocus} onBlur={onBlur} />
            </div>
            <p className="url-preview" style={{ fontSize: '12px', color: C.stone, marginTop: '8px', fontFamily: 'monospace' }}>
              Live Preview: <strong style={{ color: C.gold }}>fancyrsvp.com/{slug || 'your-event-name'}</strong>
            </p>
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Tell guests about your event…"
              style={{ ...iStyle, resize: 'vertical', minHeight: 80 }}
              onFocus={onFocus} onBlur={onBlur} />
          </Field>

          <div className="s2-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Start Date & Time" required>
              <input type="datetime-local" value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                style={iStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="End Date & Time">
              <input type="datetime-local" value={eventEndDate}
                onChange={e => setEventEndDate(e.target.value)}
                style={iStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
          </div>

          <div className="s2-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Venue Name">
              <input type="text" value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="Grand Ballroom"
                style={iStyle} onFocus={onFocus} onBlur={onBlur} />
            </Field>
            <Field label="Address">
              <PlacesAutocomplete
                value={locationAddress}
                onChange={setLocationAddress}
                onPlaceSelect={onPlaceSelect}
                placeholder="Search venue or address…"
                style={iStyle}
              />
            </Field>
          </div>
        </Section>

        {/* ═══ Section B: Template-Specific ═══ */}
        {templateType !== 'custom' && (
          <Section title={`${tpl.icon} ${tpl.label} Details`} icon="🎨">
            {templateType === 'wedding' && (
              <>
                <div className="s2-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Partner 1 Name">
                    <input type="text" value={td('partner1')} onChange={e => setTd('partner1')(e.target.value)}
                      placeholder="First partner name" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                  <Field label="Partner 2 Name">
                    <input type="text" value={td('partner2')} onChange={e => setTd('partner2')(e.target.value)}
                      placeholder="Second partner name" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                </div>
                <Field label="Our Love Story">
                  <textarea value={td('loveStory')} onChange={e => setTd('loveStory')(e.target.value)}
                    rows={3} placeholder="Share your beautiful story…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <div className="s2-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Ceremony Location" hint="Where the ceremony takes place">
                    <input type="text" value={td('ceremonyLocation')} onChange={e => setTd('ceremonyLocation')(e.target.value)}
                      style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                  <Field label="Reception Location" hint="Where the reception takes place">
                    <input type="text" value={td('receptionLocation')} onChange={e => setTd('receptionLocation')(e.target.value)}
                      style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                </div>
                <Field label="Gift Registry URL">
                  <input type="url" value={td('giftRegistry')} onChange={e => setTd('giftRegistry')(e.target.value)}
                    placeholder="https://registry.example.com" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Guest Accommodations">
                  <textarea value={td('accommodations')} onChange={e => setTd('accommodations')(e.target.value)}
                    rows={2} placeholder="Hotel blocks, parking info…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </>
            )}

            {templateType === 'engagement' && (
              <>
                <div className="s2-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Partner 1 Name">
                    <input type="text" value={td('partner1')} onChange={e => setTd('partner1')(e.target.value)}
                      style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                  <Field label="Partner 2 Name">
                    <input type="text" value={td('partner2')} onChange={e => setTd('partner2')(e.target.value)}
                      style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                </div>
                <Field label="The Proposal Story">
                  <textarea value={td('proposalStory')} onChange={e => setTd('proposalStory')(e.target.value)}
                    rows={3} placeholder="How did the magic happen…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Gift Registry URL">
                  <input type="url" value={td('giftRegistry')} onChange={e => setTd('giftRegistry')(e.target.value)}
                    placeholder="https://registry.example.com" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </>
            )}

            {templateType === 'corporate' && (
              <>
                <Field label="Company / Organization">
                  <input type="text" value={td('company')} onChange={e => setTd('company')(e.target.value)}
                    placeholder="Acme Corporation" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Event Itinerary / Agenda">
                  <textarea value={td('agenda')} onChange={e => setTd('agenda')(e.target.value)}
                    rows={4} placeholder="Outline the event schedule…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Keynote Speakers">
                  <textarea value={td('speakers')} onChange={e => setTd('speakers')(e.target.value)}
                    rows={2} placeholder="List keynote speakers…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Sponsors">
                  <textarea value={td('sponsors')} onChange={e => setTd('sponsors')(e.target.value)}
                    rows={2} placeholder="Event sponsors…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </>
            )}

            {templateType === 'birthday' && (
              <>
                <div className="s2-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Celebrant Name">
                    <input type="text" value={td('celebrant')} onChange={e => setTd('celebrant')(e.target.value)}
                      style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                  <Field label="Age Milestone">
                    <input type="text" value={td('age')} onChange={e => setTd('age')(e.target.value)}
                      placeholder="e.g. 30" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  </Field>
                </div>
                <Field label="Party Theme / Details">
                  <input type="text" value={td('partyTheme')} onChange={e => setTd('partyTheme')(e.target.value)}
                    placeholder="e.g. Masquerade Ball" style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </>
            )}

            {templateType === 'gala' && (
              <>
                <Field label="Guest(s) of Honor / Honoree">
                  <input type="text" value={td('honoree')} onChange={e => setTd('honoree')(e.target.value)}
                    style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Evening Program Schedule">
                  <textarea value={td('program')} onChange={e => setTd('program')(e.target.value)}
                    rows={3} placeholder="Detail the evening's program…"
                    style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
                <Field label="Corporate Sponsor Packages">
                  <textarea value={td('sponsorPackages')} onChange={e => setTd('sponsorPackages')(e.target.value)}
                    rows={2} style={{ ...iStyle, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </>
            )}
          </Section>
        )}

        {/* ═══ Section C: Settings ═══ */}
        <Section title="Event Settings" icon="⚙️">
          {/* Dress Code Pills */}
          <Field label="Dress Code">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DRESS_CODES.map(dc => (
                <button key={dc || '__none'} onClick={() => setDressCode(dc)}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    border: dressCode === dc ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`,
                    background: dressCode === dc ? C.gold : C.white,
                    color: dressCode === dc ? C.white : C.stone,
                    transition: 'all 0.2s ease',
                  }}
                >{dc || 'No Dress Code'}</button>
              ))}
            </div>
          </Field>

          <Field label="RSVP Response Deadline" hint="Guests cannot RSVP after this date">
            <input type="datetime-local" value={rsvpDeadline}
              onChange={e => setRsvpDeadline(e.target.value)}
              style={iStyle} onFocus={onFocus} onBlur={onBlur} />
          </Field>

          {/* Privacy Mode Cards */}
          <Field label="Invitation Privacy">
            <div className="s2-privacy" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {PRIVACY_MODES.map(pm => (
                <div key={pm.key} onClick={() => setPrivacyMode(pm.key)}
                  style={{
                    padding: '16px 14px', borderRadius: 12,
                    border: privacyMode === pm.key ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                    background: privacyMode === pm.key ? 'rgba(184,148,79,0.04)' : C.white,
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                    transform: privacyMode === pm.key ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{pm.icon}</div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    fontWeight: 700, color: C.charcoal,
                  }}>{pm.label}</div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 10,
                    color: C.stone, marginTop: 4,
                  }}>{pm.desc}</div>
                </div>
              ))}
            </div>
          </Field>

          {/* Password input */}
          <AnimatePresence>
            {privacyMode === 'password' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <Field label="Access Passcode">
                  <input type="text" value={accessPassword}
                    onChange={e => setAccessPassword(e.target.value)}
                    placeholder="Enter access passcode"
                    style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

          <Field label="Cover Image">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="url" value={coverImageUrl}
                onChange={e => setCoverImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                style={{ ...iStyle, flex: 1 }} onFocus={onFocus} onBlur={onBlur} />
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: coverImageUploading ? 'wait' : 'pointer',
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.gold}`, color: C.gold,
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                opacity: coverImageUploading ? 0.6 : 1,
              }}>
                {coverImageUploading ? 'Uploading…' : '⬆ Upload'}
                <input type="file" accept="image/*" onChange={onCoverImageUpload} disabled={coverImageUploading} style={{ display: 'none' }} />
              </label>
            </div>
            {/* Drag-and-drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.softBg; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = C.softBg;
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  const dt = new DataTransfer(); dt.items.add(file);
                  const inp = document.createElement('input'); inp.type = 'file';
                  inp.files = dt.files;
                  onCoverImageUpload?.({ target: inp });
                }
              }}
              style={{
                marginTop: 10, padding: '18px 16px', borderRadius: 12,
                border: `2px dashed ${C.border}`, background: C.softBg,
                textAlign: 'center', transition: 'all 0.25s', cursor: 'pointer',
              }}
              onClick={() => {
                const fi = document.createElement('input');
                fi.type = 'file'; fi.accept = 'image/*';
                fi.onchange = (ev) => onCoverImageUpload?.(ev);
                fi.click();
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                  {coverImageUploading ? 'Uploading…' : 'Drop image here or click to browse'}
                </span>
                <span style={{ fontSize: 10, color: '#A09A91', fontFamily: 'var(--font-sans)' }}>JPG, PNG, WebP • Max 8MB</span>
              </div>
            </div>
            {/* Preview */}
            {coverImageUrl && (
              <div style={{
                borderRadius: 12, overflow: 'hidden',
                border: `1px solid ${C.border}`, height: 140,
                background: C.softBg, marginTop: 10,
                position: 'relative',
              }}>
                <img src={coverImageUrl} alt="Cover preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 50%)',
                }} />
                <button type="button" onClick={() => setCoverImageUrl('')}
                  style={{
                    position: 'absolute', top: 6, right: 6, width: 26, height: 26,
                    borderRadius: '50%', border: 'none', background: 'rgba(25,27,30,0.75)',
                    color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>×</button>
              </div>
            )}
          </Field>

          <Field label="Background Music (optional)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="url" value={backgroundMusicUrl || ''}
                onChange={e => setBackgroundMusicUrl(e.target.value)}
                placeholder="https://example.com/song.mp3"
                style={{ ...iStyle, flex: '1 1 240px' }} onFocus={onFocus} onBlur={onBlur} />
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: musicUploading ? 'wait' : 'pointer',
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.gold}`, color: C.gold,
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                opacity: musicUploading ? 0.6 : 1,
              }}>
                {musicUploading ? 'Uploading…' : '⬆ Upload'}
                <input type="file" accept="audio/*" onChange={onMusicUpload} disabled={musicUploading} style={{ display: 'none' }} />
              </label>
            </div>
            {/* Drag-and-drop zone for music */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.softBg; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = C.softBg;
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('audio/')) {
                  const dt = new DataTransfer(); dt.items.add(file);
                  const inp = document.createElement('input'); inp.type = 'file';
                  inp.files = dt.files;
                  onMusicUpload?.({ target: inp });
                }
              }}
              style={{
                marginTop: 10, padding: '14px 16px', borderRadius: 12,
                border: `2px dashed ${C.border}`, background: C.softBg,
                textAlign: 'center', transition: 'all 0.25s', cursor: 'pointer',
              }}
              onClick={() => {
                const fi = document.createElement('input');
                fi.type = 'file'; fi.accept = 'audio/*';
                fi.onchange = (ev) => onMusicUpload?.(ev);
                fi.click();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                  {musicUploading ? 'Uploading…' : 'Drop audio file here or click to browse'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#A09A91', fontFamily: 'var(--font-sans)', marginTop: 4, display: 'block' }}>MP3, OGG, WAV • Max 8MB</span>
            </div>
            {backgroundMusicUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <audio controls src={backgroundMusicUrl} style={{ flex: 1, height: 36 }} />
                <button type="button" onClick={() => setBackgroundMusicUrl('')}
                  style={{ padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: C.error, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Remove</button>
              </div>
            )}
          </Field>

          <Field label="Photo Gallery (optional)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="url" value={galleryInput}
                onChange={e => setGalleryInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddGalleryUrl?.(galleryInput); setGalleryInput(''); } }}
                placeholder="https://example.com/photo.jpg"
                style={{ ...iStyle, flex: '1 1 220px' }} onFocus={onFocus} onBlur={onBlur} />
              <button type="button" onClick={() => { onAddGalleryUrl?.(galleryInput); setGalleryInput(''); }}
                style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.gold}`, background: C.white, color: C.gold, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Add
              </button>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: galleryUploading ? 'wait' : 'pointer',
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.gold}`, color: C.gold,
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                opacity: galleryUploading ? 0.6 : 1,
              }}>
                {galleryUploading ? 'Uploading…' : '⬆ Upload'}
                <input type="file" accept="image/*" multiple onChange={onGalleryUpload} disabled={galleryUploading} style={{ display: 'none' }} />
              </label>
            </div>
            {/* Drag-and-drop zone for gallery */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(184,148,79,0.04)'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.softBg; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = C.softBg;
                const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
                if (files.length > 0) {
                  const dt = new DataTransfer();
                  files.forEach(f => dt.items.add(f));
                  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
                  inp.files = dt.files;
                  onGalleryUpload?.({ target: inp });
                }
              }}
              style={{
                marginTop: 10, padding: '18px 16px', borderRadius: 12,
                border: `2px dashed ${C.border}`, background: C.softBg,
                textAlign: 'center', transition: 'all 0.25s', cursor: 'pointer',
              }}
              onClick={() => {
                const fi = document.createElement('input');
                fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = true;
                fi.onchange = (ev) => onGalleryUpload?.(ev);
                fi.click();
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.stone, fontFamily: 'var(--font-sans)' }}>
                  {galleryUploading ? 'Uploading…' : 'Drop images here or click to browse'}
                </span>
                <span style={{ fontSize: 10, color: '#A09A91', fontFamily: 'var(--font-sans)' }}>Multiple images • JPG, PNG, WebP • Max 8MB each</span>
              </div>
            </div>
            {galleryUrls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                {galleryUrls.map((url, i) => (
                  <div key={i} style={{
                    position: 'relative', width: 84, height: 84, borderRadius: 10,
                    overflow: 'hidden', border: `1px solid ${C.border}`, background: C.softBg,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <img src={url} alt={`Gallery ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <button type="button" onClick={() => onRemoveGalleryUrl?.(i)} title="Remove"
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(25,27,30,0.75)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </Field>
        </Section>

        {/* ═══ Section D: Custom Questions ═══ */}
        <Section title="Custom RSVP Questions" icon="❓">
          <InlineFormBuilder fields={customFields} onFieldsChange={onFieldsChange} />
        </Section>
      </div>

      {/* ═══ NAVIGATION FOOTER ═══ */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.border}`,
        padding: '16px 24px', zIndex: 50,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', maxWidth: 860, width: '100%',
        }}>
          <button onClick={onBack} style={{
            height: 48, padding: '0 24px',
            background: 'none', border: `1.5px solid ${C.charcoal}`,
            borderRadius: 12, fontFamily: 'var(--font-sans)',
            fontSize: 14, fontWeight: 700, color: C.charcoal,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.charcoal; e.currentTarget.style.color = C.white; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.charcoal; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back
          </button>

          <button onClick={onNext}
            disabled={!title || !slug || !eventDate}
            style={{
              height: 48, padding: '0 32px',
              background: (!title || !slug || !eventDate) ? '#ccc' : 'linear-gradient(135deg, #B8944F, #a6833f)',
              color: C.white, border: 'none', borderRadius: 12,
              fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
              cursor: (!title || !slug || !eventDate) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: (!title || !slug || !eventDate) ? 'none' : '0 4px 16px rgba(184,148,79,0.3)',
              transition: 'all 0.3s',
            }}
          >
            Continue to Distribution
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .s2-row { grid-template-columns: 1fr !important; }
          .s2-privacy { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
