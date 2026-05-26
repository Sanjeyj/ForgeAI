import { z } from 'zod';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

// Field definition schema. Flexible type string to support unknown fields.
export const FieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  type: z.string(), // z.string() allows custom/unsupported types without crashing
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional(), // For dropdown select fields
  placeholder: z.string().optional(),
  defaultValue: z.any().optional(),
  visibleIf: z.object({
    field: z.string(),
    equals: z.any(),
  }).optional(),
});

export type FieldDefinition = z.infer<typeof FieldSchema>;

// Entity definition schema (e.g. database table model)
export const EntitySchema = z.object({
  name: z.string().min(1, 'Entity name is required'),
  label: z.string().optional(),
  fields: z.array(FieldSchema).default([]),
  layout: z.object({
    columns: z.number().min(1).max(4).optional().default(1),
  }).optional().default({ columns: 1 }),
});

export type EntityDefinition = z.infer<typeof EntitySchema>;

// Event automation workflow triggers
export const WorkflowSchema = z.object({
  trigger: z.string(), // e.g. "employees.created", "tasks.deleted"
  action: z.enum(['send_notification', 'log_action', 'create_record']),
  config: z.record(z.string(), z.any()).optional().default({}),
});

export type WorkflowDefinition = z.infer<typeof WorkflowSchema>;

// Complete dynamic application structure schema
export const AppSchema = z.object({
  appName: z.string().min(1, 'App name is required'),
  entities: z.array(EntitySchema).default([]),
  workflows: z.array(WorkflowSchema).optional().default([]),
  description: z.string().optional().default('Generated dynamically by ForgeAI'),
});

export type AppSchemaType = z.infer<typeof AppSchema>;

// Standard supported fields in ForgeAI Component Registry
export const SUPPORTED_FIELD_TYPES = ['text', 'number', 'select', 'textarea', 'checkbox', 'date'];

/**
 * Defensively parses and cleans raw dynamic JSON schemas.
 * Never throws. Returns a safe working schema even if completely corrupted.
 */
export function safeParseSchema(rawSchema: any, appId?: string): {
  schema: AppSchemaType;
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  if (!rawSchema || typeof rawSchema !== 'object') {
    const fallbackSchema: AppSchemaType = {
      appName: 'Fallback Recovery App',
      description: 'Automatically recovered after encountering a corrupted schema.',
      entities: [],
      workflows: [],
    };
    runtimeLogger.error('validation', 'Corrupted schema input. Rendered emergency fallback.', { rawSchema }, appId);
    return {
      schema: fallbackSchema,
      isValid: false,
      warnings: ['Schema must be a valid JSON object'],
      errors: ['Input schema is not a valid object'],
    };
  }

  // Parse against our dynamic layout structure
  const result = AppSchema.safeParse(rawSchema);
  let cleanSchema: AppSchemaType;

  if (result.success) {
    cleanSchema = result.data;
  } else {
    // Attempt recovery on partial fields
    errors.push(...result.error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`));
    cleanSchema = {
      appName: String(rawSchema.appName || 'Recovered App'),
      description: String(rawSchema.description || 'Dynamic recovery mode active'),
      entities: Array.isArray(rawSchema.entities) ? [] : [],
      workflows: Array.isArray(rawSchema.workflows) ? [] : [],
    };
    runtimeLogger.warn('validation', 'Partial schema errors. Auto-healing to partial-load layout.', { errors }, appId);
  }

  // Double check individual entities for unknown types and log warnings
  if (Array.isArray(rawSchema.entities)) {
    rawSchema.entities.forEach((entity: any, entIdx: number) => {
      if (entity && typeof entity === 'object' && Array.isArray(entity.fields)) {
        // Recover and clean fields
        const cleanedFields: FieldDefinition[] = [];
        
        entity.fields.forEach((field: any, fldIdx: number) => {
          if (!field || typeof field !== 'object') return;
          
          const fieldType = String(field.type || 'text');
          const fieldName = String(field.name || `field_${fldIdx}`);
          
          if (!SUPPORTED_FIELD_TYPES.includes(fieldType)) {
            const warnMessage = `Unsupported field type "${fieldType}" detected in entity "${entity.name}" on field "${fieldName}".`;
            warnings.push(warnMessage);
            runtimeLogger.warn('component', warnMessage, { entity: entity.name, field: fieldName, type: fieldType }, appId);
          }

          cleanedFields.push({
            name: fieldName,
            type: fieldType,
            required: !!field.required,
            options: Array.isArray(field.options) ? field.options.map(String) : undefined,
            placeholder: field.placeholder ? String(field.placeholder) : undefined,
            defaultValue: field.defaultValue,
            visibleIf: field.visibleIf && typeof field.visibleIf === 'object' ? {
              field: String(field.visibleIf.field),
              equals: field.visibleIf.equals
            } : undefined
          });
        });

        // Push successfully processed entities
        if (cleanSchema.entities) {
          cleanSchema.entities.push({
            name: String(entity.name || `entity_${entIdx}`),
            label: entity.label ? String(entity.label) : undefined,
            fields: cleanedFields,
            layout: entity.layout && typeof entity.layout === 'object' ? {
              columns: typeof entity.layout.columns === 'number' ? entity.layout.columns : 1
            } : { columns: 1 }
          });
        }
      }
    });
  }

  return {
    schema: cleanSchema,
    isValid: result.success && errors.length === 0,
    warnings,
    errors,
  };
}
