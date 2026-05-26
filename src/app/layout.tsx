import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ClientInitializer } from './client-initializer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ForgeAI | Dynamic App Generator & Runtime Engine',
  description: 'Stateless, resilient AI-powered SaaS builder, Retool-grade runtime layout generator, and database manager.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ForgeAI',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#09090b" />
        <link rel="apple-touch-icon" href="https://cdn-icons-png.flaticon.com/512/8653/8653200.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-50 min-h-screen`}
      >
        <ClientInitializer />
        {children}
      </body>
    </html>
  );
}
