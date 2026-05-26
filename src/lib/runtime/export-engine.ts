import JSZip from 'jszip';
import { AppSchemaType, EntityDefinition, FieldDefinition } from '../schema/schema-validator';

/**
 * Generates code content for a static React Hook Form component matching the schema field definitions
 */
function generateStaticFormCode(entity: EntityDefinition): string {
  const fields = entity.fields;
  const cols = entity.layout?.columns || 1;
  const gridClass = cols === 2 ? 'grid-cols-1 md:grid-cols-2' : cols === 3 ? 'grid-cols-1 md:grid-cols-3' : cols === 4 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4' : 'grid-cols-1';

  // Build TS interface
  const typeFields = fields.map(f => {
    const tsType = f.type === 'number' ? 'number' : f.type === 'checkbox' ? 'boolean' : 'string';
    return `  ${f.name}${f.required ? '' : '?'}: ${tsType};`;
  }).join('\n');

  // Input components generation
  const inputsHtml = fields.map(f => {
    const label = f.placeholder || f.name.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
    
    let inputControl = '';
    if (f.type === 'select') {
      const options = f.options || [];
      inputControl = `
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-gray-700">${label} ${f.required ? '*' : ''}</label>
          <select 
            {...register('${f.name}', { required: ${f.required ? `"${label} is required"` : 'false'} })}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select option...</option>
            ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('\n            ')}
          </select>
          {errors.${f.name} && <span className="text-[11px] text-red-500">{errors.${f.name}.message}</span>}
        </div>`;
    } else if (f.type === 'textarea') {
      inputControl = `
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-gray-700">${label} ${f.required ? '*' : ''}</label>
          <textarea 
            rows={3}
            placeholder="${f.placeholder || ''}"
            {...register('${f.name}', { required: ${f.required ? `"${label} is required"` : 'false'} })}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.${f.name} && <span className="text-[11px] text-red-500">{errors.${f.name}.message}</span>}
        </div>`;
    } else if (f.type === 'checkbox') {
      inputControl = `
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex items-center gap-2 py-1.5">
            <input 
              type="checkbox"
              id="${f.name}"
              {...register('${f.name}')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="${f.name}" className="text-xs font-semibold text-gray-700 cursor-pointer">${label}</label>
          </div>
          {errors.${f.name} && <span className="text-[11px] text-red-500">{errors.${f.name}.message}</span>}
        </div>`;
    } else if (f.type === 'number') {
      inputControl = `
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-gray-700">${label} ${f.required ? '*' : ''}</label>
          <input 
            type="number"
            step="any"
            placeholder="${f.placeholder || '0.00'}"
            {...register('${f.name}', { 
              required: ${f.required ? `"${label} is required"` : 'false'},
              valueAsNumber: true 
            })}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.${f.name} && <span className="text-[11px] text-red-500">{errors.${f.name}.message}</span>}
        </div>`;
    } else if (f.type === 'date') {
      inputControl = `
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-gray-700">${label} ${f.required ? '*' : ''}</label>
          <input 
            type="date"
            {...register('${f.name}', { required: ${f.required ? `"${label} is required"` : 'false'} })}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.${f.name} && <span className="text-[11px] text-red-500">{errors.${f.name}.message}</span>}
        </div>`;
    } else {
      // Default: Text Input
      inputControl = `
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-gray-700">${label} ${f.required ? '*' : ''}</label>
          <input 
            type="text"
            placeholder="${f.placeholder || ''}"
            {...register('${f.name}', { required: ${f.required ? `"${label} is required"` : 'false'} })}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.${f.name} && <span className="text-[11px] text-red-500">{errors.${f.name}.message}</span>}
        </div>`;
    }

    // visibleIf rendering
    if (f.visibleIf) {
      return `
  {watch('${f.visibleIf.field}') === ${typeof f.visibleIf.equals === 'string' ? `"${f.visibleIf.equals}"` : f.visibleIf.equals} && (
    ${inputControl.trim().split('\n').join('\n    ')}
  )}`;
    }

    return inputControl;
  }).join('\n');

  return `'use client';

import React from 'react';
import { useForm } from 'react-hook-form';

export interface ${entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}Data {
${typeFields}
}

interface FormProps {
  onSubmit: (data: ${entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}Data) => void;
  defaultValues?: Partial<${entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}Data>;
  isLoading?: boolean;
}

export function ${entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}Form({
  onSubmit,
  defaultValues = {},
  isLoading = false,
}: FormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<${entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}Data>({
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4">
        Add new ${entity.name.slice(0, -1)} record
      </h3>
      
      <div className="grid gap-4 ${gridClass}">
        ${inputsHtml.trim().split('\n').join('\n        ')}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Submit Entry'}
        </button>
      </div>
    </form>
  );
}
`;
}

/**
 * Generates code content for a static React table list component matching the schema
 */
