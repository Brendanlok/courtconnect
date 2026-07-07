import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuthGate } from '@/components/AuthGate';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const viewport: Viewport = {
  themeColor: '#020817',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'CourtConnect',
  description: 'Track your MMR, find matches, and compete in badminton tournaments — Malaysia',
  applicationName: 'CourtConnect',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CourtConnect',
    startupImage: '/icons/apple-touch-icon.png',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png',  sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [{ rel: 'mask-icon', url: '/icons/icon-512x512.png', color: '#059669' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#020817',
    'msapplication-TileImage': '/icons/icon-144x144.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* SW registration — must be inline script, not next/script, for static export */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{if(localStorage.getItem('cc_theme')==='light')document.documentElement.classList.add('light');}catch(e){}}());
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}}/>
      </head>
      <body className={`${geist.variable} font-[var(--font-geist)] bg-[#020817] text-slate-100 min-h-screen`}>
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
