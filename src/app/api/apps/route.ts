import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { verifyToken } from '@/lib/auth/jwt';
import { runtimeLogger } from '@/lib/logger/runtime-logger';
import { safeParseSchema } from '@/lib/schema/schema-validator';

// 1. GET: List all applications for active user
export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apps = await db.appConfig.findMany({
      where: { userId: token.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ apps });
  } catch (error) {
    runtimeLogger.error('api', 'Fetch apps list API crash', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 2. POST: Create a new application config
export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, schema } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Application name is required' }, { status: 400 });
    }

    // Defensively parse and sanitize schema before database persistence
    const { schema: cleanSchema, isValid, warnings } = safeParseSchema(schema);

    const app = await db.appConfig.create({
      data: {
        userId: token.userId,
        name,
        schema: cleanSchema,
        version: 1,
      },
    });

    runtimeLogger.info('api', `App created successfully: [${name}]`, { appId: app.id, isValid, warnings });
    return NextResponse.json({ success: true, app, warnings });
  } catch (error) {
    runtimeLogger.error('api', 'Create app API crash', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
