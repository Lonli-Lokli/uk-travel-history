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
    default: 'Travel History Tracker — Global Residency & Tax Compliance',
    template: '%s | Travel History Tracker',
  },
  description:
    'The automated compliance suite for global residents. Track UK ILR, British Citizenship, Schengen 90/180-day rules, and Statutory Residence Test (SRT) for tax purposes.',
  keywords: [
    // UK & Citizenship
    'UK travel history tracker',
    'British citizenship residency calculator',
    'ILR continuous residence tracker',
    'Home Office SAR data parser',
    // Schengen & EU
    'Schengen 90/180 rule calculator',
    'EU travel days tracker',
    'Schengen visa compliance tool',
    // Tax & Global
    'statutory residence test tracker',
    'UK tax residency calculator',
    'digital nomad tax compliance',
    '183 day rule tracker',
    // General Utility
    'custom travel log',
    'automated travel history',
    'residency requirements monitor',
  ],
  authors: [{ name: 'Travel History Tracker' }],
  creator: 'Travel History Tracker',
  publisher: 'Travel History Tracker',
  applicationName: 'Travel History Tracker',
  category: 'Finance & Compliance',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
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
    title: 'Travel History Tracker — UK, Schengen & Tax Residency Tools',
    description:
      'Manage global residency compliance. Automated tracking for UK Citizenship, Schengen 90/180 day rules, and tax residence tests.',
    siteName: 'Travel History Tracker',
    images: [{ url: `${siteUrl}/og-image.png` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Automated Residency & Compliance Tracker',
    description:
      'Track UK ILR, British Citizenship, and Schengen 90/180 rules in one place. Automated SAR parsing and tax residency monitoring.',
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
