'use client';

import React from 'react';
import SnapShell from './SnapShell';
import { FullPageThemeProvider, buildPalette } from './theme';
import { HERITAGE_ARCH_DEFAULTS as D } from './defaultContent';
import HeroSection from './sections/HeroSection';
import CountdownSection from './sections/CountdownSection';
import ScheduleSection from './sections/ScheduleSection';
import VenuesSection from './sections/VenuesSection';
import DressCodeSection from './sections/DressCodeSection';
import OurStorySection from './sections/OurStorySection';
import AccommodationSection from './sections/AccommodationSection';
import MenuSection from './sections/MenuSection';
import GiftListSection from './sections/GiftListSection';
import FaqSection from './sections/FaqSection';
import GallerySection from './sections/GallerySection';
import InvitedToSection from './sections/InvitedToSection';
import BoardingPassSection from './sections/BoardingPassSection';
import ThingsToDoSection from './sections/ThingsToDoSection';
import GettingThereSection from './sections/GettingThereSection';
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

function parseMealOptions(raw, isPreview) {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return isPreview ? D.mealOptions : [];
}

export default function HeritageArchPage({
  event, guestRsvp, lang, setLang, isRTL, t, timeLeft, musicPlaying, toggleMusic,
  hasBackgroundMusic, hasResponded, responseStatus, allowGuestEdits, slug, effectiveRsvpId, trackEvent,
  isPreview = false,
}) {
  const td = event.template_data || {};
  const customColors = event.custom_colors || {};
  // Derived section palette — Heritage Arch returns its own fixed burgundy/cream
  // constants (guarded in buildPalette); every other template gets a palette
  // derived from its custom_colors so the same sections recolor per event.
  const palette = buildPalette(customColors, event.template_type);
  // In preview/demo contexts the template shows curated demo content so it
  // always previews as a complete page; for REAL guests, unfilled sections
  // gracefully hide instead of showing placeholder data (fake hotels/story/etc).
  const demo = (value) => (isPreview ? value : null);

  const partner1 = td.groom_name || td.partner1Name || td.partner1 || demo(D.partner1) || '';
  const partner2 = td.bride_name || td.partner2Name || td.partner2 || demo(D.partner2) || '';
  const dateLine = formatDateLine(event.event_date, event.event_end_date, isRTL);

  const venueDay1 = {
    name: td.ha_venue_day1_name || td.ceremony_venue_name || event.location_name || demo(D.venues.day1.name) || '',
    address: td.ha_venue_day1_address || td.ceremony_venue_address || event.location_address || demo(D.venues.day1.address) || '',
    lat: td.ha_venue_day1_lat ?? td.ceremony_lat ?? event.location_lat ?? (isPreview ? D.venues.day1.lat : null),
    lng: td.ha_venue_day1_lng ?? td.ceremony_lng ?? event.location_lng ?? (isPreview ? D.venues.day1.lng : null),
    image: td.ha_venue_day1_image || event.cover_image_url || null,
  };
  const venueDay2 = {
    name: td.ha_venue_day2_name || td.reception_venue_name || demo(D.venues.day2.name) || '',
    address: td.ha_venue_day2_address || td.reception_venue_address || demo(D.venues.day2.address) || '',
    lat: td.ha_venue_day2_lat ?? td.reception_lat ?? (isPreview ? D.venues.day2.lat : null),
    lng: td.ha_venue_day2_lng ?? td.reception_lng ?? (isPreview ? D.venues.day2.lng : null),
    image: td.ha_venue_day2_image || null,
  };
  const hasVenues = !!(venueDay1.name || venueDay1.address || venueDay2.name || venueDay2.address);

  const scheduleDay1 = Array.isArray(td.ha_schedule_day1) && td.ha_schedule_day1.length > 0 ? td.ha_schedule_day1 : (isPreview ? D.schedule.day1 : []);
  const scheduleDay2 = Array.isArray(td.ha_schedule_day2) && td.ha_schedule_day2.length > 0 ? td.ha_schedule_day2 : (isPreview ? D.schedule.day2 : []);
  const schedule = { day1: scheduleDay1, day2: scheduleDay2 };
  const hasSchedule = scheduleDay1.length > 0 || scheduleDay2.length > 0;

  // Structured ha_accommodation (this template's own list editor) wins; the
  // plain-text `accommodations` field organizers may have already filled in
  // via the shared wedding-schema wizard step is shown as a fallback note.
  const hasStructuredAccommodation = Array.isArray(td.ha_accommodation) && td.ha_accommodation.length > 0;
  const accommodation = hasStructuredAccommodation ? td.ha_accommodation : (isPreview ? D.accommodation : []);
  const accommodationNote = !hasStructuredAccommodation ? (td.accommodations || null) : null;
  const hasAccommodation = accommodation.length > 0 || !!accommodationNote;

  const faq = Array.isArray(td.ha_faq) && td.ha_faq.length > 0 ? td.ha_faq : (isPreview ? D.faq : []);
  const hasFaq = faq.length > 0;
  const ourStory = td.ha_our_story || td.loveStory || demo(D.ourStory) || '';
  const dressCode = event.dress_code || demo(D.dressCode) || '';
  const invitedToCity = td.ha_invited_to_city || (event.location_name ? event.location_name.split(',')[0] : (isPreview ? D.invitedToCity : ''));
  // The map pin uses the city's own coordinates when the organizer picked one
  // via the address search (ha_invited_to_lat/lng); only falls back to Day 1's
  // venue when no city coordinates were ever captured, so a custom "invited to"
  // city never shows a pin sitting on a different, unrelated location.
  const invitedToLat = td.ha_invited_to_lat ?? venueDay1.lat;
  const invitedToLng = td.ha_invited_to_lng ?? venueDay1.lng;
  const mealOptions = parseMealOptions(td.ha_meal_options, isPreview);
  const galleryImages = Array.isArray(event.gallery_urls) && event.gallery_urls.length > 0 ? event.gallery_urls : [];
  const dressCodeSwatches = [customColors.primary, customColors.secondary].filter(Boolean);
  const giftRegistry = td.registryUrl || td.giftRegistry || null;

  // ── New sections (Phase 1): all graceful-hide when their data is empty ──
  const menuCourses = Array.isArray(td.ha_menu_courses) ? td.ha_menu_courses : [];
  const thingsToDo = Array.isArray(td.ha_things_to_do) ? td.ha_things_to_do : [];
  const gettingThere = td.ha_getting_there || '';
  const giftBank = {
    name: td.ha_gift_bank_name || '',
    accountName: td.ha_gift_account_name || '',
    iban: td.ha_gift_iban || '',
  };
  const hasGiftList = !!(giftRegistry || giftBank.name || giftBank.iban);
  // Boarding-pass values are auto-derived from the event — no organizer input
  // required beyond an optional flight-code override.
  const boardingInitials = [partner1, partner2]
    .map((n) => (n ? n.trim().charAt(0).toUpperCase() : ''))
    .filter(Boolean)
    .join('♡') || null;

  // Sections are assembled in the reference screenshots' order. New sections
  // (Menu, Gift List, Boarding Pass, Things to Do, Getting There) are pushed
  // conditionally — same pattern as Gallery — so an empty one never leaves a
  // blank full-viewport slide (and a dead dot in the side nav).
  // Hero + Countdown + RSVP always render; every content section in between is
  // pushed only when it has real data (or in preview), so an unconfigured event
  // shows a clean short page instead of blank slides or placeholder content.
  const sections = [
    {
      id: 'ha-hero',
      content: (
        <HeroSection
          partner1={partner1} partner2={partner2} title={event.title}
          tagline={isPreview ? D.tagline : ''} dateLine={dateLine}
          coverImageUrl={event.cover_image_url || D.coverImageUrl} isRTL={isRTL} t={t}
        />
      ),
    },
    { id: 'ha-countdown', content: <CountdownSection timeLeft={timeLeft} isRTL={isRTL} /> },
  ];

  if (hasSchedule) {
    sections.push({ id: 'ha-schedule', content: <ScheduleSection schedule={schedule} isRTL={isRTL} /> });
  }
  if (hasVenues) {
    sections.push({ id: 'ha-venues', content: <VenuesSection venues={{ day1: venueDay1, day2: venueDay2 }} isRTL={isRTL} t={t} /> });
  }
  if (dressCode) {
    sections.push({ id: 'ha-dresscode', content: <DressCodeSection dressCode={dressCode} colors={{ swatches: dressCodeSwatches }} isRTL={isRTL} /> });
  }
  if (ourStory) {
    sections.push({ id: 'ha-story', content: <OurStorySection story={ourStory} isRTL={isRTL} /> });
  }
  if (hasAccommodation) {
    sections.push({ id: 'ha-accommodation', content: <AccommodationSection hotels={accommodation} note={accommodationNote} isRTL={isRTL} /> });
  }
  if (menuCourses.length > 0) {
    sections.push({ id: 'ha-menu', content: <MenuSection courses={menuCourses} isRTL={isRTL} /> });
  }
  if (hasGiftList) {
    sections.push({ id: 'ha-giftlist', content: <GiftListSection registryUrl={giftRegistry} registryLabel={td.ha_gift_registry_label} bank={giftBank} message={td.ha_gift_message} isRTL={isRTL} /> });
  }
  if (hasFaq) {
    sections.push({ id: 'ha-faq', content: <FaqSection items={faq} isRTL={isRTL} /> });
  }
  if (galleryImages.length > 0) {
    sections.push({ id: 'ha-gallery', content: <GallerySection images={galleryImages} isRTL={isRTL} /> });
  }
  if (invitedToCity) {
    sections.push({ id: 'ha-invited', content: <InvitedToSection city={invitedToCity} lat={invitedToLat} lng={invitedToLng} isRTL={isRTL} /> });
  }
  if (event.event_date && invitedToCity) {
    sections.push({ id: 'ha-boarding', content: <BoardingPassSection destination={invitedToCity} dateISO={event.event_date} initials={boardingInitials} flightCode={td.ha_boarding_flight_code} isRTL={isRTL} /> });
  }
  if (thingsToDo.length > 0) {
    sections.push({ id: 'ha-thingstodo', content: <ThingsToDoSection items={thingsToDo} isRTL={isRTL} /> });
  }
  if (gettingThere.trim()) {
    sections.push({ id: 'ha-gettingthere', content: <GettingThereSection text={gettingThere} isRTL={isRTL} /> });
  }

  sections.push({
    id: 'ha-rsvp',
    content: (
      <RsvpSection
        event={event} slug={slug} guestRsvp={guestRsvp} hasResponded={hasResponded}
        responseStatus={responseStatus} allowGuestEdits={allowGuestEdits} effectiveRsvpId={effectiveRsvpId}
        mealOptions={mealOptions} isRTL={isRTL} trackEvent={trackEvent}
      />
    ),
  });

  return (
    <FullPageThemeProvider palette={palette}>
      <SnapShell
        sections={sections}
        lang={lang}
        setLang={setLang}
        isRTL={isRTL}
        musicPlaying={musicPlaying}
        toggleMusic={toggleMusic}
        hasBackgroundMusic={hasBackgroundMusic}
      />
    </FullPageThemeProvider>
  );
}
