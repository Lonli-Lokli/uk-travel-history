/**
 * Generic cache adapter for entity storage
 * Provides ephemeral storage for anonymous/free users
 */

import type {
  BaseEntityData,
  CreateEntityData,
  UpdateEntityData,
  EntityStoreProvider,
  EntityStoreConfig,
  EntityStoreError,
  EntityStoreErrorCode,
} from '../../types/generic';
import { get, set, deleteKey } from '@uth/cache';
import { getEndOfDayTTLSeconds } from '../session-manager';

/**
 * Create a cache adapter for a specific entity type
 * @param config Entity store configuration
 * @returns Cache adapter instance
 */
export function createCacheAdapter<T extends BaseEntityData>(
  config: EntityStoreConfig<T>,
): EntityStoreProvider<T> {
  const { entityName, cacheKeyPrefix, validate } = config;

  /**
   * Get cache key for a session
   */
  function getCacheKey(sessionId: string): string {
    return `${cacheKeyPrefix}${sessionId}`;
  }

  /**
   * Get all entities from cache
   */
  async function getEntities(sessionId: string): Promise<T[]> {
    if (validate?.sessionId) {
      validate.sessionId(sessionId);
    }

    try {
      const key = getCacheKey(sessionId);
      const entities = await get<T[]>(key);
      return entities || [];
    } catch (error) {
      console.warn(
        `Failed to get ${entityName}s from cache for session ${sessionId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get entity by ID from cache
   */
  async function getEntityById(
    sessionId: string,
    entityId: string,
  ): Promise<T | null> {
    const entities = await getEntities(sessionId);
    return entities.find((e) => e.id === entityId) || null;
  }

  /**
   * Create a new entity in cache
   */
  async function createEntity(
    sessionId: string,
    data: CreateEntityData<T>,
  ): Promise<T> {
    if (validate?.sessionId) {
      validate.sessionId(sessionId);
    }
    if (validate?.createData) {
      validate.createData(data);
    }

    const entities = await getEntities(sessionId);

    // Create new entity with generated fields
    const now = new Date().toISOString();
    const newEntity: T = {
      ...data,
      id: `${entityName}_${crypto.randomUUID()}`,
      userId: sessionId, // Use session ID as pseudo-user ID
      createdAt: now,
      updatedAt: now,
    } as T;

    entities.push(newEntity);
    await saveEntities(sessionId, entities);

    return newEntity;
  }

  /**
   * Update an existing entity in cache
   */
  async function updateEntity(
    sessionId: string,
    entityId: string,
    data: UpdateEntityData<T>,
  ): Promise<T> {
    if (validate?.sessionId) {
      validate.sessionId(sessionId);
    }
    if (validate?.updateData) {
      validate.updateData(data);
    }

    const entities = await getEntities(sessionId);
    const index = entities.findIndex((e) => e.id === entityId);

    if (index === -1) {
      throw createNotFoundError(entityName, entityId);
    }

    // Update entity
    const updated: T = {
      ...entities[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    entities[index] = updated;
    await saveEntities(sessionId, entities);

    return updated;
  }

  /**
   * Delete an entity from cache
   */
  async function deleteEntity(
    sessionId: string,
    entityId: string,
  ): Promise<void> {
    if (validate?.sessionId) {
      validate.sessionId(sessionId);
    }

    const entities = await getEntities(sessionId);
    const filtered = entities.filter((e) => e.id !== entityId);

    if (filtered.length === entities.length) {
      throw createNotFoundError(entityName, entityId);
    }

    await saveEntities(sessionId, filtered);
  }

  /**
   * Bulk create entities in cache
   */
  async function bulkCreateEntities(
    sessionId: string,
    entitiesData: CreateEntityData<T>[],
  ): Promise<T[]> {
    if (validate?.sessionId) {
      validate.sessionId(sessionId);
    }

    const existingEntities = await getEntities(sessionId);
    const now = new Date().toISOString();
    const newEntities: T[] = entitiesData.map((data) => ({
      ...data,
      id: `${entityName}_${crypto.randomUUID()}`,
      userId: sessionId,
      createdAt: now,
      updatedAt: now,
    })) as T[];

    const allEntities = [...existingEntities, ...newEntities];
    await saveEntities(sessionId, allEntities);

    return newEntities;
  }

  /**
   * Save entities to cache with TTL
   */
  async function saveEntities(sessionId: string, entities: T[]): Promise<void> {
    const key = getCacheKey(sessionId);
    const ttl = getEndOfDayTTLSeconds();
    await set(key, entities, { ttl });
  }

  /**
   * Clear all entities from cache
   */
  async function clearEntities(sessionId: string): Promise<void> {
    const key = getCacheKey(sessionId);
    await deleteKey(key);
  }

  /**
   * Check if entities exist in cache
   */
  async function hasEntities(sessionId: string): Promise<boolean> {
    const entities = await getEntities(sessionId);
    return entities.length > 0;
  }

  // Return provider interface
  return {
    getEntities,
    getEntityById,
    createEntity,
    updateEntity,
    deleteEntity,
    bulkCreateEntities,
    // Additional cache-specific methods
    clearEntities,
    hasEntities,
  } as any; // Type assertion needed for additional methods
}

/**
 * Helper to create not found error
 */
function createNotFoundError(
  entityName: string,
  entityId: string,
): { code: string; message: string } {
  return {
    code: 'NOT_FOUND',
    message: `${entityName} with id ${entityId} not found`,
  };
}
