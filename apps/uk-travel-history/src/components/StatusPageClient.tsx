'use client';

import { observer } from 'mobx-react-lite';
import { UIIcon } from '@uth/ui';
import {
  FEATURE_KEYS,
  type FeatureFlagKey,
  type FeaturePolicy,
} from '@uth/features';
import { useFeatureGateContext } from '@uth/widgets';
import { TIERS } from '@uth/domain';

interface FeatureInfo {
  key: FeatureFlagKey;
  name: string;
  description: string;
  category: 'Master Switches' | 'Premium Features' | 'UI Features';
}

const FEATURE_INFO: FeatureInfo[] = [
  // Master Switches
  {
    key: FEATURE_KEYS.MONETIZATION,
    name: 'Monetization',
    description: 'Master switch for monetization features',
    category: 'Master Switches',
  },
  {
    key: FEATURE_KEYS.AUTH,
    name: 'Authentication',
    description: 'User authentication system',
    category: 'Master Switches',
  },
  {
    key: FEATURE_KEYS.PAYMENTS,
    name: 'Payments',
    description: 'Payment processing functionality',
    category: 'Master Switches',
  },
  // Premium Features
  {
    key: FEATURE_KEYS.EXCEL_EXPORT,
    name: 'Excel Export',
    description: 'Export travel history to Excel format',
    category: 'Premium Features',
  },
  {
    key: FEATURE_KEYS.EXCEL_IMPORT,
    name: 'Excel Import',
    description: 'Import travel history from Excel files',
    category: 'Premium Features',
  },
  {
    key: FEATURE_KEYS.PDF_IMPORT,
    name: 'PDF Import',
    description: 'Import travel history from PDF documents',
    category: 'Premium Features',
  },
  {
    key: FEATURE_KEYS.CLIPBOARD_IMPORT,
    name: 'Clipboard Import',
    description: 'Import travel history from clipboard',
    category: 'Premium Features',
  },
  // UI Features
  {
    key: FEATURE_KEYS.RISK_CHART,
    name: 'Risk Chart',
    description: 'Visual chart showing travel risk analysis',
    category: 'UI Features',
  },
];

interface FeatureAccessBadgeProps {
  hasAccess: boolean;
  isEnabled: boolean;
  minTier: 'anonymous' | 'free' | 'premium';
  userTier: 'anonymous' | 'free' | 'premium';
}

