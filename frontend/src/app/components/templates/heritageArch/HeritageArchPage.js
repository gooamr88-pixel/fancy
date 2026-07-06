'use client';

import React from 'react';
import SnapShell from './SnapShell';
import { HERITAGE_ARCH_DEFAULTS as D } from './defaultContent';
import HeroSection from './sections/HeroSection';
import CountdownSection from './sections/CountdownSection';
import ScheduleSection from './sections/ScheduleSection';
import VenuesSection from './sections/VenuesSection';
import DressCodeSection from './sections/DressCodeSection';
import OurStorySection from './sections/OurStorySection';
import AccommodationSection from './sections/AccommodationSection';
import FaqSection from './sections/FaqSection';
import GallerySection from './sections/GallerySection';
import InvitedToSection from './sections/InvitedToSection';
import RsvpSection from './sections/RsvpSection';

function formatDateLine(startISO, endISO, isRTL) {
  if (!startISO) return null;
  const locale = isRTL ? 'ar-EG' : 'en-US';
  const opts = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  const start = new Date(startISO).toLocaleDateString(locale, opts).toUpperCase();
  if (!endISO) return start;
  const end = new Date(endISO).toLocaleDateString(locale, opts).toUpperCase();
  return `${start} - ${end}`;
}

function parseMealOptions(raw) {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return D.mealOptions;
}

export default function HeritageArchPage({
  event, guestRsvp, lang, setLang, isRTL, t, timeLeft, musicPlaying, toggleMusic,
  hasBackgroundMusic, hasResponded, responseStatus, allowGuestEdits, slug, effectiveRsvpId, trackEvent,
}) {
  const td = event.template_data || {};
  const customColors = event.custom_colors || {};

  const partner1 = td.groom_name || td.partner1Name || td.partner1 || D.partner1;
  const partner2 = td.bride_name || td.partner2Name || td.partner2 || D.partner2;
  const dateLine = formatDateLine(event.event_date, event.event_end_date, isRTL);

  const venueDay1 = {
    name: td.ha_venue_day1_name || td.ceremony_venue_name || event.location_name || D.venues.day1.name,
    address: td.ha_venue_day1_address || td.ceremony_venue_address || event.location_address || D.venues.day1.address,
    lat: td.ha_venue_day1_lat ?? td.ceremony_lat ?? event.location_lat ?? D.venues.day1.lat,
    lng: td.ha_venue_day1_lng ?? td.ceremony_lng ?? event.location_lng ?? D.venues.day1.lng,
    image: td.ha_venue_day1_image || event.cover_image_url || null,
  };
  const venueDay2 = {
    name: td.ha_venue_day2_name || td.reception_venue_name || D.venues.day2.name,
    address: td.ha_venue_day2_address || td.reception_venue_address || D.venues.day2.address,
    lat: td.ha_venue_day2_lat ?? td.reception_lat ?? D.venues.day2.lat,
    lng: td.ha_venue_day2_lng ?? td.reception_lng ?? D.venues.day2.lng,
    image: td.ha_venue_day2_image || null,
  };

  const schedule = {
    day1: Array.isArray(td.ha_schedule_day1) && td.ha_schedule_day1.length > 0 ? td.ha_schedule_day1 : D.schedule.day1,
    day2: Array.isArray(td.ha_schedule_day2) && td.ha_schedule_day2.length > 0 ? td.ha_schedule_day2 : D.schedule.day2,
  };

  // Structured ha_accommodation (this template's own list editor) wins; the
  // plain-text `accommodations` field organizers may have already filled in
  // via the shared wedding-schema wizard step is shown as a fallback note
  // rather than silently dropped; only then does the demo default appear.
  const hasStructuredAccommodation = Array.isArray(td.ha_accommodation) && td.ha_accommodation.length > 0;
  const accommodation = hasStructuredAccommodation ? td.ha_accommodation : D.accommodation;
  const accommodationNote = !hasStructuredAccommodation ? (td.accommodations || null) : null;
  const faq = Array.isArray(td.ha_faq) && td.ha_faq.length > 0 ? td.ha_faq : D.faq;
  const ourStory = td.ha_our_story || td.loveStory || D.ourStory;
  const invitedToCity = td.ha_invited_to_city || (event.location_name ? event.location_name.split(',')[0] : D.invitedToCity);
  const mealOptions = parseMealOptions(td.ha_meal_options);
  const galleryImages = Array.isArray(event.gallery_urls) && event.gallery_urls.length > 0 ? event.gallery_urls : D.galleryImages;
  const dressCodeSwatches = [customColors.primary, customColors.secondary].filter(Boolean);

  const sections = [
    {
      id: 'ha-hero',
      content: (
        <HeroSection
          partner1={partner1} partner2={partner2} tagline={D.tagline} dateLine={dateLine}
          coverImageUrl={event.cover_image_url || D.coverImageUrl} isRTL={isRTL} t={t}
        />
      ),
    },
    { id: 'ha-countdown', content: <CountdownSection timeLeft={timeLeft} isRTL={isRTL} /> },
    { id: 'ha-schedule', content: <ScheduleSection schedule={schedule} isRTL={isRTL} /> },
    { id: 'ha-venues', content: <VenuesSection venues={{ day1: venueDay1, day2: venueDay2 }} isRTL={isRTL} t={t} /> },
    { id: 'ha-dresscode', content: <DressCodeSection dressCode={event.dress_code || D.dressCode} colors={{ swatches: dressCodeSwatches }} isRTL={isRTL} /> },
    { id: 'ha-story', content: <OurStorySection story={ourStory} isRTL={isRTL} /> },
    { id: 'ha-accommodation', content: <AccommodationSection hotels={accommodation} note={accommodationNote} isRTL={isRTL} /> },
    { id: 'ha-faq', content: <FaqSection items={faq} isRTL={isRTL} /> },
  ];

  if (galleryImages.length > 0) {
    sections.push({ id: 'ha-gallery', content: <GallerySection images={galleryImages} isRTL={isRTL} /> });
  }

  sections.push(
    { id: 'ha-invited', content: <InvitedToSection city={invitedToCity} lat={venueDay1.lat} lng={venueDay1.lng} isRTL={isRTL} /> },
    {
      id: 'ha-rsvp',
      content: (
        <RsvpSection
          event={event} slug={slug} guestRsvp={guestRsvp} hasResponded={hasResponded}
          responseStatus={responseStatus} allowGuestEdits={allowGuestEdits} effectiveRsvpId={effectiveRsvpId}
          mealOptions={mealOptions} isRTL={isRTL} trackEvent={trackEvent}
        />
      ),
    },
  );

  return (
    <SnapShell
      sections={sections}
      lang={lang}
      setLang={setLang}
      isRTL={isRTL}
      musicPlaying={musicPlaying}
      toggleMusic={toggleMusic}
      hasBackgroundMusic={hasBackgroundMusic}
    />
  );
}
