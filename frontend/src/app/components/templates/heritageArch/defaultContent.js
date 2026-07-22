/* Heritage Arch — fallback/demo content.
   Shown whenever the organizer hasn't filled in a given field yet, so the
   template always previews as a complete page (picker preview, first-run
   editing) instead of half-empty placeholders. Every value here is overridden
   by real event/template_data fields the moment the organizer sets them. */

export const HERITAGE_ARCH_DEFAULTS = {
  partner1: 'Mohammed',
  partner2: 'Leila',
  tagline: 'We are getting married',
  coverImageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=2069',
  dressCode: 'Semi-Formal',
  ourStory: "In the city of Oakhaven, where the rain always seemed to smell like cedar and wet pavement, Elias ran a shop that sold \"nearly-dead\" clocks. He didn't fix them to be perfect; he fixed them to keep their character. Some ticked with a slight limp, others chimed a note too flat, but Elias loved them for their stubbornness.",
  invitedToCity: 'Miami',
  mealOptions: ['Caviar', 'Fish'],
  schedule: {
    day1: [
      { time: '14:00', label: 'Lunch', icon: 'plate' },
      { time: '18:00', label: 'Ceremony', icon: 'rings' },
      { time: '22:00', label: 'Party', icon: 'ornament' },
      { time: '02:00', label: 'End', icon: 'ornament' },
    ],
    day2: [
      { time: '14:00', label: 'Lunch', icon: 'watch' },
      { time: '20:00', label: 'Wedding', icon: 'watch' },
      { time: '22:00', label: 'Party', icon: 'watch' },
      { time: '02:00', label: 'End', icon: 'watch' },
    ],
  },
  venues: {
    day1: {
      name: 'Oceanfront Beach House',
      address: 'South Dixie Highway, Homestead, Miami-Dade County, Florida, 33030, United States',
      lat: 25.4687,
      lng: -80.4776,
    },
    day2: {
      name: 'The Grand Castle',
      address: 'Schijnpoortweg 137',
      lat: 51.2372,
      lng: 4.4225,
    },
  },
  accommodation: [
    {
      name: 'Hotel Costa',
      description: 'You can book directly with the link below for a discount',
      price: '$4,100',
      imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070',
      link: '',
    },
  ],
  faq: [
    { question: 'Can I bring my Children?', answer: "We love your little ones, but this celebration is an adults-only event. We hope you understand and can arrange childcare for the evening." },
    { question: "What's the best way to get there?", answer: 'We recommend driving or booking a rideshare. Parking and directions are available on the Venues section above.' },
    { question: 'Can I bring a plus one?', answer: 'Please refer to your invitation — it will indicate whether a plus one is included. If you have questions, reach out to us directly.' },
    { question: 'Is there parking nearby?', answer: 'Yes, complimentary parking is available on-site for all guests.' },
  ],
  galleryImages: [],
};

export const HERITAGE_ARCH_COLORS = {
  background: '#F7F1E4',
  paper: '#EDE4D0',
  ink: '#3A2A22',
  maroon: '#6B1B2A',
  maroonDeep: '#4A1420',
  gold: '#8A7A4A',
  border: 'rgba(107,27,42,0.18)',
  cream: '#FFFCF6',
  // Hand-picked maroon is already dark enough for white/cream button text —
  // see buildPalette's solidFill for why derived (non-heritageArch) palettes
  // need a separately-computed value here instead of reusing maroon directly.
  solidFill: '#6B1B2A',
  solidFillDeep: '#4A1420',
};
