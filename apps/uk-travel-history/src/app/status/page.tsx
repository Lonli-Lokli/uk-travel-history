import type { Metadata } from 'next';
import { getAllFeaturePolicies } from '@uth/features';
import { isDbAlive } from '@uth/db';
import { StatusPageClient } from '@/components/StatusPageClient';

export const metadata: Metadata = {
  title: 'Feature Access Status',
  description:
    'View your current access level and available features based on your subscription tier.',
};

export default async function StatusPage() {
  // Fetch feature policies from Supabase
  const policies = await getAllFeaturePolicies();
  const isAlive = await isDbAlive();

  return <StatusPageClient featurePolicies={policies} isDbAlive={isAlive} />;
}
