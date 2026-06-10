'use client';

import React, { useEffect, useState, Suspense, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { translations } from '../../utils/translations';

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

  useEffect(() => { setSearchPerformed(false); setSearchResults([]); setRsvpId(null); }, [guestName]);

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
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (!res.ok) throw new Error('EVENT_NOT_FOUND');
        const data = await res.json();
        setEvent(data.event);
      } catch (err) { setError(err.message); } finally { setLoading(false); }
    }
    fetchEvent();
  }, [slug]);

  useEffect(() => {
    if (event) {
      document.title = `RSVP - ${event.title} | Fancy RSVP`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) { metaDesc.setAttribute('content', event.description || `RSVP to ${event.title}`); }
      else { const meta = document.createElement('meta'); meta.name = 'description'; meta.content = event.description || `RSVP to ${event.title}`; document.head.appendChild(meta); }
    }
  }, [event]);

  useEffect(() => {
    const size = parseInt(partySize) || 1;
    if (size <= 1) { setAdditionalGuests([]); return; }
    const diff = size - 1;
    setAdditionalGuests(prev => {
      const copy = [...prev];
      if (copy.length < diff) { while (copy.length < diff) copy.push({ fullName: '', mealSelection: '', dietaryNotes: '' }); }
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

  const handleSubmit = async () => {
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
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', color: '#D7BE80', fontWeight: 700, display: 'block', marginBottom: '8px' }}>{t.rsvp_portal}</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, letterSpacing: '0.5px' }}>{localizedTitle}</h1>
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
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder={t.name_placeholder} disabled={searching}
                    style={{ ...S.inputBase, flex: 1 }} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
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
                  {[1,2,3,4,5,6,7,8].map(num => (<option key={num} value={num}>{num} {num === 1 ? t.person : t.people}</option>))}
                </select>
              </div>

              <div style={{ background: '#F8F4EC', padding: '16px', borderRadius: '10px' }}>
                <label style={{ ...S.labelBase, fontWeight: 700 }}>{t.meal_label.replace('{name}', guestName)}</label>
                <select value={primaryMeal} onChange={e => setPrimaryMeal(e.target.value)} style={{ ...S.inputBase }}>
                  <option value="">{t.meal_select_placeholder}</option>
                  <option value="Prime Beef Filet">{t.meal_beef}</option>
                  <option value="Atlantic Salmon">{t.meal_salmon}</option>
                  <option value="Mushroom Risotto (V)">{t.meal_risotto}</option>
                  <option value="Kids Meal">{t.meal_kids}</option>
                </select>
              </div>

              {additionalGuests.map((g, index) => (
                <div key={index} style={{ padding: '16px', border: '1px solid #E8E2D6', borderRadius: '10px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      <option value="Prime Beef Filet">{t.meal_beef}</option>
                      <option value="Atlantic Salmon">{t.meal_salmon}</option>
                      <option value="Mushroom Risotto (V)">{t.meal_risotto}</option>
                      <option value="Kids Meal">{t.meal_kids}</option>
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

              {event.rsvp_form_fields?.length > 0 ? (
                event.rsvp_form_fields.map(field => {
                  const label = isRTL && field.field_label_ar ? field.field_label_ar : field.field_label;
                  const opts = isRTL && field.options_ar ? field.options_ar : field.options;
                  return (
                    <div key={field.id}>
                      <label style={S.labelBase}>{label} {field.is_required && <span style={{ color: '#C45E5E' }}>*</span>}</label>
                      {field.field_type === 'text' && (
                        <input type="text" value={customAnswers[field.id] || ''} onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                          style={S.inputBase} onFocus={e => e.target.style.borderColor = '#B8944F'} onBlur={e => e.target.style.borderColor = '#E8E2D6'} />
                      )}
                      {field.field_type === 'select' && (
                        <select value={customAnswers[field.id] || ''} onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })} style={{ ...S.inputBase, cursor: 'pointer' }}>
                          <option value="">{t.meal_select_placeholder}</option>
                          {opts?.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}
                        </select>
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
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, color: '#191B1E' }}>
                    {t.thank_you.replace('{name}', guestName)}
                  </h2>
                  <p style={{ color: '#77736A', maxWidth: '400px', margin: '0 auto', fontSize: '14px', lineHeight: 1.7 }}>
                    {t.attending_success_desc.replace('{email}', email)}
                  </p>
                  <p style={{ fontSize: '12px', color: '#A09A91', fontStyle: 'italic' }}>{t.qr_notice}</p>
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
