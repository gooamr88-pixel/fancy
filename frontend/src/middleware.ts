import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('fancy_session');
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);

  if (!sessionCookie?.value) {
    return NextResponse.redirect(loginUrl);
  }

  // Validate JWT structure and expiry (without full signature verification in Edge Runtime)
  try {
    const parts = sessionCookie.value.split('.');
    if (parts.length !== 3) {
      return NextResponse.redirect(loginUrl);
    }
    const payload = JSON.parse(atob(parts[1]));
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const expiredUrl = new URL('/login', request.url);
      expiredUrl.searchParams.set('redirect', request.nextUrl.pathname);
      expiredUrl.searchParams.set('reason', 'expired');
      const response = NextResponse.redirect(expiredUrl);
      response.cookies.delete('fancy_session');
      return response;
    }
  } catch {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/checkin/:path*'],
};
