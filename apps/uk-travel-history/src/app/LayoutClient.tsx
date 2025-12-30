'use client';

import { Navbar } from '../components/Navbar';
import { ReactNode } from 'react';
import { ProvidersWrapper } from '../components/ProvidersWrapper';
import type { FeaturePolicy, FeatureFlagKey } from '@uth/features';

interface LayoutClientProps {
  children: ReactNode;
  featurePolicies?: Record<FeatureFlagKey, FeaturePolicy>;
}

/**
 * Layout client component that wraps the app with the Navbar and providers.
 *
 * The Navbar now handles its own toolbar rendering based on the current route,
 * eliminating the need for context-based injection and useEffect timing issues.
 */
export function LayoutClient({ children, featurePolicies }: LayoutClientProps) {
  return (
    <ProvidersWrapper featurePolicies={featurePolicies}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </ProvidersWrapper>
  );
}
