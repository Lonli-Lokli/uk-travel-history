/**
 * Tests for database operations using the mock adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  injectDbProvider,
  resetDbProvider,
  MockDbAdapter,
  getUserByAuthId,
  getUserById,
  createUser,
  updateUserByAuthId,
  deleteUserByAuthId,
  getPurchaseIntentById,
  getPurchaseIntentBySessionId,
  getPurchaseIntentsByAuthUserId,
  createPurchaseIntent,
  updatePurchaseIntent,
  hasWebhookEventBeenProcessed,
  recordWebhookEvent,
  keepalive,
  isDbConfigured,
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
} from '../index';

describe('Database Operations', () => {
  let mockAdapter: MockDbAdapter;

  beforeEach(() => {
    // Reset and inject mock adapter for each test
    resetDbProvider();
    mockAdapter = new MockDbAdapter();
    mockAdapter.initialize({ provider: 'mock' });
    injectDbProvider(mockAdapter);
  });

  describe('Configuration', () => {
    it('should check if database is configured', () => {
      expect(isDbConfigured()).toBe(true);
    });

    it('should execute keepalive', async () => {
      const result = await keepalive();
      expect(result).toBe(1);
    });
  });

  describe('User Operations', () => {
    it('should create a user', async () => {
      const userData = {
        authUserId: 'auth123',
        email: 'test@example.com',
        passkeyEnrolled: false,
      };

      const user = await createUser(userData);

      expect(user.id).toBeDefined();
      expect(user.authUserId).toBe('auth123');
      expect(user.email).toBe('test@example.com');
      expect(user.passkeyEnrolled).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should get user by auth ID', async () => {
      await createUser({
        authUserId: 'auth123',
        email: 'test@example.com',
      });

      const user = await getUserByAuthId('auth123');

      expect(user).toBeDefined();
      expect(user?.authUserId).toBe('auth123');
    });

    it('should return null for non-existent auth ID', async () => {
      const user = await getUserByAuthId('nonexistent');
      expect(user).toBeNull();
    });

    it('should get user by database ID', async () => {
      const created = await createUser({
        authUserId: 'auth123',
        email: 'test@example.com',
      });

      const user = await getUserById(created.id);

      expect(user).toBeDefined();
      expect(user?.id).toBe(created.id);
    });

    it('should update user by auth ID', async () => {
      await createUser({
        authUserId: 'auth123',
        email: 'old@example.com',
        passkeyEnrolled: false,
      });

      const updated = await updateUserByAuthId('auth123', {
        email: 'new@example.com',
        passkeyEnrolled: true,
      });

      expect(updated.email).toBe('new@example.com');
      expect(updated.passkeyEnrolled).toBe(true);
    });

    it('should throw error when updating non-existent user', async () => {
      await expect(
        updateUserByAuthId('nonexistent', { email: 'test@example.com' }),
      ).rejects.toThrow(DbError);
    });

    it('should delete user by auth ID', async () => {
      await createUser({
        authUserId: 'auth123',
        email: 'test@example.com',
      });

      await deleteUserByAuthId('auth123');

      const user = await getUserByAuthId('auth123');
      expect(user).toBeNull();
    });

    it('should throw error when deleting non-existent user', async () => {
      await expect(deleteUserByAuthId('nonexistent')).rejects.toThrow(DbError);
    });

    it('should throw error on duplicate auth user ID', async () => {
      await createUser({
        authUserId: 'auth123',
        email: 'test@example.com',
      });

      await expect(
        createUser({
          authUserId: 'auth123',
          email: 'duplicate@example.com',
        }),
      ).rejects.toThrow(DbError);
    });
  });

  describe('Purchase Intent Operations', () => {
    it('should create a purchase intent', async () => {
      const intentData = {
        email: 'buyer@example.com',
        priceId: 'price_123',
      };

      const intent = await createPurchaseIntent(intentData);

      expect(intent.id).toBeDefined();
      expect(intent.email).toBe('buyer@example.com');
      expect(intent.priceId).toBe('price_123');
      expect(intent.status).toBe(PurchaseIntentStatus.CREATED);
      expect(intent.createdAt).toBeInstanceOf(Date);
      expect(intent.updatedAt).toBeInstanceOf(Date);
    });

    it('should create purchase intent with custom status', async () => {
      const intent = await createPurchaseIntent({
        email: 'buyer@example.com',
        status: PurchaseIntentStatus.PAID,
      });

      expect(intent.status).toBe(PurchaseIntentStatus.PAID);
    });

    it('should get purchase intent by ID', async () => {
      const created = await createPurchaseIntent({
        email: 'buyer@example.com',
      });

      const intent = await getPurchaseIntentById(created.id);

      expect(intent).toBeDefined();
      expect(intent?.id).toBe(created.id);
    });

    it('should return null for non-existent purchase intent ID', async () => {
      const intent = await getPurchaseIntentById('nonexistent');
      expect(intent).toBeNull();
    });

    it('should get purchase intent by session ID', async () => {
      const created = await createPurchaseIntent({
        email: 'buyer@example.com',
      });

      await updatePurchaseIntent(created.id, {
        stripeCheckoutSessionId: 'session_123',
      });

      const intent = await getPurchaseIntentBySessionId('session_123');

      expect(intent).toBeDefined();
      expect(intent?.stripeCheckoutSessionId).toBe('session_123');
    });

    it('should get purchase intents by auth user ID', async () => {
      await createPurchaseIntent({
        email: 'buyer@example.com',
      });

      const intent = await createPurchaseIntent({
        email: 'buyer@example.com',
      });

      await updatePurchaseIntent(intent.id, {
        authUserId: 'auth123',
      });

      const intents = await getPurchaseIntentsByAuthUserId('auth123');

      expect(intents).toHaveLength(1);
      expect(intents[0].authUserId).toBe('auth123');
    });

    it('should update purchase intent', async () => {
      const created = await createPurchaseIntent({
        email: 'buyer@example.com',
      });

      const updated = await updatePurchaseIntent(created.id, {
        status: PurchaseIntentStatus.CHECKOUT_CREATED,
        stripeCheckoutSessionId: 'session_123',
        stripePaymentIntentId: 'pi_123',
        authUserId: 'auth123',
      });

      expect(updated.status).toBe(PurchaseIntentStatus.CHECKOUT_CREATED);
      expect(updated.stripeCheckoutSessionId).toBe('session_123');
      expect(updated.stripePaymentIntentId).toBe('pi_123');
      expect(updated.authUserId).toBe('auth123');
    });

    it('should throw error when updating non-existent purchase intent', async () => {
      await expect(
        updatePurchaseIntent('nonexistent', {
          status: PurchaseIntentStatus.PAID,
        }),
      ).rejects.toThrow(DbError);
    });
  });

  describe('Webhook Event Operations', () => {
    it('should record webhook event', async () => {
      const eventData = {
        stripeEventId: 'evt_123',
        type: 'payment_intent.succeeded',
        payload: { amount: 1000, currency: 'usd' },
      };

      const event = await recordWebhookEvent(eventData);

      expect(event.id).toBeDefined();
      expect(event.stripeEventId).toBe('evt_123');
      expect(event.type).toBe('payment_intent.succeeded');
      expect(event.payload).toEqual({ amount: 1000, currency: 'usd' });
      expect(event.processedAt).toBeInstanceOf(Date);
    });

    it('should check if webhook event has been processed', async () => {
      const eventData = {
        stripeEventId: 'evt_123',
        type: 'payment_intent.succeeded',
        payload: {},
      };

      expect(await hasWebhookEventBeenProcessed('evt_123')).toBe(false);

      await recordWebhookEvent(eventData);

      expect(await hasWebhookEventBeenProcessed('evt_123')).toBe(true);
    });

    it('should prevent duplicate webhook event recording', async () => {
      const eventData = {
        stripeEventId: 'evt_123',
        type: 'payment_intent.succeeded',
        payload: {},
      };

      await recordWebhookEvent(eventData);

      await expect(recordWebhookEvent(eventData)).rejects.toThrow(DbError);
    });
  });

  describe('Error Handling', () => {
    it('should create DbError with correct properties', () => {
      const error = new DbError(
        DbErrorCode.NOT_FOUND,
        'Resource not found',
        new Error('Original error'),
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DbError);
      expect(error.code).toBe(DbErrorCode.NOT_FOUND);
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('DbError');
    });

    it('should check error code with is() method', () => {
      const error = new DbError(DbErrorCode.NOT_FOUND, 'Not found');

      expect(error.is(DbErrorCode.NOT_FOUND)).toBe(true);
      expect(error.is(DbErrorCode.UNIQUE_VIOLATION)).toBe(false);
    });

    it('should convert error to JSON', () => {
      const error = new DbError(DbErrorCode.PROVIDER_ERROR, 'Provider failed');

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'DbError',
        code: DbErrorCode.PROVIDER_ERROR,
        message: 'Provider failed',
      });
    });
  });
});
