'use client';

import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { AlertCircle, Calendar, CheckSquare, ChevronDown, HelpCircle, Hash, AlignLeft, Type } from 'lucide-react';

export interface RegistryComponentProps {
  name: string;
  label: string;
  type: string;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  disabled?: boolean;
  defaultValue?: any;
}

// 1. Text Input Component
export const TextInput: React.FC<RegistryComponentProps> = ({
  name,
  label,
  register,
  errors,
  required,
  placeholder,
  disabled,
}) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
        <Type className="h-3 w-3 text-muted-foreground" />
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={`w-full px-3 py-2 text-sm bg-background border rounded-md shadow-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary'
        }`}
        {...register(name, { required: required ? `${label} is required` : false })}
      />
      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
    </div>
  );
};

// 2. Number Input Component
export const NumberInput: React.FC<RegistryComponentProps> = ({
  name,
  label,
  register,
  errors,
  required,
  placeholder,
  disabled,
}) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
        <Hash className="h-3 w-3 text-muted-foreground" />
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="number"
        step="any"
        disabled={disabled}
        placeholder={placeholder || `0.00`}
        className={`w-full px-3 py-2 text-sm bg-background border rounded-md shadow-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary'
        }`}
        {...register(name, {
          required: required ? `${label} is required` : false,
          valueAsNumber: true,
        })}
      />
      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
    </div>
  );
};

// 3. Select Dropdown Component
export const SelectInput: React.FC<RegistryComponentProps> = ({
  name,
  label,
  register,
  errors,
  required,
  options = [],
  placeholder,
  disabled,
}) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm bg-background border rounded-md shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary'
          }`}
          {...register(name, { required: required ? `${label} is required` : false })}
        >
          <option value="">{placeholder || `Select ${label.toLowerCase()}...`}</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
    </div>
  );
};

// 4. Text Area Component
export const TextArea: React.FC<RegistryComponentProps> = ({
  name,
  label,
  register,
  errors,
  required,
  placeholder,
  disabled,
}) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
        <AlignLeft className="h-3 w-3 text-muted-foreground" />
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        disabled={disabled}
        rows={3}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={`w-full px-3 py-2 text-sm bg-background border rounded-md shadow-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary'
        }`}
        {...register(name, { required: required ? `${label} is required` : false })}
      />
      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
    </div>
  );
};

// 5. Checkbox Input Component
export const CheckboxInput: React.FC<RegistryComponentProps> = ({
  name,
  label,
  register,
  errors,
  disabled,
}) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-2.5 py-1.5">
        <input
          type="checkbox"
          id={name}
          disabled={disabled}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-background accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
          {...register(name)}
        />
        <label htmlFor={name} className="text-xs font-semibold text-foreground/80 flex items-center gap-1 select-none cursor-pointer">
          <CheckSquare className="h-3 w-3 text-muted-foreground" />
          {label}
        </label>
      </div>
      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
    </div>
  );
};

// 6. Date Input Component
export const DateInput: React.FC<RegistryComponentProps> = ({
  name,
  label,
  register,
  errors,
  required,
  disabled,
}) => {
  const error = errors[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="date"
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm bg-background border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-primary'
        }`}
        {...register(name, { required: required ? `${label} is required` : false })}
      />
      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
    </div>
  );
};

// 7. Unsupported/Fallback Component
export const UnknownComponent: React.FC<RegistryComponentProps> = ({
  name,
  label,
  type,
}) => {
  return (
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-3.5 flex items-start gap-2.5">
      <div className="p-1.5 bg-amber-500/10 rounded text-amber-500 mt-0.5">
        <AlertCircle className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <div className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">
          Unsupported Component: {type}
        </div>
        <h5 className="text-xs font-medium text-foreground">
          {label} <span className="text-muted-foreground/60">({name})</span>
        </h5>
        <p className="text-[10px] text-muted-foreground leading-normal">
          The registry lacks an interpreter for component <span className="font-mono bg-amber-500/10 text-amber-400 px-1 rounded">{type}</span>. Degrading gracefully to fallback UI representation.
        </p>
      </div>
    </div>
  );
};

// Central component registry mapping keys to React elements
export const componentRegistry: Record<string, React.FC<RegistryComponentProps>> = {
  text: TextInput,
  number: NumberInput,
  select: SelectInput,
  textarea: TextArea,
  checkbox: CheckboxInput,
  date: DateInput,
};

/**
 * Registry Helper function to fetch the mapped input component or gracefully fall back.
 */
export function getRegistryComponent(type: string): React.FC<RegistryComponentProps> {
  const component = componentRegistry[type.toLowerCase()];
  if (component) return component;
  return UnknownComponent;
}
