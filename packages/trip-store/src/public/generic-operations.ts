/**
 * Generic entity store operations factory
 * Creates CRUD operations for any entity type with automatic routing to cache or Supabase
 */

import type {
  BaseEntityData,
  CreateEntityData,
  UpdateEntityData,
  EntityStoreContext,
  EntityStoreConfig,
} from '../types/generic';
import { createCacheAdapter } from '../internal/providers/generic-cache-adapter';
import { createSupabaseAdapter } from '../internal/providers/generic-supabase-adapter';

/**
 * Create entity store operations for a specific entity type
 * @param config Entity store configuration
 * @returns Entity store operations
 */
export function createEntityStoreOperations<T extends BaseEntityData>(
  config: EntityStoreConfig<T>,
) {
  const cacheAdapter = createCacheAdapter(config) as any;
  const supabaseAdapter = createSupabaseAdapter(config);

  /**
   * Create a context for entity store operations
   * Determines whether to use cache (anonymous/free) or Supabase (paid)
   *
   * @param authUser Authenticated user (null if anonymous)
   * @param sessionId Session ID for anonymous users
   * @param isPaidUser Whether the user has a paid subscription
   * @returns Entity store context
   */
  function createContext(
    authUser: { uid: string } | null,
    sessionId: string | null,
    isPaidUser: boolean,
  ): EntityStoreContext {
    // Paid authenticated users use Supabase
    if (authUser && isPaidUser) {
      return {
        userId: authUser.uid,
        usePersistentStorage: true,
      };
    }

    // Free/anonymous users use cache
    // Session ID is required for cache access
    if (!sessionId) {
      throw new Error('Session ID is required for anonymous/free users');
    }

    return {
      userId: sessionId,
      usePersistentStorage: false,
      sessionId,
    };
  }

  /**
   * Get all entities for the user
   */
  async function getEntities(context: EntityStoreContext): Promise<T[]> {
    if (context.usePersistentStorage) {
      return supabaseAdapter.getEntities(context.userId);
    } else {
      return cacheAdapter.getEntities(context.sessionId!);
    }
  }

  /**
   * Get entity by ID
   */
  async function getEntityById(
    context: EntityStoreContext,
    entityId: string,
  ): Promise<T | null> {
    if (context.usePersistentStorage) {
      return supabaseAdapter.getEntityById(context.userId, entityId);
    } else {
      return cacheAdapter.getEntityById(context.sessionId!, entityId);
    }
  }

  /**
   * Create a new entity
   */
  async function createEntity(
    context: EntityStoreContext,
    data: CreateEntityData<T>,
  ): Promise<T> {
    if (context.usePersistentStorage) {
      return supabaseAdapter.createEntity(context.userId, data);
    } else {
      return cacheAdapter.createEntity(context.sessionId!, data);
    }
  }

  /**
   * Update an existing entity
   */
  async function updateEntity(
    context: EntityStoreContext,
    entityId: string,
    data: UpdateEntityData<T>,
  ): Promise<T> {
    if (context.usePersistentStorage) {
      return supabaseAdapter.updateEntity(context.userId, entityId, data);
    } else {
      return cacheAdapter.updateEntity(context.sessionId!, entityId, data);
    }
  }

  /**
   * Delete an entity
   */
  async function deleteEntity(
    context: EntityStoreContext,
    entityId: string,
  ): Promise<void> {
    if (context.usePersistentStorage) {
      return supabaseAdapter.deleteEntity(context.userId, entityId);
    } else {
      return cacheAdapter.deleteEntity(context.sessionId!, entityId);
    }
  }

  /**
   * Bulk create entities
   */
  async function bulkCreateEntities(
    context: EntityStoreContext,
    entitiesData: CreateEntityData<T>[],
  ): Promise<T[]> {
    if (context.usePersistentStorage) {
      return supabaseAdapter.bulkCreateEntities(context.userId, entitiesData);
    } else {
      return cacheAdapter.bulkCreateEntities(context.sessionId!, entitiesData);
    }
  }

  /**
   * Check if context uses persistent storage
   */
  function usesPersistentStorage(context: EntityStoreContext): boolean {
    return context.usePersistentStorage;
  }

  return {
    createContext,
    getEntities,
    getEntityById,
    createEntity,
    updateEntity,
    deleteEntity,
    bulkCreateEntities,
    usesPersistentStorage,
  };
}
