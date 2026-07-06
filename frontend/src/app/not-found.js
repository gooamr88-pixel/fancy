'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="notfound-shell">
      <div className="notfound-card">
        <span className="notfound-digits">404</span>
        <h2 className="notfound-heading">Page Not Found</h2>
        <p className="notfound-body">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="notfound-actions">
          <Link href="/" className="notfound-btn">Back to Home</Link>
        </div>
      </div>

      <style jsx>{`
        .notfound-shell {
          min-height: 100vh;
          min-height: 100dvh;
          background: #F8F4EC;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: var(--font-sans);
        }
        .notfound-card { max-width: 440px; width: 100%; text-align: center; }
        .notfound-digits {
          font-family: var(--font-serif);
          font-size: clamp(4rem, 20vw, 6rem);
          font-weight: 700;
          color: var(--gold-cta, #8A6D34);
          line-height: 1;
          display: block;
        }
        .notfound-heading {
          font-family: var(--font-serif);
          font-size: 28px;
          font-weight: 600;
          color: #191B1E;
          margin-top: 16px;
        }
        .notfound-body {
          color: #77736A;
          margin-top: 12px;
          font-size: 15px;
          line-height: 1.7;
          font-weight: 300;
        }
        .notfound-actions { margin-top: 32px; }
        .notfound-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 14px 36px;
          box-sizing: border-box;
          background: var(--gold-cta, #8A6D34);
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 700;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.3s ease;
          font-family: var(--font-sans);
        }

        @media (prefers-color-scheme: dark) {
          .notfound-shell { background: #17181A; }
          .notfound-heading { color: #F8F4EC; }
          .notfound-body { color: #A8A397; }
          .notfound-btn { background: #D7BE80; color: #191B1E; }
        }
      `}</style>
    </div>
  );
}
