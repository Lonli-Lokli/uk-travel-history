// User roles
export const ROLES = {
  STANDARD: 'standard',
  ADMIN: 'admin',
} as const;

export type RoleId = (typeof ROLES)[keyof typeof ROLES];

// Tier identifiers
export const TIERS = {
  ANONYMOUS: 'anonymous', // No authentication required
  FREE: 'free', // Authenticated, free tier
  PREMIUM: 'premium', // Authenticated, paid subscription
} as const;

export type TierId = (typeof TIERS)[keyof typeof TIERS];
