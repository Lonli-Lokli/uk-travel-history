/**
 * Domain types for trips (business logic layer)
 * These are provider-agnostic and used throughout the application
 *
 * Key differences from DB types:
 * - All dates are ISO strings (serializable, cacheable)
 * - No database-specific fields (e.g., database-generated timestamps)
 * - Business-focused field names and structures
 */

/**
 * Trip entity - core business object
 * Represents a single trip outside the UK
 */
export interface Trip {
  /** Unique identifier */
  id: string;
  /** User who owns this trip */
  userId: string;
  /** Optional: Goal this trip is associated with */
  goalId: string | null;
  /** Optional: Human-readable title */
  title: string | null;
  /** Departure date (ISO 8601 format: YYYY-MM-DD) */
  outDate: string;
  /** Return date (ISO 8601 format: YYYY-MM-DD) */
  inDate: string;
  /** Departure route/location */
  outRoute: string | null;
  /** Return route/location */
  inRoute: string | null;
  /** Destination country/location */
  destination: string | null;
  /** Additional notes */
  notes: string | null;
  /** Optional: Group ID for grouping trips */
  groupId: string | null;
  /** Sort order within user's trips */
  sortOrder: number;
  /** How this trip was created */
  source: 'manual' | 'pdf_import' | 'excel_import';
  /** When this trip was created (ISO 8601 timestamp) */
  createdAt: string;
  /** When this trip was last updated (ISO 8601 timestamp) */
  updatedAt: string;
}

/**
 * Data required to create a new trip
 * Excludes generated fields (id, userId, timestamps)
 */
export interface CreateTripInput {
  /** Optional: Goal this trip is associated with */
  goalId?: string | null;
  /** Optional: Human-readable title */
  title?: string | null;
  /** Departure date (ISO 8601 format: YYYY-MM-DD) */
  outDate: string;
  /** Return date (ISO 8601 format: YYYY-MM-DD) */
  inDate: string;
  /** Departure route/location */
  outRoute?: string | null;
  /** Return route/location */
  inRoute?: string | null;
  /** Destination country/location */
  destination?: string | null;
  /** Additional notes */
  notes?: string | null;
  /** Optional: Group ID for grouping trips */
  groupId?: string | null;
  /** Sort order within user's trips */
  sortOrder?: number;
  /** How this trip was created */
  source?: 'manual' | 'pdf_import' | 'excel_import';
}

/**
 * Data for updating an existing trip
 * All fields optional (partial update)
 */
export interface UpdateTripInput {
  /** Human-readable title */
  title?: string | null;
  /** Departure date (ISO 8601 format: YYYY-MM-DD) */
  outDate?: string;
  /** Return date (ISO 8601 format: YYYY-MM-DD) */
  inDate?: string;
  /** Departure route/location */
  outRoute?: string | null;
  /** Return route/location */
  inRoute?: string | null;
  /** Destination country/location */
  destination?: string | null;
  /** Additional notes */
  notes?: string | null;
  /** Group ID for grouping trips */
  groupId?: string | null;
  /** Sort order within user's trips */
  sortOrder?: number;
}

/**
 * Data for bulk creating trips (e.g., from imports)
 */
export interface BulkCreateTripsInput {
  /** Goal to associate all trips with */
  goalId: string;
  /** Array of trip data to create */
  trips: Array<Omit<CreateTripInput, 'goalId'>>;
}
