'use client';

import { createContext } from 'react';

/**
 * Lets usePermissions() reuse AdminShell's already-resolved GET /admin/me
 * result instead of every section page independently re-fetching it on
 * every navigation (7+ pages previously did) — a redundant round-trip that
 * costs the most on the slower/higher-latency mobile connections this is
 * meant to help. Null when no provider is mounted (usePermissions then
 * falls back to fetching on its own, so it still works standalone).
 */
export const PermissionsContext = createContext(null);
