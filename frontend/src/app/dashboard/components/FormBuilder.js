'use client';

import React, { useState, useEffect, useCallback } from 'react';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E8E2D6',
  borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#191B1E',
  outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.25s ease',
};
const labelStyle = {
  fontSize: '11px', color: '#77736A', fontWeight: 600, display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)',
};

export default function FormBuilder({ eventId }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState('text');
  const [optionsString, setOptionsString] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  const loadFields = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/events/${eventId}/fields`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setFields(data.fields || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load fields:', err);
      setError('Could not connect to fields API.');
    } finally { setLoading(false); }
  }, [apiUrl, eventId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleLabelChange = (val) => {
    setLabel(val);
    const slug = val.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '_');
    setKey(slug);
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!label.trim() || !key.trim() || !eventId) { alert('Label and Field Key are required.'); return; }
    let options = [];
    if (type === 'select') {
      options = optionsString.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length === 0) { alert('Please specify at least one choice for multiple choice fields.'); return; }
    }
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/events/${eventId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fieldKey: key, fieldLabel: label, fieldType: type, options, isRequired, sortOrder: fields.length })
      });
      if (!res.ok) throw new Error('Failed to create field');
      const data = await res.json();
      if (data.success) { setLabel(''); setKey(''); setType('text'); setOptionsString(''); setIsRequired(false); setShowAddForm(false); loadFields(); }
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleDeleteField = async (fieldId, fieldLabel) => {
    if (!eventId) return;
    if (!confirm(`Are you sure you want to delete "${fieldLabel}"? Any guest answers matching this question will also be deleted.`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/events/${eventId}/fields/${fieldId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete field');
      const data = await res.json();
      if (data.success) loadFields();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  if (loading && fields.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '12px', color: '#77736A', fontFamily: 'var(--font-sans)' }}>Loading form configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0ECE3', paddingBottom: '16px' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500, color: '#191B1E' }}>RSVP Custom Questionnaire</h3>
          <p style={{ fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)', marginTop: '4px' }}>Configure additional questions guest party heads reply to when completing RSVPs.</p>
        </div>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} style={{ padding: '8px 16px', background: '#B8944F', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            onMouseEnter={e => e.target.style.background = '#a6833f'} onMouseLeave={e => e.target.style.background = '#B8944F'}>
            + Add Custom Question
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '10px', color: '#C45E5E', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>{error}</div>
      )}

      {/* Add Field Form */}
      {showAddForm && (
        <form onSubmit={handleAddField} style={{ background: '#F8F4EC', padding: '24px', border: '1px solid #E8E2D6', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#191B1E', fontFamily: 'var(--font-sans)' }}>New Custom Question</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Question / Label (e.g. Dietary Notes)</label>
              <input type="text" value={label} onChange={e => handleLabelChange(e.target.value)} placeholder="e.g. Dietary Restrictions"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
            <div>
              <label style={labelStyle}>Field Key (Unique identifier in DB)</label>
              <input type="text" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. dietary_restrictions"
                style={{ ...inputStyle, fontFamily: 'monospace' }} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Response Type</label>
              <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="text">Single Line Text</option>
                <option value="textarea">Paragraph Description</option>
                <option value="select">Multiple Choice (Dropdown)</option>
                <option value="checkbox">Toggle Agreement (Checkbox)</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#77736A', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ accentColor: '#B8944F' }} />
                Required field (Guest must answer to submit)
              </label>
            </div>
          </div>

          {type === 'select' && (
            <div>
              <label style={labelStyle}>Dropdown Options (Comma-separated)</label>
              <input type="text" value={optionsString} onChange={e => setOptionsString(e.target.value)} placeholder="e.g. Prime Beef, Atlantic Salmon, Mushroom Risotto"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
              <span style={{ fontSize: '10px', color: '#A09A91', display: 'block', marginTop: '4px' }}>Define selections. Separate choices with commas.</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #E8E2D6' }}>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#77736A', fontFamily: 'var(--font-sans)' }}>Cancel</button>
            <button type="submit" style={{ padding: '8px 16px', background: '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Save Question</button>
          </div>
        </form>
      )}

      {/* Field Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {fields.length > 0 ? (
          fields.map(f => (
            <div key={f.id} style={{ background: '#FAFAF8', padding: '16px', border: '1px solid #F0ECE3', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,148,79,0.3)'} onMouseLeave={e => e.currentTarget.style.borderColor = '#F0ECE3'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#191B1E', fontFamily: 'var(--font-sans)' }}>{f.field_label}</span>
                  {f.is_required && (
                    <span style={{ fontSize: '9px', background: 'rgba(184,148,79,0.1)', color: '#B8944F', border: '1px solid rgba(184,148,79,0.25)', padding: '2px 6px', borderRadius: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Required</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: '#A09A91', fontWeight: 500, fontFamily: 'monospace' }}>
                  <span>key: {f.field_key}</span>
                  <span>•</span>
                  <span>type: {f.field_type}</span>
                  {f.options && f.options.length > 0 && (<><span>•</span><span>options: [{f.options.join(', ')}]</span></>)}
                </div>
              </div>
              <button onClick={() => handleDeleteField(f.id, f.field_label)} title="Delete field"
                style={{ padding: '6px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '8px', cursor: 'pointer', color: '#C45E5E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,94,94,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(196,94,94,0.06)'}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', background: '#F8F4EC', border: '1px solid #E8E2D6', borderRadius: '10px' }}>
            <span style={{ fontSize: '28px' }}>📝</span>
            <p style={{ fontSize: '12px', color: '#77736A', marginTop: '8px', fontFamily: 'var(--font-sans)' }}>No custom questions configured yet. The RSVP form will default to standard guest responses.</p>
          </div>
        )}
      </div>

      <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
