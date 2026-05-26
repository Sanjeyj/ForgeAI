import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { verifyToken } from '@/lib/auth/jwt';
import { runtimeLogger } from '@/lib/logger/runtime-logger';
import { safeParseSchema } from '@/lib/schema/schema-validator';

// 1. GET: Fetch individual app details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = await db.appConfig.findUnique({
      where: { id },
    });

    if (!app || app.userId !== token.userId) {
      return NextResponse.json({ error: 'Application config not found' }, { status: 404 });
    }

    // Get total count of dynamic records
    const recordCount = await db.runtimeRecord.count({
      where: { appId: id }
    });

    return NextResponse.json({ app, stats: { recordCount } });
  } catch (error) {
    runtimeLogger.error('api', `Fetch app by ID API crash`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 2. PUT: Save schema updates
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = await db.appConfig.findUnique({
      where: { id },
    });

    if (!app || app.userId !== token.userId) {
      return NextResponse.json({ error: 'Application config not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, schema, version } = body;

    // Defensively parse and sanitize incoming schema
    const { schema: cleanSchema, isValid, warnings } = safeParseSchema(schema, id);

    const updatedApp = await db.appConfig.update({
      where: { id },
      data: {
        name: name || app.name,
        schema: cleanSchema,
        version: version !== undefined ? version : app.version + 1,
      },
    });

    runtimeLogger.info('api', `App config updated: [${updatedApp.name}]`, { appId: id, isValid, warnings });
    return NextResponse.json({ success: true, app: updatedApp, warnings });
  } catch (error) {
    runtimeLogger.error('api', `Update app by ID API crash`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 3. DELETE: Archive and remove application configuration
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = await db.appConfig.findUnique({
      where: { id },
    });

    if (!app || app.userId !== token.userId) {
      return NextResponse.json({ error: 'Application config not found' }, { status: 404 });
    }

    await db.appConfig.delete({
      where: { id },
    });

    runtimeLogger.info('api', `App deleted successfully: [${app.name}]`, { appId: id });
    return NextResponse.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    runtimeLogger.error('api', `Delete app by ID API crash`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
