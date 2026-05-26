import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db } from '@/server/db/client';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('forgeai_session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = await verifyToken(sessionCookie);

    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false, error: 'Auth check error' }, { status: 500 });
  }
}
