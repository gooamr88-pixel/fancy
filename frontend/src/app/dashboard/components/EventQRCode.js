'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function EventQRCode({ slug, qrCodeUrl }) {
  const [generatedQr, setGeneratedQr] = useState('');
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${slug}`
    : `http://localhost:3000/${slug}`;

  useEffect(() => {
    // Prefer the QR persisted by the backend at event creation/publish; only
    // generate live as a fallback (e.g. legacy events created before QR persistence).
    if (qrCodeUrl || !slug) return;
    QRCode.toDataURL(eventUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#0f172a', // dark slate
        light: '#ffffff'
      }
    })
      .then(url => setGeneratedQr(url))
      .catch(err => console.error('Failed to generate QR Code:', err));
  }, [slug, eventUrl, qrCodeUrl]);

  // Persisted QR wins; fall back to the locally generated one.
  const qrUrl = qrCodeUrl || generatedQr;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-sm">
      <h4 className="text-sm font-semibold text-slate-800 mb-2">Event QR Code</h4>
      {qrUrl ? (
        <div className="bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100">
          <img src={qrUrl} alt="Event QR Code" className="w-40 h-40 object-contain" />
        </div>
      ) : (
        <div className="w-40 h-40 bg-slate-100 rounded-xl flex items-center justify-center mb-3 animate-pulse">
          <span className="text-xs text-slate-400">Generating...</span>
        </div>
      )}
      
      <div className="w-full text-center mb-3">
        <p className="text-xs text-slate-500 mb-1">Invite link:</p>
        <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-xs text-slate-600 font-mono break-all select-all">
          <span>{eventUrl}</span>
          <button 
            onClick={handleCopy}
            className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            title="Copy URL"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {qrUrl && (
        <a 
          href={qrUrl} 
          download={`rsvp-qr-${slug}.png`}
          className="flex items-center justify-center gap-1.5 w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-2 px-4 rounded-xl transition-all shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download QR Image
        </a>
      )}
    </div>
  );
}
