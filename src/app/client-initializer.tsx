'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function ClientInitializer() {
  const checkSession = useAuthStore(state => state.checkSession);

  useEffect(() => {
    // 1. Authenticate user session
    checkSession();

    // 2. Register PWA Service Worker
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('ForgeAI SW registered successfully with scope:', registration.scope);
          })
          .catch((error) => {
            console.error('ForgeAI SW registration failed:', error);
          });
      });
    }
  }, [checkSession]);

  return null;
}
