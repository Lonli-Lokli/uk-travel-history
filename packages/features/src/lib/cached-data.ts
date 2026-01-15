import { getPriceDetails } from '@uth/payments-server';
import { unstable_cache } from 'next/cache';
import { getAllFeaturePolicies } from './features';
import { DEFAULT_FEATURE_POLICIES } from './defaults';

/**
 * CACHE GLOBAL DATA (Cross-request)
 * These don't change per user. We cache them for 1 hour.
 */

/**
 * Cached Policies
 */
export const getCachedPolicies = unstable_cache(
  async () => {
    try {
      return await getAllFeaturePolicies();
    } catch (error) {
      console.error('[loadDataAccessContext] Failed to load policies:', error);
      return DEFAULT_FEATURE_POLICIES;
    }
  },
  ['global-feature-policies'],
  { revalidate: 3600 },
);

/**
 * Cached Price Details
 */
export const getCachedPriceDetails = unstable_cache(
  async () => {
    try {
      return await getPriceDetails();
    } catch (error) {
      console.error(
        '[loadDataAccessContext] Failed to load price details:',
        error,
      );
      return null;
    }
  },
  ['global-price-details'],
  { revalidate: 3600 },
);
