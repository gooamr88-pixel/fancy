'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useCallback } from 'react';
import { MEAL_FIELD_KEY, findMealField } from '../../utils/mealField';
import Icon from '../../components/icons/Icon';

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E8E2D6',
  borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#191B1E',
  outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.25s ease',
};
const labelStyle = {
  fontSize: '11px', color: '#77736A', fontWeight: 600, display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)',
};

// When the guest is asked this question. Mirrors the create-event InlineFormBuilder
// and the only values the backend + DB CHECK constraint accept ('always'|'attending').
const CONDITIONS = [
  { value: 'always', label: 'Always Show', color: '#3B9B6D', bg: 'rgba(59,155,109,0.08)' },
  { value: 'attending', label: 'If Attending', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
];

/**
 * How each answer type reads to somebody who is not a developer.
 *
 * The saved-question rows used to print the raw enum — `type: multiselect`,
 * `type: textarea` — in monospace beside a database key. These are the same values
 * said in the words an organizer would use to describe what they asked for.
 */
const ANSWER_TYPE_LABELS = {
  text: 'Short answer',
  textarea: 'Long answer',
  email: 'Email address',
  phone: 'Phone number',
  number: 'A number',
  select: 'Pick one',
  radio: 'Pick one',
  multiselect: 'Pick any',
  checkbox: 'Yes / no',
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
  // No longer editable — the "Who answers this?" picker is gone (see the note
  // where it used to render). Kept as state so an existing question's saved
  // value round-trips through an edit instead of being silently rewritten to
  // 'party'; new questions default to 'party', which is now what every question
  // effectively is.
  const [scope, setScope] = useState('party');
  // 'always' (asked on every response, e.g. a song request) vs 'attending' (only
  // when the guest is coming). Persisted since the "Always Show" migration; this
  // dashboard builder previously had no UI for it, so a question created/edited
  // here could never be set to 'always'.
  const [condition, setCondition] = useState('attending');
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

  useEffect(() => { (async () => { await loadFields(); })(); }, [loadFields]);

  const TYPES_WITH_OPTIONS = ['select', 'radio', 'multiselect'];

  // Auto-derive the field key from the label — but only while ADDING. The key is
  // immutable once a field exists (changing it would orphan saved guest answers).
  /**
   * Derive the storage key from the label — and never produce a collision.
   *
   * ── The bug this replaces ──
   *
   * The old slug was `label.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/[\s-]+/g,'_')`,
   * which keeps Latin letters and digits and throws everything else away. For an
   * ARABIC label that leaves nothing:
   *
   *     "ملاحظات غذائية"  ->  "_"
   *     "نوع الوجبة"      ->  "_"
   *     "🎂"              ->  ""
   *
   * So every Arabic question produced the SAME key, `_`. `rsvp_form_fields` has no
   * unique constraint on `field_key` (only a partial index for the single meal
   * field), so the second Arabic question saved happily alongside the first with an
   * identical key — and anything that reads a field BY key, exports included, can
   * no longer tell them apart. An emoji-only label produced an empty key and then
   * an error blaming a "Field Key" the organizer had never been shown.
   *
   * For the primary audience of this product, writing questions in Arabic, the
   * feature was broken from the second question onward.
   *
   * ── The fix ──
   *
   * Slug what transliterates; when nothing does, fall back to `question_<n>` chosen
   * against the keys already on this event so it is unique by construction. The key
   * is storage, not content — it never has to be readable, only distinct and stable.
   */
  const deriveKey = (val) => {
    const slug = String(val || '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/^_+|_+$/g, ''); // "Bus?" must not become "bus_" and "_" must not survive

    const taken = new Set(fields.map((f) => f.field_key).filter(Boolean));
    if (slug && !taken.has(slug)) return slug;
    if (slug) {
      // A genuine duplicate label ("Notes" twice) gets a suffix rather than
      // silently sharing a key with the first one.
      let n = 2;
      while (taken.has(`${slug}_${n}`)) n += 1;
      return `${slug}_${n}`;
    }
    // Nothing transliterated — Arabic, emoji, punctuation only.
    let n = 1;
    while (taken.has(`question_${n}`)) n += 1;
    return `question_${n}`;
  };

  const handleLabelChange = (val) => {
    setLabel(val);
    // The key is immutable once a field exists — changing it would orphan every
    // answer already saved against it.
    if (editingId) return;
    /**
     * The meal shortcut's key is a magic string, not a slug.
     *
     * The guest RSVP wizard finds the meal question by `field_key ===
     * 'meal_selection'` (utils/mealField), so typing the label must not slug over
     * it. This guard was not needed while the key had a visible input that was
     * `disabled` for the meal case — except it WAS: handleLabelChange overwrote the
     * state anyway and the disabled box simply displayed the wrong value. It never
     * surfaced because fieldController re-forces 'meal_selection' on the way in.
     * Now that the input is gone the mismatch would be completely invisible, so the
     * client is made to agree with the server rather than relying on it.
     */
    if (isMealField) return;
    setKey(deriveKey(val));
  };

  const resetForm = () => {
    setLabel(''); setKey(''); setType('text'); setOptionsString(''); setIsRequired(false);
    setEditingId(null); setIsMealField(false); setScope('party'); setCondition('attending'); setShowAddForm(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setLabel(''); setKey(''); setType('text'); setOptionsString(''); setIsRequired(false);
    setIsMealField(false);
    setScope('party');
    setCondition('attending');
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
    setCondition('attending');
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
    setCondition(f.condition === 'always' ? 'always' : 'attending');
    setShowAddForm(true);
  };

  const handleSubmitField = async (e) => {
    e.preventDefault();
    if (!eventId) return;
    // Only the LABEL is the organizer's to get right. The key is derived, so
    // blaming them for it — which the old message did — described a field they
    // could no longer even see.
    if (!label.trim()) { toast.error('Give your question a label first.'); return; }
    // Belt and braces: deriveKey never returns empty, but a key of '' would write a
    // field that nothing can look up, and silently.
    const fieldKey = key.trim() || deriveKey(label);
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
            ? { fieldLabel: label, fieldType: type, options, isRequired, scope, condition }
            // fieldKey, not key — the guarded value computed above.
            : { fieldKey, fieldLabel: label, fieldType: type, options, isRequired, sortOrder: fields.length, isMealField, scope, condition }),
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
          {/* "RSVP Custom Questionnaire" — three nouns, none of which an organizer
              would use. This is the list of extra things their RSVP form asks, and
              the sidebar now calls the section "RSVP form", so the two agree. */}
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500, color: '#191B1E' }}>What else you ask your guests</h3>
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

          {/**
            * "Field Key (Unique identifier in DB)" used to sit beside this input.
            *
            * It was already filled in automatically from the label, immutable once
            * the field existed, and described to the organizer as a database
            * identifier — so it was a developer-facing slug that a person planning a
            * wedding could only leave alone or break. Clearing it produced "Label
            * and Field Key are required", an error about something they never
            * knowingly filled in.
            *
            * It is storage, and it is now generated (see deriveKey). The organizer
            * writes the question; nothing asks them to name a column.
            */}
          <div>
            <label style={labelStyle}>{isMealField ? 'Question Label' : 'What do you want to ask your guests?'}</label>
            <input
              type="text"
              value={label}
              onChange={e => handleLabelChange(e.target.value)}
              placeholder="e.g. Any dietary requirements?"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#B8944F'}
              onBlur={e => e.target.style.borderColor = '#E8E2D6'}
            />
          </div>

          <div className="fb-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

          {/* The "Who answers this?" picker (Once per party / Once per guest)
              stood here. The RSVP form now asks the person who opened the
              invitation for everything and records the people they bring as
              names only, so there is no second person left to ask and the choice
              had no effect. `scope` is still stored and still sent below, so
              existing questions keep their saved value and nothing needs
              migrating — a question saved as 'guest' is simply asked once, of
              whoever is filling the form in. */}

          {/* Meal questions are inherently attending-only (you only pick a dish if
              you're coming), so the condition toggle only applies to generic questions. */}
          {!isMealField && (
            <div>
              <label style={labelStyle}>Show This Question</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {CONDITIONS.map(c => (
                  <button key={c.value} type="button" onClick={() => setCondition(c.value)}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s ease',
                      border: condition === c.value ? `1.5px solid ${c.color}` : '1px solid #E8E2D6',
                      background: condition === c.value ? c.bg : '#FFFFFF',
                      color: condition === c.value ? c.color : '#77736A',
                    }}>{c.label}</button>
                ))}
              </div>
              <span style={{ fontSize: '10px', color: '#A09A91', display: 'block', marginTop: '4px' }}>
                “Always Show” asks the question on every reply (even declines); “If Attending” only when the guest is coming.
              </span>
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
          // Wrap-safe row: a long label plus up to three badges and the
          // key/type/options meta line easily exceeds a phone's width. Without
          // flexWrap (and minWidth:0 so the text column may actually shrink) the
          // row overflowed and the root overflow guard clipped the edit/delete
          // buttons right off the card.
          fields.map(f => (
            <div key={f.id} style={{ background: '#FAFAF8', padding: '16px', border: '1px solid #F0ECE3', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,148,79,0.3)'} onMouseLeave={e => e.currentTarget.style.borderColor = '#F0ECE3'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#191B1E', fontFamily: 'var(--font-sans)' }}>{f.field_label}</span>
                  {f.is_required && (
                    <span style={{ fontSize: '9px', background: 'rgba(184,148,79,0.1)', color: '#B8944F', border: '1px solid rgba(184,148,79,0.25)', padding: '2px 6px', borderRadius: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Required</span>
                  )}
                  {f.condition === 'always' && !findMealField([f]) && (
                    <span style={{ fontSize: '9px', background: 'rgba(59,155,109,0.1)', color: '#3B9B6D', border: '1px solid rgba(59,155,109,0.25)', padding: '2px 6px', borderRadius: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Always</span>
                  )}
                </div>
                {/* `key: dietary_restrictions` used to lead this line in monospace.
                    It is a storage detail the organizer does not choose any more, so
                    showing it first told them nothing and made the row read like a
                    database dump. The answer TYPE and the choices are what they came
                    to check. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0, overflowWrap: 'anywhere', fontSize: '11px', color: '#A09A91', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  <span>{ANSWER_TYPE_LABELS[f.field_type] || f.field_type}</span>
                  {f.options && f.options.length > 0 && (<><span>•</span><span>{f.options.join(', ')}</span></>)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => startEdit(f)} title="Edit question" aria-label={`Edit the question: ${f.field_label}`}
                  style={{ padding: '6px', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#B8944F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,148,79,0.16)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(184,148,79,0.08)'}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => handleDeleteField(f.id, f.field_label)} title="Delete question" aria-label={`Delete the question: ${f.field_label}`}
                  style={{ padding: '6px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: '8px', cursor: 'pointer', color: '#C45E5E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,94,94,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(196,94,94,0.06)'}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', background: '#F8F4EC', border: '1px solid #E8E2D6', borderRadius: '10px' }}>
            <Icon name="pencil" size={26} color="#B8944F" strokeWidth={1.3} />
            <p style={{ fontSize: '12px', color: '#77736A', marginTop: '8px', fontFamily: 'var(--font-sans)' }}>No custom questions configured yet. The RSVP form will default to standard guest responses.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 639.98px) {
          .fb-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
