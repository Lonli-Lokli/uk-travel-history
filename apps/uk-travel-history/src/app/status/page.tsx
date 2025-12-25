import Link from 'next/link';
import { Button, UIIcon } from '@uth/ui';
import type { Metadata } from 'next';
import {
  getAllFeatureFlags,
  FEATURE_KEYS,
  DEFAULT_FEATURE_STATES,
  type FeatureFlagKey,
} from '@uth/features';

export const metadata: Metadata = {
  title: 'Status',
  description: 'View the status of features and their configuration in the UK Travel History Parser.',
};

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

function FeatureStatusBadge({
  enabled,
  isDefault,
}: {
  enabled: boolean;
  isDefault: boolean;
}) {
  if (enabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UIIcon iconName="check" className="h-3 w-3 mr-1" />
          Enabled
        </span>
        {isDefault && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Default
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <UIIcon iconName="x" className="h-3 w-3 mr-1" />
        Disabled
      </span>
      {isDefault && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Default
        </span>
      )}
    </div>
  );
}

export default async function StatusPage() {
  // Fetch all feature flags from Edge Config
  const featureFlags = await getAllFeatureFlags();

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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Button */}
        <Link href="/" className="inline-block mb-8">
          <Button variant="outline" size="sm">
            <UIIcon iconName="arrow-left" className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            System Status
          </h1>
          <p className="text-slate-600">
            View the current status of features and their configuration. Features can be controlled via Vercel Edge Config for runtime management.
          </p>
        </div>

        {/* Feature Status by Category */}
        {Object.entries(featuresByCategory).map(([category, features]) => (
          <div
            key={category}
            className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 mb-6"
          >
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {category}
            </h2>
            <div className="space-y-4">
              {features.map((feature) => {
                const isEnabled = featureFlags[feature.key];
                const defaultState = DEFAULT_FEATURE_STATES[feature.key];
                const isDefault = isEnabled === defaultState;

                return (
                  <div
                    key={feature.key}
                    className="flex items-start justify-between py-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-slate-900">
                          {feature.name}
                        </h3>
                        <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {feature.key}
                        </code>
                      </div>
                      <p className="text-sm text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <FeatureStatusBadge
                        enabled={isEnabled}
                        isDefault={isDefault}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
            <UIIcon iconName="info-circle" className="h-4 w-4 mr-2" />
            Feature Flag Information
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Default:</strong> Features showing the "Default" badge are using their default configuration and are not overridden by Edge Config.
            </p>
            <p>
              <strong>Edge Config:</strong> Features without the "Default" badge are being controlled by Vercel Edge Config, allowing runtime configuration without redeployment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
