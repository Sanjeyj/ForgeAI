import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { verifyToken } from '@/lib/auth/jwt';
import { safeParseSchema, FieldDefinition } from '@/lib/schema/schema-validator';
import { workflowEngine } from '@/lib/runtime/workflow-engine';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

/**
 * Helper to build a dynamic Zod validator based on field definitions
 */
function buildDynamicZodSchema(fields: FieldDefinition[]) {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  fields.forEach(field => {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'number':
        fieldSchema = z.number({
          message: `${field.name} must be a number`,
        });
        break;
      case 'checkbox':
        fieldSchema = z.boolean({
          message: `${field.name} must be a boolean`,
        });
        break;
      default:
        fieldSchema = z.string({
          message: `${field.name} must be a string`,
        });
        if (field.required && field.type !== 'checkbox') {
          fieldSchema = (fieldSchema as z.ZodString).min(1, `${field.name} is required`);
        }
        break;
    }

    if (!field.required) {
      fieldSchema = fieldSchema.optional().nullable();
    }

    schemaShape[field.name] = fieldSchema;
  });

  return z.object(schemaShape);
}

// 1. GET: Fetch all records for the given entity
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId') || req.headers.get('x-forgeai-appid');

    if (!appId) {
      return NextResponse.json({ error: 'Missing appId query parameter or x-forgeai-appid header' }, { status: 400 });
    }

    // Authenticate user
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confirm app exists and is user-scoped
    const app = await db.appConfig.findUnique({
      where: { id: appId },
    });

    if (!app || app.userId !== token.userId) {
      return NextResponse.json({ error: 'Application config not found' }, { status: 404 });
    }

    // Fetch records
    const records = await db.runtimeRecord.findMany({
      where: {
        appId,
        entityName: entity,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ records });
  } catch (error) {
    runtimeLogger.error('api', 'Dynamic GET API crash', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 2. POST: Create a new record for the given entity
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId') || req.headers.get('x-forgeai-appid');

    if (!appId) {
      return NextResponse.json({ error: 'Missing appId query parameter or x-forgeai-appid header' }, { status: 400 });
    }

    // Authenticate user
    const sessionCookie = req.cookies.get('forgeai_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await verifyToken(sessionCookie);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confirm app exists and is user-scoped
    const app = await db.appConfig.findUnique({
      where: { id: appId },
    });

    if (!app || app.userId !== token.userId) {
      return NextResponse.json({ error: 'Application config not found' }, { status: 404 });
    }

    // Parse the app schema defensively
    const { schema } = safeParseSchema(app.schema, appId);
    const entityDef = schema.entities.find(e => e.name === entity);

    if (!entityDef) {
      return NextResponse.json({ error: `Entity type [${entity}] is undefined in the app schema` }, { status: 400 });
    }

    // Parse payload and validate dynamically
    const body = await req.json();
    const dynamicZodSchema = buildDynamicZodSchema(entityDef.fields);
    
    // safeParse validates fields but doesn't crash on extra unknown fields
    const validationResult = dynamicZodSchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.issues.map((err: z.ZodIssue) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      runtimeLogger.warn('validation', `API request failed dynamic entity validation for [${entity}]`, {
        errors: fieldErrors,
        appId
      }, appId);

      return NextResponse.json({ 
        error: 'Validation failed', 
        details: fieldErrors 
      }, { status: 400 });
    }

    // Prepare clean payload containing only defined fields OR preserve unknown fields gracefully
    // Standard Retool architecture preserves unknown fields but logs a mild debug warning
    const payloadToSave: Record<string, any> = { ...body };

    // Create record
    const record = await db.runtimeRecord.create({
      data: {
        appId,
        entityName: entity,
        payload: payloadToSave,
      },
    });

    // 3. Execute asynchronous workflow automation triggers
    // Standard events are handled cleanly in background
    setTimeout(async () => {
      await workflowEngine.executeTrigger(appId, `${entity}.created`, {
        id: record.id,
        ...payloadToSave,
      });
    }, 0);

    runtimeLogger.info('api', `Dynamic API POST successful: Created record in [${entity}]`, { id: record.id }, appId);
    return NextResponse.json({ success: true, record });
  } catch (error) {
    runtimeLogger.error('api', 'Dynamic POST API crash', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
