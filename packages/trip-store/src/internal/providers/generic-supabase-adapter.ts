/**
 * Generic Supabase adapter for entity storage
 * Provides persistent storage with Row Level Security (RLS)
 */

import type {
  BaseEntityData,
  CreateEntityData,
  UpdateEntityData,
  EntityStoreProvider,
  EntityStoreConfig,
} from '../../types/generic';
import { EntityStoreError, EntityStoreErrorCode } from '../../types/generic';

/**
 * Create a Supabase adapter for a specific entity type
 * @param config Entity store configuration
 * @returns Supabase adapter instance
 */
export function createSupabaseAdapter<T extends BaseEntityData>(
  config: EntityStoreConfig<T>,
): EntityStoreProvider<T> {
  const { entityName, dbOperations, validate } = config;

  /**
   * Get all entities for a user
   */
  async function getEntities(userId: string): Promise<T[]> {
    try {
      return await dbOperations.getAll(userId);
    } catch (error) {
      throw new EntityStoreError(
        EntityStoreErrorCode.PROVIDER_ERROR,
        `Failed to get ${entityName}s for user ${userId}`,
        error,
      );
    }
  }

  /**
   * Get entity by ID
   */
  async function getEntityById(
    userId: string,
    entityId: string,
  ): Promise<T | null> {
    try {
      return await dbOperations.getById(entityId);
    } catch (error) {
      throw new EntityStoreError(
        EntityStoreErrorCode.PROVIDER_ERROR,
        `Failed to get ${entityName} ${entityId}`,
        error,
      );
    }
  }

  /**
   * Create a new entity
   */
  async function createEntity(
    userId: string,
    data: CreateEntityData<T>,
  ): Promise<T> {
    if (validate?.createData) {
      validate.createData(data);
    }

    try {
      return await dbOperations.create(userId, data);
    } catch (error) {
      throw new EntityStoreError(
        EntityStoreErrorCode.PROVIDER_ERROR,
        `Failed to create ${entityName} for user ${userId}`,
        error,
      );
    }
  }

  /**
   * Update an existing entity
   */
  async function updateEntity(
    userId: string,
    entityId: string,
    data: UpdateEntityData<T>,
  ): Promise<T> {
    if (validate?.updateData) {
      validate.updateData(data);
    }

    try {
      return await dbOperations.update(entityId, data);
    } catch (error) {
      throw new EntityStoreError(
        EntityStoreErrorCode.PROVIDER_ERROR,
        `Failed to update ${entityName} ${entityId}`,
        error,
      );
    }
  }

  /**
   * Delete an entity
   */
  async function deleteEntity(
    userId: string,
    entityId: string,
  ): Promise<void> {
    try {
      await dbOperations.delete(entityId);
    } catch (error) {
      throw new EntityStoreError(
        EntityStoreErrorCode.PROVIDER_ERROR,
        `Failed to delete ${entityName} ${entityId}`,
        error,
      );
    }
  }

  /**
   * Bulk create entities
   */
  async function bulkCreateEntities(
    userId: string,
    entitiesData: CreateEntityData<T>[],
  ): Promise<T[]> {
    try {
      // Use bulk create if available
      if (dbOperations.bulkCreate) {
        return await dbOperations.bulkCreate(userId, entitiesData);
      }

      // Fall back to individual creates
      const results: T[] = [];
      for (const data of entitiesData) {
        const entity = await dbOperations.create(userId, data);
        results.push(entity);
      }
      return results;
    } catch (error) {
      throw new EntityStoreError(
        EntityStoreErrorCode.PROVIDER_ERROR,
        `Failed to bulk create ${entityName}s for user ${userId}`,
        error,
      );
    }
  }

  // Return provider interface
  return {
    getEntities,
    getEntityById,
    createEntity,
    updateEntity,
    deleteEntity,
    bulkCreateEntities,
  };
}
