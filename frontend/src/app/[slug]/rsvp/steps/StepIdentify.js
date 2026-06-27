'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FadeInUp, StaggerChildren, StaggerItem, ShimmerPlaceholder } from '../../../components/guest/GuestAnimations';
import { PremiumButton, FormField, inputFocus, inputBlur } from '../../../components/guest/GuestUI';
import { S } from '../styles';
import SeatingResultPanel from './SeatingResultPanel';

/** Step 1 — find your invitation by name, or "Already RSVP'd? Find your table". */
export default function StepIdentify({
  t, isRTL, guestName, setGuestName, validationErrors, setValidationErrors,
  searchApi, onSelectResult, onContinueNew, seatingApi, seatingRevealed,
  showTableLookup, setShowTableLookup,
}) {
  const { searching, searchPerformed, searchResults, search } = searchApi;
  const { tableQuery, setTableQuery, tableResults, tableLookingUp, tableLookupDone, seatingView, setSeatingView, seatingLoading, lookupTable, fetchSeatingMap } = seatingApi;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <FadeInUp delay={0.1} y={20}>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>💌</span>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 500, color: '#191B1E', lineHeight: 1.5 }}>
            {isRTL ? 'يسعدنا دعوتك للاحتفال معنا' : 'We would be honored by your presence'}
          </h3>
          <p style={{ fontSize: '13px', color: '#77736A', marginTop: '4px', lineHeight: 1.6 }}>
            {isRTL ? 'ابحث عن اسمك في قائمة الضيوف أو سجّل كضيف جديد' : 'Find your name on the guest list or register as a new guest'}
          </p>
        </div>
      </FadeInUp>

      <FormField label={t.enter_name} error={validationErrors.guestName}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={guestName}
            onChange={e => {
              setGuestName(e.target.value);
              setValidationErrors(prev => { const n = { ...prev }; delete n.guestName; return n; });
            }}
            placeholder={t.name_placeholder}
            disabled={searching}
            style={{ ...S.inputBase, flex: 1, ...(validationErrors.guestName ? { borderColor: '#ef4444' } : {}) }}
            onFocus={e => inputFocus(e)}
            onBlur={e => inputBlur(e, !!validationErrors.guestName)}
            onKeyDown={e => { if (e.key === 'Enter' && !searchPerformed) search(guestName); }}
          />
          {!searchPerformed && (
            <PremiumButton testId="rsvp-search" disabled={!guestName.trim() || searching} onClick={() => search(guestName)} loading={searching} size="md">
              {isRTL ? 'بحث' : 'Search'}
            </PremiumButton>
          )}
        </div>
      </FormField>

      {searching && (
        <FadeInUp y={10}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
            <ShimmerPlaceholder height="56px" borderRadius="12px" />
            <ShimmerPlaceholder height="56px" borderRadius="12px" />
            <p style={{ color: '#77736A', fontSize: '13px', textAlign: 'center' }}>
              {isRTL ? 'جاري البحث عن دعوتك...' : 'Searching for your invitation...'}
            </p>
          </div>
        </FadeInUp>
      )}

      {searchPerformed && !searching && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
          {searchResults.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#77736A', fontWeight: 500 }}>
                {isRTL ? 'لقد وجدنا دعوتك! يرجى اختيار اسمك لتأكيد الحضور:' : 'We found your invitation! Please select your name below:'}
              </p>
              <StaggerChildren staggerDelay={0.08}>
                {searchResults.map((result, i) => (
                  <StaggerItem key={result.id || i}>
                    <motion.button
                      whileHover={{ scale: 1.01, borderColor: '#B8944F' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelectResult(result)}
                      style={{
                        width: '100%', textAlign: isRTL ? 'right' : 'left',
                        padding: '16px', border: '1px solid #E8E2D6', borderRadius: '14px',
                        background: '#FFFFFF', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#191B1E', fontSize: '14px' }}>
                        {result.guestName}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', background: '#F8F4EC', borderRadius: '8px', color: '#77736A' }}>
                        {isRTL ? `مرافقين: ${result.partySize}` : `Party: ${result.partySize}`}
                      </span>
                    </motion.button>
                  </StaggerItem>
                ))}
              </StaggerChildren>
              <button
                onClick={onContinueNew}
                style={{ fontSize: '13px', color: '#B8944F', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline', fontFamily: 'var(--font-sans)', padding: '4px' }}
              >
                {isRTL ? 'اسمي ليس في القائمة (المتابعة كضيف جديد)' : "My name isn't listed (Continue as a new guest)"}
              </button>
            </div>
          ) : (
            <FadeInUp y={10}>
              <div style={{ fontSize: '13px', color: '#77736A', background: 'rgba(184,148,79,0.08)', border: '1px solid rgba(184,148,79,0.2)', padding: '16px', borderRadius: '12px' }}>
                ⚠️ {isRTL
                  ? `لم نجد اسماً مطابقاً لـ "${guestName}" في قائمة المدعوين. لا تقلق، يمكنك الاستمرار والتسجيل كضيف جديد.`
                  : `We couldn't find an invitation matching "${guestName}". No worries, you can still RSVP as a new guest.`}
              </div>
              <PremiumButton testId="rsvp-continue-new" fullWidth onClick={onContinueNew} style={{ marginTop: '12px' }}>
                {isRTL ? 'المتابعة كضيف جديد' : 'Continue as a New Guest'}
              </PremiumButton>
            </FadeInUp>
          )}
        </motion.div>
      )}

      {/* Find my table — hidden until the 24h seating reveal window opens */}
      {seatingRevealed && (
      <div style={{ borderTop: '1px solid #F0ECE3', paddingTop: '16px' }}>
        {!showTableLookup ? (
          <button onClick={() => setShowTableLookup(true)} style={{ ...S.backBtn, color: '#B8944F', fontWeight: 600 }}>
            {isRTL ? 'هل سجّلت بالفعل؟ ابحث عن طاولتك' : "Already RSVP'd? Find your table"}
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={S.labelBase}>{isRTL ? 'ابحث باسمك لعرض طاولتك' : 'Search your name to see your table'}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text" value={tableQuery}
                onChange={e => setTableQuery(e.target.value)}
                placeholder={t.name_placeholder}
                style={{ ...S.inputBase, flex: 1 }}
                onFocus={e => inputFocus(e)} onBlur={e => inputBlur(e)}
                onKeyDown={e => { if (e.key === 'Enter') lookupTable(); }}
              />
              <PremiumButton disabled={!tableQuery.trim() || tableLookingUp} onClick={lookupTable} loading={tableLookingUp} size="md">
                {isRTL ? 'بحث' : 'Find'}
              </PremiumButton>
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
                <StaggerChildren staggerDelay={0.06}>
                  {tableResults.map((r, i) => {
                    const assigned = r.tableName && r.tableName !== 'Unassigned';
                    const clickable = assigned && r.id;
                    return (
                      <StaggerItem key={r.id || i}>
                        <motion.button
                          whileHover={clickable ? { scale: 1.01, borderColor: '#B8944F' } : {}}
                          disabled={!clickable}
                          onClick={() => clickable && fetchSeatingMap(r.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            gap: '8px', padding: '14px 16px', border: '1px solid #E8E2D6',
                            borderRadius: '12px', background: '#FFFFFF', width: '100%',
                            cursor: clickable ? 'pointer' : 'default',
                            fontFamily: 'var(--font-sans)', textAlign: isRTL ? 'right' : 'left',
                            transition: 'border-color 0.2s',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#191B1E', fontSize: '14px' }}>{r.guestName}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '8px', background: assigned ? 'rgba(184,148,79,0.12)' : '#F8F4EC', color: assigned ? '#B8944F' : '#A09A91' }}>
                              {assigned ? r.tableName : (isRTL ? 'لم تُخصّص بعد' : 'Not assigned yet')}
                            </span>
                            {clickable && (
                              <span style={{ fontSize: '11px', color: '#B8944F', fontWeight: 700 }}>
                                {isRTL ? 'عرض الخريطة ←' : 'View map →'}
                              </span>
                            )}
                          </span>
                        </motion.button>
                      </StaggerItem>
                    );
                  })}
                </StaggerChildren>
              ) : (
                <p style={{ fontSize: '13px', color: '#77736A' }}>
                  {isRTL ? 'لم نعثر على حجز مطابق. تأكد من اسمك أو سجّل أعلاه.' : "No matching reservation found. Check your name or RSVP above."}
                </p>
              )
            )}
          </motion.div>
        )}
      </div>
      )}
    </div>
  );
}
