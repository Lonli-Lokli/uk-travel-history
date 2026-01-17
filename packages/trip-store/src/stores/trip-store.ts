/**
 * Trip-specific entity store
 * Built on top of generic entity store infrastructure
 */

import { NextRequest, NextResponse } from 'next/server';
import type { TripData, CreateTripData, UpdateTripData } from '@uth/db';
import {
  getTrips as dbGetTrips,
  getTripById as dbGetTripById,
  createTrip as dbCreateTrip,
  updateTrip as dbUpdateTrip,
  deleteTrip as dbDeleteTrip,
  bulkCreateTrips as dbBulkCreateTrips,
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
import type { Trip } from '../types/trip-domain';
import {
  tripFromDb,
  tripToDb,
  createTripInputToDb,
  updateTripInputToDb,
} from '../internal/converters/trip-converter';

/**
 * Trip entity store configuration
 */
const tripStoreConfig: EntityStoreConfig<Trip, TripData> = {
  entityName: 'trip',
  cacheKeyPrefix: 'trips:session:',
  dbOperations: {
    getAll: (userId: string) => dbGetTrips(userId),
    getById: dbGetTripById,
    create: dbCreateTrip,
    update: dbUpdateTrip,
    delete: dbDeleteTrip,
    // Note: DB bulkCreateTrips has a different signature (BulkCreateTripsData)
    // so we omit it and let the generic store fall back to individual creates
  },
  converters: {
    fromDb: tripFromDb,
    toDb: tripToDb,
    createInputToDb: createTripInputToDb,
    updateInputToDb: updateTripInputToDb,
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
 * Create trip store operations
 */
const operations = createEntityStoreOperations(tripStoreConfig);

/**
 * Create trip migration functions
 */
const migration = createMigrationFunctions(tripStoreConfig);

/**
 * Extended context with Next.js integration
 */
export interface TripStoreContextWithResponse extends EntityStoreContext {
  sessionId?: string; // Override to match base type
  isPaidUser: boolean;
  response: {
    json: (data: any, init?: ResponseInit) => NextResponse;
  };
}

/**
 * Create trip store context from Next.js request
 * Handles authentication, session management, and automatic migration
 *
 * @param request Next.js request object
 * @returns Trip store context with response wrapper and session state
 */
export async function createTripStoreContext(
  request: NextRequest,
): Promise<{
  context: TripStoreContextWithResponse;
  isNewSession: boolean;
  didMigrate: boolean;
}> {
  // Try to get authenticated user (lazy import to avoid circular deps)
  const { getCurrentUser } = await import('@uth/auth-server');
  const authUser = await getCurrentUser();

  let sessionId = getSessionId(request);
  const isNewSession = !sessionId;
  let didMigrate = false;

  if (authUser) {
    // Authenticated user - check subscription tier
    const dbUser = await getUserByAuthId(authUser.uid);
    const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
    const isPaid = isPaidTier(tier);

    if (isPaid) {
      // Paid user - migrate cached trips if needed
      if (sessionId) {
        try {
          const result = await migration.migrateFromCache(sessionId, authUser.uid);
          didMigrate = result.migrated > 0;
        } catch (error) {
          console.warn('Failed to migrate cached trips', error);
        }
      }

      // Create context for paid user
      const opContext = operations.createContext(authUser, null, true);

      const context: TripStoreContextWithResponse = {
        ...opContext,
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

      return { context, isNewSession, didMigrate };
    }
  }

  // Free/anonymous user - use cache
  if (!sessionId) {
    sessionId = createSessionId();
  }

  const opContext = operations.createContext(null, sessionId, false);

  const context: TripStoreContextWithResponse = {
    ...opContext,
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

  return { context, isNewSession, didMigrate };
}

// Export operations with trip-specific names
export const getTrips = operations.getEntities;
export const getTripById = operations.getEntityById;
export const createTripEntity = operations.createEntity;
export const updateTripEntity = operations.updateEntity;
export const deleteTripEntity = operations.deleteEntity;
export const bulkCreateTrips = operations.bulkCreateEntities;
export const tripStoreUsesPersistentStorage = operations.usesPersistentStorage;

// Export migration functions with trip-specific names
export const migrateTripsFromCache = migration.migrateFromCache;
export const hasCachedTrips = migration.hasCachedEntities;
export const getCachedTripCount = migration.getCachedEntityCount;
export const clearCachedTrips = migration.clearCachedEntities;

// Export types
export type { EntityStoreContext as TripStoreContext } from '../types/generic';
export { EntityStoreError as TripStoreError, EntityStoreErrorCode as TripStoreErrorCode } from '../types/generic';
