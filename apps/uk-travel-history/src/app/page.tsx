import type { Metadata } from 'next';
import { TravelPageClient } from '@/components/TravelPageClient';

export const metadata: Metadata = {
  title: 'Travel Tracker',
  description:
    'Track your travel days, monitor visa requirements, and manage your immigration goals.',
};

export default function HomePage() {
  return <TravelPageClient />;
}
