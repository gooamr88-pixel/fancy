'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from 'react';

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;
const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * True when a Turnstile sitekey is configured. The public RSVP form uses this to
 * decide whether a solved captcha token is required before submitting — it must
 * mirror the backend gate (middleware/captcha.js), which enforces a token only
 * when TURNSTILE_SECRET is set. Set BOTH env vars to turn the challenge on; leave
 * either unset and the whole feature is a no-op (nothing renders, nothing blocks).
 */
export const turnstileEnabled = !!SITEKEY;

/**
 * Cloudflare Turnstile challenge widget.
 *
 * Renders nothing when no sitekey is configured. When enabled, it loads the
 * Turnstile script once, renders the challenge, and hands the solved token to
 * `onVerify` (the form sends it as `captchaToken`). The parent can call the
 * exposed `reset()` (via ref) to request a fresh token after a failed submit,
 * since Turnstile tokens are single-use.
 */
const TurnstileWidget = forwardRef(function TurnstileWidget({ onVerify, onExpire, theme = 'light' }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  const render = useCallback(() => {
    if (!SITEKEY || !window.turnstile || !containerRef.current || widgetIdRef.current !== null) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITEKEY,
      theme,
      callback: (token) => onVerify?.(token),
      'expired-callback': () => onExpire?.(),
      'error-callback': () => onExpire?.(),
    });
  }, [onVerify, onExpire, theme]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch { /* widget gone */ }
      }
    },
  }), []);

  useEffect(() => {
    if (!SITEKEY) return undefined;
    if (window.turnstile) { render(); return undefined; }

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onLoad = () => render();
    script.addEventListener('load', onLoad);

    return () => {
      script.removeEventListener('load', onLoad);
      // Tear down this instance so a remount doesn't stack duplicate widgets.
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* already gone */ }
        widgetIdRef.current = null;
      }
    };
  }, [render]);

  if (!SITEKEY) return null;
  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', minHeight: '65px' }} />;
});

export default TurnstileWidget;
