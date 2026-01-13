import type { Metadata, Viewport } from 'next';
import * as Sentry from '@sentry/nextjs';
import './global.css';
import { Geist } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Suspense } from 'react';
import { LayoutClient } from './LayoutClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://busel.uk';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
 title: {
    default: 'Travel History Tracker — UK Residency, Schengen & Tax Compliance',
    template: '%s | Travel History Tracker',
  },
  description:
    'The all-in-one compliance tracker for UK ILR, British Citizenship, and Schengen 90/180 rules. Automatically parse Home Office travel history and calculate residency for tax and visa purposes.',
  keywords: [
    // UK Core
    'UK travel history tracker',
    'ILR residency calculator',
    'British citizenship travel days',
    'Home Office SAR parser',
    // Schengen
    'Schengen 90/180 calculator',
    'Schengen visa stay tracker',
    // Tax & Custom
    'statutory residence test tracker',
    'UK tax residency calculator',
    'custom travel date tracker',
    '180 day rule compliance',
    'travel history export excel',
  ],
  authors: [{ name: 'Travel History Parser' }],
  creator: 'Travel History Parser',
  publisher: 'Travel History Parser',
  applicationName: 'Travel History Parser',
  category: 'Tools',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Note: Next.js will automatically serve icon.svg from src/app/icon.svg
  // Adding explicit fallbacks for browsers that need specific formats
  icons: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      url: '/favicon.svg',
    },
    {
      rel: 'apple-touch-icon',
      url: '/favicon.svg',
    },
  ],
  manifest: '/site.webmanifest',
 openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: siteUrl,
    title: 'Travel History Tracker — UK Residency & Schengen Tools',
    description:
      'Manage global residency compliance. Automated tools for UK Citizenship, ILR, and Schengen 90/180 day rules.',
    siteName: 'Travel History Tracker',
    images: [{ url: `${siteUrl}/og-image.png` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Travel History Parser - Track Your UK Residency & Travel Days',
   description:
    'The all-in-one compliance tracker for UK ILR, British Citizenship, and Schengen 90/180 rules. Automatically parse Home Office travel history and calculate residency for tax and visa purposes.',
    images: [`${siteUrl}/og-image.png`],
    creator: '@uk_travel_history',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  other: {
    ...Sentry.getTraceData(),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const geist = Geist({
  subsets: ['latin'],
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={geist.className}>
        <body className="h-screen bg-slate-50 flex flex-col">
          <Suspense fallback={<NavPlaceholder />}>
            <LayoutClient>{children}</LayoutClient>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}

// Minimal placeholder to prevent layout shift while Identity loads (~100ms)
function NavPlaceholder() {
  return <nav className="h-16 border-b bg-white w-full animate-pulse" />;
}
