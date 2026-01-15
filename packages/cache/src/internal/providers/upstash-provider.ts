import { CacheError, CacheErrorCode } from '../../types/domain';
import { CacheProvider, CacheProviderConfig, SetOptions } from './interface.js';

import { Redis } from '@upstash/redis';

/**
 * Upstash implementation of the cache provider
 */
export class UpstashCacheAdapter implements CacheProvider {
  private client: Redis | null = null;
  private configured = false;
  private initError?: Error;

  initialize(_config: CacheProviderConfig): void {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      const error = new Error(
        'Missing Upstash configuration. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.',
      );
      this.initError = error;
      return;
    }

    this.client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): Redis {
    if (!this.configured || !this.client) {
      if (this.initError) {
        throw new CacheError(
          CacheErrorCode.CONFIG_ERROR,
          `Upstash not initialized: ${this.initError.message}`,
          this.initError,
        );
      }
      throw new CacheError(
        CacheErrorCode.CONFIG_ERROR,
        'Upstash not initialized. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.',
      );
    }
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.ensureConfigured();
    try {
      const value = await client.get<T>(key);
      return value;
    } catch (error) {
      throw new CacheError(
        CacheErrorCode.PROVIDER_ERROR,
        `Failed to get key "${key}"`,
        error,
      );
    }
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
    const client = this.ensureConfigured();
    try {
      if (options?.ttl) {
        await client.set(key, value, { ex: options.ttl });
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      throw new CacheError(
        CacheErrorCode.PROVIDER_ERROR,
        `Failed to set key "${key}"`,
        error,
      );
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.ensureConfigured();
    try {
      await client.del(key);
    } catch (error) {
      throw new CacheError(
        CacheErrorCode.PROVIDER_ERROR,
        `Failed to delete key "${key}"`,
        error,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const client = this.ensureConfigured();
    try {
      const count = await client.exists(key);
      return count > 0;
    } catch (error) {
      throw new CacheError(
        CacheErrorCode.PROVIDER_ERROR,
        `Failed to check existence of key "${key}"`,
        error,
      );
    }
  }
}
