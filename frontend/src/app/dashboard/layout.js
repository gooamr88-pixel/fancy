'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import ImpersonationBanner from '../components/ImpersonationBanner';
import DashboardNav from './components/DashboardNav';
import { OrganizerClockProvider } from './components/OrganizerClock';

/**
 * Shared chrome for every /dashboard/* route.
 *
 * ── Why the navigation moved here ──
 *
 * It used to be markup inside dashboard/page.js. Four of its own items navigate
 * to other routes, and those routes rendered with no sidebar — so pressing a
 * navigation item was how an organizer lost the navigation, and the only way
 * back was the browser's back button. Rendering it from the layout means it
 * survives navigating between sections, which is the entire point of a sidebar.
 *
 * ── The two pages that deliberately have no chrome ──
 *
 * `create-event` is a linear wizard. A sidebar there is an invitation to abandon
 * a half-created event mid-flow, and the wizard already owns its own exit.
 *
 * `seating-map` is a full-bleed drag-and-drop canvas whose usable area is the
 * whole viewport; surrendering 240px of it to navigation would cost more than it
 * returns. Both keep their existing back-links.
 *
 * These are product decisions, not technical limits — hence the explicit list
 * rather than an inverted "pages that opt in", so adding a new dashboard page
 * gets the navigation by default and losing it has to be a choice somebody makes
 * on purpose.
 */
const NO_CHROME = ['/dashboard/create-event', '/dashboard/seating-map'];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const bare = NO_CHROME.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  /* The organizer's clock wraps BOTH branches, including the bare one.
     `create-event` and `seating-map` opt out of the sidebar, not out of
     knowing what time it is — and the seating chart's printed header is one of
     the surfaces that needs it. Putting the provider inside the chromed branch
     only would have left exactly those two pages reading the platform default,
     which is the kind of gap that looks fine until an organizer abroad prints a
     seating chart dated the wrong day. */
  if (bare) {
    return (
      <OrganizerClockProvider>
        <ImpersonationBanner />
        {children}
      </OrganizerClockProvider>
    );
  }

  return (
    <OrganizerClockProvider>
      <ImpersonationBanner />
      {/* DashboardNav reads `?tab=` and `?event=`, so it needs a boundary or it
          opts every dashboard route out of static rendering. */}
      <Suspense fallback={null}>
        <DashboardNav />
      </Suspense>
      {/* The sidebar is position:fixed; this wrapper is what keeps content out
          from under it. Applied here rather than per page, because the pages that
          most needed it are exactly the ones that never had a sidebar to offset. */}
      <div className="dnav-content">
        {children}
      </div>
    </OrganizerClockProvider>
  );
}
