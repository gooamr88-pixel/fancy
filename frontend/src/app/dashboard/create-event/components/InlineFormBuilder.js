'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MEAL_FIELD_KEY, MEAL_FIELD_KEYS } from '../../../utils/mealField';
import { toast } from '../../../utils/toast';

const C = {
  gold: '#B8944F', goldHover: '#a6833f',
  charcoal: '#191B1E', ivory: '#F8F4EC',
  stone: '#77736A', border: '#E8E2D6',
  white: '#FFFFFF', error: '#C45E5E',
};

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'multiselect', label: 'Multi-Select (Checkboxes)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
];

const CONDITIONS = [
  { value: 'always', label: 'Always Show', color: '#3B9B6D', bg: 'rgba(59,155,109,0.08)' },
  { value: 'attending', label: 'If Attending', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  { value: 'declining', label: 'If Declining', color: '#E88F4F', bg: 'rgba(232,143,79,0.08)' },
];

const iStyle = {
  width: '100%', boxSizing: 'border-box',
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '10px 14px',
  fontSize: 13, color: C.charcoal,
  outline: 'none', fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.25s ease',
};

const lblStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.stone, textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 6,
  fontFamily: 'var(--font-sans)',
};

const onFocus = (e) => e.target.style.borderColor = C.gold;
const onBlur = (e) => e.target.style.borderColor = C.border;

