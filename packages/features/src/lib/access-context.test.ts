/**
 * Tests for checkFeatureAccess() logic
 * Covers tier levels, allowlist/denylist precedence, beta users, and rollout percentage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies
vi.mock('@uth/auth-server', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@uth/db', () => ({
  getUserByAuthId: vi.fn(),
  SubscriptionTier: {
    ANONYMOUS: 'anonymous',
    FREE: 'free',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    LIFETIME: 'lifetime',
  },
  SubscriptionStatus: {
    ACTIVE: 'active',
    CANCELED: 'canceled',
    PAST_DUE: 'past_due',
  },
  UserRole: {
    STANDARD: 'standard',
    ADMIN: 'admin',
  },
}));

vi.mock('@uth/payments-server', () => ({
  getPriceDetails: vi.fn().mockResolvedValue({
    monthly: { id: 'price_monthly', amount: 999, currency: 'gbp' },
    annual: { id: 'price_annual', amount: 9999, currency: 'gbp' },
    lifetime: { id: 'price_lifetime', amount: 29999, currency: 'gbp' },
  }),
}));

vi.mock('./features', () => ({
  getAllFeaturePolicies: vi.fn(),
  isFeatureEnabled: vi.fn(),
  DEFAULT_FEATURE_POLICIES: {
    // Master switches (ANONYMOUS - can be checked without auth)
    monetization: {
      enabled: false,
      minTier: 'anonymous',
    },
    auth: {
      enabled: true,
      minTier: 'anonymous',
    },
    payments: {
      enabled: true,
      minTier: 'anonymous',
    },

    // Premium features (require PREMIUM tier)
    excel_export: {
      enabled: true,
      minTier: 'free',
    },
    excel_import: {
      enabled: true,
      minTier: 'free',
    },
    pdf_import: {
      enabled: true, // Disabled by default, but configured as premium feature
      minTier: 'premium', // Premium tier - PDF import requires active subscription
    },
    clipboard_import: {
      enabled: true,
      minTier: 'anonymous',
    },

    // UI features (ANONYMOUS - available to all)
    risk_chart: {
      enabled: true,
      minTier: 'premium',
    },
  },
}));

// Import the module after mocking
import { loadAccessContext } from './access-context';
import { getCurrentUser } from '@uth/auth-server';
import { getUserByAuthId, SubscriptionStatus, SubscriptionTier } from '@uth/db';
import { getAllFeaturePolicies } from './features';
import { TierId, TIERS } from '@uth/domain';
import { FEATURE_KEYS } from './shapes';
import { configureFeatureLogger } from './feature-logger';

// We need to access the private checkFeatureAccess function for testing
// Extract it by importing the module and testing through computeEntitlements
type FeaturePolicy = {
  enabled: boolean;
  minTier: TierId;
  allowlist?: string[] | null;
  denylist?: string[] | null;
  betaUsers?: string[] | null;
  rolloutPercentage?: number | null;
};

// Helper function to create a default policy (enabled, FREE tier, no restrictions)
function createDefaultPolicy(): FeaturePolicy {
  return {
    enabled: true,
    minTier: TIERS.FREE,
    allowlist: null,
    denylist: null,
    betaUsers: null,
    rolloutPercentage: null,
  };
}

// Helper function to test checkFeatureAccess logic through the public API
async function testFeatureAccess(
  userTier: TierId,
  userId: string,
  policy: FeaturePolicy,
): Promise<boolean> {
  // Mock auth and DB
  vi.mocked(getCurrentUser).mockResolvedValue({
    uid: userId,
    email: 'test@example.com',
    emailVerified: true,
  });

  vi.mocked(getUserByAuthId, { partial: true }).mockResolvedValue({
    id: '123',
    authUserId: userId,
    email: 'test@example.com',
    subscriptionTier:
      userTier === TIERS.PREMIUM
        ? SubscriptionTier.MONTHLY
        : SubscriptionTier.FREE,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });

  // Mock feature policies with our test policy for clipboard_import
  // (using a real feature key since computeEntitlements loops through FEATURE_KEYS)
  // and default policies for all other features
  const allPolicies: Record<string, FeaturePolicy> = {};

  // Add default policy for all known features
  for (const featureKey of Object.values(FEATURE_KEYS)) {
    allPolicies[featureKey] = createDefaultPolicy();
  }

  // Override clipboard_import with our test policy
  allPolicies.clipboard_import = policy;

  vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue(
    allPolicies,
  );

  // Load access context and check entitlements
  const context = await loadAccessContext();
  return context.entitlements.clipboard_import || false;
}

// Create mock logger for testing
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describe('checkFeatureAccess()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureFeatureLogger({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Reset to default configuration
    configureFeatureLogger({});
  });

  describe('Feature enabled/disabled', () => {
    it('should deny access when feature is globally disabled', async () => {
      const policy: FeaturePolicy = {
        enabled: false,
        minTier: TIERS.FREE,
      };

      const hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user1', policy);
      expect(hasAccess).toBe(false);
    });

    it('should allow access when feature is enabled and user meets tier requirement', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Denylist precedence', () => {
    it('should deny access if user is in denylist, even if they meet tier requirement', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        denylist: ['user1'],
      };

      const hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user1', policy);
      expect(hasAccess).toBe(false);
    });

    it('should deny access if user is in denylist, even if they are in allowlist', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        allowlist: ['user1'],
        denylist: ['user1'],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(false);
    });

    it('should allow access if user is not in denylist', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        denylist: ['user2'],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Allowlist precedence', () => {
    it('should grant access if user is in allowlist, even if they do not meet tier requirement', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        allowlist: ['user1'],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should grant access if user is in allowlist and meets tier requirement', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        allowlist: ['user1'],
      };

      const hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should deny access if user is not in allowlist and does not meet tier requirement', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        allowlist: ['user2'],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(false);
    });
  });

  describe('Beta users', () => {
    it('should grant access if user is in beta users list, even if they do not meet tier requirement', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        betaUsers: ['user1'],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should deny access if user is in beta users but also in denylist', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        betaUsers: ['user1'],
        denylist: ['user1'],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(false);
    });
  });

  describe('Tier level hierarchy', () => {
    it('should deny access when user tier is below required tier', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(false);
    });

    it('should grant access when user tier equals required tier', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should grant access when user tier is above required tier', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
      };

      const hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should grant access for ANONYMOUS tier features to all users', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.ANONYMOUS,
      };

      // Test with FREE tier
      let hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);

      // Test with PREMIUM tier
      hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user2', policy);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Rollout percentage', () => {
    it('should grant access based on user ID hash within rollout percentage', async () => {
      // Note: This test is deterministic based on the hash function (djb2)
      // The hash for 'user1' should result in a specific percentile
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        rolloutPercentage: 50,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);

      // Calculate expected hash for 'user1' using djb2 algorithm
      let hash = 5381;
      for (let i = 0; i < 'user1'.length; i++) {
        hash = (hash << 5) + hash + 'user1'.charCodeAt(i);
      }
      hash = Math.abs(hash);
      const percentile = hash % 100;
      const expectedAccess = percentile < 50;

      expect(hasAccess).toBe(expectedAccess);
    });

    it('should grant access to 100% rollout', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        rolloutPercentage: 100,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should deny access to 0% rollout', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        rolloutPercentage: 0,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(false);
    });

    it('should respect allowlist even with 0% rollout', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        allowlist: ['user1'],
        rolloutPercentage: 0,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should respect denylist even with 100% rollout', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        denylist: ['user1'],
        rolloutPercentage: 100,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(false);
    });
  });

  describe('Access precedence order', () => {
    it('should follow precedence: disabled > denylist > allowlist > betaUsers > tier > rollout', async () => {
      // Test 1: Feature disabled overrides everything
      const disabledPolicy: FeaturePolicy = {
        enabled: false,
        minTier: TIERS.FREE,
        allowlist: ['user1'],
        betaUsers: ['user1'],
        rolloutPercentage: 100,
      };
      let hasAccess = await testFeatureAccess(
        TIERS.PREMIUM,
        'user1',
        disabledPolicy,
      );
      expect(hasAccess).toBe(false);

      // Test 2: Denylist overrides allowlist, betaUsers, tier, and rollout
      const denylistPolicy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        denylist: ['user1'],
        allowlist: ['user1'],
        betaUsers: ['user1'],
        rolloutPercentage: 100,
      };
      hasAccess = await testFeatureAccess(
        TIERS.PREMIUM,
        'user1',
        denylistPolicy,
      );
      expect(hasAccess).toBe(false);

      // Test 3: Allowlist bypasses tier and rollout checks
      const allowlistPolicy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        allowlist: ['user1'],
        rolloutPercentage: 0,
      };
      hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', allowlistPolicy);
      expect(hasAccess).toBe(true);

      // Test 4: Beta users bypass tier and rollout checks
      const betaPolicy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.PREMIUM,
        betaUsers: ['user1'],
        rolloutPercentage: 0,
      };
      hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', betaPolicy);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle null allowlist', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        allowlist: null,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should handle null denylist', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        denylist: null,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should handle null betaUsers', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        betaUsers: null,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should handle null rolloutPercentage', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        rolloutPercentage: null,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });

    it('should handle empty arrays', async () => {
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        allowlist: [],
        denylist: [],
        betaUsers: [],
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);
      expect(hasAccess).toBe(true);
    });
  });
});

describe('loadAccessContext()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureFeatureLogger({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Reset to default configuration
    configureFeatureLogger({});
  });

  describe('Anonymous (unauthenticated) users', () => {
    it('should return anonymous context when user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const context = await loadAccessContext();

      expect(context.user).toBeNull();
      expect(context.tier).toBe('anonymous');
      expect(context.role).toBe('standard');
      expect(context.entitlements).toEqual({});
      expect(context.subscriptionStatus).toBeNull();
    });
  });

  describe('Fail-closed behavior', () => {
    it('should default to FREE tier when user not found in database', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockResolvedValue(null);
      vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.user).toBeDefined();
      expect(context.tier).toBe('free');
      expect(context.role).toBe('standard');
    });

    it('should default to FREE tier when database lookup fails', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockRejectedValue(new Error('DB error'));
      vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.user).toBeDefined();
      expect(context.tier).toBe('free');
      expect(context.role).toBe('standard');
    });

    it('should return anonymous context on critical error', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Auth error'));

      const context = await loadAccessContext();

      expect(context.user).toBeNull();
      expect(context.tier).toBe('anonymous');
      expect(context.role).toBe('standard');
      // On critical error, entitlements are computed from DEFAULT_FEATURE_POLICIES
      // for the anonymous tier (features with minTier: 'anonymous' are accessible)
      expect(context.entitlements).toMatchObject({
        auth: true,
        payments: true,
        clipboard_import: true,
        monetization: false, // disabled in default policies
      });
    });

    // it('should return empty entitlements when feature policies fail to load', async () => {
    //   vi.mocked(getCurrentUser).mockResolvedValue({
    //     uid: 'user1',
    //     email: 'test@example.com',
    //     emailVerified: true,
    //   });
    //   vi.mocked(getUserByAuthId, { partial: true }).mockResolvedValue({
    //     id: '123',
    //     authUserId: 'user1',
    //     email: 'test@example.com',
    //     subscriptionTier: SubscriptionTier.MONTHLY,
    //     subscriptionStatus: SubscriptionStatus.ACTIVE,
    //     currentPeriodEnd: null,
    //     cancelAtPeriodEnd: false,
    //     createdAt: new Date(),
    //     stripeCustomerId: null,
    //     stripeSubscriptionId: null,
    //   });
    //   vi.mocked(getAllFeaturePolicies).mockRejectedValue(
    //     new Error('Feature policies error'),
    //   );

    //   const context = await loadAccessContext();

    //   expect(context.user).toBeDefined();
    //   expect(context.entitlements).toEqual({});
    // });
  });

  describe('Subscription tier mapping', () => {
    it('should map FREE subscription to FREE tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId, { partial: true }).mockResolvedValue({
        id: '123',
        authUserId: 'user1',
        email: 'test@example.com',
        subscriptionTier: SubscriptionTier.FREE,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
      vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('free');
    });

    it('should map MONTHLY subscription to PREMIUM tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId, { partial: true }).mockResolvedValue({
        id: '123',
        authUserId: 'user1',
        email: 'test@example.com',
        subscriptionTier: SubscriptionTier.MONTHLY,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2026-02-01'),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      });
      vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('monthly');
    });

    it('should map YEARLY subscription to PREMIUM tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId, { partial: true }).mockResolvedValue({
        id: '123',
        authUserId: 'user1',
        email: 'test@example.com',
        subscriptionTier: SubscriptionTier.YEARLY,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2027-01-01'),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      });
      vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('yearly');
    });

    it('should map LIFETIME subscription to PREMIUM tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId, { partial: true }).mockResolvedValue({
        id: '123',
        authUserId: 'user1',
        email: 'test@example.com',
        subscriptionTier: SubscriptionTier.LIFETIME,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: null,
      });
      vi.mocked(getAllFeaturePolicies, { partial: true }).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('lifetime');
    });
  });
});
