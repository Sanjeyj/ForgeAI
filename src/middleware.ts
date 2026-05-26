import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// Lightweight, sliding-window rate limit cache in middleware memory
const rateLimitCache = new Map<string, { timestamps: number[] }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const userData = rateLimitCache.get(key) || { timestamps: [] };
  
  // Filter out timestamps outside the current window
  const activeTimestamps = userData.timestamps.filter(
    t => now - t < RATE_LIMIT_WINDOW_MS
  );
  
  if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  activeTimestamps.push(now);
  rateLimitCache.set(key, { timestamps: activeTimestamps });
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Grab session cookie
  const sessionCookie = req.cookies.get('forgeai_session')?.value;
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isRuntimeApiRoute = pathname.startsWith('/api/runtime');
  const isAuthApiRoute = pathname.startsWith('/api/auth');

  // Verify token if cookie exists
  let tokenPayload = null;
  if (sessionCookie) {
    tokenPayload = await verifyToken(sessionCookie);
  }

  // 1. Rate Limiting Protection (specifically for APIs)
  if (pathname.startsWith('/api/')) {
    // Generate rate limit key (scoped to user ID if authenticated, else IP)
    const clientIp = req.headers.get('x-forwarded-for') || (req as any).ip || 'anonymous';
    const rateLimitKey = tokenPayload ? tokenPayload.userId : clientIp;
    
    if (isRateLimited(rateLimitKey)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Rate limit is 100 requests per minute.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  // 2. Authentication Protection
  // Protected Web Routes
  if (isDashboardRoute) {
    if (!tokenPayload) {
      // Redirect to login if unauthenticated
      const loginUrl = new URL('/', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protected Runtime API Routes
  if (isRuntimeApiRoute) {
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Unauthorized. Active session token required.' },
        { status: 401 }
      );
    }
  }

  // Prevent logged-in users from seeing the login/signup page (root path)
  if (pathname === '/') {
    if (tokenPayload) {
      const dashboardUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/api/runtime/:path*',
    '/api/auth/me',
  ],
};
