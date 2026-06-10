import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F4EC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '96px',
            fontWeight: 700,
            color: '#B8944F',
            lineHeight: 1,
            display: 'block',
          }}
        >
          404
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '28px',
            fontWeight: 600,
            color: '#191B1E',
            marginTop: '16px',
          }}
        >
          Page Not Found
        </h2>
        <p
          style={{
            color: '#77736A',
            marginTop: '12px',
            fontSize: '15px',
            lineHeight: 1.7,
            fontWeight: 300,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ marginTop: '32px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '14px 36px',
              background: '#B8944F',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
