'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Terminal, LayoutDashboard, LogOut, Bell, X, Trash2, Cpu, User as UserIcon } from 'lucide-react';
import { runtimeLogger, SystemLog } from '@/lib/logger/runtime-logger';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // 2. Fetch logs and track client notification hub
  const refreshLogs = () => {
    const activeLogs = runtimeLogger.getLogs();
    setLogs(activeLogs);
    // Unread count based on warn/error count in logs
    const criticalLogs = activeLogs.filter(l => l.level === 'error' || l.level === 'warn').length;
    setUnreadCount(criticalLogs);
  };

  useEffect(() => {
    refreshLogs();

    // Listen to custom logger event
    const handleNewLog = () => {
      refreshLogs();
    };

    window.addEventListener('forgeai-new-log', handleNewLog);
    window.addEventListener('forgeai-logs-cleared', handleNewLog);

    return () => {
      window.removeEventListener('forgeai-new-log', handleNewLog);
      window.removeEventListener('forgeai-logs-cleared', handleNewLog);
    };
  }, []);

  const handleClearLogs = () => {
    runtimeLogger.clearLogs();
    refreshLogs();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 font-mono gap-4 select-none">
        <Cpu className="h-8 w-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground tracking-widest uppercase">Validating User Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden font-sans select-none">
      
      {/* 1. Sidebar Navigation */}
      <aside className="hidden md:flex flex-col justify-between w-64 border-r border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <Terminal className="h-5 w-5 text-emerald-500" />
            <span className="font-mono text-sm font-extrabold tracking-widest">FORGEAI</span>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => router.push('/dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                pathname === '/dashboard'
                  ? 'bg-zinc-800 text-zinc-50 border border-zinc-700'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Apps Workspace
            </button>
          </nav>
        </div>

        {/* Sidebar Footer User Details */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-md border border-zinc-800/30">
            <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-300 truncate">Developer Console</p>
              <p className="text-[9px] font-mono text-zinc-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              title="Logout Session"
              className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Page Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header Bar */}
        <header className="h-14 border-b border-zinc-850 bg-zinc-900/60 backdrop-blur flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <Terminal className="md:hidden h-5 w-5 text-emerald-500" />
            <span className="font-mono text-xs font-bold md:hidden tracking-wider mr-2">FORGEAI</span>
            <span className="hidden md:inline text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono">
              Console / {pathname === '/dashboard' ? 'Apps' : 'Builder'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Center Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-1.5 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer relative ${
                  showNotifications ? 'bg-zinc-800 text-zinc-100' : ''
                }`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>

              {/* Collapsible Dropdown Notification Alert Hub */}
              {showNotifications && (
                <div className="absolute right-0 mt-2.5 w-80 md:w-96 border border-zinc-800 rounded-lg bg-zinc-900 shadow-xl z-50 p-4 space-y-4 max-h-[400px] overflow-y-auto font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="font-bold text-zinc-200">SYSTEM NOTIFICATIONS</span>
                    <div className="flex items-center gap-2">
                      {logs.length > 0 && (
                        <button
                          onClick={handleClearLogs}
                          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {logs.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500">
                      No recent warning alerts or workflow triggers recorded.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logs.slice(0, 15).map((log) => (
                        <div
                          key={log.id}
                          className={`p-2.5 rounded border border-zinc-850 bg-zinc-950/40 text-[10px] space-y-1 ${
                            log.level === 'error'
                              ? 'border-red-500/10 bg-red-500/5 text-red-300'
                              : log.level === 'warn'
                              ? 'border-amber-500/10 bg-amber-500/5 text-amber-300'
                              : 'text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>[{log.category.toUpperCase()}]</span>
                            <span className="text-[8px] text-zinc-600">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="leading-relaxed">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Mobile Logout trigger */}
            <button
              onClick={() => logout()}
              className="md:hidden p-1.5 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content Box */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
