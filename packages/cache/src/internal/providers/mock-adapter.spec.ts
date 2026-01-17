/**
 * Tests for MockCacheAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockCacheAdapter } from './mock-adapter';

describe('MockCacheAdapter', () => {
  let adapter: MockCacheAdapter;

  beforeEach(() => {
    adapter = new MockCacheAdapter();
    adapter.initialize({ provider: 'mock' });
  });

  describe('setIfNotExists', () => {
    it('should set value when key does not exist', async () => {
      const result = await adapter.setIfNotExists('testKey', 'testValue');
      expect(result).toBe(true);

      const value = await adapter.get<string>('testKey');
      expect(value).toBe('testValue');
    });

    it('should not set value when key already exists', async () => {
      await adapter.set('testKey', 'originalValue');

      const result = await adapter.setIfNotExists('testKey', 'newValue');
      expect(result).toBe(false);

      const value = await adapter.get<string>('testKey');
      expect(value).toBe('originalValue');
    });

    it('should respect TTL when setting new key', async () => {
      const result = await adapter.setIfNotExists('testKey', 'testValue', {
        ttl: 1,
      });
      expect(result).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const value = await adapter.get<string>('testKey');
      expect(value).toBe(null);
    });

    it('should allow setting again after key expires', async () => {
      // Set with short TTL
      await adapter.setIfNotExists('testKey', 'value1', { ttl: 1 });

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be able to set again
      const result = await adapter.setIfNotExists('testKey', 'value2');
      expect(result).toBe(true);

      const value = await adapter.get<string>('testKey');
      expect(value).toBe('value2');
    });

    it('should work with complex objects', async () => {
      const complexObj = { foo: 'bar', nested: { value: 123 } };
      const result = await adapter.setIfNotExists('complexKey', complexObj);
      expect(result).toBe(true);

      const retrieved = await adapter.get<typeof complexObj>('complexKey');
      expect(retrieved).toEqual(complexObj);
    });

    it('should simulate atomic behavior for setIfNotExists', async () => {
      // Note: The mock adapter's setIfNotExists is not truly atomic in concurrent scenarios
      // since it uses async exists() followed by set(). This is expected for a mock.
      // In production, the Upstash adapter uses true atomic Redis SET NX.

      // Test sequential setIfNotExists behavior
      const result1 = await adapter.setIfNotExists('raceKey', 'value1');
      expect(result1).toBe(true);

      const result2 = await adapter.setIfNotExists('raceKey', 'value2');
      expect(result2).toBe(false);

      // First value should be preserved
      const value = await adapter.get<string>('raceKey');
      expect(value).toBe('value1');
    });
  });

  describe('basic operations', () => {
    it('should get and set values', async () => {
      await adapter.set('key1', 'value1');
      const value = await adapter.get<string>('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const value = await adapter.get('nonExistent');
      expect(value).toBe(null);
    });

    it('should delete keys', async () => {
      await adapter.set('key1', 'value1');
      await adapter.delete('key1');
      const value = await adapter.get('key1');
      expect(value).toBe(null);
    });

    it('should check key existence', async () => {
      await adapter.set('key1', 'value1');
      const exists1 = await adapter.exists('key1');
      expect(exists1).toBe(true);

      const exists2 = await adapter.exists('nonExistent');
      expect(exists2).toBe(false);
    });

    it('should respect TTL', async () => {
      await adapter.set('ttlKey', 'ttlValue', { ttl: 1 });

      const value1 = await adapter.get<string>('ttlKey');
      expect(value1).toBe('ttlValue');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const value2 = await adapter.get<string>('ttlKey');
      expect(value2).toBe(null);
    });

    it('should clear all entries', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      adapter.clear();

      const value1 = await adapter.get('key1');
      const value2 = await adapter.get('key2');
      expect(value1).toBe(null);
      expect(value2).toBe(null);
    });
  });

  describe('isConfigured', () => {
    it('should return true after initialization', () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should return false before initialization', () => {
      const newAdapter = new MockCacheAdapter();
      expect(newAdapter.isConfigured()).toBe(false);
    });
  });
});
