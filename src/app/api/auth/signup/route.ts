import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { hashPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues.map((e: z.ZodIssue) => e.message).join(', ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { email, password } = result.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Hash password and save
    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // Create session token
    const token = await signToken({
      userId: user.id,
      email: user.email,
    });

    // Create response and set cookie
    const response = NextResponse.json({
      message: 'Signup successful',
      user: {
        id: user.id,
        email: user.email,
      },
    });

    response.cookies.set({
      name: 'forgeai_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    runtimeLogger.info('auth', `User signed up successfully: ${email}`);
    return response;
  } catch (error) {
    runtimeLogger.error('auth', 'Signup error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
