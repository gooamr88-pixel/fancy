'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * useIsClient — replaces the `useEffect(() => setMounted(true), [])` idiom for
 * hydration-safe "has the client taken over yet" gating. useSyncExternalStore's
 * server/client snapshot split is exactly what this needs: `false` on the
 * server and first client render (matching SSR output, no hydration mismatch),
 * `true` from the next paint onward — with no effect, no setState, and no
 * extra component-level state to manage.
 */
export function useIsClient() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
