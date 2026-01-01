/**
 * Tests for checkFeatureAccess() logic
 * Covers tier levels, allowlist/denylist precedence, beta users, and rollout percentage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIERS, type TierId } from './shapes';

// Mock the dependencies
vi.mock('@uth/auth-server', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@uth/db', () => ({
  getUserByAuthId: vi.fn(),
  SubscriptionTier: {
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

vi.mock('../lib/features', () => ({
  getAllFeaturePolicies: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

// Import the module after mocking
import { loadAccessContext } from './access-context';
import { getCurrentUser } from '@uth/auth-server';
import { getUserByAuthId } from '@uth/db';
import { getAllFeaturePolicies } from '../lib/features';

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

  vi.mocked(getUserByAuthId).mockResolvedValue({
    id: '123',
    authId: userId,
    email: 'test@example.com',
    subscriptionTier: userTier === TIERS.PREMIUM ? 'monthly' : 'free',
    subscriptionStatus: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });

  // Mock feature policies with our test policy
  vi.mocked(getAllFeaturePolicies).mockResolvedValue({
    test_feature: policy,
  });

  // Load access context and check entitlements
  const context = await loadAccessContext();
  return context.entitlements.test_feature || false;
}

describe('checkFeatureAccess()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
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
      // Note: This test is deterministic based on the hash function
      // The hash for 'user1' should result in a specific percentile
      const policy: FeaturePolicy = {
        enabled: true,
        minTier: TIERS.FREE,
        rolloutPercentage: 50,
      };

      const hasAccess = await testFeatureAccess(TIERS.FREE, 'user1', policy);

      // Calculate expected hash for 'user1'
      const hash = 'user1'.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
      let hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user1', disabledPolicy);
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
      hasAccess = await testFeatureAccess(TIERS.PREMIUM, 'user1', denylistPolicy);
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Anonymous (unauthenticated) users', () => {
    it('should return anonymous context when user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const context = await loadAccessContext();

      expect(context.user).toBeNull();
      expect(context.tier).toBe('free');
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
      vi.mocked(getAllFeaturePolicies).mockResolvedValue({});

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
      vi.mocked(getAllFeaturePolicies).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.user).toBeDefined();
      expect(context.tier).toBe('free');
      expect(context.role).toBe('standard');
    });

    it('should return anonymous context on critical error', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Auth error'));

      const context = await loadAccessContext();

      expect(context.user).toBeNull();
      expect(context.tier).toBe('free');
      expect(context.role).toBe('standard');
      expect(context.entitlements).toEqual({});
    });

    it('should return empty entitlements when feature policies fail to load', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockResolvedValue({
        id: '123',
        authId: 'user1',
        email: 'test@example.com',
        subscriptionTier: 'monthly',
        subscriptionStatus: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
      vi.mocked(getAllFeaturePolicies).mockRejectedValue(new Error('Feature policies error'));

      const context = await loadAccessContext();

      expect(context.user).toBeDefined();
      expect(context.entitlements).toEqual({});
    });
  });

  describe('Subscription tier mapping', () => {
    it('should map FREE subscription to FREE tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockResolvedValue({
        id: '123',
        authId: 'user1',
        email: 'test@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
      vi.mocked(getAllFeaturePolicies).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('free');
    });

    it('should map MONTHLY subscription to PREMIUM tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockResolvedValue({
        id: '123',
        authId: 'user1',
        email: 'test@example.com',
        subscriptionTier: 'monthly',
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date('2026-02-01'),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      });
      vi.mocked(getAllFeaturePolicies).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('monthly');
    });

    it('should map YEARLY subscription to PREMIUM tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockResolvedValue({
        id: '123',
        authId: 'user1',
        email: 'test@example.com',
        subscriptionTier: 'yearly',
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date('2027-01-01'),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      });
      vi.mocked(getAllFeaturePolicies).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('yearly');
    });

    it('should map LIFETIME subscription to PREMIUM tier', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        uid: 'user1',
        email: 'test@example.com',
        emailVerified: true,
      });
      vi.mocked(getUserByAuthId).mockResolvedValue({
        id: '123',
        authId: 'user1',
        email: 'test@example.com',
        subscriptionTier: 'lifetime',
        subscriptionStatus: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: null,
      });
      vi.mocked(getAllFeaturePolicies).mockResolvedValue({});

      const context = await loadAccessContext();

      expect(context.tier).toBe('lifetime');
    });
  });
});
