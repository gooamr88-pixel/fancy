'use client';

import React from 'react';
import SnapShell from './SnapShell';
import { FullPageThemeProvider, buildPalette } from './theme';
import { HERITAGE_ARCH_DEFAULTS as D } from './defaultContent';
import { getHaDays } from '../../../utils/haDays';
import HeroSection from './sections/HeroSection';
import CoverPhotoSection from './sections/CoverPhotoSection';
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

// Event time — separate from the date line so a multi-day range (which already
// reads as "START - END") never has a single time awkwardly glued onto it.
function formatTimeLine(startISO, isRTL) {
  if (!startISO) return null;
  const d = new Date(startISO);
  // A bare DATE-only value (no clock component supplied at creation) serializes
  // to local midnight — showing "12:00 AM" for those would read as a real start
  // time instead of "no time set," so this is intentionally hidden then.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return null;
  return d.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

function parseMealOptions(raw, isPreview) {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return isPreview ? D.mealOptions : [];
}

export default function HeritageArchPage({
  event, guestRsvp, lang, setLang, isRTL, t, timeLeft, musicPlaying, toggleMusic,
  hasBackgroundMusic, hasResponded, responseStatus, allowGuestEdits, slug, effectiveRsvpId, trackEvent,
  invitationPattern, invitationTheme, invitationGuestName, invitationData,
  isPreview = false,
}) {
  const td = event.template_data || {};
  const customColors = event.custom_colors || {};
  // Explicit per-section on/off, set by the organizer in Stage 2's "Sections"
  // panel. Defaults to true (unset === shown) so existing events — which never
  // set this — keep their current auto-hide-when-empty behavior; an organizer
  // can still force a section off even when it has content.
  const enabledSections = td.enabledSections || {};
  const sectionOn = (key) => enabledSections[key] !== false;
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
  // Only shown for a single-day event — a start/end range already reads as a
  // full span, and gluing one clock time onto it would misleadingly imply
  // the whole range starts then.
  const timeLine = !event.event_end_date ? formatTimeLine(event.event_date, isRTL) : null;

  // Custom's "what kind of event is this?" category (Stage 2) drives the hero
  // name/tagline for the two categories with no "couple" — wedding/engagement
  // categories already work via partner1/partner2 above. Both fall back to
  // the event's own title when the organizer hasn't named a celebrant/parents
  // yet, exactly like every other template does.
  const customCategory = event.template_type === 'custom' ? (td.custom_category || '') : '';
  const heroTitle = customCategory === 'celebration' ? (td.custom_honoree || event.title)
    : customCategory === 'babyShower' ? (td.custom_parents || event.title)
    : event.title;
  // Arabic override typed in the wizard/EventSettings — same field the classic
  // template's InvitationCard and InvitationReveal envelope already read; this
  // full-page hero was the one place still stuck on the English title/dress
  // code even with the page switched to Arabic.
  const titleAr = event.title_ar || td.title_ar || null;
  const heroTagline = customCategory === 'celebration'
    ? (td.custom_milestone || (isRTL ? 'يسعدنا احتفالنا معكم' : 'Join us to celebrate'))
    : customCategory === 'babyShower'
    ? (td.custom_baby_name ? (isRTL ? `نستقبل قدوم ${td.custom_baby_name}` : `Welcoming ${td.custom_baby_name}`) : (td.custom_baby_due || (isRTL ? 'ينتظرنا مولود جديد' : "We're expecting!")))
    : '';

  // A flexible list of days — one for a single-day event, two, three, or
  // more — each with its own venue and schedule. Falls back to the older
  // fixed day1/day2 fields for events saved before this was dynamic, then to
  // the plain ceremony/location fields, then (preview only) to demo content,
  // so every event still shows something reasonable.
  let haDays = getHaDays(td);
  if (haDays.length === 0 && isPreview) {
    haDays = [
      { label: 'Day 1', schedule: D.schedule.day1, venue: { name: D.venues.day1.name, address: D.venues.day1.address, lat: D.venues.day1.lat, lng: D.venues.day1.lng, image: null } },
      { label: 'Day 2', schedule: D.schedule.day2, venue: { name: D.venues.day2.name, address: D.venues.day2.address, lat: D.venues.day2.lat, lng: D.venues.day2.lng, image: null } },
    ];
  }
  if (haDays.length === 0 && !isPreview) {
    const fallbackVenue = {
      name: td.ceremony_venue_name || event.location_name || '',
      address: td.ceremony_venue_address || event.location_address || '',
      lat: td.ceremony_lat ?? event.location_lat ?? null,
      lng: td.ceremony_lng ?? event.location_lng ?? null,
      image: event.cover_image_url || null,
    };
    if (fallbackVenue.name || fallbackVenue.address) {
      haDays = [{ label: '', schedule: [], venue: fallbackVenue }];
    }
  }
  const primaryVenue = haDays[0]?.venue || {};
  const hasVenues = haDays.some((d) => d.venue?.name || d.venue?.address);
  const hasSchedule = haDays.some((d) => Array.isArray(d.schedule) && d.schedule.length > 0);

  // Structured ha_accommodation (this template's own list editor) wins; the
  // plain-text `accommodations` field organizers may have already filled in
  // via the shared wedding-schema wizard step is shown as a fallback note.
  const hasStructuredAccommodation = Array.isArray(td.ha_accommodation) && td.ha_accommodation.length > 0;
  const accommodation = hasStructuredAccommodation ? td.ha_accommodation : (isPreview ? D.accommodation : []);
  const accommodationNote = !hasStructuredAccommodation ? (td.accommodations || null) : null;
  const hasAccommodation = accommodation.length > 0 || !!accommodationNote;

  const faq = Array.isArray(td.ha_faq) && td.ha_faq.length > 0 ? td.ha_faq : (isPreview ? D.faq : []);
  const hasFaq = faq.length > 0;
  const ourStory = td.ha_our_story || td.loveStory || td.proposalStory || demo(D.ourStory) || '';
  const dressCode = (isRTL && td.dress_code_ar) || event.dress_code || demo(D.dressCode) || '';
  const invitedToCity = td.ha_invited_to_city || (event.location_name ? event.location_name.split(',')[0] : (isPreview ? D.invitedToCity : ''));
  // The map pin uses the city's own coordinates when the organizer picked one
  // via the address search (ha_invited_to_lat/lng); only falls back to Day 1's
  // venue when no city coordinates were ever captured, so a custom "invited to"
  // city never shows a pin sitting on a different, unrelated location.
  const invitedToLat = td.ha_invited_to_lat ?? primaryVenue.lat;
  const invitedToLng = td.ha_invited_to_lng ?? primaryVenue.lng;
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

  // Sections are assembled Hero + Countdown (+ Cover Photo) first, RSVP last —
  // both fixed anchors. Every content section in between is keyed by the same
  // SECTION_TOGGLES key Stage 2's "Sections" panel uses, built only when it
  // has real data (or in preview) — same pattern as Gallery — then reordered
  // by the organizer's saved sectionOrder (see the ↑/↓ arrangement controls),
  // falling back to this default order for anyone who never touched it.
  const middleSections = {};
  if (hasSchedule && sectionOn('schedule')) {
    middleSections.schedule = { id: 'ha-schedule', content: <ScheduleSection days={haDays} isRTL={isRTL} /> };
  }
  if (hasVenues && sectionOn('venues')) {
    middleSections.venues = { id: 'ha-venues', content: <VenuesSection days={haDays} isRTL={isRTL} t={t} /> };
  }
  if (dressCode && sectionOn('dresscode')) {
    middleSections.dresscode = { id: 'ha-dresscode', content: <DressCodeSection dressCode={dressCode} colors={{ swatches: dressCodeSwatches }} isRTL={isRTL} /> };
  }
  if (ourStory && sectionOn('story')) {
    middleSections.story = { id: 'ha-story', content: <OurStorySection story={ourStory} isRTL={isRTL} /> };
  }
  if (hasAccommodation && sectionOn('accommodation')) {
    middleSections.accommodation = { id: 'ha-accommodation', content: <AccommodationSection hotels={accommodation} note={accommodationNote} isRTL={isRTL} /> };
  }
  if (menuCourses.length > 0 && sectionOn('menu')) {
    middleSections.menu = { id: 'ha-menu', content: <MenuSection courses={menuCourses} isRTL={isRTL} /> };
  }
  if (hasGiftList && sectionOn('giftlist')) {
    middleSections.giftlist = { id: 'ha-giftlist', content: <GiftListSection registryUrl={giftRegistry} registryLabel={td.ha_gift_registry_label} bank={giftBank} message={td.ha_gift_message} isRTL={isRTL} /> };
  }
  if (hasFaq && sectionOn('faq')) {
    middleSections.faq = { id: 'ha-faq', content: <FaqSection items={faq} isRTL={isRTL} /> };
  }
  if (galleryImages.length > 0 && sectionOn('gallery')) {
    middleSections.gallery = { id: 'ha-gallery', content: <GallerySection images={galleryImages} isRTL={isRTL} /> };
  }
  if (invitedToCity && sectionOn('invited')) {
    middleSections.invited = { id: 'ha-invited', content: <InvitedToSection city={invitedToCity} lat={invitedToLat} lng={invitedToLng} isRTL={isRTL} /> };
  }
  if (event.event_date && invitedToCity && sectionOn('boarding')) {
    middleSections.boarding = { id: 'ha-boarding', content: <BoardingPassSection destination={invitedToCity} dateISO={event.event_date} initials={boardingInitials} flightCode={td.ha_boarding_flight_code} isRTL={isRTL} /> };
  }
  if (thingsToDo.length > 0 && sectionOn('thingstodo')) {
    middleSections.thingstodo = { id: 'ha-thingstodo', content: <ThingsToDoSection items={thingsToDo} isRTL={isRTL} /> };
  }
  if (gettingThere.trim() && sectionOn('gettingthere')) {
    middleSections.gettingthere = { id: 'ha-gettingthere', content: <GettingThereSection text={gettingThere} isRTL={isRTL} /> };
  }

  const DEFAULT_SECTION_ORDER = ['schedule', 'venues', 'dresscode', 'story', 'accommodation', 'menu', 'giftlist', 'faq', 'gallery', 'invited', 'boarding', 'thingstodo', 'gettingthere'];
  const savedOrder = Array.isArray(td.sectionOrder) ? td.sectionOrder : [];
  const resolvedOrder = [
    ...savedOrder.filter((k) => middleSections[k]),
    ...DEFAULT_SECTION_ORDER.filter((k) => middleSections[k] && !savedOrder.includes(k)),
  ];

  const sections = [
    {
      id: 'ha-hero',
      content: (
        <HeroSection
          partner1={partner1} partner2={partner2} title={heroTitle}
          tagline={isPreview ? D.tagline : heroTagline} dateLine={dateLine} timeLine={timeLine} titleAr={titleAr}
          invitationPattern={invitationPattern} invitationTheme={invitationTheme}
          invitationGuestName={invitationGuestName} invitationData={invitationData}
          isRTL={isRTL} t={t}
        />
      ),
    },
    { id: 'ha-countdown', content: <CountdownSection timeLeft={timeLeft} isRTL={isRTL} /> },
  ];

  // The cover photo, now that the template card is the hero centerpiece, gets
  // its own framed slide — shown only when the organizer uploaded one.
  if (event.cover_image_url) {
    sections.push({ id: 'ha-cover-photo', content: <CoverPhotoSection imageUrl={event.cover_image_url} isRTL={isRTL} /> });
  }

  for (const key of resolvedOrder) {
    sections.push(middleSections[key]);
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
