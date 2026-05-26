'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Cpu, Database, Trash2, ArrowRight, MessageSquare, ShieldAlert, Sparkles, Loader2, X, Terminal } from 'lucide-react';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

interface AppConfigItem {
  id: string;
  name: string;
  version: number;
  schema: any;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // App creation modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isAiMode, setIsAiMode] = useState(true);
  const [appName, setAppName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // System stats
  const [stats, setStats] = useState({
    totalApps: 0,
    dbFallback: false,
  });

  const fetchApps = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
        
        // Fetch database fallback state from log headers or endpoint checks
        // Our client exposed db.isFallbackActive() which is synced to console warning logs
        const offlineLogs = runtimeLogger.getLogs().some(l => l.category === 'database' && l.level === 'warn');
        setStats({
          totalApps: data.apps?.length || 0,
          dbFallback: offlineLogs
        });
      }
    } catch (e) {
      runtimeLogger.error('api', 'Failed to fetch application registry list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleDeleteApp = async (e: React.MouseEvent, appId: string, name: string) => {
    e.stopPropagation(); // Avoid triggering card routing
    if (!confirm(`Are you absolutely sure you want to delete "${name}"? All associated dynamic database records will be lost.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/apps/${appId}`, { method: 'DELETE' });
      if (res.ok) {
        setApps(prev => prev.filter(app => app.id !== appId));
        setStats(prev => ({ ...prev, totalApps: Math.max(0, prev.totalApps - 1) }));
        runtimeLogger.info('api', `Deleted application: ${name}`);
      } else {
        alert('Failed to delete application.');
      }
    } catch (e) {
      alert('Delete operation failed.');
    }
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    let finalSchema: any = null;
    let finalName = appName.trim();

    try {
      if (isAiMode) {
        if (!prompt.trim()) {
          setErrorMsg('AI Assistant requires a prompt description.');
          setIsSubmitting(false);
          return;
        }

        // Call compile prompt API
        const compileRes = await fetch('/api/ai/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        
        const compileData = await compileRes.json();
        if (!compileRes.ok || !compileData.success) {
          throw new Error(compileData.error || 'Failed to compile AI prompt');
        }

        finalSchema = compileData.schema;
        finalName = finalSchema.appName || 'AI Generated App';
      } else {
        if (!finalName) {
          setErrorMsg('Application name is required.');
          setIsSubmitting(false);
          return;
        }

        // Blank template schema
        finalSchema = {
          appName: finalName,
          description: 'Custom dynamic builder template initialized from scratch.',
          entities: [
            {
              name: 'items',
              label: 'Items Registry',
              fields: [
                { name: 'title', type: 'text', required: true, placeholder: 'Enter item name' },
                { name: 'category', type: 'select', options: ['Hardware', 'Software', 'Support'], defaultValue: 'Hardware' },
                { name: 'quantity', type: 'number', placeholder: 'Stock count' }
              ],
              layout: { columns: 2 }
            }
          ],
          workflows: []
        };
      }

      // Save App Config to Database
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          schema: finalSchema,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to register application configuration');
      } else {
        setShowCreateModal(false);
        setAppName('');
        setPrompt('');
        
        // Redirect directly to the schema builder interface!
        router.push(`/dashboard/builder/${data.app.id}`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'System crash during builder compile pipeline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      
      {/* 1. Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight">Apps Workspace</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage, configure, and inspect your dynamically generated micro-apps.</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Application
        </button>
      </div>

      {/* 2. System Status & Metrics Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Metric: Total apps */}
        <div className="border border-zinc-850 bg-zinc-900/50 rounded-lg p-5 flex items-start gap-4 shadow-sm">
          <div className="p-2.5 bg-emerald-500/10 rounded-md text-emerald-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">Active Apps</p>
            <h3 className="text-2xl font-bold mt-1 text-zinc-100">{stats.totalApps}</h3>
            <p className="text-[10px] text-zinc-500 leading-normal mt-1">Ready for CRUD processing.</p>
          </div>
        </div>

        {/* Metric: Database Status */}
        <div className={`border rounded-lg p-5 flex items-start gap-4 shadow-sm ${
          stats.dbFallback
            ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-zinc-850 bg-zinc-900/50'
        }`}>
          <div className={`p-2.5 rounded-md ${
            stats.dbFallback ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
          }`}>
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">Engine Storage</p>
            <h3 className="text-lg font-bold mt-1.5 text-zinc-100">
              {stats.dbFallback ? 'Resilient Sandbox Fallback' : 'Persistent PostgreSQL'}
            </h3>
            <p className="text-[10px] text-zinc-500 leading-normal mt-0.5">
              {stats.dbFallback
                ? 'Offline memory storage active. Zero database setups required!'
                : 'Prisma Client connected successfully. Persisting records.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Apps Listing Grid */}
      <div className="space-y-4">
        {/* Search Toolbar */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-600 focus:border-zinc-700"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-lg border border-zinc-850 bg-zinc-900/20 animate-pulse" />
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="border border-zinc-850 bg-zinc-900/10 rounded-lg py-16 text-center">
            <div className="flex flex-col items-center justify-center gap-3 max-w-xs mx-auto">
              <div className="p-3 bg-zinc-800/40 rounded-full text-zinc-500">
                <Sparkles className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-sm text-zinc-200">No applications registered</h4>
              <p className="text-xs text-zinc-400">
                {searchQuery
                  ? `No search results match "${searchQuery}".`
                  : 'Start by compiling an application using AI descriptions or initializing one from scratch.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors cursor-pointer"
                >
                  Create Your First App
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                onClick={() => router.push(`/dashboard/builder/${app.id}`)}
                className="group border border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900/60 rounded-lg p-5 flex flex-col justify-between h-40 shadow-sm hover:border-zinc-700 transition-all cursor-pointer relative"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-sm text-zinc-200 group-hover:text-emerald-400 truncate pr-6 transition-colors">
                      {app.name}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteApp(e, app.id, app.name)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 absolute top-4 right-4 z-10 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2">
                    {app.schema?.description || 'AI Compiled application registry.'}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 select-none">
                  <span className="font-mono text-[9px] text-zinc-500">
                    Engine Version: {app.version || 1}
                  </span>
                  
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400">
                    Open Builder
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. AI Generator / Builder Wizard Dialog Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-zinc-800 bg-zinc-900 rounded-lg shadow-xl p-6 space-y-6 max-h-[90vh] overflow-y-auto font-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-emerald-500" />
                <span className="font-bold text-zinc-100 text-sm tracking-wide">INITIALIZE BUILDER</span>
              </div>
              <button
                onClick={() => { setShowCreateModal(false); setErrorMsg(null); }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toggle Modes */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 border border-zinc-850 rounded-md text-xs font-semibold select-none">
              <button
                type="button"
                onClick={() => { setIsAiMode(true); setErrorMsg(null); }}
                className={`py-1.5 rounded text-center transition-all cursor-pointer ${
                  isAiMode ? 'bg-zinc-800 text-emerald-400 font-bold border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="h-3 w-3 inline mr-1" />
                AI Assistant panel
              </button>
              <button
                type="button"
                onClick={() => { setIsAiMode(false); setErrorMsg(null); }}
                className={`py-1.5 rounded text-center transition-all cursor-pointer ${
                  !isAiMode ? 'bg-zinc-800 text-emerald-400 font-bold border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Plus className="h-3.5 w-3.5 inline mr-1" />
                Start Blank Template
              </button>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {isAiMode ? (
                /* AI Prompt Mode */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                      Describe the application
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Create a patient clinic booking tracker managing patients and doctors, with automated notification triggers..."
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-700 font-mono"
                    />
                  </div>
                  
                  {/* Prompt recommendations */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Example Templates:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Employee CRM Directory', 'Hospital Patient Dashboard', 'Student Academy Classes', 'Agile Tasks Sprint Board'].map((tpl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPrompt(`Build a ${tpl.toLowerCase()}`)}
                          className="px-2 py-1 text-[10px] border border-zinc-800 bg-zinc-950 rounded hover:border-zinc-700 text-zinc-400 transition-colors cursor-pointer"
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Blank Form Mode */
                <div className="space-y-1">
                  <label htmlFor="appName" className="text-xs font-semibold text-zinc-400">
                    Application Name
                  </label>
                  <input
                    id="appName"
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g. Inventory Tracker"
                    className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-700"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setErrorMsg(null); }}
                  className="px-4 py-2 text-xs font-semibold border border-zinc-800 rounded-md hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-605 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Compiling...
                    </>
                  ) : (
                    <>
                      <Cpu className="h-3.5 w-3.5" />
                      Initialize Platform
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
