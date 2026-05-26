'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { KeyRound, Mail, Terminal, ShieldAlert, Cpu, Sparkles } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, error: authError, setUser } = useAuthStore();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!email || !password) {
      setFormError('Please fill in all credentials.');
      setIsSubmitting(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Authentication failed. Please verify your credentials.');
      } else {
        // Authenticated successfully
        setUser(data.user);
        router.push('/dashboard');
      }
    } catch (e) {
      setFormError('Connection timed out. Please check your local network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 font-mono gap-4 select-none">
        <Cpu className="h-8 w-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground tracking-widest uppercase">Initializing Secure Runtime Environment...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen grid-cols-1 md:grid-cols-2 bg-zinc-950 text-zinc-50 relative overflow-hidden font-sans">
      {/* Decorative Left Side for Screens Larger Than Mobile */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-zinc-900 border-r border-zinc-800 relative z-10 w-1/2">
        <div className="flex items-center gap-2 select-none">
          <Terminal className="h-5 w-5 text-emerald-500" />
          <span className="font-mono text-sm font-bold tracking-widest text-zinc-100">FORGEAI v1.0.0</span>
        </div>

        <div className="space-y-4 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
            <Sparkles className="h-3 w-3" />
            AI-POWERED RUNTIME
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight leading-none text-zinc-100">
            Generate full-stack SaaS panels in seconds.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            ForgeAI compiles natural language prompts dynamically into production-grade multi-entity interfaces, schemas, validation boundaries, and REST APIs. Zero build compilations. Endless flexibility.
          </p>
        </div>

        <div className="text-xs text-zinc-500 font-mono">
          © {new Date().getFullYear()} ForgeAI. Edge Runtime-Engine. All rights reserved.
        </div>
      </div>

      {/* Auth Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 z-10">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center gap-2 pb-4">
            <Terminal className="h-5 w-5 text-emerald-500" />
            <span className="font-mono text-xs font-bold tracking-widest">FORGEAI</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
              {isLogin ? 'Sign in to platform' : 'Create developer account'}
            </h2>
            <p className="text-xs text-zinc-400">
              {isLogin ? 'Welcome back! Enter your developer credentials.' : 'Initialize your workspace credentials to start building.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {(formError || authError) && (
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError || authError}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-400">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-600 focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-400">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-600 focus:border-zinc-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 text-sm font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isSubmitting ? 'Authenticating...' : isLogin ? 'Access Console' : 'Initialize Workspace'}
            </button>
          </form>

          {/* Toggle */}
          <div className="text-center text-xs">
            <span className="text-zinc-400">
              {isLogin ? "Don't have an account? " : 'Already registered? '}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setFormError(null);
              }}
              className="font-semibold text-emerald-500 hover:text-emerald-400 hover:underline cursor-pointer"
            >
              {isLogin ? 'Create one now' : 'Sign in instead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
