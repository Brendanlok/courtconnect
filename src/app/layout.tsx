import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuthGate } from '@/components/AuthGate';
import { BASE_PATH } from '@/lib/utils';
import { GA_MEASUREMENT_ID } from '@/lib/analytics';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const viewport: Viewport = {
  themeColor: '#020817',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

const SITE_URL = 'https://brendanlok.github.io' + BASE_PATH + '/'; // trailing slash: metadataBase resolves relative image paths against it

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'CourtConnect',
  description: 'Track your MMR, find matches, and compete in badminton tournaments — Malaysia',
  applicationName: 'CourtConnect',
  // ponytail: reuses the existing 512x512 app icon as the share-preview image
  // (square, not the ideal 1200x630) — no image-gen tooling in this session.
  // Swap for a proper OG banner if link-preview quality matters later.
  openGraph: {
    title: 'CourtConnect — Badminton Ranking Platform, Malaysia',
    description: 'Track your MMR, find matches, and compete in badminton tournaments — Malaysia',
    url: SITE_URL,
    siteName: 'CourtConnect',
    images: [{ url: 'icons/icon-512x512.png', width: 512, height: 512 }],
    locale: 'en_MY',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CourtConnect — Badminton Ranking Platform, Malaysia',
    description: 'Track your MMR, find matches, and compete in badminton tournaments — Malaysia',
    images: ['icons/icon-512x512.png'],
  },
  manifest: `${BASE_PATH}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CourtConnect',
    startupImage: `${BASE_PATH}/icons/apple-touch-icon.png`,
  },
  icons: {
    icon: [
      { url: `${BASE_PATH}/icons/favicon-32x32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${BASE_PATH}/icons/icon-192x192.png`,  sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: `${BASE_PATH}/icons/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }],
    other: [{ rel: 'mask-icon', url: `${BASE_PATH}/icons/icon-512x512.png`, color: '#059669' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#020817',
    'msapplication-TileImage': `${BASE_PATH}/icons/icon-144x144.png`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Visitor analytics — no-op until NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
            Navigation here is full-page (window.location.href, no client router),
            so GA's own config call below already fires a page_view per load —
            no SPA route-change wiring needed. */}
        {GA_MEASUREMENT_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}}/>
          </>
        )}
        {/* SW registration — must be inline script, not next/script, for static export */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{if(localStorage.getItem('cc_theme')==='light')document.documentElement.classList.add('light');}catch(e){}}());
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('${BASE_PATH}/sw.js');
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
