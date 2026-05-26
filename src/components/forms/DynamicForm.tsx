'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { EntityDefinition, FieldDefinition } from '@/lib/schema/schema-validator';
import { getRegistryComponent } from '@/components/runtime/ComponentRegistry';
import { ErrorBoundary } from '@/components/runtime/ErrorBoundary';
import { Check, Loader2 } from 'lucide-react';

interface DynamicFormProps {
  entity: EntityDefinition;
  onSubmit: (data: any) => Promise<void> | void;
  isLoading?: boolean;
  defaultValues?: any;
  submitLabel?: string;
  appId?: string;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  entity,
  onSubmit,
  isLoading = false,
  defaultValues = {},
  submitLabel = 'Submit',
  appId,
}) => {
  // Pre-calculate fallback default values matching field definitions
  const initialValues = React.useMemo(() => {
    const fallbacks: Record<string, any> = {};
    entity.fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        fallbacks[field.name] = field.defaultValue;
      } else if (field.type === 'checkbox') {
        fallbacks[field.name] = false;
      } else if (field.type === 'number') {
        fallbacks[field.name] = undefined;
      } else {
        fallbacks[field.name] = '';
      }
    });
    return { ...fallbacks, ...defaultValues };
  }, [entity, defaultValues]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: initialValues,
  });

  // Watch entire form reactively to evaluate conditional visibility rules
  const watchedValues = watch();

  // Reset form when initial values change (e.g. entering Edit mode)
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const checkVisibility = (field: FieldDefinition): boolean => {
    if (!field.visibleIf) return true;
    const { field: targetFieldName, equals } = field.visibleIf;
    
    const targetValue = watchedValues[targetFieldName];
    
    // Evaluate equalities: strings, numbers, booleans
    if (typeof equals === 'boolean') {
      return !!targetValue === equals;
    }
    
    return String(targetValue) === String(equals);
  };

  // Maps numeric columns from schema to Tailwind responsive grids
  const getGridColsClass = (columns?: number) => {
    switch (columns) {
      case 2:
        return 'grid-cols-1 md:grid-cols-2';
      case 3:
        return 'grid-cols-1 md:grid-cols-3';
      case 4:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4';
      default:
        return 'grid-cols-1';
    }
  };

  const handleFormSubmit = (data: any) => {
    // Strip hidden fields so we don't submit values that should be invisible
    const activeData: Record<string, any> = {};
    entity.fields.forEach(f => {
      if (checkVisibility(f)) {
        // Safe mapping for numbers
        if (f.type === 'number') {
          activeData[f.name] = isNaN(Number(data[f.name])) ? null : Number(data[f.name]);
        } else {
          activeData[f.name] = data[f.name];
        }
      }
    });
    onSubmit(activeData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 1. Dynamic Layout Grid */}
      <div className={`grid gap-4 ${getGridColsClass(entity.layout?.columns)}`}>
        {entity.fields.map((field) => {
          // Check visibility conditions
          const isVisible = checkVisibility(field);
          if (!isVisible) return null;

          const InputComponent = getRegistryComponent(field.type);

          return (
            <div key={field.name} className="w-full">
              {/* Isolate individual component failures using our ErrorBoundary */}
              <ErrorBoundary fallbackName={`FormField: ${field.name}`} appId={appId}>
                <InputComponent
                  name={field.name}
                  label={field.placeholder || field.name.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}
                  type={field.type}
                  register={register}
                  errors={errors}
                  required={field.required}
                  options={field.options}
                  placeholder={field.placeholder}
                  disabled={isLoading}
                />
              </ErrorBoundary>
            </div>
          );
        })}
      </div>

      {/* 2. Submit Control Bar */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isLoading || (!isDirty && Object.keys(defaultValues).length === 0)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/95 rounded-md shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  );
};
