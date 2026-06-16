'use client';

import React, { useEffect, useState, useRef, Suspense, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { translations } from '../../utils/translations';
import SeatingMiniMap from './SeatingMiniMap';

/* ═══ Brand Inline Style Helpers ═══ */
const S = {
  inputBase: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '8px', fontSize: '14px', color: '#191B1E', outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.25s ease' },
  labelBase: { fontSize: '12px', fontWeight: 600, color: '#77736A', display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)' },
  goldBtn: (disabled) => ({ padding: '12px 28px', background: disabled ? '#D7BE80' : '#B8944F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: disabled ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: disabled ? 0.6 : 1, transition: 'all 0.3s ease' }),
  backBtn: { background: 'none', border: 'none', fontSize: '13px', color: '#77736A', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: '4px 0' },
};

function RSVPFormContent({ slug }) {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang') || 'en';
  
  const [lang, setLang] = useState(langParam);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [step, setStep] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [additionalGuests, setAdditionalGuests] = useState([]);
  const [primaryMeal, setPrimaryMeal] = useState('');
  const [customAnswers, setCustomAnswers] = useState({});
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [rsvpId, setRsvpId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [assignedTableName, setAssignedTableName] = useState(null);

  /* "Find my table" lookup (for guests who already RSVP'd) */
  const [tableQuery, setTableQuery] = useState('');
  const [tableResults, setTableResults] = useState([]);
  const [tableLookingUp, setTableLookingUp] = useState(false);
  const [tableLookupDone, setTableLookupDone] = useState(false);
  const [showTableLookup, setShowTableLookup] = useState(false);

  /* Personal seating map (table + own party, never other guests) */
  const [seatingView, setSeatingView] = useState(null); // { myTableName, party, tables }
  const [seatingLoading, setSeatingLoading] = useState(false);

  const guestIdParam = searchParams ? searchParams.get('g') : null;
  // Per-guest invitation token (unlocks private events + pre-fills this guest).
  const invitationRsvpId = searchParams ? searchParams.get('rsvp_id') : null;

  // When the form is pre-filled programmatically (from an invitation token), we must
  // NOT let the name-change reset below wipe the resolved rsvpId — otherwise the
  // submission would create a duplicate record instead of updating the invited guest.
  const skipNameResetRef = useRef(false);

  useEffect(() => {
    if (skipNameResetRef.current) { skipNameResetRef.current = false; return; }
    setSearchPerformed(false); setSearchResults([]); setRsvpId(null);
  }, [guestName]);

  const handleSearchName = async () => {
    if (!guestName.trim()) return;
    if (slug === 'demo-wedding' || slug === 'demo') {
      setSearching(true);
      setTimeout(() => {
        setSearching(false); setSearchPerformed(true);
        if (guestName.toLowerCase().includes('alice') || guestName.toLowerCase().includes('bob')) {
          setSearchResults([{ id: 'demo-pre-registered-id', guestName: guestName.toLowerCase().includes('alice') ? 'Alice Smith' : 'Bob Jones', email: guestName.toLowerCase().includes('alice') ? 'alice@example.com' : 'bob@example.com', phone: '555-0199', partySize: 2, response: 'pending' }]);
        } else { setSearchResults([]); }
      }, 600);
      return;
    }
    setSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/rsvp/search?query=${encodeURIComponent(guestName.trim())}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) { console.error(err); setSearchResults([]); }
    finally { setSearching(false); setSearchPerformed(true); }
  };

  const handleTableLookup = async () => {
    if (!tableQuery.trim()) return;
    setTableLookingUp(true);
    setTableLookupDone(false);
    setSeatingView(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/seating/search?query=${encodeURIComponent(tableQuery.trim())}`);
      const data = await res.json();
      setTableResults(data.results || []);
    } catch (err) {
      console.error('Table lookup failed:', err);
      setTableResults([]);
    } finally {
      setTableLookingUp(false);
      setTableLookupDone(true);
    }
  };

  const fetchSeatingMap = async (gid) => {
    if (!gid) return;
    setSeatingLoading(true);
    setSeatingView(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${apiUrl}/public/events/${slug}/seating/guest/${gid}`);
      const data = await res.json();
      if (data.success) {
        setSeatingView({ myTableName: data.myTableName, myTableId: data.myTableId, party: data.party || [], tables: data.tables || [] });
      }
    } catch (err) {
      console.error('Seating map fetch failed:', err);
    } finally {
      setSeatingLoading(false);
    }
  };

  const [prevLangParam, setPrevLangParam] = useState(langParam);
  if (langParam !== prevLangParam) { setPrevLangParam(langParam); setLang(langParam); }

  useEffect(() => {
    if (!slug) return;
    async function fetchEvent() {
      try {
        if (slug === 'demo-wedding' || slug === 'demo') {
          setEvent({
            id: 'demo-uuid', title: 'Julian & Sophia\'s Wedding Gala', title_ar: 'حفل زفاف جوليان وصوفيا الأنيق', template_type: 'wedding',
            rsvp_form_fields: [
              { id: 'field-1', field_key: 'meal', field_label: 'Meal Choice', field_label_ar: 'وجبة العشاء المفضلة', field_type: 'select', options: ['Beef Tenderloin', 'Pan-Seared Salmon', 'Wild Mushroom Risotto (V)', 'Kids Meal'], options_ar: ['شريحة لحم فيليه فاخرة', 'سمك السلمون الأطلسي', 'ريزوتو الفطر البري (نباتي)', 'وجبة أطفال'], is_required: true },
              { id: 'field-2', field_key: 'allergies', field_label: 'Dietary Restrictions / Allergies', field_label_ar: 'الحساسية من بعض الأطعمة أو قيود غذائية', field_type: 'text', is_required: false }
            ],
            custom_colors: { primary: '#B8944F' }
          });
          setLoading(false); return;
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        // Forward the invitation token so private events resolve (instead of 403).
        const query = invitationRsvpId ? `?rsvp_id=${encodeURIComponent(invitationRsvpId)}` : '';
        const res = await fetch(`${apiUrl}/public/events/${slug}${query}`);
        if (!res.ok) throw new Error('EVENT_NOT_FOUND');
        const data = await res.json();
        setEvent(data.event);

        // Pre-fill the form with the invited guest's existing RSVP record.
        if (data.guestRsvp) {
          const g = data.guestRsvp;
          skipNameResetRef.current = true; // preserve rsvpId across the name-change effect
          setRsvpId(g.id);
          setGuestName(g.guest_name || '');
          if (g.email) setEmail(g.email);
          if (g.phone) setPhone(g.phone);
          if (g.party_size) setPartySize(g.party_size);
          if (g.notes) setNotes(g.notes);
          if (g.response === 'yes' || g.response === 'no') setAttending(g.response);
          setStep(2); // skip the name-search step — we already know who they are
        }
      } catch (err) { setError(err.message); } finally { setLoading(false); }
    }
    fetchEvent();
  }, [slug, invitationRsvpId]);

  useEffect(() => {
    if (event) {
      document.title = `RSVP - ${event.title} | Fancy RSVP`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) { metaDesc.setAttribute('content', event.description || `RSVP to ${event.title}`); }
      else { const meta = document.createElement('meta'); meta.name = 'description'; meta.content = event.description || `RSVP to ${event.title}`; document.head.appendChild(meta); }
    }
  }, [event]);

  // 1. Resolve guest details from token parameter
  useEffect(() => {
    if (!guestIdParam || !event) return;
    async function loadGuestFromToken() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        const res = await fetch(`${apiUrl}/public/rsvp/guest/${guestIdParam}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.guest) {
            const g = data.guest;
            setRsvpId(g.id);
            setGuestName(g.guest_name);
            if (g.email) setEmail(g.email);
            if (g.phone) setPhone(g.phone);
            if (g.party_size) setPartySize(g.party_size);
            if (g.notes) setNotes(g.notes);
            if (g.table_name) setAssignedTableName(g.table_name);
            if (g.response === 'yes' || g.response === 'no') {
              setAttending(g.response);
            }
            setStep(2);
          }
        }
      } catch (err) {
        console.error('Error loading guest from token:', err);
      }
    }
    loadGuestFromToken();
  }, [guestIdParam, event]);

  // 2. Dynamic Font Loader
  useEffect(() => {
    if (!event) return;
    const titleFont = event.custom_fonts?.card_title;
    const bodyFont = event.custom_fonts?.card_body;

    const fontsToLoad = [];
    if (titleFont && titleFont !== 'Playfair Display') fontsToLoad.push(titleFont.replace(/ /g, '+'));
    if (bodyFont && bodyFont !== 'Montserrat') fontsToLoad.push(bodyFont.replace(/ /g, '+'));

    if (fontsToLoad.length > 0) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontsToLoad.join('&family=')}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      return () => {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
    }
  }, [event]);

  useEffect(() => {
    const size = parseInt(partySize) || 1;
    if (size <= 1) { setAdditionalGuests([]); return; }
    const diff = size - 1;
    setAdditionalGuests(prev => {
      const copy = [...prev];
      if (copy.length < diff) { while (copy.length < diff) copy.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, fullName: '', mealSelection: '', dietaryNotes: '' }); }
      else if (copy.length > diff) { copy.splice(diff); }
      return copy;
    });
  }, [partySize]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#77736A', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 300 }}>Preparing RSVP form...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '56px' }}>🔍</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: '#191B1E', marginTop: '12px' }}>Event details not loaded.</h1>
        </div>
      </div>
    );
  }

  const themeColor = '#B8944F';
  const isRTL = lang === 'ar';
  const t = translations[lang];
  const localizedTitle = isRTL && event.title_ar ? event.title_ar : event.title;
  const isContinueDisabled = partySize > 1 && additionalGuests.some(g => !g.fullName || !g.fullName.trim());

  // Meal options: prefer a configured meal field's options (so guest choices match
  // what the organizer set up — and what the backend validates against). Fall back
  // to the built-in defaults only when no meal field is configured.
  const MEAL_FIELD_KEYS = ['meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option'];
  const mealField = (event.rsvp_form_fields || []).find(
    f => MEAL_FIELD_KEYS.includes((f.field_key || '').toLowerCase()) && ['select', 'radio'].includes(f.field_type)
  );
  const mealOptions = (mealField && Array.isArray(mealField.options) && mealField.options.length)
    ? mealField.options.map(o => ({ value: o, label: o }))
    : [
        { value: 'Prime Beef Filet', label: t.meal_beef },
        { value: 'Atlantic Salmon', label: t.meal_salmon },
        { value: 'Mushroom Risotto (V)', label: t.meal_risotto },
        { value: 'Kids Meal', label: t.meal_kids },
      ];
  // Step-4 custom questions exclude the meal field (it's asked in step 3) to avoid
  // asking the same thing twice.
  const customQuestionFields = (event.rsvp_form_fields || []).filter(f => !mealField || f.id !== mealField.id);

  const setAnswer = (fieldId, value) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
    setValidationErrors(prev => { const n = { ...prev }; delete n[`field_${fieldId}`]; return n; });
  };
  const toggleMultiAnswer = (fieldId, opt) => {
    setCustomAnswers(prev => {
      const cur = (prev[fieldId] || '').split(',').map(s => s.trim()).filter(Boolean);
      const idx = cur.indexOf(opt);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(opt);
      return { ...prev, [fieldId]: cur.join(', ') };
    });
    setValidationErrors(prev => { const n = { ...prev }; delete n[`field_${fieldId}`]; return n; });
  };

  const handleSubmit = async () => {
    // Client-side validation
    const errors = {};
    if (!guestName.trim()) errors.guestName = 'Name is required';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email format';
    if (partySize < 1 || partySize > 20) errors.partySize = 'Party size must be between 1 and 20';
    if (attending === 'yes') {
      // Validate only the custom questions actually shown in step 4 (the meal field
      // is asked in step 3 and validated server-side), so a required meal field
      // can't falsely block submission via the empty-customAnswers path.
      const requiredFields = customQuestionFields.filter(f => f.is_required);
      requiredFields.forEach(field => {
        if (!customAnswers[field.id] || !customAnswers[field.id].toString().trim()) {
          errors[`field_${field.id}`] = `${field.field_label} is required`;
        }
      });
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const payload = {
        rsvpId, guestName, email, phone, response: attending,
        partySize: attending === 'yes' ? partySize : 1, notes, primaryGuestMeal: primaryMeal,
        additionalGuests: attending === 'yes' ? additionalGuests : [],
        customAnswers: Object.keys(customAnswers).map(fieldId => ({ fieldId, value: customAnswers[fieldId] }))
      };
      if (slug === 'demo-wedding' || slug === 'demo') { setTimeout(() => { setSubmitResult('SUCCESS'); setStep(5); setSubmitting(false); }, 1000); return; }
      const res = await fetch(`${apiUrl}/public/events/${slug}/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to submit RSVP.');
      setSubmitResult('SUCCESS'); setStep(5);
    } catch (err) { alert(err.message); } finally { setSubmitting(false); }
  };

  /* Step indicator dots */
  const totalSteps = attending === 'yes' ? 5 : 4;
  const stepIndicator = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} style={{
          width: step >= i + 1 ? '24px' : '8px', height: '8px', borderRadius: '4px',
          background: step >= i + 1 ? '#B8944F' : '#E8E2D6', transition: 'all 0.4s ease',
        }} />
      ))}
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
    }}>
      <div style={{ maxWidth: '540px', width: '100%', background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>

        {/* Card Header */}
        <div style={{ background: '#191B1E', color: '#FFFFFF', padding: '32px', textAlign: 'center', position: 'relative' }}>
          {/* Lang toggle */}
          <div style={{ position: 'absolute', top: '12px', ...(isRTL ? { left: '12px' } : { right: '12px' }), display: 'flex', gap: '6px' }}>
            {[{ code: 'en', label: 'EN' }, { code: 'ar', label: 'عربي' }].map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{
                fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                border: lang === l.code ? '1px solid #B8944F' : '1px solid rgba(255,255,255,0.2)',
                background: lang === l.code ? '#B8944F' : 'transparent',
                color: lang === l.code ? '#191B1E' : 'rgba(255,255,255,0.7)',
                fontWeight: lang === l.code ? 700 : 400, fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
              }}>{l.label}</button>
            ))}
          </div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', color: '#D7BE80', fontWeight: 700, display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>{t.rsvp_portal}</span>
          <h1 style={{ fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)', fontSize: '22px', fontWeight: 400, letterSpacing: '0.5px' }}>{localizedTitle}</h1>
        </div>

        {/* Card Body */}
        <div style={{ padding: '32px' }}>
          {stepIndicator}

          {/* ════ STEP 1: Search Name ════ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={S.labelBase}>{t.enter_name}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={guestName} onChange={e => { setGuestName(e.target.value); setValidationErrors(prev => { const n = {...prev}; delete n.guestName; return n; }); }} placeholder={t.name_placeholder} disabled={searching}
                    style={{ ...S.inputBase, flex: 1, ...(validationErrors.guestName ? { borderColor: '#C45E5E' } : {}) }} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = validationErrors.guestName ? '#C45E5E' : '#E8E2D6'} />
                  {!searchPerformed && (
                    <button disabled={!guestName.trim() || searching} onClick={handleSearchName} style={S.goldBtn(!guestName.trim() || searching)}>
                      {searching ? '...' : (isRTL ? 'بحث' : 'Search')}
                    </button>
                  )}
                </div>
              </div>

              {searching && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                  <p style={{ color: '#77736A', fontSize: '13px' }}>{isRTL ? 'جاري البحث عن دعوتك...' : 'Searching for your invitation...'}</p>
                </div>
              )}

              {searchPerformed && !searching && (
                <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {searchResults.length > 0 ? (
                    <>
                      <p style={{ fontSize: '13px', color: '#77736A', fontWeight: 500 }}>
                        {isRTL ? 'لقد وجدنا دعوتك! يرجى اختيار اسمك لتأكيد الحضور:' : 'We found your invitation! Please select your name below:'}
                      </p>
                      {searchResults.map(result => (
                        <button key={result.id} onClick={() => { setRsvpId(result.id); setGuestName(result.guestName); if (result.email) setEmail(result.email); if (result.phone) setPhone(result.phone); if (result.partySize) setPartySize(result.partySize); setStep(2); }}
                          style={{ width: '100%', textAlign: 'left', padding: '14px', border: '1px solid #E8E2D6', borderRadius: '10px', background: '#FFFFFF', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', transition: 'border-color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#B8944F'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E8E2D6'}>
                          <div>
                            <span style={{ fontWeight: 600, color: '#191B1E', display: 'block', fontSize: '14px' }}>{result.guestName}</span>
                            <span style={{ fontSize: '11px', color: '#A09A91' }}>{result.email || (isRTL ? 'لا يوجد بريد مسجل' : 'No email registered')}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', background: '#F8F4EC', borderRadius: '6px', color: '#77736A' }}>
                            {isRTL ? `مرافقين: ${result.partySize}` : `Party: ${result.partySize}`}
                          </span>
                        </button>
                      ))}
                      <button onClick={() => { setRsvpId(null); setStep(2); }} style={{ fontSize: '13px', color: '#B8944F', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline', fontFamily: 'var(--font-sans)', padding: '4px' }}>
                        {isRTL ? 'اسمي ليس في القائمة (المتابعة كضيف جديد)' : "My name isn't listed (Continue as a new guest)"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', color: '#77736A', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', padding: '16px', borderRadius: '10px' }}>
                        ⚠️ {isRTL ? `لم نجد اسماً مطابقاً لـ "${guestName}" في قائمة المدعوين. لا تقلق، يمكنك الاستمرار والتسجيل كضيف جديد.` : `We couldn't find an invitation matching "${guestName}". No worries, you can still RSVP as a new guest.`}
                      </div>
                      <button onClick={() => { setRsvpId(null); setStep(2); }} style={{ ...S.goldBtn(false), width: '100%' }}>
                        {isRTL ? 'المتابعة كضيف جديد' : 'Continue as a New Guest'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Find my table — for guests who already RSVP'd */}
              <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                {!showTableLookup ? (
                  <button onClick={() => setShowTableLookup(true)} style={{ ...S.backBtn, color: '#B8944F', fontWeight: 600 }}>
                    {isRTL ? 'هل سجّلت بالفعل؟ ابحث عن طاولتك' : "Already RSVP'd? Find your table"}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={S.labelBase}>{isRTL ? 'ابحث باسمك لعرض طاولتك' : 'Search your name to see your table'}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" value={tableQuery} onChange={e => setTableQuery(e.target.value)} placeholder={t.name_placeholder}
                        style={{ ...S.inputBase, flex: 1 }} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'}
                        onKeyDown={e => { if (e.key === 'Enter') handleTableLookup(); }} />
                      <button disabled={!tableQuery.trim() || tableLookingUp} onClick={handleTableLookup} style={S.goldBtn(!tableQuery.trim() || tableLookingUp)}>
                        {tableLookingUp ? '...' : (isRTL ? 'بحث' : 'Find')}
                      </button>
                    </div>
                    {seatingView ? (
                      <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} onBack={() => setSeatingView(null)} />
                    ) : seatingLoading ? (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ width: '28px', height: '28px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                        <p style={{ color: '#77736A', fontSize: '12px' }}>{isRTL ? 'جاري تحميل خريطة جلوسك...' : 'Loading your seating map...'}</p>
                      </div>
                    ) : tableLookupDone && (
                      tableResults.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tableResults.map((r, i) => {
                            const assigned = r.tableName && r.tableName !== 'Unassigned';
                            const clickable = assigned && r.id;
                            return (
                              <button key={r.id || i} disabled={!clickable}
                                onClick={() => clickable && fetchSeatingMap(r.id)}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 14px', border: '1px solid #E8E2D6', borderRadius: '10px', background: '#FFFFFF', cursor: clickable ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left', transition: 'border-color 0.2s' }}
                                onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = '#B8944F'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E2D6'; }}>
                                <span style={{ fontWeight: 600, color: '#191B1E', fontSize: '14px' }}>{r.guestName}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '6px',
                                    background: assigned ? 'rgba(184,148,79,0.12)' : '#F8F4EC',
                                    color: assigned ? '#B8944F' : '#A09A91' }}>
                                    {assigned ? r.tableName : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
                                  </span>
                                  {clickable && (
                                    <span style={{ fontSize: '11px', color: '#B8944F', fontWeight: 700 }}>
                                      {isRTL ? 'عرض الخريطة ←' : 'View map →'}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ fontSize: '13px', color: '#77736A' }}>
                          {isRTL ? 'لم نعثر على حجز مطابق. تأكد من اسمك أو سجّل أعلاه.' : "No matching reservation found. Check your name or RSVP above."}
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ STEP 2: Attendance ════ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E', textAlign: 'center' }}>
                {t.attending_q.replace('{name}', guestName)}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { val: 'yes', emoji: '✓', label: t.attending_yes, bg: 'rgba(184,148,79,0.08)', border: '#B8944F', color: '#B8944F' },
                  { val: 'no', emoji: '✕', label: t.attending_no, bg: 'rgba(196,94,94,0.06)', border: '#C45E5E', color: '#C45E5E' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => { setAttending(opt.val); setStep(opt.val === 'yes' ? 3 : 4); }}
                    style={{
                      padding: '28px 16px', border: `2px solid ${attending === opt.val ? opt.border : '#E8E2D6'}`,
                      borderRadius: '12px', textAlign: 'center', fontWeight: 700, fontSize: '16px', cursor: 'pointer',
                      background: attending === opt.val ? opt.bg : '#FFFFFF', color: attending === opt.val ? opt.color : '#191B1E',
                      fontFamily: 'var(--font-sans)', transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={e => { if (attending !== opt.val) e.currentTarget.style.borderColor = opt.border; }}
                    onMouseLeave={e => { if (attending !== opt.val) e.currentTarget.style.borderColor = '#E8E2D6'; }}>
                    <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                <button onClick={() => setStep(1)} style={S.backBtn}>{isRTL ? '← السابق' : '← Back'}</button>
              </div>
            </div>
          )}

          {/* ════ STEP 3: Details & Meals ════ */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>{t.party_details}</h3>

              <div>
                <label style={S.labelBase}>{t.party_size_label}</label>
                <select value={partySize} onChange={e => setPartySize(parseInt(e.target.value))} style={{ ...S.inputBase, cursor: 'pointer' }}>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num} {num === 1 ? t.person : t.people}</option>))}
                </select>
              </div>

              <div style={{ background: '#F8F4EC', padding: '16px', borderRadius: '10px' }}>
                <label style={{ ...S.labelBase, fontWeight: 700 }}>{t.meal_label.replace('{name}', guestName)}</label>
                <select value={primaryMeal} onChange={e => setPrimaryMeal(e.target.value)} style={{ ...S.inputBase }}>
                  <option value="">{t.meal_select_placeholder}</option>
                  {mealOptions.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
                </select>
              </div>

              {additionalGuests.map((g, index) => (
                <div key={g.id} style={{ padding: '16px', border: '1px solid #E8E2D6', borderRadius: '10px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A09A91', fontWeight: 700 }}>{t.guest_label.replace('{index}', index + 2)}</h4>
                  <div>
                    <label style={{ ...S.labelBase, fontSize: '11px' }}>{t.guest_name_label}</label>
                    <input type="text" value={g.fullName} onChange={e => { const copy = [...additionalGuests]; copy[index].fullName = e.target.value; setAdditionalGuests(copy); }}
                      placeholder={t.name_placeholder} style={S.inputBase} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
                  </div>
                  <div>
                    <label style={{ ...S.labelBase, fontSize: '11px' }}>{t.guest_meal_label}</label>
                    <select value={g.mealSelection} onChange={e => { const copy = [...additionalGuests]; copy[index].mealSelection = e.target.value; setAdditionalGuests(copy); }} style={{ ...S.inputBase, cursor: 'pointer' }}>
                      <option value="">{t.meal_select_placeholder}</option>
                      {mealOptions.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
                    </select>
                  </div>
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                <div>
                  <label style={{ ...S.labelBase, fontSize: '11px' }}>{t.email_label}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" style={S.inputBase}
                    onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
                </div>
                <div>
                  <label style={{ ...S.labelBase, fontSize: '11px' }}>{t.phone_label}</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" style={S.inputBase}
                    onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                <button onClick={() => setStep(2)} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
                <button disabled={isContinueDisabled} onClick={() => setStep(4)} style={S.goldBtn(isContinueDisabled)}>{t.continue}</button>
              </div>
            </div>
          )}

          {/* ════ STEP 4: Custom Questions ════ */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: '#191B1E' }}>{t.additional_details}</h3>

              {customQuestionFields.length > 0 ? (
                customQuestionFields.map(field => {
                  const label = isRTL && field.field_label_ar ? field.field_label_ar : field.field_label;
                  const opts = (isRTL && Array.isArray(field.options_ar) ? field.options_ar : field.options) || [];
                  const val = customAnswers[field.id] || '';
                  const hasErr = !!validationErrors[`field_${field.id}`];
                  const inputStyle = { ...S.inputBase, ...(hasErr ? { borderColor: '#C45E5E' } : {}) };
                  const onFocus = e => e.target.style.borderColor = '#B8944F';
                  const onBlur = e => e.target.style.borderColor = hasErr ? '#C45E5E' : '#E8E2D6';
                  const type = field.field_type;
                  // Map our field types to native input types for the simple inputs.
                  const nativeType = { number: 'number', email: 'email', phone: 'tel', url: 'url', date: 'date' }[type];
                  return (
                    <div key={field.id}>
                      <label style={S.labelBase}>{label} {field.is_required && <span style={{ color: '#C45E5E' }}>*</span>}</label>
                      {hasErr && <span style={{ fontSize: '11px', color: '#C45E5E', display: 'block', marginBottom: '4px' }}>{validationErrors[`field_${field.id}`]}</span>}

                      {(type === 'text' || nativeType) && (
                        <input type={nativeType || 'text'} value={val} onChange={e => setAnswer(field.id, e.target.value)}
                          style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                      )}

                      {type === 'textarea' && (
                        <textarea value={val} onChange={e => setAnswer(field.id, e.target.value)} rows={3}
                          style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} onFocus={onFocus} onBlur={onBlur} />
                      )}

                      {type === 'select' && (
                        <select value={val} onChange={e => setAnswer(field.id, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="">{t.meal_select_placeholder}</option>
                          {opts.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
                        </select>
                      )}

                      {type === 'radio' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {opts.map((opt, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer' }}>
                              <input type="radio" name={`field_${field.id}`} value={opt} checked={val === opt}
                                onChange={() => setAnswer(field.id, opt)} style={{ accentColor: '#B8944F' }} />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}

                      {type === 'multiselect' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {opts.map((opt, i) => {
                            const selected = val.split(',').map(s => s.trim()).filter(Boolean).includes(opt);
                            return (
                              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer' }}>
                                <input type="checkbox" checked={selected} onChange={() => toggleMultiAnswer(field.id, opt)} style={{ accentColor: '#B8944F' }} />
                                {opt}
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {type === 'checkbox' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#191B1E', cursor: 'pointer' }}>
                          <input type="checkbox" checked={val === 'Yes' || val === 'true'}
                            onChange={e => setAnswer(field.id, e.target.checked ? 'Yes' : '')} style={{ accentColor: '#B8944F' }} />
                          {isRTL ? 'نعم' : 'Yes'}
                        </label>
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: '13px', color: '#77736A' }}>{t.no_questions}</p>
              )}

              <div>
                <label style={S.labelBase}>{t.note_label}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={t.note_placeholder}
                  style={{ ...S.inputBase, resize: 'vertical', minHeight: '80px' }} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
              </div>

              {Object.keys(validationErrors).length > 0 && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', fontSize: '12px', color: '#C45E5E', marginBottom: '8px' }}>
                  ⚠️ {isRTL ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields before submitting.'}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
                <button onClick={() => setStep(attending === 'yes' ? 3 : 2)} style={S.backBtn}>{isRTL ? 'رجوع' : 'Back'}</button>
                <button disabled={submitting} onClick={handleSubmit} style={S.goldBtn(submitting)}>{submitting ? t.submitting : t.submit_rsvp}</button>
              </div>
            </div>
          )}

          {/* ════ STEP 5: Thank You ════ */}
          {step === 5 && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px 0' }}>
              {attending === 'yes' ? (
                <>
                  <span style={{ fontSize: '56px' }}>🎉</span>
                  <h2 style={{ fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E' }}>
                    {t.thank_you.replace('{name}', guestName)}
                  </h2>
                  <p style={{ color: '#77736A', maxWidth: '400px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
                    {t.attending_success_desc.replace('{email}', email)}
                  </p>
                  {assignedTableName && (
                    <div style={{ background: '#F8F4EC', border: '1px solid #E8E2D6', padding: '16px 24px', borderRadius: '12px', marginTop: '16px', display: 'inline-block', margin: '16px auto 0' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>
                        {isRTL ? 'طاولتك المخصصة' : 'Your Assigned Table'}
                      </span>
                      <strong style={{ fontSize: '18px', color: '#B8944F', fontFamily: event?.custom_fonts?.card_title || 'var(--font-serif)' }}>
                        {assignedTableName}
                      </strong>
                    </div>
                  )}

                  {/* Personal seating map */}
                  {rsvpId && (
                    seatingView ? (
                      <div style={{ marginTop: '8px' }}>
                        <SeatingResultPanel view={seatingView} loading={seatingLoading} isRTL={isRTL} onBack={() => setSeatingView(null)} />
                      </div>
                    ) : (
                      <button onClick={() => fetchSeatingMap(rsvpId)} disabled={seatingLoading}
                        style={{ marginTop: '4px', padding: '10px 20px', background: '#FFFFFF', color: '#B8944F', border: '1px solid #B8944F', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        {seatingLoading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? '🗺️ اعرض مكان جلوسي على الخريطة' : '🗺️ View where I sit on the map')}
                      </button>
                    )
                  )}

                  <p style={{ fontSize: '12px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)', marginTop: '12px' }}>{t.qr_notice}</p>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '56px' }}>✉️</span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E' }}>
                    {isRTL ? 'شكراً لإعلامنا بقرارك' : 'Thank you for letting us know'}
                  </h2>
                  <p style={{ color: '#77736A', maxWidth: '380px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7 }}>{t.decline_success_desc}</p>
                </>
              )}
              <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '24px' }}>
                <Link href={`/${slug}`} style={{ color: '#B8944F', fontSize: '14px', fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>{t.return_btn}</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* Shows the guest's table + a highlighted map + the companions THEY brought.
   Deliberately never lists other parties seated at the same table. */
function SeatingResultPanel({ view, loading, isRTL, onBack }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ width: '28px', height: '28px', border: '3px solid #E8E2D6', borderTop: '3px solid #B8944F', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
        <p style={{ color: '#77736A', fontSize: '12px' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }
  if (!view) return null;
  const assigned = !!view.myTableName;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: isRTL ? 'right' : 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#77736A', fontWeight: 700, display: 'block', fontFamily: 'var(--font-sans)' }}>
            {isRTL ? 'طاولتك' : 'Your table'}
          </span>
          <strong style={{ fontSize: '18px', color: assigned ? '#B8944F' : '#A09A91', fontFamily: 'var(--font-serif)' }}>
            {assigned ? view.myTableName : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
          </strong>
        </div>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#77736A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline' }}>
            {isRTL ? 'رجوع' : 'Back'}
          </button>
        )}
      </div>

      <SeatingMiniMap tables={view.tables} myTableId={view.myTableId} youLabel={isRTL ? 'مكانك' : "You're here"} />

      {view.party && view.party.length > 0 && (
        <div style={{ background: '#FAFAF8', border: '1px solid #E8E2D6', borderRadius: '12px', padding: '14px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#77736A', fontWeight: 700, display: 'block', marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
            {isRTL ? 'مرافقوك على نفس الطاولة' : 'Your party at this table'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {view.party.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ color: '#191B1E', fontWeight: p.isPrimary ? 700 : 500, fontFamily: 'var(--font-sans)' }}>
                  {p.name}{p.isPrimary ? (isRTL ? ' (أنت)' : ' (you)') : ''}
                </span>
                {p.meal && <span style={{ fontSize: '11px', color: '#77736A', fontFamily: 'var(--font-sans)' }}>{p.meal}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: '11px', color: '#A09A91', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
        {isRTL ? 'الخريطة توضّح مكان طاولتك في القاعة فقط.' : 'The map shows where your table is in the venue.'}
      </p>
    </div>
  );
}

export default function RSVPFormPage({ params }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#F8F4EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#77736A', fontFamily: 'var(--font-sans)', fontSize: '14px' }}>Loading localization parameters...</p>
      </div>
    }>
      <RSVPFormContent slug={slug} />
    </Suspense>
  );
}