function FeatureAccessBadge({
  hasAccess,
  isEnabled,
  minTier,
  userTier,
}: FeatureAccessBadgeProps) {
  if (!isEnabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <UIIcon iconName="x" className="h-3 w-3 mr-1" />
          Disabled Globally
        </span>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UIIcon iconName="check" className="h-3 w-3 mr-1" />
          You have access
        </span>
        {minTier !== 'anonymous' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Requires: {minTier}
          </span>
        )}
      </div>
    );
  }

  // No access
  const tierColors = {
    free: 'bg-blue-100 text-blue-800',
    premium: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <UIIcon iconName="close" className="h-3 w-3 mr-1" />
        No access
      </span>
      {minTier !== 'anonymous' && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierColors[minTier as 'free' | 'premium']}`}
        >
          Requires: {minTier}
        </span>
      )}
    </div>
  );
}

interface StatusPageClientProps {
  featurePolicies: Record<FeatureFlagKey, FeaturePolicy>;
  isDbAlive: boolean;
}

export const StatusPageClient = observer(
  ({ featurePolicies, isDbAlive }: StatusPageClientProps) => {
    const { monetizationStore, authStore } = useFeatureGateContext();

    const userTier = monetizationStore.tier;
    const isAuthenticated =
      monetizationStore.isAuthenticated || !!authStore.user;

    // Group features by category
    const featuresByCategory = FEATURE_INFO.reduce(
      (acc, feature) => {
        if (!acc[feature.category]) {
          acc[feature.category] = [];
        }
        acc[feature.category].push(feature);
        return acc;
      },
      {} as Record<string, FeatureInfo[]>,
    );

    // Tier labels
    const tierLabels = {
      [TIERS.ANONYMOUS]: 'Anonymous (Not signed in)',
      [TIERS.FREE]: 'Free (Signed in)',
      [TIERS.PREMIUM]: 'Premium',
    };

    return (
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Feature Access Status
          </h1>
          <p className="text-sm md:text-base text-slate-600 mb-4">
            View your current access level and available features based on your
            subscription tier.
          </p>

          {/* Data Source Indicator */}
          <div
            className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${
              isDbAlive
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-300'
            }`}
          >
            <UIIcon
              iconName={isDbAlive ? 'check-circle' : 'alert-triangle'}
              className={`h-4 w-4 flex-shrink-0 ${
                isDbAlive ? 'text-green-700' : 'text-yellow-700'
              }`}
            />
            <div
              className={`text-xs md:text-sm ${
                isDbAlive ? 'text-green-800' : 'text-yellow-800'
              }`}
            >
              <strong>Data Source:</strong>{' '}
              {isDbAlive
                ? 'Database (live policies)'
                : 'Using default fallback values'}
            </div>
          </div>

          {/* User Tier Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <UIIcon
                iconName="user"
                className="h-5 w-5 text-slate-600 flex-shrink-0"
              />
              <div>
                <div className="text-xs md:text-sm text-slate-600">
                  Your Current Tier
                </div>
                <div className="text-sm md:text-base font-semibold text-slate-900">
                  {tierLabels[userTier]}
                </div>
              </div>
            </div>
            {!isAuthenticated && (
              <div className="sm:ml-auto">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Sign in for more features
                </span>
              </div>
            )}
            {isAuthenticated && userTier !== TIERS.PREMIUM && (
              <div className="sm:ml-auto">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Upgrade to Premium for full access
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Feature Status by Category */}
        {Object.entries(featuresByCategory).map(([category, features]) => (
          <div
            key={category}
            className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-8"
          >
            <h2 className="text-lg md:text-xl font-semibold text-slate-900 mb-4">
              {category}
            </h2>
            <div className="space-y-4">
              {features.map((feature) => {
                const policy = featurePolicies[feature.key];
                const hasAccess = monetizationStore.hasFeatureAccess(
                  feature.key,
                );
                const isEnabled = policy?.enabled ?? false;
                const minTier = policy?.minTier ?? 'anonymous';

                return (
                  <div
                    key={feature.key}
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-3 border-b border-slate-100 last:border-0 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-medium text-slate-900 text-sm md:text-base">
                          {feature.name}
                        </h3>
                        <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded whitespace-nowrap">
                          {feature.key}
                        </code>
                      </div>
                      <p className="text-xs md:text-sm text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                    <div className="sm:ml-4 flex-shrink-0">
                      <FeatureAccessBadge
                        hasAccess={hasAccess}
                        isEnabled={isEnabled}
                        minTier={minTier}
                        userTier={userTier}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 md:p-6">
          <h3 className="text-xs md:text-sm font-semibold text-blue-900 mb-3 flex items-center">
            <UIIcon
              iconName="info-circle"
              className="h-4 w-4 mr-2 flex-shrink-0"
            />
            Feature Access Information
          </h3>
          <div className="text-xs md:text-sm text-blue-800 space-y-2">
            <p>
              <strong>Your Access:</strong> Features showing "You have access"
              are available to you with your current tier.
            </p>
            <p>
              <strong>Tier Requirements:</strong> Each feature shows the minimum
              subscription tier required for access.
            </p>
            <p>
              <strong>Anonymous:</strong> Available to everyone without signing
              in
            </p>
            <p>
              <strong>Free:</strong> Available to signed-in users (free account)
            </p>
            <p>
              <strong>Premium:</strong> Requires premium subscription
            </p>
          </div>
        </div>
      </div>
    );
  },
);

StatusPageClient.displayName = 'StatusPageClient';
