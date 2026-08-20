import { permanentRedirect } from 'next/navigation';

/**
 * /printed-invitations → /shop
 *
 * The catalogue was named for its first and only shelf. It now sells screens,
 * scanners, signage and print, so the old name described a sixth of it.
 *
 * A 308 rather than a rewrite: the URL genuinely moved, this one has been
 * indexed and linked to, and a permanent redirect is what transfers that.
 * Deleting the route instead would 404 every existing link and every search
 * result pointing at it.
 *
 * This file is the whole route on purpose — no metadata, no fetch. A redirect
 * that first waits on the backend is a redirect that fails when the backend
 * does, and there is nothing here worth rendering.
 */
export default function PrintedInvitationsRedirect() {
  permanentRedirect('/shop');
}
