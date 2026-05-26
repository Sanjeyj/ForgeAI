'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Terminal, Sparkles, Code, Play, RefreshCw, AlertTriangle, 
  Download, ArrowLeft, Settings, Layers, Info, X
} from 'lucide-react';
import { safeParseSchema, AppSchemaType } from '@/lib/schema/schema-validator';
import { runtimeLogger, SystemLog } from '@/lib/logger/runtime-logger';
import { generateApplicationZip } from '@/lib/runtime/export-engine';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { DynamicTable } from '@/components/tables/DynamicTable';
import { ErrorBoundary } from '@/components/runtime/ErrorBoundary';

interface BuilderPageProps {
  params: Promise<{ id: string }>;
}

export default function BuilderPage({ params }: BuilderPageProps) {
  const router = useRouter();
  
  // Resolve Next.js 15 params promise
  const { id: appId } = use(params);

  // App & Schema states
  const [appName, setAppName] = useState('Dynamic Engine');
  const [schemaJson, setSchemaJson] = useState('{}');
  const [schema, setSchema] = useState<AppSchemaType | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  
  // UI Panels / Control states
  const [activeTab, setActiveTab] = useState<'preview' | 'schema' | 'logs' | 'workflows' | 'export'>('preview');
  const [activeEntityName, setActiveEntityName] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  
  // CRUD Data states
  const [records, setRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{ id: string; payload: any } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Local component log cache
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  // 1. Fetch original app config
  const fetchAppConfig = async () => {
    try {
      const res = await fetch(`/api/apps/${appId}`);
      if (!res.ok) {
        runtimeLogger.error('api', 'Failed to retrieve application config');
        router.push('/dashboard');
        return;
      }
      const data = await res.json();
      const dbSchema = data.app.schema;
      setAppName(data.app.name);

      // Format schema to string
      const formattedJson = JSON.stringify(dbSchema, null, 2);
      setSchemaJson(formattedJson);

      // Parse and load
      const parseResult = safeParseSchema(dbSchema, appId);
      setSchema(parseResult.schema);
      setWarnings(parseResult.warnings);
      setErrors(parseResult.errors);

      if (parseResult.schema.entities.length > 0) {
        setActiveEntityName(parseResult.schema.entities[0].name);
      }
    } catch (e) {
      runtimeLogger.error('api', 'App config fetch crash');
    }
  };

  // 2. Fetch runtime records
  const fetchRecords = async (entityName: string) => {
    if (!entityName) return;
    setIsLoadingRecords(true);
    try {
      const res = await fetch(`/api/runtime/${entityName}?appId=${appId}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (e) {
      runtimeLogger.error('api', `Failed to load records for entity ${entityName}`);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const syncSystemLogs = () => {
    setSystemLogs(runtimeLogger.getLogs().filter(l => l.appId === appId || !l.appId));
  };

  useEffect(() => {
    fetchAppConfig();
    syncSystemLogs();

    // Listen for custom logged warnings during builds
    const handleNewLog = () => syncSystemLogs();
    window.addEventListener('forgeai-new-log', handleNewLog);
    return () => window.removeEventListener('forgeai-new-log', handleNewLog);
  }, [appId]);

  // Refetch records when selected entity tab changes
  useEffect(() => {
    if (activeEntityName) {
      fetchRecords(activeEntityName);
      setEditingRecord(null);
    }
  }, [activeEntityName]);

  // 3. AI assistant prompt handler
  const handleAiRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsCompiling(true);
    
    // Inject builder context warning
    runtimeLogger.info('ai', `AI prompt refining active layout...`, { prompt: aiPrompt }, appId);

    try {
      const compileRes = await fetch('/api/ai/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `Using our current schema: ${schemaJson}, apply this revision: ${aiPrompt}` 
        }),
      });

      const compileData = await compileRes.json();
      if (!compileRes.ok || !compileData.success) {
        throw new Error(compileData.error || 'Failed to refine layout');
      }

      const refinedSchema = compileData.schema;
      const formattedJson = JSON.stringify(refinedSchema, null, 2);
      setSchemaJson(formattedJson);

      // Defensively parse and apply schema
      const parseResult = safeParseSchema(refinedSchema, appId);
      setSchema(parseResult.schema);
      setWarnings(parseResult.warnings);
      setErrors(parseResult.errors);
      setJsonParseError(null);

      if (parseResult.schema.entities.length > 0) {
        const exists = parseResult.schema.entities.some(e => e.name === activeEntityName);
        if (!exists) setActiveEntityName(parseResult.schema.entities[0].name);
      }

      setAiPrompt('');
      
      // Auto-save changes
      await saveSchemaToDb(refinedSchema);
      
      runtimeLogger.info('ai', `AI refined schema successfully. Layout rebuilt.`, null, appId);
    } catch (e: any) {
      runtimeLogger.error('ai', 'AI compilation pipeline failed', { error: e.message }, appId);
      alert(`AI Compile Failed: ${e.message}`);
    } finally {
      setIsCompiling(true); // Wait, set to false
      setIsCompiling(false);
    }
  };

  // 4. Save schema updates directly
  const saveSchemaToDb = async (schemaToSave: any) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: appName,
          schema: schemaToSave,
        }),
      });

      if (!res.ok) {
        throw new Error('Save transaction rejected by DB');
      }

      const data = await res.json();
      setWarnings(data.warnings || []);
    } catch (e: any) {
      runtimeLogger.error('database', 'Failed to save schema update to database', { error: e.message }, appId);
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Raw Schema Text Editor Changes
  const handleSchemaJsonChange = (val: string) => {
    setSchemaJson(val);
    setJsonParseError(null);

    try {
      const parsed = JSON.parse(val);
      
      // Validate
      const parseResult = safeParseSchema(parsed, appId);
      setSchema(parseResult.schema);
      setWarnings(parseResult.warnings);
      setErrors(parseResult.errors);

      if (parseResult.schema.entities.length > 0) {
        const exists = parseResult.schema.entities.some(e => e.name === activeEntityName);
        if (!exists) setActiveEntityName(parseResult.schema.entities[0].name);
      }

      // Auto-save parsed content
      saveSchemaToDb(parsed);
    } catch (e: any) {
      // Catch JSON syntax errors defensively, avoiding UI crashes
      setJsonParseError(`JSON Syntax Error: ${e.message}`);
      // Do NOT update parsed schema state so UI remains fully rendered and safe!
    }
  };

  // 6. Dynamic CRUD - Insert row
  const handleSubmitRecord = async (payload: any) => {
    setIsLoadingRecords(true);
    try {
      const res = await fetch(`/api/runtime/${activeEntityName}?appId=${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        runtimeLogger.info('database', `Added record to ${activeEntityName}`, { payload }, appId);
        fetchRecords(activeEntityName);
      } else {
        const data = await res.json();
        alert(`Failed to save record: ${data.error || 'Validation error'}`);
      }
    } catch (e) {
      alert('Network save error');
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // 7. Dynamic CRUD - Update row
  const handleUpdateRecord = async (payload: any) => {
    if (!editingRecord) return;
    setIsLoadingRecords(true);
    try {
      const res = await fetch(`/api/runtime/${activeEntityName}/${editingRecord.id}?appId=${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        runtimeLogger.info('database', `Updated record ${editingRecord.id} in ${activeEntityName}`, { payload }, appId);
        setShowEditModal(false);
        setEditingRecord(null);
        fetchRecords(activeEntityName);
      } else {
        const data = await res.json();
        alert(`Failed to update record: ${data.error || 'Validation error'}`);
      }
    } catch (e) {
      alert('Network update error');
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // 8. Dynamic CRUD - Delete row
  const handleDeleteRecord = async (recordId: string) => {
    try {
      const res = await fetch(`/api/runtime/${activeEntityName}/${recordId}?appId=${appId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        runtimeLogger.info('database', `Erased record ${recordId} in ${activeEntityName}`, null, appId);
        fetchRecords(activeEntityName);
      } else {
        alert('Failed to delete record.');
      }
    } catch (e) {
      alert('Delete request failed.');
    }
  };

  // 9. Zip Exporter Trigger
  const handleExportZip = async () => {
    if (!schema) return;
    try {
      runtimeLogger.info('workflow', 'Assembling Next.js 15 starter templates into ZIP archive...', null, appId);
      const blob = await generateApplicationZip(schema);
      
      // Start download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-nextjs-starter.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      runtimeLogger.info('workflow', 'Export successful! ZIP archive downloaded.', null, appId);
      alert('Starter kit project exported successfully!');
    } catch (e) {
      alert('Export failed.');
    }
  };

  // Pre-calculate active selected entity definition
  const activeEntityDef = schema?.entities.find(e => e.name === activeEntityName) || null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-zinc-950 font-sans overflow-hidden">
      
      {/* ========================================================
          LEFT: AI Assistant Panel & Builder Sidebar Controls
          ======================================================== */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-900/40 flex flex-col justify-between shrink-0 h-full overflow-y-auto">
        <div className="p-5 space-y-6">
          
          {/* Back button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-350 transition-colors uppercase tracking-wider font-semibold select-none cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            Workspace Apps
          </button>

          {/* Title Area */}
          <div>
            <h1 className="text-base font-extrabold text-zinc-100 truncate">{appName}</h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">ID: {appId}</p>
          </div>

          {/* AI Refiner Panel */}
          <div className="space-y-3 bg-zinc-900 border border-zinc-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-1.5 text-zinc-200">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold tracking-wide">AI Assistant Panel</span>
            </div>
            
            <form onSubmit={handleAiRefine} className="space-y-2">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Add a custom notes field to employees, and append a trigger workflow logging logs..."
                rows={3}
                className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-200 placeholder:text-zinc-700"
              />
              <button
                type="submit"
                disabled={isCompiling || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[10px] font-bold tracking-wide cursor-pointer transition-colors"
              >
                {isCompiling ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Compiling Revisions...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Apply AI Revisions
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Entity list manager preview */}
          {schema && schema.entities.length > 0 && (
            <div className="space-y-2 select-none">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dynamic Entities ({schema.entities.length})</span>
              <div className="space-y-1">
                {schema.entities.map(ent => (
                  <button
                    key={ent.name}
                    onClick={() => { setActiveEntityName(ent.name); setActiveTab('preview'); }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      activeEntityName === ent.name && activeTab === 'preview'
                        ? 'bg-zinc-850 text-emerald-400 font-bold border border-zinc-800'
                        : 'text-zinc-400 hover:bg-zinc-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate">{ent.label || ent.name}</span>
                    </div>
                    <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1 rounded">
                      {ent.fields.length} cols
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Dynamic Warning Banner */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/20 text-[10px] font-mono space-y-1">
          <div className="flex items-center justify-between text-zinc-500 pb-1">
            <span>VALIDATION SHIELD</span>
            {errors.length > 0 ? (
              <span className="bg-red-500/20 text-red-400 px-1 rounded font-bold">ERRORS</span>
            ) : warnings.length > 0 ? (
              <span className="bg-amber-500/20 text-amber-400 px-1 rounded font-bold">WARNINGS</span>
            ) : (
              <span className="bg-green-500/20 text-green-400 px-1 rounded font-bold">SECURE</span>
            )}
          </div>
          {errors.length > 0 ? (
            <p className="text-red-400 leading-normal">
              Schema has errors. Direct UI fallbacks active. Review editor code.
            </p>
          ) : warnings.length > 0 ? (
            <p className="text-amber-400 leading-normal">
              Detected unsupported field types. Fallback inputs generated.
            </p>
          ) : (
            <p className="text-zinc-500 leading-normal">
              Compiled config parsed successfully. Live CRUD mapping initialized.
            </p>
          )}
        </div>
      </aside>

      {/* ========================================================
          RIGHT: Primary Workspace & View Tabs
          ======================================================== */}
      <section className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* Navigation Tabs Bar */}
        <nav className="h-11 border-b border-zinc-850 bg-zinc-900/20 flex items-center justify-between px-6 shrink-0 z-10 select-none">
          <div className="flex gap-4">
            {[
              { id: 'preview', label: 'Live Preview', icon: Play },
              { id: 'schema', label: 'Schema Editor', icon: Code },
              { id: 'logs', label: 'System Logs', icon: Terminal },
              { id: 'export', label: 'Export Workspace', icon: Download }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 h-11 text-xs font-semibold px-1.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-400 font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-[10px] text-zinc-500 font-mono animate-pulse">Auto-saving database...</span>
            )}
          </div>
        </nav>

        {/* Tab View Container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* ==============================================
              TAB 1: LIVE PREVIEW & CRUD RUNTIME DEMO
              ============================================== */}
          {activeTab === 'preview' && (
            <div className="space-y-8 max-w-6xl">
              
              {!activeEntityName ? (
                <div className="border border-zinc-850 bg-zinc-900/10 rounded-lg py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 max-w-xs mx-auto">
                    <Info className="h-6 w-6 text-zinc-500" />
                    <h4 className="font-bold text-sm text-zinc-200">No entities configured</h4>
                    <p className="text-xs text-zinc-400">
                      Use the AI Assistant Panel or open the Schema Editor to create entity grids.
                    </p>
                  </div>
                </div>
              ) : !activeEntityDef ? (
                /* Unsupported/Corrupted Layout Crash isolation fallback */
                <div className="p-4 border border-red-500/20 bg-red-500/5 text-red-400 rounded-md">
                  Failed to resolve entity metadata for Plural Name: [<strong>{activeEntityName}</strong>]. App degraded gracefully to preserve workspace windows.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Entity Information Header */}
                  <div>
                    <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight">
                      Entity Workspace: {activeEntityDef.label || activeEntityName.charAt(0).toUpperCase() + activeEntityName.slice(1)}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Dynamic React components compiled using field properties of Plural Name: <span className="font-mono bg-zinc-900 text-zinc-300 px-1 py-0.5 rounded">{activeEntityName}</span>.
                    </p>
                  </div>

                  {/* Dynamic split CRUD panel */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                    
                    {/* LEFT Column: Interactive dynamic form entry wrapped in ErrorBoundary */}
                    <div className="xl:col-span-1 space-y-4">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <h3 className="text-xs font-extrabold text-zinc-200 uppercase tracking-wide">Form Generator</h3>
                          <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1 rounded uppercase tracking-wider font-semibold">Zod validated</span>
                        </div>
                        
                        <ErrorBoundary fallbackName={`DynamicForm: ${activeEntityName}`} appId={appId}>
                          <DynamicForm
                            entity={activeEntityDef}
                            onSubmit={handleSubmitRecord}
                            isLoading={isLoadingRecords}
                            submitLabel={`Add ${activeEntityName.slice(0, -1)}`}
                            appId={appId}
                          />
                        </ErrorBoundary>
                      </div>
                    </div>

                    {/* RIGHT Column: Searchable, sorted, paginated dynamic table list */}
                    <div className="xl:col-span-2">
                      <ErrorBoundary fallbackName={`DynamicTable: ${activeEntityName}`} appId={appId}>
                        <DynamicTable
                          entity={activeEntityDef}
                          records={records}
                          isLoading={isLoadingRecords}
                          onEdit={(record) => {
                            setEditingRecord(record);
                            setShowEditModal(true);
                          }}
                          onDelete={handleDeleteRecord}
                        />
                      </ErrorBoundary>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==============================================
              TAB 2: RAW SCHEMA JSON EDITOR
              ============================================== */}
          {activeTab === 'schema' && (
            <div className="space-y-6 max-w-4xl h-full flex flex-col">
              
              <div>
                <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                  <Code className="h-5 w-5 text-emerald-400" />
                  JSON Schema Compiler
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Directly modify the application configuration schema below. Saving is validated instantly using dynamic auto-healers.
                </p>
              </div>

              {jsonParseError && (
                <div className="flex items-start gap-2.5 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{jsonParseError}</span>
                </div>
              )}

              {/* Code text-area editor */}
              <div className="flex-1 flex flex-col border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900 shadow-md">
                <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2 flex justify-between items-center select-none font-mono text-[10px]">
                  <span className="text-zinc-500">SCHEMATIC CODE BLOCK</span>
                  {jsonParseError ? (
                    <span className="text-red-400 font-semibold uppercase animate-pulse">Parsing Paused</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold uppercase">Auto-sync Active</span>
                  )}
                </div>
                
                <textarea
                  value={schemaJson}
                  onChange={(e) => handleSchemaJsonChange(e.target.value)}
                  className="flex-1 min-h-[400px] w-full p-4 bg-zinc-950 text-zinc-300 font-mono text-[11px] leading-relaxed resize-y focus:outline-none placeholder:text-zinc-800"
                  spellCheck="false"
                />
              </div>

              <div className="border border-zinc-850 bg-zinc-900/20 rounded-md p-4 space-y-2 select-none">
                <h5 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Editor Guide</h5>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  - <strong>entities</strong> array defines dynamic databases and data form shapes.<br />
                  - <strong>columns</strong> layout accepts numeric counts 1-4 adjusting screen responsiveness.<br />
                  - <strong>workflows</strong> binds custom automated events. triggers: <code>employees.created</code>, <code>employees.deleted</code>, actions: <code>send_notification</code>, <code>log_action</code>, <code>create_record</code>.
                </p>
              </div>
            </div>
          )}

          {/* ==============================================
              TAB 3: SYSTEM LOGS PANEL
              ============================================== */}
          {activeTab === 'logs' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-emerald-400" />
                  System Logs Panel
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Real-time engine debugger. Captures dyn-component warnings, database fallback swaps, validation alerts, and background triggers.
                </p>
              </div>

              <div className="border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden shadow-md">
                <div className="bg-zinc-900 border-b border-zinc-850 px-4 py-2.5 flex justify-between items-center text-xs select-none">
                  <span className="font-semibold text-zinc-400">ENGINE EXECUTION TRACES</span>
                  <button
                    onClick={() => { runtimeLogger.clearLogs(); syncSystemLogs(); }}
                    className="text-[10px] text-zinc-500 hover:text-red-400 font-bold transition-colors cursor-pointer"
                  >
                    Flush logs
                  </button>
                </div>

                <div className="p-4 space-y-2 font-mono text-[10px] max-h-[500px] overflow-y-auto">
                  {systemLogs.length === 0 ? (
                    <div className="py-12 text-center text-zinc-650">
                      No logs captured in current execution window. Make database insertions to trigger logs.
                    </div>
                  ) : (
                    systemLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded border border-zinc-850 bg-zinc-900/10 flex flex-col md:flex-row md:items-start justify-between gap-3 ${
                          log.level === 'error'
                            ? 'border-red-500/10 bg-red-500/5 text-red-300'
                            : log.level === 'warn'
                            ? 'border-amber-500/10 bg-amber-500/5 text-amber-300'
                            : 'text-zinc-400'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 font-bold select-none text-[9px] tracking-wider">
                            <span className={`px-1 py-0.5 rounded text-[8px] ${
                              log.level === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : log.level === 'warn'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-zinc-600">|</span>
                            <span>[{log.category.toUpperCase()}]</span>
                          </div>
                          
                          <p className="leading-relaxed font-semibold break-words">{log.message}</p>
                          
                          {log.details && (
                            <pre className="text-[9px] text-zinc-550 border border-zinc-800 bg-zinc-950 p-2.5 rounded max-w-full overflow-x-auto max-h-32 whitespace-pre">
                              {log.details}
                            </pre>
                          )}
                        </div>
                        
                        <span className="text-[8px] text-zinc-600 self-end select-none shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================
              TAB 4: EXPORT WORKSPACE STARTER KITS
              ============================================== */}
          {activeTab === 'export' && (
            <div className="space-y-6 max-w-xl">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-md space-y-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
                    <Download className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-zinc-200">Export Application</h3>
                    <p className="text-xs text-zinc-450 leading-relaxed">
                      Download a structured ZIP file containing a complete developer-ready Next.js 15 starter project.
                    </p>
                  </div>
                </div>

                <div className="border border-zinc-800 bg-zinc-950 rounded p-4 text-[11px] font-mono space-y-2 select-none text-zinc-450">
                  <div className="text-zinc-550 border-b border-zinc-850 pb-1 flex justify-between font-bold uppercase tracking-wider text-[9px]">
                    <span>ZIP Archive Layout</span>
                    <span>READY FOR DEV</span>
                  </div>
                  <pre className="leading-normal">
{`├── package.json          # Next.js 15 config
├── tsconfig.json          # TS typing
├── src/
│   ├── schema.json        # Compiled app JSON config
│   ├── app/
│   │   ├── page.tsx       # Integrated CRUD Dashboard
│   │   └── layout.tsx     # styling shell
│   └── components/
${schema?.entities.map(e => `│       └── ${e.name}/     # Typed Forms & Table logs`).join('\n')}`}
                  </pre>
                </div>

                <button
                  onClick={handleExportZip}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold tracking-wide transition-colors cursor-pointer shadow"
                >
                  <Download className="h-4 w-4" />
                  Export Starter Code Template
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ========================================================
          MODAL: EDIT RECORD DIALOG
          ======================================================== */}
      {showEditModal && editingRecord && activeEntityDef && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl border border-zinc-800 bg-zinc-900 rounded-lg shadow-xl p-6 space-y-6 max-h-[90vh] overflow-y-auto font-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-zinc-100 text-sm tracking-wide">
                  Edit {activeEntityDef.name.slice(0, -1)} entry
                </span>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingRecord(null); }}
                className="text-zinc-500 hover:text-zinc-350 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Dynamic Form mounted with default values in Edit Mode */}
            <ErrorBoundary fallbackName={`DynamicFormEdit: ${activeEntityName}`} appId={appId}>
              <DynamicForm
                entity={activeEntityDef}
                onSubmit={handleUpdateRecord}
                isLoading={isLoadingRecords}
                defaultValues={editingRecord.payload}
                submitLabel="Update Entry"
                appId={appId}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

    </div>
  );
}
