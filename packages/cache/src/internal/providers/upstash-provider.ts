import { CacheError, CacheErrorCode } from '../../types/domain';
import { CacheProvider, CacheProviderConfig } from './interface.js';

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
}
