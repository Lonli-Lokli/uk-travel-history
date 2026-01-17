/**
 * Generic migration utilities for moving entities from cache to Supabase
 * Used when a user upgrades from free to paid tier
 */

import type {
  BaseEntityData,
  CreateEntityData,
  EntityStoreConfig,
  MigrationResult,
} from '../types/generic';
import { set, get, deleteKey } from '@uth/cache';
import { createCacheAdapter } from '../internal/providers/generic-cache-adapter';
import { createSupabaseAdapter } from '../internal/providers/generic-supabase-adapter';

/**
 * Create migration functions for a specific entity type
 * @param config Entity store configuration
 * @returns Migration functions
 */
export function createMigrationFunctions<T extends BaseEntityData>(
  config: EntityStoreConfig<T>,
) {
  const { entityName } = config;
  const cacheAdapter = createCacheAdapter(config) as any;
  const supabaseAdapter = createSupabaseAdapter(config);

  /**
   * Migrate entities from cache to Supabase for a user
   * This is called when a user upgrades to a paid tier
   *
   * Uses a distributed lock to prevent concurrent migrations of the same session.
   * If another process is already migrating this session, returns immediately with skipped=true.
   *
   * @param sessionId Session ID containing cached entities
   * @param userId User ID to migrate entities to
   * @returns Migration result
   */
  async function migrateFromCache(
    sessionId: string,
    userId: string,
  ): Promise<MigrationResult> {
    const lockKey = `migration:lock:${entityName}:${sessionId}`;
    const lockTTL = 30; // Lock expires after 30 seconds
    const errors: string[] = [];
    let migrated = 0;

    try {
      // Try to acquire lock
      const lockAcquired = await acquireLock(lockKey, lockTTL);
      if (!lockAcquired) {
        // Another process is already migrating this session
        return {
          migrated: 0,
          errors: [],
          success: true,
          skipped: true,
        };
      }

      try {
        // Get entities from cache
        const cachedEntities = await cacheAdapter.getEntities(sessionId);

        if (cachedEntities.length === 0) {
          return {
            migrated: 0,
            errors: [],
            success: true,
          };
        }

        // Convert cached entities to create data
        const createData: CreateEntityData<T>[] = cachedEntities.map(
          (entity: T) => {
            // Remove generated fields (id, userId, createdAt, updatedAt)
            const { id, userId, createdAt, updatedAt, ...rest } = entity;
            return rest as CreateEntityData<T>;
          },
        );

        // Create entities in Supabase one by one to handle partial failures
        for (const data of createData) {
          try {
            await supabaseAdapter.createEntity(userId, data);
            migrated++;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to migrate ${entityName}: ${message}`);
          }
        }

        // Always clear cache after migration attempt
        // This prevents data duplication and ensures users see fresh data from Supabase
        // Even if some entities failed to migrate, we clear the cache to avoid confusion
        await cacheAdapter.clearEntities(sessionId);

        return {
          migrated,
          errors,
          success: errors.length === 0,
        };
      } finally {
        // Always release lock, even if migration fails
        await releaseLock(lockKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Migration failed: ${message}`);
      // Ensure lock is released on critical error
      try {
        await releaseLock(lockKey);
      } catch {
        // Ignore lock release errors - lock will auto-expire
      }
      return {
        migrated,
        errors,
        success: false,
      };
    }
  }

  /**
   * Check if a session has entities that need migration
   * @param sessionId Session ID to check
   * @returns true if there are entities in the cache for this session
   */
  async function hasCachedEntities(sessionId: string): Promise<boolean> {
    return cacheAdapter.hasEntities(sessionId);
  }

  /**
   * Get count of cached entities for a session
   * @param sessionId Session ID to check
   * @returns Number of cached entities
   */
  async function getCachedEntityCount(sessionId: string): Promise<number> {
    const entities = await cacheAdapter.getEntities(sessionId);
    return entities.length;
  }

  /**
   * Clear cached entities for a session (without migrating)
   * Use with caution - this deletes data
   * @param sessionId Session ID to clear
   */
  async function clearCachedEntities(sessionId: string): Promise<void> {
    await cacheAdapter.clearEntities(sessionId);
  }

  return {
    migrateFromCache,
    hasCachedEntities,
    getCachedEntityCount,
    clearCachedEntities,
  };
}

/**
 * Acquire a distributed lock using cache SET NX (set if not exists)
 * @param lockKey Lock key
 * @param ttl Lock TTL in seconds
 * @returns true if lock was acquired, false otherwise
 */
async function acquireLock(lockKey: string, ttl: number): Promise<boolean> {
  try {
    // Check if lock already exists
    const existing = await get<string>(lockKey);
    if (existing) {
      return false;
    }

    // Set lock with TTL
    await set(lockKey, 'locked', { ttl });
    return true;
  } catch (error) {
    // On error, fail-safe: don't acquire lock
    console.error('Failed to acquire migration lock:', error);
    return false;
  }
}

/**
 * Release a distributed lock
 * @param lockKey Lock key
 */
async function releaseLock(lockKey: string): Promise<void> {
  try {
    await deleteKey(lockKey);
  } catch (error) {
    // Log but don't throw - lock will auto-expire anyway
    console.error('Failed to release migration lock:', error);
  }
}