export default function InlineFormBuilder({ fields, onFieldsChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState('text');
  const [optionsStr, setOptionsStr] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [condition, setCondition] = useState('always');
  // True when the open form is the dedicated meal-options shortcut — locks the field
  // key/type so the guest RSVP wizard's findMealField() picks it up automatically.
  const [isMealField, setIsMealField] = useState(false);
  const hasMealField = fields.some((f) => f.isMealField !== undefined
    ? !!f.isMealField
    : MEAL_FIELD_KEYS.includes((f.key || '').toLowerCase()) && ['select', 'radio'].includes(f.type));

  const autoKey = useCallback((val) => {
    return val.toLowerCase().trim()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }, []);

  const handleLabelChange = (val) => {
    setLabel(val);
    setKey(autoKey(val));
  };

  const resetForm = () => {
    setLabel(''); setKey(''); setType('text');
    setOptionsStr(''); setIsRequired(false);
    setCondition('always'); setShowForm(false);
    setEditingId(null); setIsMealField(false);
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    setLabel(f.label || '');
    setKey(f.key || '');
    setType(f.type || 'text');
    setOptionsStr(Array.isArray(f.options) ? f.options.join(', ') : '');
    setIsRequired(!!f.isRequired);
    setCondition(f.condition || 'always');
    // Trust the explicit flag carried on the field object (set by handleSave
    // below, or hydrated from the server's is_meal_field column) — only fall
    // back to the key/type guess for field objects that predate this flag
    // ever being attached.
    setIsMealField(f.isMealField !== undefined
      ? !!f.isMealField
      : MEAL_FIELD_KEYS.includes((f.key || '').toLowerCase()) && ['select', 'radio'].includes(f.type));
    setShowForm(true);
  };

  // Shortcut for the special "what would the guest like to eat" question — pre-fills
  // the exact field key the guest RSVP wizard looks for, so the organizer never has
  // to know or type the magic string themselves.
  const startAddMeal = () => {
    setEditingId(null);
    setLabel('Meal Selection');
    setKey(MEAL_FIELD_KEY);
    setType('select');
    setOptionsStr('');
    setIsRequired(true);
    setCondition('attending');
    setIsMealField(true);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!label.trim() || !key.trim()) {
      toast.error('Question label is required.');
      return;
    }
    let options = [];
    if (type === 'select' || type === 'radio' || type === 'multiselect') {
      options = optionsStr.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length === 0) {
        toast.error(isMealField ? 'Please list at least one meal choice.' : 'Please specify at least one option for this question.');
        return;
      }
    }
    if (editingId) {
      // Update existing field — key is immutable.
      const updated = fields.map(f => f.id === editingId
        ? { ...f, label: label.trim(), type, options, isRequired, condition, isMealField }
        : f
      );
      onFieldsChange(updated);
    } else {
      const newField = {
        id: crypto.randomUUID(),
        label: label.trim(),
        key: key.trim(),
        type, options, isRequired, condition, isMealField,
        sortOrder: fields.length,
      };
      onFieldsChange([...fields, newField]);
    }
    resetForm();
  };

  const handleDelete = (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    if (!confirm(`Are you sure you want to delete "${field?.label || 'this question'}"? Any guest answers matching this question will also be deleted.`)) return;
    onFieldsChange(fields.filter(f => f.id !== fieldId));
  };

  const condObj = (val) => CONDITIONS.find(c => c.value === val) || CONDITIONS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h4 style={{
            fontFamily: 'var(--font-serif)', fontSize: 16,
            fontWeight: 600, color: C.charcoal, margin: 0,
          }}>Custom RSVP Questions</h4>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 11,
            color: C.stone, margin: '4px 0 0',
          }}>Add questions guests must answer when RSVPing</p>
        </div>
        {!showForm && (
          <div style={{ display: 'flex', gap: 8 }}>
            {!hasMealField && (
              <button
                onClick={startAddMeal}
                style={{
                  padding: '8px 16px', background: C.white,
                  color: C.gold, fontSize: 12, fontWeight: 700,
                  borderRadius: 8, border: '1px solid rgba(184,148,79,0.35)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,148,79,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = C.white}
              >🍽 Add Meal Options</button>
            )}
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: '8px 16px', background: C.gold,
                color: C.white, fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.goldHover}
              onMouseLeave={e => e.currentTarget.style.background = C.gold}
            >+ Add Question</button>
          </div>
        )}
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: C.ivory, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <h4 style={{
                fontFamily: 'var(--font-sans)', fontSize: 14,
                fontWeight: 700, color: C.charcoal, margin: 0,
              }}>{isMealField ? '🍽 Meal Options' : (editingId ? 'Edit Custom Question' : 'New Custom Question')}</h4>
              {isMealField && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: C.stone, margin: 0 }}>
                  Guests will see this as a dedicated meal picker on the RSVP page. Just list the dishes below.
                </p>
              )}

              {/* Row 1: Label + Key */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={lblStyle}>Question Label</label>
                  <input type="text" value={label}
                    onChange={e => handleLabelChange(e.target.value)}
                    placeholder="e.g. Dietary Restrictions"
                    style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={lblStyle}>Field Key {(editingId || isMealField) ? '(cannot change)' : ''}</label>
                  <input type="text" value={key}
                    onChange={e => { if (!editingId && !isMealField) setKey(e.target.value); }}
                    placeholder="e.g. dietary_restrictions"
                    disabled={!!editingId || isMealField}
                    style={{ ...iStyle, fontFamily: 'monospace', ...((editingId || isMealField) ? { background: '#F0ECE3', color: '#A09A91', cursor: 'not-allowed' } : {}) }}
                    onFocus={e => { if (!editingId && !isMealField) onFocus(e); }} onBlur={onBlur} />
                </div>
              </div>

              {/* Row 2: Type + Required */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={lblStyle}>Response Type</label>
                  <select value={type} onChange={e => setType(e.target.value)}
                    disabled={isMealField}
                    style={{ ...iStyle, cursor: isMealField ? 'not-allowed' : 'pointer', ...(isMealField ? { background: '#F0ECE3', color: '#A09A91' } : {}) }}>
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: 22 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, color: C.stone, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                    <input type="checkbox" checked={isRequired}
                      onChange={e => setIsRequired(e.target.checked)}
                      style={{ accentColor: C.gold }} />
                    Required (guests must answer)
                  </label>
                </div>
              </div>

              {/* Row 3: Options (conditional) */}
              {(type === 'select' || type === 'radio' || type === 'multiselect') && (
                <div>
                  <label style={lblStyle}>{isMealField ? 'Meal Choices (comma-separated)' : 'Options (comma-separated)'}</label>
                  <input type="text" value={optionsStr}
                    onChange={e => setOptionsStr(e.target.value)}
                    placeholder="e.g. Beef, Salmon, Vegetarian"
                    style={iStyle} onFocus={onFocus} onBlur={onBlur} />
                  <span style={{
                    fontSize: 10, color: '#A09A91',
                    display: 'block', marginTop: 4,
                  }}>Separate choices with commas</span>
                </div>
              )}

              {/* Row 4: Condition */}
              <div>
                <label style={lblStyle}>Show This Question</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {CONDITIONS.map(c => (
                    <button key={c.value}
                      onClick={() => setCondition(c.value)}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        fontSize: 12, fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        border: condition === c.value
                          ? `1.5px solid ${c.color}` : `1px solid ${C.border}`,
                        background: condition === c.value ? c.bg : C.white,
                        color: condition === c.value ? c.color : C.stone,
                        transition: 'all 0.2s ease',
                      }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                paddingTop: 8, borderTop: `1px solid ${C.border}`,
              }}>
                <button onClick={resetForm} style={{
                  padding: '8px 16px', background: C.white,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  color: C.stone, fontFamily: 'var(--font-sans)',
                }}>Cancel</button>
                <button onClick={handleSave} style={{
                  padding: '8px 16px', background: C.gold,
                  color: C.white, border: 'none', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  opacity: (!label.trim() || !key.trim()) ? 0.5 : 1,
                }}>{editingId ? 'Update Question' : 'Save Question'}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Field Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence>
          {fields.map(f => {
            const cond = condObj(f.condition);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
                transition={{ duration: 0.25 }}
                style={{
                  background: C.white, padding: 16,
                  border: `1px solid ${C.border}`, borderRadius: 12,
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,148,79,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Label + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: C.charcoal, fontFamily: 'var(--font-sans)',
                    }}>{f.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      background: 'rgba(184,148,79,0.08)',
                      color: C.gold, borderRadius: 4,
                      padding: '2px 8px',
                    }}>{FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}</span>
                    {f.isRequired && (
                      <span style={{
                        fontSize: 9, fontWeight: 800,
                        background: C.gold, color: C.white,
                        borderRadius: 4, padding: '2px 6px',
                        textTransform: 'uppercase',
                      }}>Required</span>
                    )}
                  </div>
                  {/* Condition + Options */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      background: cond.bg, color: cond.color,
                      border: `1px solid ${cond.color}20`,
                      borderRadius: 4, padding: '2px 8px',
                    }}>{cond.label}</span>
                    {f.options && f.options.length > 0 && (
                      <span style={{
                        fontSize: 10, color: '#A09A91',
                        fontFamily: 'monospace',
                      }}>[{f.options.join(', ')}]</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => startEdit(f)}
                    title="Edit question"
                    style={{
                      padding: 6, background: 'rgba(184,148,79,0.08)',
                      border: '1px solid rgba(184,148,79,0.2)',
                      borderRadius: 8, cursor: 'pointer', color: C.gold,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,148,79,0.16)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(184,148,79,0.08)'}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    title="Delete question"
                    style={{
                      padding: 6, background: 'rgba(196,94,94,0.06)',
                      border: '1px solid rgba(196,94,94,0.15)',
                      borderRadius: 8, cursor: 'pointer', color: C.error,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,94,94,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(196,94,94,0.06)'}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {fields.length === 0 && !showForm && (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            background: C.ivory, border: `1px solid ${C.border}`,
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 28 }}>📝</span>
            <p style={{
              fontSize: 12, color: C.stone, marginTop: 8,
              fontFamily: 'var(--font-sans)',
            }}>No custom questions configured yet. The RSVP form will use standard fields only.</p>
          </div>
        )}
      </div>
    </div>
  );
}
