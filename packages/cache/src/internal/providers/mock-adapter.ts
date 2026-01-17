import { CacheProvider, CacheProviderConfig, SetOptions } from './interface';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class MockCacheAdapter implements CacheProvider {
  private configured = false;
  private store = new Map<string, CacheEntry<unknown>>();

  initialize(_config: CacheProviderConfig): void {
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
    const entry: CacheEntry<T> = { value };

    if (options?.ttl) {
      entry.expiresAt = Date.now() + options.ttl * 1000;
    }

    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async setIfNotExists<T>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    // Check if key already exists (and is not expired)
    const exists = await this.exists(key);
    if (exists) {
      return false;
    }

    // Set the key since it doesn't exist
    await this.set(key, value, options);
    return true;
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }
}
