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

// 1. PUT: Update a specific record
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId') || req.headers.get('x-forgeai-appid');

    if (!appId) {
      return NextResponse.json({ error: 'Missing appId query parameter' }, { status: 400 });
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

    // Fetch the target record
    const existingRecord = await db.runtimeRecord.findUnique({
      where: { id },
    });

    if (!existingRecord || existingRecord.appId !== appId || existingRecord.entityName !== entity) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Parse schema defensively
    const { schema } = safeParseSchema(app.schema, appId);
    const entityDef = schema.entities.find(e => e.name === entity);

    if (!entityDef) {
      return NextResponse.json({ error: `Entity [${entity}] is undefined in app schema` }, { status: 400 });
    }

    // Parse and validate update payload
    const body = await req.json();
    const dynamicZodSchema = buildDynamicZodSchema(entityDef.fields);
    const validationResult = dynamicZodSchema.safeParse(body);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.issues.map((err: z.ZodIssue) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return NextResponse.json({ 
        error: 'Validation failed', 
        details: fieldErrors 
      }, { status: 400 });
    }

    const payloadToSave = { ...body };

    // Update record
    const updatedRecord = await db.runtimeRecord.update({
      where: { id },
      data: {
        payload: payloadToSave,
      },
    });

    // Execute update triggers in background
    setTimeout(async () => {
      await workflowEngine.executeTrigger(appId, `${entity}.updated`, {
        id: updatedRecord.id,
        ...payloadToSave,
      });
    }, 0);

    runtimeLogger.info('api', `Dynamic API PUT successful: Updated record ${id} in [${entity}]`, { id }, appId);
    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error) {
    runtimeLogger.error('api', `Dynamic PUT API crash on record: ${id}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 2. DELETE: Delete a specific record
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId') || req.headers.get('x-forgeai-appid');

    if (!appId) {
      return NextResponse.json({ error: 'Missing appId query parameter' }, { status: 400 });
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

    // Fetch record
    const existingRecord = await db.runtimeRecord.findUnique({
      where: { id },
    });

    if (!existingRecord || existingRecord.appId !== appId || existingRecord.entityName !== entity) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Save record payload snapshot for deletion trigger before erasing
    const payloadSnapshot = typeof existingRecord.payload === 'string'
      ? JSON.parse(existingRecord.payload)
      : existingRecord.payload;

    // Delete record
    await db.runtimeRecord.delete({
      where: { id },
    });

    // Execute delete triggers in background
    setTimeout(async () => {
      await workflowEngine.executeTrigger(appId, `${entity}.deleted`, {
        id,
        ...payloadSnapshot,
      });
    }, 0);

    runtimeLogger.info('api', `Dynamic API DELETE successful: Erased record ${id} in [${entity}]`, { id }, appId);
    return NextResponse.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    runtimeLogger.error('api', `Dynamic DELETE API crash on record: ${id}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
