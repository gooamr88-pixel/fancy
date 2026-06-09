'use client';

import React, { useState, useEffect, useCallback } from 'react';

export default function FormBuilder({ eventId, token }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState('text');
  const [optionsString, setOptionsString] = useState(''); // Comma-separated
  const [isRequired, setIsRequired] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  // Load fields
  const loadFields = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${apiUrl}/events/${eventId}/fields`, { headers });
      const data = await res.json();
      if (data.success) {
        setFields(data.fields || []);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load fields:', err);
      setError('Could not connect to fields API.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, eventId, token]);

  useEffect(() => {
    setTimeout(() => {
      loadFields();
    }, 0);
  }, [loadFields]);

  // Handle auto-slugification for key
  const handleLabelChange = (val) => {
    setLabel(val);
    // Auto-generate key: camelCase or snake_case lowercase alphanumeric
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // remove special chars
      .replace(/[\s-]+/g, '_'); // replace spaces/hyphens with underscore
    setKey(slug);
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!label.trim() || !key.trim() || !eventId) {
      alert('Label and Field Key are required.');
      return;
    }

    // Parse options if select
    let options = [];
    if (type === 'select') {
      options = optionsString
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
      if (options.length === 0) {
        alert('Please specify at least one choice for multiple choice fields.');
        return;
      }
    }

    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/events/${eventId}/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          fieldKey: key,
          fieldLabel: label,
          fieldType: type,
          options,
          isRequired,
          sortOrder: fields.length
        })
      });

      if (!res.ok) throw new Error('Failed to create field');

      const data = await res.json();
      if (data.success) {
        setLabel('');
        setKey('');
        setType('text');
        setOptionsString('');
        setIsRequired(false);
        setShowAddForm(false);
        loadFields();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = async (fieldId, fieldLabel) => {
    if (!eventId) return;
    if (!confirm(`Are you sure you want to delete "${fieldLabel}"? Any guest answers matching this question will also be deleted.`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/events/${eventId}/fields/${fieldId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to delete field');

      const data = await res.json();
      if (data.success) {
        loadFields();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && fields.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs">Loading form configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      
      {/* ─── Header ─── */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100">RSVP Custom Questionnaire</h3>
          <p className="text-xs text-slate-400 mt-1">Configure additional questions guest party heads reply to when completing RSVPs.</p>
        </div>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg transition cursor-pointer text-white"
          >
            + Add Custom Question
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* ─── Add Field Form ─── */}
      {showAddForm && (
        <form onSubmit={handleAddField} className="bg-slate-950 p-6 border border-slate-850 rounded-xl space-y-4">
          <h4 className="text-sm font-bold text-slate-200">New Custom Question</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Question / Label (e.g. Dietary Notes)</label>
              <input
                type="text"
                value={label}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="e.g. Dietary Restrictions"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Field Key (Unique identifier in DB)</label>
              <input
                type="text"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="e.g. dietary_restrictions"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Response Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="text">Single Line Text</option>
                <option value="textarea">Paragraph Description</option>
                <option value="select">Multiple Choice (Dropdown)</option>
                <option value="checkbox">Toggle Agreement (Checkbox)</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs text-slate-400 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={e => setIsRequired(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-900 text-amber-600 focus:ring-amber-500"
                />
                Required field (Guest must answer to submit)
              </label>
            </div>
          </div>

          {type === 'select' && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold block">Dropdown Options (Comma-separated)</label>
              <input
                type="text"
                value={optionsString}
                onChange={e => setOptionsString(e.target.value)}
                placeholder="e.g. Prime Beef, Atlantic Salmon, Mushroom Risotto"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-550 block leading-tight">Define selections. Separate choices with commas.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-900">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold rounded-lg transition cursor-pointer text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-bold rounded-lg transition cursor-pointer text-white"
            >
              Save Question
            </button>
          </div>
        </form>
      )}

      {/* ─── Field Rows List ─── */}
      <div className="space-y-3">
        {fields.length > 0 ? (
          fields.map(f => (
            <div key={f.id} className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl flex justify-between items-center hover:border-slate-800 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">{f.field_label}</span>
                  {f.is_required && (
                    <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                      Required
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-550 font-medium font-mono">
                  <span>key: {f.field_key}</span>
                  <span>•</span>
                  <span>type: {f.field_type}</span>
                  {f.options && f.options.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-slate-450">options: [{f.options.join(', ')}]</span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDeleteField(f.id, f.field_label)}
                className="p-1.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-500 hover:text-rose-400 border border-rose-950/30 rounded-lg transition cursor-pointer"
                title="Delete field"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-950/20 border border-slate-850/60 rounded-xl">
            <span className="text-2xl">📝</span>
            <p className="text-xs text-slate-500 mt-2">No custom questions configured yet. The RSVP form will default to standard guest responses.</p>
          </div>
        )}
      </div>

    </div>
  );
}
