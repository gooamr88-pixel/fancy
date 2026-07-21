'use client';

import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import CoverReveal from './CoverReveal';
import { LiteralThemeProvider, buildLiteralPalette } from './theme';
import HeroCouple from './sections/HeroCouple';
import Announcement from './sections/Announcement';
import TimelineVertical from './sections/TimelineVertical';
import VenueBlock from './sections/VenueBlock';
import DressCodeSwatches from './sections/DressCodeSwatches';
import ClosingMessage from './sections/ClosingMessage';
import RsvpGlassCard from './sections/RsvpGlassCard';
import { FloatingMusicButton, FloatingCalendarButton } from './chrome/FloatingChrome';
import ProgressDotNav from './chrome/ProgressDotNav';
import { getHaDays } from '../../../utils/haDays';

function formatDateLine(startISO, isRTL) {
  if (!startISO) return null;
  const locale = isRTL ? 'ar-EG' : 'en-US';
  return new Date(startISO).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
}
function formatTimeLine(startISO, isRTL) {
  if (!startISO) return null;
  const d = new Date(startISO);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return null;
  return d.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

/* CustomCanvasWeddingPage — a literal port of the reference Tilda file's
   design, rendered ONLY for template_type === 'custom' events in a couple
   category (see EventPageClient.js). Deliberately owns its own scroll
   container and chrome (ProgressDotNav) rather than reusing SnapShell/
   heritageArch's shared.js DotNav, so nothing here can ever affect
   wedding/engagement/legacy-variant rendering — see the plan's isolation
   goal. Real organizer data drives every section; only the visual language
   is a faithful port. */
export default function CustomCanvasWeddingPage({
  event, guestRsvp, isRTL, slug, hasResponded, responseStatus, allowGuestEdits,
  effectiveRsvpId, trackEvent, musicPlaying, toggleMusic, hasBackgroundMusic,
}) {
  const containerRef = useRef(null);
  const [revealed, setRevealed] = useState(false);

  const td = event?.template_data || {};
  const palette = useMemo(() => buildLiteralPalette(event?.custom_colors), [event?.custom_colors]);

  const partner1 = td.groom_name || td.partner1Name || td.partner1 || '';
  const partner2 = td.bride_name || td.partner2Name || td.partner2 || '';
  const dateLine = formatDateLine(event?.event_date, isRTL);
  const timeLine = formatTimeLine(event?.event_date, isRTL);
  const description = (isRTL && td.description_ar) || event?.description || '';
  const dressCode = (isRTL && td.dress_code_ar) || event?.dress_code || '';

  const haDays = getHaDays(td);
  const primaryVenue = haDays[0]?.venue?.name || haDays[0]?.venue?.address
    ? haDays[0].venue
    : { name: event?.location_name || '', address: event?.location_address || '', lat: event?.location_lat ?? null, lng: event?.location_lng ?? null };

  const mealOptionsRaw = td.ha_meal_options;
  const mealOptions = Array.isArray(mealOptionsRaw) ? mealOptionsRaw
    : (typeof mealOptionsRaw === 'string' && mealOptionsRaw.trim() ? mealOptionsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []);

  const sectionDefs = [
    { id: 'ccs-hero', label: isRTL ? 'الرئيسية' : 'Home', content: (
      <HeroCouple partner1={partner1} partner2={partner2} title={event?.title} dateLine={dateLine} timeLine={timeLine} heroVideoUrl={event?.hero_video_url} revealed={revealed} isRTL={isRTL} />
    ) },
    description || event?.cover_image_url ? { id: 'ccs-announcement', label: isRTL ? 'الدعوة' : 'Announcement', content: (
      <Announcement photoUrl={event?.cover_image_url} text={description} isRTL={isRTL} />
    ) } : null,
    haDays.some((d) => Array.isArray(d.schedule) && d.schedule.length > 0) ? { id: 'ccs-schedule', label: isRTL ? 'البرنامج' : 'Schedule', content: (
      <TimelineVertical days={haDays} isRTL={isRTL} />
    ) } : null,
    (primaryVenue.name || primaryVenue.address) ? { id: 'ccs-venue', label: isRTL ? 'الموقع' : 'Venue', content: (
      <VenueBlock venue={primaryVenue} isRTL={isRTL} />
    ) } : null,
    dressCode ? { id: 'ccs-dresscode', label: isRTL ? 'الزي' : 'Dress Code', content: (
      <DressCodeSwatches dressCode={dressCode} ladiesText={td.dressCodeLadies} gentlemenText={td.dressCodeGentlemen} isRTL={isRTL} />
    ) } : null,
    { id: 'ccs-rsvp', label: isRTL ? 'التأكيد' : 'RSVP', content: (
      <RsvpGlassCard event={event} slug={slug} guestRsvp={guestRsvp} hasResponded={hasResponded} responseStatus={responseStatus} allowGuestEdits={allowGuestEdits} effectiveRsvpId={effectiveRsvpId} mealOptions={mealOptions} isRTL={isRTL} trackEvent={trackEvent} />
    ) },
    td.closingMessage ? { id: 'ccs-closing', label: isRTL ? 'ختام' : 'Closing', content: (
      <ClosingMessage text={td.closingMessage} isRTL={isRTL} />
    ) } : null,
  ].filter(Boolean);

  return (
    <LiteralThemeProvider palette={palette}>
      <AnimatePresence>
        {!revealed && (
          <CoverReveal
            event={event}
            guestName={guestRsvp?.guest_name || ''}
            isRTL={isRTL}
            onOpen={() => setRevealed(true)}
          />
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
          scrollBehavior: 'smooth', background: palette.background, fontFamily: 'var(--font-sans)',
        }}
      >
        {sectionDefs.map((s) => (
          <div key={s.id} id={s.id} data-ccs-section>
            {s.content}
          </div>
        ))}
      </div>

      {revealed && (
        <>
          <ProgressDotNav containerRef={containerRef} sections={sectionDefs.map((s) => ({ id: s.id, label: s.label }))} isRTL={isRTL} showHint={revealed} />
          {hasBackgroundMusic && <FloatingMusicButton playing={musicPlaying} onToggle={toggleMusic} isRTL={isRTL} />}
          <FloatingCalendarButton event={event} isRTL={isRTL} />
        </>
      )}
    </LiteralThemeProvider>
  );
}
