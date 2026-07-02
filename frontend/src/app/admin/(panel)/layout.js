'use client';

import AdminShell from '../_components/AdminShell';

/**
 * Layout for the Control Center route group (Master Plan §5).
 */
export default function PanelLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
