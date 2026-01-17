/**
 * Goal-specific entity store
 * Built on top of generic entity store infrastructure
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  TrackingGoalData,
  CreateTrackingGoalData,
  UpdateTrackingGoalData,
} from '@uth/db';
import {
  getUserGoals as dbGetUserGoals,
  getGoalById as dbGetGoalById,
  createGoal as dbCreateGoal,
  updateGoal as dbUpdateGoal,
  deleteGoal as dbDeleteGoal,
  getUserByAuthId,
  SubscriptionTier,
} from '@uth/db';
import type { EntityStoreConfig, EntityStoreContext } from '../types/generic';
import { createEntityStoreOperations } from '../public/generic-operations';
import { createMigrationFunctions } from '../public/generic-migration';
import { validateSessionId, validateUserId } from '../internal/validation';
import {
  getSessionId,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
} from '../internal/session-manager';
import type { TrackingGoal } from '../types/goal-domain';
import {
  goalFromDb,
  goalToDb,
  createGoalInputToDb,
  updateGoalInputToDb,
} from '../internal/converters/goal-converter';

/**
 * Goal entity store configuration
 */
const goalStoreConfig: EntityStoreConfig<TrackingGoal, TrackingGoalData> = {
  entityName: 'goal',
  cacheKeyPrefix: 'goals:session:',
  dbOperations: {
    getAll: dbGetUserGoals,
    getById: dbGetGoalById,
    create: dbCreateGoal,
    update: dbUpdateGoal,
    delete: dbDeleteGoal,
  },
  converters: {
    fromDb: goalFromDb,
    toDb: goalToDb,
    createInputToDb: createGoalInputToDb,
    updateInputToDb: updateGoalInputToDb,
  },
  validate: {
    sessionId: validateSessionId,
  },
};

/**
 * Paid subscription tiers that use persistent storage
 */
const PAID_TIERS: SubscriptionTier[] = [
  SubscriptionTier.MONTHLY,
  SubscriptionTier.YEARLY,
  SubscriptionTier.LIFETIME,
];

/**
 * Check if a subscription tier is a paid tier
 */
function isPaidTier(tier: SubscriptionTier): boolean {
  return PAID_TIERS.includes(tier);
}

/**
 * Create goal store operations
 */
const operations = createEntityStoreOperations(goalStoreConfig);

/**
 * Create goal migration functions
 */
const migration = createMigrationFunctions(goalStoreConfig);

/**
 * Extended context with Next.js integration
 */
export interface GoalStoreContextWithResponse extends EntityStoreContext {
  sessionId?: string; // Override to match base type
  isPaidUser: boolean;
  response: {
    json: (data: any, init?: ResponseInit) => NextResponse;
  };
}

/**
 * Create goal store context from Next.js request
 * Handles authentication, session management, and automatic migration
 *
 * @param authUser Authenticated user (null if anonymous)
 * @param request Next.js request object
 * @returns Goal store context with response wrapper
 */
export async function createGoalStoreContext(
  authUser: { uid: string } | null,
  request: NextRequest,
): Promise<GoalStoreContextWithResponse> {
  let sessionId = getSessionId(request);
  const isNewSession = !sessionId;
  let didMigrate = false;

  if (authUser) {
    // Authenticated user - check subscription tier
    const dbUser = await getUserByAuthId(authUser.uid);
    const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
    const isPaid = isPaidTier(tier);

    if (isPaid) {
      // Paid user - migrate cached goals if needed
      if (sessionId) {
        try {
          const result = await migration.migrateFromCache(sessionId, authUser.uid);
          didMigrate = result.migrated > 0;
        } catch (error) {
          console.warn('Failed to migrate cached goals', error);
        }
      }

      // Create context for paid user
      const context = operations.createContext(authUser, null, true);

      return {
        ...context,
        sessionId: undefined,
        isPaidUser: true,
        response: {
          json: (data: any, init?: ResponseInit) => {
            const response = NextResponse.json(data, init);
            if (didMigrate) {
              clearSessionCookie(response);
            }
            return response;
          },
        },
      };
    }
  }

  // Free/anonymous user - use cache
  if (!sessionId) {
    sessionId = createSessionId();
  }

  const context = operations.createContext(null, sessionId, false);

  return {
    ...context,
    sessionId,
    isPaidUser: false,
    response: {
      json: (data: any, init?: ResponseInit) => {
        const response = NextResponse.json(data, init);
        if (isNewSession && sessionId) {
          setSessionCookie(response, sessionId);
        }
        return response;
      },
    },
  };
}

// Export operations with goal-specific names
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

// Export types (Note: GoalStoreContextWithResponse is exported above)
export type { EntityStoreContext as GoalStoreContext } from '../types/generic';
export { EntityStoreError as GoalStoreError, EntityStoreErrorCode as GoalStoreErrorCode } from '../types/generic';
