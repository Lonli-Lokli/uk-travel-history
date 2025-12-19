import type { Metadata, Viewport } from 'next';
import { Toaster } from '@uth/ui';
import { getAllFeatureFlags } from '@uth/features';
import * as Sentry from '@sentry/nextjs';
import './global.css';
import { Geist } from 'next/font/google';
import { FeatureFlagsProvider } from '@uth/widgets';
import { PaymentModal } from '../components/PaymentModal';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://uk-travel-history.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'UK Travel History Parser - Track Your UK Residency & Travel Days',
    template: '%s | UK Travel History Parser',
  },
  description:
    'Free tool to parse UK Home Office travel history PDFs and calculate days outside the UK. Track visa compliance, ILR eligibility, and continuous residence. Upload SAR documents, edit trips, and export to Excel.',
  keywords: [
    'UK travel history',
    'Home Office SAR',
    'travel calculator',
    'days outside UK',
    'UK residency calculator',
    'ILR eligibility',
    'continuous residence',
    '180 day rule',
    'border control data',
    'PDF parser',
    'excel export',
    'UK visa compliance',
    'settlement calculator',
    'ilr track time',
    'ILR when can I apply',
  ],
  authors: [{ name: 'UK Travel History Parser' }],
  creator: 'UK Travel History Parser',
  publisher: 'UK Travel History Parser',
  applicationName: 'UK Travel History Parser',
  category: 'Tools',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: siteUrl,
    title: 'UK Travel History Parser - Track Your UK Residency & Travel Days',
    description:
      'Free tool to parse UK Home Office travel history PDFs and calculate days outside the UK. Track visa compliance, ILR eligibility, and continuous residence for UK settlement.',
    siteName: 'UK Travel History Parser',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'UK Travel History Parser - Calculate days outside UK for visa and ILR compliance',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UK Travel History Parser - Track Your UK Residency & Travel Days',
    description:
      'Free tool to parse UK Home Office travel history PDFs and calculate days outside the UK. Track visa compliance, ILR eligibility, and continuous residence.',
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
  // Fetch feature flags from Vercel Edge Config
  const flags = await getAllFeatureFlags();

  return (
    <html lang="en" className={`${geist.className} h-full`}>
      <body className="h-full bg-slate-50 overflow-y-scroll">
        <FeatureFlagsProvider flags={flags}>
          {children}
          <PaymentModal />
          <Toaster />
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
