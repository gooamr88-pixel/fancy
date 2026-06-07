'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { translations } from '../../utils/translations';

// Subcomponent that uses useSearchParams inside a Suspense block
function RSVPFormContent({ slug }) {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang') || 'en';
  
  const [lang, setLang] = useState(langParam);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
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

  useEffect(() => {
    if (langParam) {
      setLang(langParam);
    }
  }, [langParam]);

  useEffect(() => {
    if (!slug) return;

    async function fetchEvent() {
      try {
        if (slug === 'demo-wedding' || slug === 'demo') {
          setEvent({
            id: 'demo-uuid',
            title: 'Julian & Sophia\'s Wedding Gala',
            title_ar: 'حفل زفاف جوليان وصوفيا الأنيق',
            template_type: 'wedding',
            rsvp_form_fields: [
              { id: 'field-1', field_key: 'meal', field_label: 'Meal Choice', field_label_ar: 'وجبة العشاء المفضلة', field_type: 'select', options: ['Beef Tenderloin', 'Pan-Seared Salmon', 'Wild Mushroom Risotto (V)', 'Kids Meal'], options_ar: ['شريحة لحم فيليه فاخرة', 'سمك السلمون الأطلسي', 'ريزوتو الفطر البري (نباتي)', 'وجبة أطفال'], is_required: true },
              { id: 'field-2', field_key: 'allergies', field_label: 'Dietary Restrictions / Allergies', field_label_ar: 'الحساسية من بعض الأطعمة أو قيود غذائية', field_type: 'text', is_required: false }
            ],
            custom_colors: { primary: '#6b5b95' }
          });
          setLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        const res = await fetch(`${apiUrl}/public/events/${slug}`);
        if (!res.ok) throw new Error('EVENT_NOT_FOUND');
        const data = await res.json();
        setEvent(data.event);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [slug]);

  // Sync additional guests inputs dynamically when party size changes
  useEffect(() => {
    const size = parseInt(partySize) || 1;
    if (size <= 1) {
      setAdditionalGuests([]);
      return;
    }

    const diff = size - 1;
    setAdditionalGuests(prev => {
      const copy = [...prev];
      if (copy.length < diff) {
        while (copy.length < diff) {
          copy.push({ fullName: '', mealSelection: '', dietaryNotes: '' });
        }
      } else if (copy.length > diff) {
        copy.splice(diff);
      }
      return copy;
    });
  }, [partySize]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-stone-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-600 font-medium">Preparing RSVP form...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="text-center">
          <span className="text-5xl">🔍</span>
          <h1 className="text-2xl font-bold mt-4">Event details not loaded.</h1>
        </div>
      </div>
    );
  }

  const themeColor = event.custom_colors?.primary || '#8c7853';
  const isRTL = lang === 'ar';
  const t = translations[lang];

  // Dynamic Event Info
  const localizedTitle = isRTL && event.title_ar ? event.title_ar : event.title;

  // Form submit handler
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      
      const payload = {
        guestName,
        email,
        phone,
        response: attending,
        partySize: attending === 'yes' ? partySize : 1,
        notes,
        primaryGuestMeal: primaryMeal,
        additionalGuests: attending === 'yes' ? additionalGuests : [],
        customAnswers: Object.keys(customAnswers).map(fieldId => ({
          fieldId,
          value: customAnswers[fieldId]
        }))
      };

      if (slug === 'demo-wedding' || slug === 'demo') {
        setTimeout(() => {
          setSubmitResult('SUCCESS');
          setStep(5);
          setSubmitting(false);
        }, 1000);
        return;
      }

      const res = await fetch(`${apiUrl}/public/events/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to submit RSVP.');
      }

      setSubmitResult('SUCCESS');
      setStep(5);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className={`min-h-screen bg-stone-50 flex items-center justify-center p-6 transition-all duration-300 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      
      {/* ─── Glassmorphic Card Container ─── */}
      <div className="max-w-xl w-full bg-white border border-stone-150 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Card Header */}
        <div className="bg-stone-900 text-white p-8 text-center relative">
          
          {/* Language Toggle Inside Header */}
          <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} flex gap-1.5`}>
            <button 
              onClick={() => setLang('en')}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition ${lang === 'en' ? 'bg-amber-500 text-stone-950 border-amber-500 font-bold' : 'text-stone-300 border-stone-750 hover:bg-stone-850'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('ar')}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition ${lang === 'ar' ? 'bg-amber-500 text-stone-950 border-amber-500 font-bold' : 'text-stone-300 border-stone-750 hover:bg-stone-850'}`}
            >
              عربي
            </button>
          </div>

          <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-2">{t.rsvp_portal}</span>
          <h1 className="text-xl md:text-2xl font-light tracking-wide">{localizedTitle}</h1>
        </div>

        {/* Card Body */}
        <div className="p-8">

          {/* ════ STEP 1: Search Name ════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-700 block">{t.enter_name}</label>
                <input 
                  type="text" 
                  value={guestName} 
                  onChange={e => setGuestName(e.target.value)}
                  placeholder={t.name_placeholder} 
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-base"
                />
              </div>
              <button
                disabled={!guestName.trim()}
                onClick={() => setStep(2)}
                className="w-full py-3 text-white font-medium rounded-xl transition duration-150 disabled:opacity-50"
                style={{ backgroundColor: themeColor }}
              >
                {t.continue}
              </button>
            </div>
          )}

          {/* ════ STEP 2: Attendance selection ════ */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-stone-850 text-center">
                {t.attending_q.replace('{name}', guestName)}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => { setAttending('yes'); setStep(3); }}
                  className={`py-6 border-2 rounded-xl text-center font-bold text-lg transition ${attending === 'yes' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 hover:border-stone-300'}`}
                >
                  🟢 {t.attending_yes}
                </button>
                <button
                  onClick={() => { setAttending('no'); setStep(4); }}
                  className={`py-6 border-2 rounded-xl text-center font-bold text-lg transition ${attending === 'no' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-stone-200 hover:border-stone-300'}`}
                >
                  🔴 {t.attending_no}
                </button>
              </div>

              <div className="flex justify-between border-t border-stone-100 pt-4">
                <button onClick={() => setStep(1)} className="text-sm text-stone-500 hover:text-stone-750">
                  {isRTL ? '← السابق' : '← Back'}
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 3: Details & Meals (Attending only) ════ */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-850">{t.party_details}</h3>

              {/* Party size selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-700 block">{t.party_size_label}</label>
                <select 
                  value={partySize} 
                  onChange={e => setPartySize(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none"
                >
                  {[1,2,3,4,5,6,7,8].map(num => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? t.person : t.people}
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary guest meal */}
              <div className="space-y-2 bg-stone-50 p-4 rounded-xl">
                <label className="text-sm font-bold text-stone-700 block">
                  {t.meal_label.replace('{name}', guestName)}
                </label>
                <select
                  value={primaryMeal}
                  onChange={e => setPrimaryMeal(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-250 rounded-lg bg-white"
                >
                  <option value="">{t.meal_select_placeholder}</option>
                  <option value="Prime Beef Filet">{t.meal_beef}</option>
                  <option value="Atlantic Salmon">{t.meal_salmon}</option>
                  <option value="Mushroom Risotto (V)">{t.meal_risotto}</option>
                  <option value="Kids Meal">{t.meal_kids}</option>
                </select>
              </div>

              {/* Additional guest names and meals */}
              {additionalGuests.map((g, index) => (
                <div key={index} className="space-y-3 p-4 border border-stone-150 rounded-xl bg-white shadow-sm">
                  <h4 className="text-xs uppercase tracking-wider text-stone-400 font-bold">
                    {t.guest_label.replace('{index}', index + 2)}
                  </h4>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-600">{t.guest_name_label}</label>
                    <input
                      type="text"
                      value={g.fullName}
                      onChange={e => {
                        const copy = [...additionalGuests];
                        copy[index].fullName = e.target.value;
                        setAdditionalGuests(copy);
                      }}
                      placeholder={t.name_placeholder}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-600">{t.guest_meal_label}</label>
                    <select
                      value={g.mealSelection}
                      onChange={e => {
                        const copy = [...additionalGuests];
                        copy[index].mealSelection = e.target.value;
                        setAdditionalGuests(copy);
                      }}
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-white"
                    >
                      <option value="">{t.meal_select_placeholder}</option>
                      <option value="Prime Beef Filet">{t.meal_beef}</option>
                      <option value="Atlantic Salmon">{t.meal_salmon}</option>
                      <option value="Mushroom Risotto (V)">{t.meal_risotto}</option>
                      <option value="Kids Meal">{t.meal_kids}</option>
                    </select>
                  </div>
                </div>
              ))}

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-stone-100 pt-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-600">{t.email_label}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-600">{t.phone_label}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-between border-t border-stone-100 pt-4">
                <button onClick={() => setStep(2)} className="text-sm text-stone-500 hover:text-stone-750">
                  {isRTL ? 'رجوع' : 'Back'}
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2 text-white text-sm font-medium rounded-lg"
                  style={{ backgroundColor: themeColor }}
                >
                  {t.continue}
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 4: Custom Questions ════ */}
          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-850">{t.additional_details}</h3>

              {/* Render configured fields */}
              {event.rsvp_form_fields?.length > 0 ? (
                event.rsvp_form_fields.map(field => {
                  const label = isRTL && field.field_label_ar ? field.field_label_ar : field.field_label;
                  const opts = isRTL && field.options_ar ? field.options_ar : field.options;

                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="text-sm font-semibold text-stone-755 block">
                        {label} {field.is_required && <span className="text-red-500">*</span>}
                      </label>
                      
                      {field.field_type === 'text' && (
                        <input
                          type="text"
                          value={customAnswers[field.id] || ''}
                          onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                        />
                      )}
                      
                      {field.field_type === 'select' && (
                        <select
                          value={customAnswers[field.id] || ''}
                          onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-white"
                        >
                          <option value="">{t.meal_select_placeholder}</option>
                          {opts?.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-stone-500">{t.no_questions}</p>
              )}

              {/* General Message notes */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-stone-755 block">{t.note_label}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none"
                  placeholder={t.note_placeholder}
                />
              </div>

              <div className="flex justify-between border-t border-stone-100 pt-4">
                <button onClick={() => setStep(attending === 'yes' ? 3 : 2)} className="text-sm text-stone-500 hover:text-stone-750">
                  {isRTL ? 'رجوع' : 'Back'}
                </button>
                <button
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="px-6 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {submitting ? t.submitting : t.submit_rsvp}
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 5: Thank you page ════ */}
          {step === 5 && (
            <div className="text-center space-y-6 py-8">
              {attending === 'yes' ? (
                <>
                  <span className="text-6xl">🎉</span>
                  <h2 className="text-2xl font-bold text-stone-850">
                    {t.thank_you.replace('{name}', guestName)}
                  </h2>
                  <p className="text-stone-600 max-w-md mx-auto">
                    {t.attending_success_desc.replace('{email}', email)}
                  </p>
                  <p className="text-sm text-stone-400 italic">
                    {t.qr_notice}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-6xl">✉️</span>
                  <h2 className="text-2xl font-bold text-stone-850">
                    {isRTL ? 'شكراً لإعلامنا بقرارك' : 'Thank you for letting us know'}
                  </h2>
                  <p className="text-stone-600 max-w-sm mx-auto">
                    {t.decline_success_desc}
                  </p>
                </>
              )}

              <div className="border-t border-stone-100 pt-6">
                <Link href={`/${slug}`} className="text-sm font-semibold text-amber-600 hover:underline">
                  {t.return_btn}
                </Link>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

// Main page component wrapped in Suspense
export default function RSVPFormPage({ params }) {
  const [slug, setSlug] = useState('');

  useEffect(() => {
    async function resolveParams() {
      const resolvedParams = await params;
      setSlug(resolvedParams.slug);
    }
    resolveParams();
  }, [params]);

  if (!slug) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-600 font-medium">Resolving URL path parameters...</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-600 font-medium font-sans">Loading localization parameters...</p>
      </div>
    }>
      <RSVPFormContent slug={slug} />
    </Suspense>
  );
}
