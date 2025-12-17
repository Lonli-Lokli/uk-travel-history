import type { Metadata } from 'next';
import { TravelPageClient } from '@/components/TravelPageClient';

export const metadata: Metadata = {
  title: 'Travel History', // Will use template from layout.tsx: 'Travel History | UK Travel History Parser'
  description: 'Track and calculate your UK travel history, days outside UK, and continuous residence period.',
};

export default function TravelPage() {
  return <TravelPageClient />;
}

