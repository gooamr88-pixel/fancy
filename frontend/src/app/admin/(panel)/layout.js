'use client';

import AdminShell from '../_components/AdminShell';

/**
 * Layout for the new Control Center route group. Scoped to (panel) only, so the
 * legacy monolithic /admin page is left untouched during the strangler-pattern
 * migration (Master Plan §5 — incremental admin refactor).
 */
export default function PanelLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
