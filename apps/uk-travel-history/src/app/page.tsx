import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  // Root page doesn't use template - it uses the default from layout.tsx
  // Or we can set it explicitly as an absolute title
  title: {
    absolute: 'UK Travel History Parser - Track Your UK Residency & Travel Days'
  },
  description:
    'Professional web app for parsing UK Home Office travel history PDFs and calculating days spent outside the UK. Upload SAR documents, track continuous residence, and export to Excel.',
};

export default function HomePage() {
  return <LandingPage />;
}
