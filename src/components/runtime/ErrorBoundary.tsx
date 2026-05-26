'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

interface Props {
  children: ReactNode;
  fallbackName?: string;
  appId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDiagnostics: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDiagnostics: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log the error to our custom logger
    runtimeLogger.error(
      'crash',
      `Render Crash in [${this.props.fallbackName || 'Component'}]: ${error.message}`,
      {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
      this.props.appId
    );
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private toggleDiagnostics = () => {
    this.setState(prev => ({ showDiagnostics: !prev }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-5 my-4 backdrop-blur-sm shadow-sm transition-all">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500/10 rounded-md text-red-500 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            
            <div className="flex-1 space-y-2">
              <div>
                <h4 className="font-semibold text-red-400 text-sm md:text-base">
                  Component Rendering Failure
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Failed to load component: <span className="font-mono text-foreground font-semibold">{this.props.fallbackName || 'Unknown Component'}</span>
                </p>
              </div>

              <div className="bg-background/80 border border-border rounded p-3 text-xs font-mono text-red-400 max-w-full overflow-x-auto">
                {this.state.error?.message || 'Unknown runtime rendering error'}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry Render
                </button>

                <button
                  onClick={this.toggleDiagnostics}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded text-foreground hover:bg-accent transition-colors"
                >
                  <Terminal className="h-3 w-3" />
                  {this.state.showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
                  {this.state.showDiagnostics ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>

              {this.state.showDiagnostics && (
                <div className="mt-4 border border-border/80 rounded bg-black/40 text-[11px] font-mono text-foreground p-3 overflow-x-auto space-y-2 max-h-60">
                  <div className="text-muted-foreground border-b border-border/40 pb-1 flex justify-between">
                    <span>STACK TRACE DIAGNOSTICS</span>
                    <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">DEBUG MODE</span>
                  </div>
                  <pre className="text-red-400/90 leading-relaxed font-mono whitespace-pre-wrap">
                    {this.state.error?.stack}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <div className="text-muted-foreground border-t border-border/40 pt-2 pb-1 font-semibold">
                        Component Tree Stack:
                      </div>
                      <pre className="text-muted-foreground/80 leading-relaxed font-mono whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
