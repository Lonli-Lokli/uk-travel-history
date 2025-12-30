import type { Metadata } from 'next';
import { getAllFeaturePolicies, isSupabaseFeaturePoliciesAvailable } from '@uth/features';
import { StatusPageClient } from '@/components/StatusPageClient';

export const metadata: Metadata = {
  title: 'Feature Access Status',
  description:
    'View your current access level and available features based on your subscription tier.',
};

export default async function StatusPage() {
  // Fetch feature policies from Supabase
  const policies = await getAllFeaturePolicies();
  const isSupabaseAvailable = await isSupabaseFeaturePoliciesAvailable();

  return <StatusPageClient featurePolicies={policies} isSupabaseAvailable={isSupabaseAvailable} />;
}
