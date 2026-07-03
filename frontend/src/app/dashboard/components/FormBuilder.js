'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useCallback } from 'react';
import { MEAL_FIELD_KEY, findMealField } from '../../utils/mealField';

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
  // 'party' (asked once, e.g. "will you need a hotel room?") vs 'guest' (asked
  // per companion, e.g. "T-shirt size"). The backend/RSVP wizard have fully
  // supported this distinction since the guest-side-tagging work, but this UI
  // never exposed a way to actually set it — every question silently defaulted
  // to 'party', so a per-guest question could never be asked of each companion.
  const [scope, setScope] = useState('party');
  const [editingId, setEditingId] = useState(null); // null = add mode; a field id = editing that field
  // True when the open form is the dedicated meal-options shortcut — locks the field
  // key to MEAL_FIELD_KEY so the guest RSVP wizard's findMealField() picks it up.
  const [isMealField, setIsMealField] = useState(false);

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

  const TYPES_WITH_OPTIONS = ['select', 'radio', 'multiselect'];

  // Auto-derive the field key from the label — but only while ADDING. The key is
  // immutable once a field exists (changing it would orphan saved guest answers).
  const handleLabelChange = (val) => {
    setLabel(val);
    if (editingId) return;
    const slug = val.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '_');
    setKey(slug);
  };

  const resetForm = () => {
    setLabel(''); setKey(''); setType('text'); setOptionsString(''); setIsRequired(false);
    setEditingId(null); setIsMealField(false); setScope('party'); setShowAddForm(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setLabel(''); setKey(''); setType('text'); setOptionsString(''); setIsRequired(false);
    setIsMealField(false);
    setScope('party');
    setShowAddForm(true);
  };

  // Shortcut for the special "what would the guest like to eat" field — pre-fills the
  // exact field key the guest RSVP wizard looks for, so the organizer never has to know
  // or type the magic string themselves.
  const startAddMeal = () => {
    setEditingId(null);
    setLabel('Meal Selection');
    setKey(MEAL_FIELD_KEY);
    setType('select');
    setOptionsString('');
    setIsRequired(true);
    setIsMealField(true);
    setShowAddForm(true);
  };

  // Open the form pre-filled with an existing field so the organizer can edit it.
  const startEdit = (f) => {
    setEditingId(f.id);
    setLabel(f.field_label || '');
    setKey(f.field_key || '');
    setType(f.field_type || 'text');
    setOptionsString(Array.isArray(f.options) ? f.options.join(', ') : '');
    setIsRequired(!!f.is_required);
    setIsMealField(!!findMealField([f]));
    setScope(f.scope === 'guest' ? 'guest' : 'party');
    setShowAddForm(true);
  };

  const handleSubmitField = async (e) => {
    e.preventDefault();
    if (!label.trim() || !key.trim() || !eventId) { toast.error('Label and Field Key are required.'); return; }
    let options = [];
    if (TYPES_WITH_OPTIONS.includes(type)) {
      options = optionsString.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length === 0) { toast.error('Please specify at least one choice for this field type.'); return; }
    }
    const isEdit = !!editingId;
    try {
      setLoading(true);
      const res = await fetch(
        isEdit ? `${apiUrl}/events/${eventId}/fields/${editingId}` : `${apiUrl}/events/${eventId}/fields`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          // The field key is immutable — only sent when creating.
          body: JSON.stringify(isEdit
            ? { fieldLabel: label, fieldType: type, options, isRequired, scope }
            : { fieldKey: key, fieldLabel: label, fieldType: type, options, isRequired, sortOrder: fields.length, isMealField, scope }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || (isEdit ? 'Failed to update field' : 'Failed to create field'));
      if (data.success) { resetForm(); loadFields(); toast.success(isEdit ? 'Question updated.' : 'Question added.'); }
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
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
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  if (loading && fields.length === 0) {
    // Skeleton that mirrors the real form-builder layout (header + field rows),
    // so the panel's shape is stable as content streams in — no spinner→content jump.
    const skel = (w, h = 14, r = 6) => ({
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #F0ECE3 25%, #F8F5EF 37%, #F0ECE3 63%)',
      backgroundSize: '200% 100%', animation: 'fbSkelShimmer 1.4s ease-in-out infinite',
    });
    return (
      <div aria-busy="true" aria-label="Loading form configuration" style={{ background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={skel('190px', 20)} />
          <div style={skel('128px', 34, 20)} />
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid #F0ECE3', borderRadius: '10px' }}>
            <div style={skel(`${150 - i * 18}px`, 12)} />
            <div style={skel('100%', 40, 8)} />
          </div>
        ))}
        <style>{`@keyframes fbSkelShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
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
          <div style={{ display: 'flex', gap: '8px' }}>
            {!findMealField(fields) && (
              <button onClick={startAddMeal} style={{ padding: '8px 16px', background: '#FFFFFF', color: '#B8944F', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: '1px solid rgba(184,148,79,0.35)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => e.target.style.background = 'rgba(184,148,79,0.08)'} onMouseLeave={e => e.target.style.background = '#FFFFFF'}>
                🍽 Add Meal Options
              </button>
            )}
            <button onClick={startAdd} style={{ padding: '8px 16px', background: '#B8944F', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              onMouseEnter={e => e.target.style.background = '#a6833f'} onMouseLeave={e => e.target.style.background = '#B8944F'}>
              + Add Custom Question
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '10px', color: '#C45E5E', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>{error}</div>
      )}

      {/* Add Field Form */}
      {showAddForm && (
        <form onSubmit={handleSubmitField} style={{ background: '#F8F4EC', padding: '24px', border: '1px solid #E8E2D6', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#191B1E', fontFamily: 'var(--font-sans)' }}>
            {isMealField ? '🍽 Meal Options' : (editingId ? 'Edit Custom Question' : 'New Custom Question')}
          </h4>
          {isMealField && (
            <p style={{ fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)', margin: 0 }}>
              Guests will see this as a dedicated meal picker on the RSVP page. Just list the dishes below.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{isMealField ? 'Question Label' : 'Question / Label (e.g. Dietary Notes)'}</label>
              <input type="text" value={label} onChange={e => handleLabelChange(e.target.value)} placeholder="e.g. Dietary Restrictions"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
            <div>
              <label style={labelStyle}>Field Key {editingId || isMealField ? '(cannot change)' : '(Unique identifier in DB)'}</label>
              <input type="text" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. dietary_restrictions" disabled={!!editingId || isMealField}
                style={{ ...inputStyle, fontFamily: 'monospace', ...((editingId || isMealField) ? { background: '#F0ECE3', color: '#A09A91', cursor: 'not-allowed' } : {}) }}
                onFocus={e => { if (!editingId && !isMealField) e.target.style.borderColor = '#B8944F'; }} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Response Type</label>
              <select value={type} onChange={e => setType(e.target.value)} disabled={isMealField} style={{ ...inputStyle, cursor: isMealField ? 'not-allowed' : 'pointer', ...(isMealField ? { background: '#F0ECE3', color: '#A09A91' } : {}) }}>
                <option value="text">Single Line Text</option>
                <option value="textarea">Paragraph Description</option>
                <option value="select">Multiple Choice (Dropdown)</option>
                <option value="multiselect">Multiple Choice (Checkboxes)</option>
                <option value="radio">Single Choice (Radio)</option>
                <option value="checkbox">Toggle Agreement (Checkbox)</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="url">Website / URL</option>
                <option value="date">Date</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#77736A', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ accentColor: '#B8944F' }} />
                Required field (Guest must answer to submit)
              </label>
            </div>
          </div>

          {/* Meal options already have their own dedicated per-companion picker
              (see the guest RSVP wizard) — scope only applies to generic
              custom questions. */}
          {!isMealField && (
            <div>
              <label style={labelStyle}>Who answers this?</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { value: 'party', label: 'Once per party', hint: 'e.g. "Will you need a hotel room?"' },
                  { value: 'guest', label: 'Once per guest', hint: 'e.g. "T-shirt size"' },
                ].map((opt) => (
                  <label key={opt.value} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 12px',
                    border: `1px solid ${scope === opt.value ? '#B8944F' : '#E8E2D6'}`,
                    background: scope === opt.value ? 'rgba(184,148,79,0.06)' : '#FFFFFF',
                    borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#191B1E' }}>
                      <input type="radio" name="field-scope" checked={scope === opt.value} onChange={() => setScope(opt.value)} style={{ accentColor: '#B8944F' }} />
                      {opt.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#A09A91', marginLeft: '20px' }}>{opt.hint}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {TYPES_WITH_OPTIONS.includes(type) && (
            <div>
              <label style={labelStyle}>{isMealField ? 'Meal Choices (Comma-separated)' : 'Choice Options (Comma-separated)'}</label>
              <input type="text" value={optionsString} onChange={e => setOptionsString(e.target.value)} placeholder="e.g. Prime Beef, Atlantic Salmon, Mushroom Risotto"
                style={inputStyle} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
              <span style={{ fontSize: '10px', color: '#A09A91', display: 'block', marginTop: '4px' }}>Define selections. Separate choices with commas.</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #E8E2D6' }}>
            <button type="button" onClick={resetForm} style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#77736A', fontFamily: 'var(--font-sans)' }}>Cancel</button>
            <button type="submit" style={{ padding: '8px 16px', background: '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{editingId ? 'Update Question' : 'Save Question'}</button>
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
                  {f.scope === 'guest' && !findMealField([f]) && (
                    <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.25)', padding: '2px 6px', borderRadius: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Per Guest</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: '#A09A91', fontWeight: 500, fontFamily: 'monospace' }}>
                  <span>key: {f.field_key}</span>
                  <span>•</span>
                  <span>type: {f.field_type}</span>
                  {f.options && f.options.length > 0 && (<><span>•</span><span>options: [{f.options.join(', ')}]</span></>)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => startEdit(f)} title="Edit field"
                  style={{ padding: '6px', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#B8944F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,148,79,0.16)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(184,148,79,0.08)'}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => handleDeleteField(f.id, f.field_label)} title="Delete field"
                  style={{ padding: '6px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '8px', cursor: 'pointer', color: '#C45E5E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,94,94,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(196,94,94,0.06)'}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
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
