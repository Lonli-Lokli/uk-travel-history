/**
 * Public trip store operations
 * These functions provide the main API for trip CRUD operations
 */

import type { NextRequest } from 'next/server';
import type {
  TripData,
  CreateTripData,
  UpdateTripData,
} from '@uth/db';
import { SubscriptionTier } from '@uth/db';
import { getCurrentUser } from '@uth/auth-server';
import { getUserByAuthId } from '@uth/db';
import {
  getTripStoreProvider,
  getIdentifier,
  shouldUsePersistentStorage,
} from '../internal/provider-resolver';
import {
  getSessionId,
  createSessionId,
} from '../internal/session-manager';
import { migrateTripsFromCache, hasCachedTrips } from './migration';
import type { TripStoreContext } from '../types/domain';
import { logger } from '@uth/utils';

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
 * Create trip store context from a Next.js request
 * Determines the appropriate storage backend and identifier
 * Automatically migrates cached trips when a user upgrades to paid
 *
 * @param request Next.js request
 * @returns Trip store context with session ID (creates new if needed)
 *          and flags for session/migration state
 */
export async function createTripStoreContext(
  request: NextRequest,
): Promise<{
  context: TripStoreContext;
  isNewSession: boolean;
  didMigrate: boolean;
}> {
  // Try to get authenticated user
  const authUser = await getCurrentUser();

  if (authUser) {
    // Authenticated user - check subscription tier
    const dbUser = await getUserByAuthId(authUser.uid);
    const tier = dbUser?.subscriptionTier ?? SubscriptionTier.FREE;
    const isPaid = isPaidTier(tier);

    if (isPaid) {
      // Paid user - use Supabase
      const sessionId = getSessionId(request);
      let didMigrate = false;

      // Check if user has cached trips from before upgrading
      if (sessionId) {
        try {
          const hasCached = await hasCachedTrips(sessionId);
          if (hasCached) {
            // Migrate cached trips to Supabase
            const result = await migrateTripsFromCache(sessionId, authUser.uid);
            didMigrate = result.success && result.migrated > 0;

            if (result.migrated > 0) {
              logger.info('Migrated trips from cache to Supabase', {
                extra: {
                  userId: authUser.uid,
                  sessionId,
                  migrated: result.migrated,
                  errors: result.errors,
                },
              });
            }
          }
        } catch (error) {
          // Log but don't fail - migration is best-effort
          logger.warn('Failed to migrate cached trips', {
            extra: {
              userId: authUser.uid,
              sessionId,
              error: (error as Error).message,
            },
          });
        }
      }

      return {
        context: {
          userId: authUser.uid,
          sessionId,
          isPaidUser: true,
        },
        isNewSession: false,
        didMigrate,
      };
    }

    // Free authenticated user - use cache with session
    let sessionId = getSessionId(request);
    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = createSessionId();
    }

    return {
      context: {
        userId: authUser.uid,
        sessionId,
        isPaidUser: false,
      },
      isNewSession,
      didMigrate: false,
    };
  }

  // Anonymous user - use cache with session
  let sessionId = getSessionId(request);
  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = createSessionId();
  }

  return {
    context: {
      userId: null,
      sessionId,
      isPaidUser: false,
    },
    isNewSession,
    didMigrate: false,
  };
}

/**
 * Get all trips for the current context
 * @param context Trip store context
 * @returns Array of trips
 */
export async function getTrips(context: TripStoreContext): Promise<TripData[]> {
  const provider = getTripStoreProvider(context);
  const identifier = getIdentifier(context);
  return provider.getTrips(identifier);
}

/**
 * Get a specific trip by ID
 * @param context Trip store context
 * @param tripId Trip ID
 * @returns Trip data or null if not found
 */
export async function getTripById(
  context: TripStoreContext,
  tripId: string,
): Promise<TripData | null> {
  const provider = getTripStoreProvider(context);
  const identifier = getIdentifier(context);
  return provider.getTripById(identifier, tripId);
}

/**
 * Create a new trip
 * @param context Trip store context
 * @param data Trip creation data
 * @returns Created trip
 */
export async function createTrip(
  context: TripStoreContext,
  data: CreateTripData,
): Promise<TripData> {
  const provider = getTripStoreProvider(context);
  const identifier = getIdentifier(context);
  return provider.createTrip(identifier, data);
}

/**
 * Update an existing trip
 * @param context Trip store context
 * @param tripId Trip ID
 * @param data Trip update data
 * @returns Updated trip
 */
export async function updateTrip(
  context: TripStoreContext,
  tripId: string,
  data: UpdateTripData,
): Promise<TripData> {
  const provider = getTripStoreProvider(context);
  const identifier = getIdentifier(context);
  return provider.updateTrip(identifier, tripId, data);
}

/**
 * Delete a trip
 * @param context Trip store context
 * @param tripId Trip ID
 */
export async function deleteTrip(
  context: TripStoreContext,
  tripId: string,
): Promise<void> {
  const provider = getTripStoreProvider(context);
  const identifier = getIdentifier(context);
  return provider.deleteTrip(identifier, tripId);
}

/**
 * Bulk create trips (for imports)
 * @param context Trip store context
 * @param trips Array of trip creation data
 * @returns Array of created trips
 */
export async function bulkCreateTrips(
  context: TripStoreContext,
  trips: CreateTripData[],
): Promise<TripData[]> {
  const provider = getTripStoreProvider(context);
  const identifier = getIdentifier(context);
  return provider.bulkCreateTrips(identifier, trips);
}

/**
 * Check if context uses persistent storage
 * @param context Trip store context
 * @returns true if using persistent storage (Supabase)
 */
export function usesPersistentStorage(context: TripStoreContext): boolean {
  return shouldUsePersistentStorage(context);
}

// Re-export session management functions for API routes
export {
  getSessionId,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
} from '../internal/session-manager';
