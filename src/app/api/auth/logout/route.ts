import { NextRequest, NextResponse } from 'next/server';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({ message: 'Logout successful' });
    
    response.cookies.set({
      name: 'forgeai_session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    });

    runtimeLogger.info('auth', 'User logged out successfully');
    return response;
  } catch (error) {
    runtimeLogger.error('auth', 'Logout error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
