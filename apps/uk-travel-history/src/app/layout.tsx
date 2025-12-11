import type { Metadata, Viewport } from 'next';
import { Toaster } from '@uth/ui';
import * as Sentry from '@sentry/nextjs';
import './global.css';

export const metadata: Metadata = {
  title: {
    default: 'UK Travel History Parser',
    template: '%s | UK Travel History Parser',
  },
  description:
    'Professional web app for parsing UK Home Office travel history PDFs and calculating days spent outside the UK. Upload SAR documents, edit trips, and export to Excel.',
  keywords: [
    'UK travel history',
    'Home Office SAR',
    'travel calculator',
    'days outside UK',
    'UK residency',
    'border control',
    'PDF parser',
    'excel export',
  ],
  authors: [{ name: 'UK Travel History Parser' }],
  creator: 'UK Travel History Parser',
  publisher: 'UK Travel History Parser',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/favicon.svg',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: '/',
    title: 'UK Travel History Parser',
    description:
      'Professional web app for parsing UK Home Office travel history PDFs and calculating days spent outside the UK.',
    siteName: 'UK Travel History Parser',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'UK Travel History Parser - Calculate days outside UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UK Travel History Parser',
    description:
      'Professional web app for parsing UK Home Office travel history PDFs and calculating days spent outside the UK.',
    images: ['/og-image.png'],
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
  other: {
    ...Sentry.getTraceData(),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
