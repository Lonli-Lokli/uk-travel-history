/**
 * Goal-specific entity store
 * Built on top of generic entity store infrastructure
 */

import type {
  TrackingGoalData,
  CreateTrackingGoalData,
  UpdateTrackingGoalData,
} from '@uth/db';
import {
  getUserGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} from '@uth/db';
import type { EntityStoreConfig } from '../types/generic';
import { createEntityStoreOperations } from '../public/generic-operations';
import { createMigrationFunctions } from '../public/generic-migration';
import { validateSessionId, validateUserId } from '../internal/validation';

/**
 * Goal entity store configuration
 */
const goalStoreConfig: EntityStoreConfig<TrackingGoalData> = {
  entityName: 'goal',
  cacheKeyPrefix: 'goals:session:',
  dbOperations: {
    getAll: getUserGoals,
    getById: getGoalById,
    create: createGoal,
    update: updateGoal,
    delete: deleteGoal,
  },
  validate: {
    sessionId: validateSessionId,
  },
};

/**
 * Create goal store operations
 */
const operations = createEntityStoreOperations(goalStoreConfig);

/**
 * Create goal migration functions
 */
const migration = createMigrationFunctions(goalStoreConfig);

// Export operations with goal-specific names
export const createGoalStoreContext = operations.createContext;
export const getGoals = operations.getEntities;
export const getGoalById = operations.getEntityById;
export const createGoalEntity = operations.createEntity;
export const updateGoalEntity = operations.updateEntity;
export const deleteGoalEntity = operations.deleteEntity;
export const bulkCreateGoals = operations.bulkCreateEntities;
export const goalStoreUsesPersistentStorage = operations.usesPersistentStorage;

// Export migration functions with goal-specific names
export const migrateGoalsFromCache = migration.migrateFromCache;
export const hasCachedGoals = migration.hasCachedEntities;
export const getCachedGoalCount = migration.getCachedEntityCount;
export const clearCachedGoals = migration.clearCachedEntities;

// Export types
export type { EntityStoreContext as GoalStoreContext } from '../types/generic';
export { EntityStoreError as GoalStoreError, EntityStoreErrorCode as GoalStoreErrorCode } from '../types/generic';