function generateStaticTableCode(entity: EntityDefinition): string {
  const fields = entity.fields;
  const capitalized = entity.name.charAt(0).toUpperCase() + entity.name.slice(1);

  const headersHtml = fields.map(f => {
    const label = f.placeholder || f.name.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
    return `              <th className="px-4 py-3 font-semibold text-gray-700">${label}</th>`;
  }).join('\n');

  const rowsHtml = fields.map(f => {
    if (f.type === 'checkbox') {
      return `                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className={\`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold \${
                      row.${f.name} ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }\`}>
                      {row.${f.name} ? 'Yes' : 'No'}
                    </span>
                  </td>`;
    }
    if (f.type === 'date') {
      return `                  <td className="px-4 py-3 text-gray-600">
                    {row.${f.name} ? new Date(row.${f.name}).toLocaleDateString() : '-'}
                  </td>`;
    }
    return `                  <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{row.${f.name} ?? '-'}</td>`;
  }).join('\n');

  return `'use client';

import React, { useState, useMemo } from 'react';
import { ${capitalized}Data } from './Form';

interface TableProps {
  records: Array<{ id: string; payload: ${capitalized}Data }>;
  onDelete?: (id: string) => void;
  onEdit?: (record: { id: string; payload: ${capitalized}Data }) => void;
}

export function ${capitalized}Table({ records, onDelete, onEdit }: TableProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r => 
      Object.values(r.payload).some(val => 
        String(val ?? '').toLowerCase().includes(q)
      )
    );
  }, [records, search]);

  return (
    <div className="space-y-3 bg-white p-5 border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-gray-900">Data Logs: ${entity.label || entity.name}</h3>
        <input 
          type="text"
          placeholder="Filter table entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs border border-gray-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="border border-gray-200 rounded-md overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[500px] border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[9px] font-bold text-gray-500">
            <tr>
              ${headersHtml.trim()}
              {(onDelete || onEdit) && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={${fields.length + 1}} className="py-8 text-center text-gray-400">
                  No records stored yet.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50">
                  ${rowsHtml.trim()}
                  {(onDelete || onEdit) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row.id)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
}

/**
 * Creates the JSZip blob for download representing the GitHub-like starter kit
 */
export async function generateApplicationZip(schema: AppSchemaType): Promise<Blob> {
  const zip = new JSZip();

  // 1. root metadata files
  zip.file('schema.json', JSON.stringify(schema, null, 2));

  zip.file('package.json', JSON.stringify({
    name: schema.appName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint'
    },
    dependencies: {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'react-hook-form': '^7.50.0',
      lucide: '^0.300.0',
      'lucide-react': '^0.300.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      '@types/node': '^20.0.0',
      tailwindcss: '^4.0.0',
      postcss: '^8.0.0'
    }
  }, null, 2));

  zip.file('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] }
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules']
  }, null, 2));

  // 2. Readme Setup guide
  const readmeText = `
# Exported App: ${schema.appName}

Generated dynamically by **ForgeAI** — Your runtime-driven AI application platform.

## Architecture

This project is a clean Next.js 15 template containing typed static React components derived from your dynamic JSON schema fields!

### Code Structure
- \`src/schema.json\`: Your original builder JSON model config.
- \`src/components/[entity]/\`: Customized forms and list grids styled with Tailwind.
- \`src/app/page.tsx\`: Dashboard mounting and integrating CRUD actions.

## Quick Start

\`\`\`bash
# 1. Install workspace dependencies
npm install

# 2. Run local Next development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
`;
  zip.file('README.md', readmeText.trim());

  // 3. tailwind configurations
  zip.file('src/app/globals.css', `
@import "tailwindcss";

body {
  background-color: #f9fafb;
  color: #111827;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
  `.trim());

  // 4. Root Page rendering and linking forms
  const importsHtml: string[] = [];
  const mountsHtml: string[] = [];
  const stateHooksHtml: string[] = [];

  schema.entities.forEach(ent => {
    const Cap = ent.name.charAt(0).toUpperCase() + ent.name.slice(1);
    importsHtml.push(`import { ${Cap}Form, ${Cap}Data } from '../components/${ent.name}/Form';`);
    importsHtml.push(`import { ${Cap}Table } from '../components/${ent.name}/Table';`);

    stateHooksHtml.push(`  const [${ent.name}, set${Cap}] = useState<Array<{ id: string; payload: ${Cap}Data }>>([]);`);

    mountsHtml.push(`
        {/* Section: ${ent.label || ent.name} */}
        <section className="space-y-6 border-b pb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-800">${ent.label || Cap}</h2>
            <p className="text-xs text-gray-500">Manage logs and records for ${ent.name}.</p>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-1">
              <${Cap}Form 
                onSubmit={(data) => {
                  set${Cap}(prev => [{ id: Math.random().toString(36).substring(2, 9), payload: data }, ...prev]);
                }} 
              />
            </div>
            <div className="xl:col-span-2">
              <${Cap}Table 
                records={${ent.name}}
                onDelete={(id) => {
                  set${Cap}(prev => prev.filter(r => r.id !== id));
                }}
              />
            </div>
          </div>
        </section>`);
  });

  const pageCode = `'use client';

import React, { useState } from 'react';
${importsHtml.join('\n')}

export default function Home() {
${stateHooksHtml.join('\n')}

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-12">
      {/* Header */}
      <header className="border-b pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">${schema.appName}</h1>
        <p className="text-sm text-gray-500 mt-1">${schema.description || 'Statically exported Next.js app.'}</p>
      </header>

      {/* Dynamic Entity Workspaces */}
      <div className="space-y-12">
        ${mountsHtml.join('\n').trim().split('\n').join('\n        ')}
      </div>
    </main>
  );
}
`;

  zip.file('src/app/page.tsx', pageCode);

  zip.file('src/app/layout.tsx', `
import './globals.css';

export const metadata = {
  title: '${schema.appName}',
  description: 'Generated by ForgeAI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
  `.trim());

  // 5. Generate Entity components
  schema.entities.forEach(ent => {
    const formCode = generateStaticFormCode(ent);
    const tableCode = generateStaticTableCode(ent);

    zip.file(`src/components/${ent.name}/Form.tsx`, formCode);
    zip.file(`src/components/${ent.name}/Table.tsx`, tableCode);
  });

  return await zip.generateAsync({ type: 'blob' });
}
