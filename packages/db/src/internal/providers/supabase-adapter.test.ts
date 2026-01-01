/**
 * Tests for Supabase database adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseDbAdapter } from './supabase-adapter';
import {
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
} from '../../types/domain';
import type {
  CreateUserData,
  UpdateUserData,
  CreatePurchaseIntentData,
  UpdatePurchaseIntentData,
  CreateWebhookEventData,
} from '../../types/domain';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { createClient } from '@supabase/supabase-js';

describe('SupabaseDbAdapter', () => {
  let adapter: SupabaseDbAdapter;
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeEach(() => {
    adapter = new SupabaseDbAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  });

  describe('initialize', () => {
    it('should initialize with environment variables', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

      adapter.initialize({});

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should handle missing URL gracefully', () => {
      delete process.env.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      adapter.initialize({});

      expect(adapter.isConfigured()).toBe(false);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('should handle missing service role key gracefully', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      adapter.initialize({});

      expect(adapter.isConfigured()).toBe(false);
      expect(createClient).not.toHaveBeenCalled();
    });

    it('should handle both credentials missing gracefully', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      adapter.initialize({});

      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true after successful initialization', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

      adapter.initialize({});
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should return false when not initialized', () => {
      delete process.env.SUPABASE_URL;
      adapter.initialize({});
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('keepalive', () => {
    it('should call keepalive RPC and return result', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 42,
        error: null,
      });

      const result = await adapter.keepalive();

      expect(result).toBe(42);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('keepalive');
    });

    it('should throw CONFIG_ERROR when not configured', async () => {
      delete process.env.SUPABASE_URL;
      adapter.initialize({});

      await expect(adapter.keepalive()).rejects.toThrow(DbError);
      await expect(adapter.keepalive()).rejects.toThrow(/not initialized/);

      try {
        await adapter.keepalive();
      } catch (error: any) {
        expect(error.code).toBe(DbErrorCode.CONFIG_ERROR);
      }
    });

    it('should handle RPC errors', async () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed', code: 'PGRST000' },
      });

      try {
        await adapter.keepalive();
      } catch (error: any) {
        expect(error).toBeInstanceOf(DbError);
        expect(error.code).toBe(DbErrorCode.PROVIDER_ERROR);
      }
    });
  });

  describe('getUserByAuthId', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should return user when found', async () => {
      const mockData = {
        id: 'user-uuid',
        clerk_user_id: 'clerk_123',
        email: 'test@example.com',
        passkey_enrolled: true,
        subscription_tier: 'premium',
        subscription_status: 'active',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        stripe_price_id: 'price_123',
        current_period_end: '2023-12-31T23:59:59Z',
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const user = await adapter.getUserByAuthId('clerk_123');

      expect(user).not.toBeNull();
      expect(user?.authUserId).toBe('clerk_123');
      expect(user?.email).toBe('test@example.com');
      expect(user?.passkeyEnrolled).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQuery.eq).toHaveBeenCalledWith('clerk_user_id', 'clerk_123');
    });

    it('should return null when user not found (PGRST116)', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const user = await adapter.getUserByAuthId('nonexistent');

      expect(user).toBeNull();
    });

    it('should throw PROVIDER_ERROR for other database errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST000', message: 'Database error' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      try {
        await adapter.getUserByAuthId('clerk_123');
      } catch (error: any) {
        expect(error).toBeInstanceOf(DbError);
        expect(error.code).toBe(DbErrorCode.PROVIDER_ERROR);
      }
    });
  });

  describe('getUserById', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should return user when found', async () => {
      const mockData = {
        id: 'user-uuid',
        clerk_user_id: 'clerk_123',
        email: 'test@example.com',
        passkey_enrolled: false,
        subscription_tier: 'free',
        subscription_status: null, // Free tier users have NULL status
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_end: null,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const user = await adapter.getUserById('user-uuid');

      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-uuid');
      expect(user?.subscriptionStatus).toBe(null); // Free tier = NULL status
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-uuid');
    });

    it('should return null when user not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const user = await adapter.getUserById('nonexistent');

      expect(user).toBeNull();
    });
  });

  describe('createUser', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should create user with all fields', async () => {
      const mockResult = {
        id: 'user-uuid',
        clerk_user_id: 'clerk_new',
        email: 'new@example.com',
        passkey_enrolled: true,
        subscription_tier: 'premium',
        subscription_status: 'active',
        stripe_customer_id: 'cus_new',
        stripe_subscription_id: 'sub_new',
        stripe_price_id: 'price_new',
        current_period_end: '2023-12-31T23:59:59Z',
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const data: CreateUserData = {
        authUserId: 'clerk_new',
        email: 'new@example.com',
        passkeyEnrolled: true,
        subscriptionTier: SubscriptionTier.MONTHLY,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_new',
        stripeSubscriptionId: 'sub_new',
        stripePriceId: 'price_new',
        currentPeriodEnd: new Date('2023-12-31T23:59:59Z'),
      };

      const user = await adapter.createUser(data);

      expect(user.authUserId).toBe('clerk_new');
      expect(user.email).toBe('new@example.com');
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          clerk_user_id: 'clerk_new',
          email: 'new@example.com',
          passkey_enrolled: true,
        }),
      );
    });

    it('should create user with minimal fields (defaults)', async () => {
      const mockResult = {
        id: 'user-uuid',
        clerk_user_id: 'clerk_minimal',
        email: 'minimal@example.com',
        passkey_enrolled: false,
        subscription_tier: 'free',
        subscription_status: null, // Free tier users have NULL status
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_end: null,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const data: CreateUserData = {
        authUserId: 'clerk_minimal',
        email: 'minimal@example.com',
      };

      const user = await adapter.createUser(data);

      expect(user.passkeyEnrolled).toBe(false);
      expect(user.subscriptionTier).toBe(SubscriptionTier.FREE);
      expect(user.subscriptionStatus).toBe(null); // Free tier = NULL status
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          passkey_enrolled: false,
          subscription_tier: 'free',
          subscription_status: null, // NULL for free tier
        }),
      );
    });

    it('should throw UNIQUE_VIOLATION for duplicate email', async () => {
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Unique violation' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      try {
        await adapter.createUser({
          authUserId: 'clerk_dup',
          email: 'duplicate@example.com',
        });
      } catch (error: any) {
        expect(error).toBeInstanceOf(DbError);
        expect(error.code).toBe(DbErrorCode.UNIQUE_VIOLATION);
      }
    });
  });

  describe('updateUserByAuthId', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should update user fields', async () => {
      const mockResult = {
        id: 'user-uuid',
        clerk_user_id: 'clerk_123',
        email: 'updated@example.com',
        passkey_enrolled: true,
        subscription_tier: 'premium',
        subscription_status: 'active',
        stripe_customer_id: 'cus_updated',
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_end: null,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const updates: UpdateUserData = {
        email: 'updated@example.com',
        passkeyEnrolled: true,
        stripeCustomerId: 'cus_updated',
      };

      const user = await adapter.updateUserByAuthId('clerk_123', updates);

      expect(user.email).toBe('updated@example.com');
      expect(mockQuery.update).toHaveBeenCalledWith({
        email: 'updated@example.com',
        passkey_enrolled: true,
        stripe_customer_id: 'cus_updated',
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('clerk_user_id', 'clerk_123');
    });

    it('should handle partial updates', async () => {
      const mockResult = {
        id: 'user-uuid',
        clerk_user_id: 'clerk_123',
        email: 'test@example.com',
        passkey_enrolled: true,
        subscription_tier: 'free',
        subscription_status: null, // Free tier users have NULL status
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
        current_period_end: null,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await adapter.updateUserByAuthId('clerk_123', {
        passkeyEnrolled: true,
      });

      expect(mockQuery.update).toHaveBeenCalledWith({
        passkey_enrolled: true,
      });
    });

    it('should throw PROVIDER_ERROR when update fails', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST000', message: 'Update failed' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      try {
        await adapter.updateUserByAuthId('clerk_123', { email: 'new@example.com' });
      } catch (error: any) {
        expect(error).toBeInstanceOf(DbError);
        expect(error.code).toBe(DbErrorCode.PROVIDER_ERROR);
      }
    });
  });

  describe('deleteUserByAuthId', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should delete user successfully', async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      await expect(adapter.deleteUserByAuthId('clerk_123')).resolves.not.toThrow();
      expect(mockQuery.eq).toHaveBeenCalledWith('clerk_user_id', 'clerk_123');
    });

    it('should throw PROVIDER_ERROR on database error', async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST000', message: 'Delete failed' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      try {
        await adapter.deleteUserByAuthId('clerk_123');
      } catch (error: any) {
        expect(error).toBeInstanceOf(DbError);
        expect(error.code).toBe(DbErrorCode.PROVIDER_ERROR);
      }
    });
  });

  describe('getPurchaseIntentById', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should return purchase intent when found', async () => {
      const mockData = {
        id: 'intent-uuid',
        status: 'provisioned',
        stripe_checkout_session_id: 'cs_123',
        stripe_payment_intent_id: 'pi_123',
        email: 'test@example.com',
        price_id: 'price_123',
        product_id: 'prod_123',
        clerk_user_id: 'clerk_123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const intent = await adapter.getPurchaseIntentById('intent-uuid');

      expect(intent).not.toBeNull();
      expect(intent?.id).toBe('intent-uuid');
      expect(intent?.status).toBe(PurchaseIntentStatus.PROVISIONED);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'intent-uuid');
    });

    it('should return null when not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const intent = await adapter.getPurchaseIntentById('nonexistent');

      expect(intent).toBeNull();
    });
  });

  describe('getPurchaseIntentBySessionId', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should return purchase intent by session ID', async () => {
      const mockData = {
        id: 'intent-uuid',
        status: 'processing',
        stripe_checkout_session_id: 'cs_session',
        stripe_payment_intent_id: null,
        email: 'test@example.com',
        price_id: 'price_123',
        product_id: null,
        clerk_user_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const intent = await adapter.getPurchaseIntentBySessionId('cs_session');

      expect(intent).not.toBeNull();
      expect(intent?.stripeCheckoutSessionId).toBe('cs_session');
      expect(mockQuery.eq).toHaveBeenCalledWith('stripe_checkout_session_id', 'cs_session');
    });
  });

  describe('getPurchaseIntentsByAuthUserId', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should return array of purchase intents', async () => {
      const mockData = [
        {
          id: 'intent-1',
          status: 'provisioned',
          stripe_checkout_session_id: 'cs_1',
          stripe_payment_intent_id: 'pi_1',
          email: 'test@example.com',
          price_id: 'price_1',
          product_id: 'prod_1',
          clerk_user_id: 'clerk_123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'intent-2',
          status: 'created',
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
          email: 'test@example.com',
          price_id: null,
          product_id: null,
          clerk_user_id: 'clerk_123',
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const intents = await adapter.getPurchaseIntentsByAuthUserId('clerk_123');

      expect(intents).toHaveLength(2);
      expect(intents[0].id).toBe('intent-1');
      expect(intents[1].id).toBe('intent-2');
    });

    it('should return empty array when no intents found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const intents = await adapter.getPurchaseIntentsByAuthUserId('clerk_none');

      expect(intents).toEqual([]);
    });
  });

  describe('createPurchaseIntent', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should create purchase intent', async () => {
      const mockResult = {
        id: 'intent-new',
        status: 'created',
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        email: 'buyer@example.com',
        price_id: 'price_new',
        product_id: 'prod_new',
        clerk_user_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const data: CreatePurchaseIntentData = {
        email: 'buyer@example.com',
        priceId: 'price_new',
        productId: 'prod_new',
      };

      const intent = await adapter.createPurchaseIntent(data);

      expect(intent.email).toBe('buyer@example.com');
      expect(intent.status).toBe(PurchaseIntentStatus.CREATED);
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'buyer@example.com',
          price_id: 'price_new',
          product_id: 'prod_new',
          status: 'created',
        }),
      );
    });

    it('should default to CREATED status when not provided', async () => {
      const mockResult = {
        id: 'intent-new',
        status: 'created',
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        email: 'buyer@example.com',
        price_id: null,
        product_id: null,
        clerk_user_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const intent = await adapter.createPurchaseIntent({
        email: 'buyer@example.com',
      });

      expect(intent.status).toBe(PurchaseIntentStatus.CREATED);
      expect(mockQuery.insert).toHaveBeenCalledWith({
        email: 'buyer@example.com',
        status: 'created',
        price_id: null,
        product_id: null,
      });
    });
  });

  describe('updatePurchaseIntent', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should update purchase intent', async () => {
      const mockResult = {
        id: 'intent-uuid',
        status: 'provisioned',
        stripe_checkout_session_id: 'cs_updated',
        stripe_payment_intent_id: 'pi_updated',
        email: 'test@example.com',
        price_id: 'price_123',
        product_id: 'prod_123',
        clerk_user_id: 'clerk_assigned',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const updates: UpdatePurchaseIntentData = {
        status: PurchaseIntentStatus.PROVISIONED,
        stripeCheckoutSessionId: 'cs_updated',
        stripePaymentIntentId: 'pi_updated',
        authUserId: 'clerk_assigned',
      };

      const intent = await adapter.updatePurchaseIntent('intent-uuid', updates);

      expect(intent.status).toBe(PurchaseIntentStatus.PROVISIONED);
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'provisioned',
          stripe_checkout_session_id: 'cs_updated',
          stripe_payment_intent_id: 'pi_updated',
          clerk_user_id: 'clerk_assigned',
        }),
      );
    });
  });

  describe('hasWebhookEventBeenProcessed', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should return true when event exists', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'webhook-1' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const processed = await adapter.hasWebhookEventBeenProcessed('evt_123');

      expect(processed).toBe(true);
      expect(mockQuery.eq).toHaveBeenCalledWith('stripe_event_id', 'evt_123');
    });

    it('should return false when event not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const processed = await adapter.hasWebhookEventBeenProcessed('evt_new');

      expect(processed).toBe(false);
    });
  });

  describe('recordWebhookEvent', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should record webhook event', async () => {
      const mockResult = {
        id: 'webhook-new',
        stripe_event_id: 'evt_new',
        type: 'checkout.session.completed',
        payload: { test: 'data' },
        processed_at: '2023-01-01T00:00:00Z',
      };

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const data: CreateWebhookEventData = {
        stripeEventId: 'evt_new',
        type: 'checkout.session.completed',
        payload: { test: 'data' },
      };

      const event = await adapter.recordWebhookEvent(data);

      expect(event.stripeEventId).toBe('evt_new');
      expect(event.type).toBe('checkout.session.completed');
      expect(mockQuery.insert).toHaveBeenCalledWith({
        stripe_event_id: 'evt_new',
        type: 'checkout.session.completed',
        payload: { test: 'data' },
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      adapter.initialize({});
    });

    it('should map PGRST116 to NOT_FOUND', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const user = await adapter.getUserById('nonexistent');
      expect(user).toBeNull(); // NOT_FOUND returns null for get operations
    });

    it('should map 23505 to UNIQUE_VIOLATION', async () => {
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Unique violation' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      try {
        await adapter.createUser({
          authUserId: 'clerk_dup',
          email: 'dup@example.com',
        });
      } catch (error: any) {
        expect(error.code).toBe(DbErrorCode.UNIQUE_VIOLATION);
      }
    });

    it('should map 23503 to FOREIGN_KEY_VIOLATION', async () => {
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23503', message: 'Foreign key violation' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      try {
        await adapter.createPurchaseIntent({
          email: 'test@example.com',
        });
      } catch (error: any) {
        expect(error.code).toBe(DbErrorCode.FOREIGN_KEY_VIOLATION);
      }
    });
  });
});
