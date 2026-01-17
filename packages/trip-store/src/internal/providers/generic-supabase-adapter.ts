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
export function createSupabaseAdapter<
  TDomain extends BaseEntityData,
  TDb = TDomain,
>(config: EntityStoreConfig<TDomain, TDb>): EntityStoreProvider<TDomain> {
  const { entityName, dbOperations, converters, validate } = config;

  /**
   * Get all entities for a user
   */
  async function getEntities(userId: string): Promise<TDomain[]> {
    try {
      const dbEntities = await dbOperations.getAll(userId);
      return dbEntities.map(converters.fromDb);
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
  ): Promise<TDomain | null> {
    try {
      const dbEntity = await dbOperations.getById(entityId);
      return dbEntity ? converters.fromDb(dbEntity) : null;
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
    data: CreateEntityData<TDomain>,
  ): Promise<TDomain> {
    if (validate?.createData) {
      validate.createData(data);
    }

    try {
      const dbData = converters.createInputToDb(data);
      const dbEntity = await dbOperations.create(userId, dbData);
      return converters.fromDb(dbEntity);
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
    data: UpdateEntityData<TDomain>,
  ): Promise<TDomain> {
    if (validate?.updateData) {
      validate.updateData(data);
    }

    try {
      const dbData = converters.updateInputToDb(data);
      const dbEntity = await dbOperations.update(entityId, dbData);
      return converters.fromDb(dbEntity);
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
    entitiesData: CreateEntityData<TDomain>[],
  ): Promise<TDomain[]> {
    try {
      // Convert domain data to DB data
      const dbDataArray = entitiesData.map(converters.createInputToDb);

      // Use bulk create if available
      if (dbOperations.bulkCreate) {
        const dbEntities = await dbOperations.bulkCreate(userId, dbDataArray);
        return dbEntities.map(converters.fromDb);
      }

      // Fall back to individual creates
      const results: TDomain[] = [];
      for (const dbData of dbDataArray) {
        const dbEntity = await dbOperations.create(userId, dbData);
        results.push(converters.fromDb(dbEntity));
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
