import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <span className="text-7xl font-bold text-brand-green">404</span>
        <h2 className="text-2xl font-bold mt-4 text-foreground">Page Not Found</h2>
        <p className="text-muted-text mt-2 text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-brand-green hover:bg-brand-green-hover text-white text-sm rounded-lg font-bold transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
