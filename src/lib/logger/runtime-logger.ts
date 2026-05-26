export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'validation' | 'workflow' | 'component' | 'crash' | 'api' | 'database' | 'auth' | 'ai';

export interface SystemLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
  appId?: string;
}

// In-memory buffer for logs (singleton on server/client respectively)
const LOG_BUFFER_LIMIT = 200;
let localLogs: SystemLog[] = [];

// For client-server synchronization, we can push to a local storage or in-memory array.
export const runtimeLogger = {
  log(level: LogLevel, category: LogCategory, message: string, details?: any, appId?: string): SystemLog {
    const formattedDetails = typeof details === 'object' ? JSON.stringify(details, null, 2) : details;
    const logItem: SystemLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: formattedDetails,
      appId,
    };

    // Print to developer console
    const prefix = `[ForgeAI][${logItem.timestamp}][${level.toUpperCase()}][${category.toUpperCase()}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, details || '');
    } else {
      console.log(`${prefix} ${message}`, details || '');
    }

    localLogs.unshift(logItem);
    if (localLogs.length > LOG_BUFFER_LIMIT) {
      localLogs.pop();
    }

    // Keep logs persisted in localStorage if in browser environment
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('forgeai_system_logs');
        const parsed = stored ? JSON.parse(stored) : [];
        parsed.unshift(logItem);
        if (parsed.length > LOG_BUFFER_LIMIT) parsed.pop();
        localStorage.setItem('forgeai_system_logs', JSON.stringify(parsed));
        // Dispatch a custom event to update dashboard in real-time
        window.dispatchEvent(new CustomEvent('forgeai-new-log', { detail: logItem }));
      } catch (e) {
        // Silently catch local storage errors (e.g. quota exceeded)
      }
    }

    return logItem;
  },

  info(category: LogCategory, message: string, details?: any, appId?: string) {
    return this.log('info', category, message, details, appId);
  },

  warn(category: LogCategory, message: string, details?: any, appId?: string) {
    return this.log('warn', category, message, details, appId);
  },

  error(category: LogCategory, message: string, details?: any, appId?: string) {
    return this.log('error', category, message, details, appId);
  },

  getLogs(): SystemLog[] {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('forgeai_system_logs');
        return stored ? JSON.parse(stored) : localLogs;
      } catch (e) {
        return localLogs;
      }
    }
    return localLogs;
  },

  clearLogs() {
    localLogs = [];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('forgeai_system_logs');
        window.dispatchEvent(new CustomEvent('forgeai-logs-cleared'));
      } catch (e) {}
    }
  }
};
