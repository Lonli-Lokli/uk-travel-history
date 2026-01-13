import { CacheProvider, CacheProviderConfig } from './interface';

export class MockCacheAdapter implements CacheProvider {
  private configured = false;

  initialize(_config: CacheProviderConfig): void {
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }
}
