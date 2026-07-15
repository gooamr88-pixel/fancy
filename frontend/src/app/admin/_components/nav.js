/**
 * Super Admin Control Center navigation model (Master Plan §1–§25).
 * Each item maps a section to its route, the permission that reveals it, and a
 * `ready` flag. Unbuilt sections are shown (if permitted) but disabled until
 * their phase lands — keeping the full information architecture visible without
 * dead links. Icons are rendered by Sidebar.js's own SVG map, keyed on `key`.
 */
export const NAV_GROUPS = [
  {
    heading: 'Overview',
    items: [
      { key: 'overview', label: 'Executive Overview', href: '/admin/overview', perm: 'overview.view', ready: true },
      { key: 'operations', label: 'Operations', href: '/admin/operations', perm: 'operations.view', ready: false },
      { key: 'health', label: 'System Health', href: '/admin/health', perm: 'health.view', ready: true },
    ],
  },
  {
    heading: 'People',
    items: [
      { key: 'users', label: 'Users', href: '/admin/users', perm: 'users.view', ready: true },
      { key: 'organizers', label: 'Organizers', href: '/admin/organizers', perm: 'organizers.view', ready: true },
      { key: 'support', label: 'Support', href: '/admin/support', perm: 'support.view', ready: false },
    ],
  },
  {
    heading: 'Events & Guests',
    items: [
      { key: 'events', label: 'Events', href: '/admin/events', perm: 'events.view', ready: true },
      { key: 'invitations', label: 'Invitations', href: '/admin/invitations', perm: 'invitations.view', ready: false },
      { key: 'guests', label: 'Guests', href: '/admin/guests', perm: 'guests.view', ready: false },
    ],
  },
  {
    heading: 'Revenue',
    items: [
      { key: 'payments', label: 'Payments', href: '/admin/payments', perm: 'payments.view', ready: true },
      { key: 'credits', label: 'Credits', href: '/admin/credits', perm: 'credits.view', ready: true },
      { key: 'finance', label: 'Financial Center', href: '/admin/finance', perm: 'finance.view', ready: true },
      { key: 'marketing', label: 'Marketing', href: '/admin/marketing', perm: 'marketing.view', ready: true },
      { key: 'promo-codes', label: 'Promo Codes', href: '/admin/promo-codes', perm: 'marketing.view', ready: true },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { key: 'cms', label: 'Landing CMS', href: '/admin/cms', perm: 'cms.view', ready: true },
      { key: 'config', label: 'Configuration', href: '/admin/config', perm: 'config.view', ready: true },
      { key: 'feature-flags', label: 'Feature Flags', href: '/admin/feature-flags', perm: 'flags.view', ready: false },
      { key: 'auth-config', label: 'Auth Settings', href: '/admin/auth-config', perm: 'authconfig.view', ready: false },
      { key: 'notifications', label: 'Notifications', href: '/admin/notifications', perm: 'notifications.view', ready: false },
    ],
  },
  {
    heading: 'Intelligence',
    items: [
      { key: 'analytics', label: 'Analytics', href: '/admin/analytics', perm: 'analytics.view', ready: false },
      { key: 'insights', label: 'AI Insights', href: '/admin/insights', perm: 'insights.view', ready: false },
    ],
  },
  {
    heading: 'Governance',
    items: [
      { key: 'roles', label: 'Roles & Permissions', href: '/admin/roles', perm: 'rbac.view', ready: true },
      { key: 'security', label: 'Security Center', href: '/admin/security', perm: 'security.view', ready: true },
      { key: 'audit', label: 'Audit Logs', href: '/admin/audit', perm: 'audit.view', ready: true },
      { key: 'data', label: 'Data Management', href: '/admin/data', perm: 'data.view', ready: false },
    ],
  },
];

export default NAV_GROUPS;
