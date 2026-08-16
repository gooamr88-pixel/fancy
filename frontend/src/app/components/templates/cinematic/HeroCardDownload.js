'use client';

import React, { useCallback, useRef, useState } from 'react';
import InvitationCard from '../InvitationCard';
import Icon from '../../icons/Icon';

/* ═══════════════════════════════════════════════════════════════
   "Save the invitation" for the cinematic templates.

   The other full-page templates put the invitation card in the middle of
   the hero and hang a download button under it. These two can't: their heroes
   are photographic compositions where a stationery card floating over the
   ring — or over the doves — would be a second focal point fighting the first.

   So the card is still rendered, at its true size and with this event's real
   data, but parked off-screen; only the button is visible. html-to-image
   clones the node it is given rather than screenshotting the viewport, so an
   off-screen node captures identically to an on-screen one. The guest keeps
   the feature; the hero keeps its composition.

   Off-screen here means moved, not hidden: `display: none` or
   `visibility: hidden` would give the clone zero dimensions and produce a
   blank PNG.
   ═══════════════════════════════════════════════════════════════ */

export const HERO_CAPTURE_ID = 'cine-invitation-card-capture';

export default function HeroCardDownload({
  pattern, theme, guestName, data, title, isRTL, className = '',
}) {
  const [downloading, setDownloading] = useState(false);
  /* A ref rather than the id lookup. The id stays on the node — it is exported
     and other code looks for it — but in the organizer's preview this page is
     portalled into an iframe while the global `document` is still the
     dashboard's, so getElementById found nothing and every click threw.
     See utils/frameDocument.js. */
  const captureRef = useRef(null);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const node = captureRef.current;
      if (!node) throw new Error('Card element not found');

      // Webfonts can be applied but not yet laid out at the moment of the
      // click; capturing then bakes the fallback face into the PNG.
      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const dataUrl = await toPng(node, { quality: 0.98, pixelRatio: 2.5, cacheBust: true });
      const link = document.createElement('a');
      link.download = `${title || 'invitation'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download invitation card:', error);
    } finally {
      setDownloading(false);
    }
  }, [title]);

  return (
    <>
      <div
        ref={captureRef}
        id={HERO_CAPTURE_ID}
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInlineStart: '-10000px',
          top: 0,
          width: '322px',
          aspectRatio: '210 / 290',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#FAF8F5',
          pointerEvents: 'none',
        }}
      >
        <InvitationCard
          template={{ pattern }}
          theme={theme}
          guestName={guestName}
          data={data}
        />
      </div>

      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className={`cine-hero__save ${className}`}
        data-testid="cine-hero-download"
      >
        {downloading ? (
          <>
            <span aria-hidden="true" className="cine-hero__save-spin" />
            <span>{isRTL ? 'جارٍ التحميل…' : 'Downloading…'}</span>
          </>
        ) : (
          <>
            <Icon name="download" size={15} strokeWidth={1.8} />
            <span>{isRTL ? 'تحميل بطاقة الدعوة' : 'Save the invitation'}</span>
          </>
        )}
      </button>
    </>
  );
}
