'use client';

import ImpersonationBanner from '../components/ImpersonationBanner';

/**
 * Shared layout for every /dashboard/* route (main dashboard, create-event,
 * seating-map, campaigns) so the impersonation indicator/return-to-admin
 * banner shows up everywhere an admin impersonating an organizer might land,
 * not just the main dashboard page.
 */
export default function DashboardLayout({ children }) {
  return (
    <>
      <ImpersonationBanner />
      {children}
    </>
  );
}
