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
// These eight sections were never part of the Tilda reference file, so
// there's no "literal design" to port for them — reusing the existing,
// already-correct heritageArch components (wrapped in their own theme
// provider so they recolor to this event's palette) avoids rebuilding
// working content sections from scratch, and is what keeps this switch from
// silently dropping Gallery/FAQ/Accommodation/Menu/Gift List/Things To Do/
// Getting There/Invited-To-City content organizers already filled in.
import { FullPageThemeProvider, buildPalette } from '../heritageArch/theme';
import GallerySection from '../heritageArch/sections/GallerySection';
import FaqSection from '../heritageArch/sections/FaqSection';
import AccommodationSection from '../heritageArch/sections/AccommodationSection';
import MenuSection from '../heritageArch/sections/MenuSection';
import GiftListSection from '../heritageArch/sections/GiftListSection';
import ThingsToDoSection from '../heritageArch/sections/ThingsToDoSection';
import GettingThereSection from '../heritageArch/sections/GettingThereSection';
import InvitedToSection from '../heritageArch/sections/InvitedToSection';

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

  // Same heritageArch palette every one of these eight sections already
  // renders correctly with — not this page's own gold/glass literal palette,
  // which they were never designed against.
  const haStylePalette = useMemo(() => buildPalette(event?.custom_colors, event?.template_type), [event?.custom_colors, event?.template_type]);
  const wrapHa = (node) => <FullPageThemeProvider palette={haStylePalette}>{node}</FullPageThemeProvider>;

  const galleryImages = Array.isArray(event?.gallery_urls) ? event.gallery_urls : [];
  const faq = Array.isArray(td.ha_faq) ? td.ha_faq : [];
  const hasStructuredAccommodation = Array.isArray(td.ha_accommodation) && td.ha_accommodation.length > 0;
  const accommodation = hasStructuredAccommodation ? td.ha_accommodation : [];
  const accommodationNote = !hasStructuredAccommodation ? (td.accommodations || null) : null;
  const hasAccommodation = accommodation.length > 0 || !!accommodationNote;
  const menuCourses = Array.isArray(td.ha_menu_courses) ? td.ha_menu_courses : [];
  const thingsToDo = Array.isArray(td.ha_things_to_do) ? td.ha_things_to_do : [];
  const gettingThere = td.ha_getting_there || '';
  const giftRegistry = td.registryUrl || td.giftRegistry || null;
  const giftBank = { name: td.ha_gift_bank_name || '', accountName: td.ha_gift_account_name || '', iban: td.ha_gift_iban || '' };
  const hasGiftList = !!(giftRegistry || giftBank.name || giftBank.iban);
  // Same product decision HeritageArchPage already makes: Wedding/Engagement
  // show full venue details elsewhere, so a same-city "Invited To" pin would
  // be redundant there — only shown for Custom Canvas couple events.
  const isWeddingOrEngagement = event?.template_type === 'wedding' || event?.template_type === 'engagement';
  const invitedToCity = td.ha_invited_to_city || (event?.location_name ? event.location_name.split(',')[0] : '');
  const invitedToLat = td.ha_invited_to_lat ?? primaryVenue.lat;
  const invitedToLng = td.ha_invited_to_lng ?? primaryVenue.lng;

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
    (invitedToCity && !isWeddingOrEngagement) ? { id: 'ccs-invited', label: isRTL ? 'المدينة' : 'Invited To', content: wrapHa(
      <InvitedToSection city={invitedToCity} lat={invitedToLat} lng={invitedToLng} isRTL={isRTL} />
    ) } : null,
    hasAccommodation ? { id: 'ccs-accommodation', label: isRTL ? 'الإقامة' : 'Accommodation', content: wrapHa(
      <AccommodationSection hotels={accommodation} note={accommodationNote} isRTL={isRTL} />
    ) } : null,
    gettingThere.trim() ? { id: 'ccs-gettingthere', label: isRTL ? 'الوصول' : 'Getting There', content: wrapHa(
      <GettingThereSection text={gettingThere} isRTL={isRTL} />
    ) } : null,
    thingsToDo.length > 0 ? { id: 'ccs-thingstodo', label: isRTL ? 'أنشطة' : 'Things To Do', content: wrapHa(
      <ThingsToDoSection items={thingsToDo} isRTL={isRTL} />
    ) } : null,
    menuCourses.length > 0 ? { id: 'ccs-menu', label: isRTL ? 'القائمة' : 'Menu', content: wrapHa(
      <MenuSection courses={menuCourses} isRTL={isRTL} />
    ) } : null,
    hasGiftList ? { id: 'ccs-giftlist', label: isRTL ? 'الهدايا' : 'Gift List', content: wrapHa(
      <GiftListSection registryUrl={giftRegistry} registryLabel={td.ha_gift_registry_label} bank={giftBank} message={td.ha_gift_message} isRTL={isRTL} />
    ) } : null,
    faq.length > 0 ? { id: 'ccs-faq', label: isRTL ? 'أسئلة' : 'FAQ', content: wrapHa(
      <FaqSection items={faq} isRTL={isRTL} />
    ) } : null,
    galleryImages.length > 0 ? { id: 'ccs-gallery', label: isRTL ? 'معرض الصور' : 'Gallery', content: wrapHa(
      <GallerySection images={galleryImages} isRTL={isRTL} />
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
