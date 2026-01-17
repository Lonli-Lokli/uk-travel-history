/**
 * Generic entity store types
 * Can be used to create stores for trips, goals, or any other entity
 */

/**
 * Base data type for entities
 * All entities must have these fields
 * Note: Dates are stored as ISO strings (compatible with JSON serialization and database storage)
 */
export interface BaseEntityData {
  id: string;
  userId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Create data type for entities
 * Represents the data needed to create a new entity (without generated fields)
 */
export type CreateEntityData<T extends BaseEntityData> = Omit<
  T,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

/**
 * Update data type for entities
 * Represents the data that can be updated (partial, excluding generated fields)
 */
export type UpdateEntityData<T extends BaseEntityData> = Partial<
  Omit<T, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;

/**
 * Generic provider interface for entity storage
 * Implementations: Supabase (persistent), Cache (ephemeral)
 */
export interface EntityStoreProvider<T extends BaseEntityData> {
  /** Get all entities for a user */
  getEntities(userId: string): Promise<T[]>;

  /** Get entity by ID */
  getEntityById(userId: string, entityId: string): Promise<T | null>;

  /** Create a new entity */
  createEntity(userId: string, data: CreateEntityData<T>): Promise<T>;

  /** Update an existing entity */
  updateEntity(
    userId: string,
    entityId: string,
    data: UpdateEntityData<T>,
  ): Promise<T>;

  /** Delete an entity */
  deleteEntity(userId: string, entityId: string): Promise<void>;

  /** Bulk create entities */
  bulkCreateEntities(
    userId: string,
    entities: CreateEntityData<T>[],
  ): Promise<T[]>;
}

/**
 * Context for entity store operations
 * Determines which provider to use (cache or Supabase)
 */
export interface EntityStoreContext {
  /** User ID (authenticated) or session ID (anonymous) */
  userId: string;
  /** Whether to use persistent storage (Supabase) or ephemeral cache */
  usePersistentStorage: boolean;
  /** Optional: Session ID for cache-based storage */
  sessionId?: string;
}

/**
 * Error codes for entity store operations
 */
export enum EntityStoreErrorCode {
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

/**
 * Custom error for entity store operations
 */
export class EntityStoreError extends Error {
  constructor(
    public code: EntityStoreErrorCode,
    message: string,
    public override cause?: unknown,
  ) {
    super(message);
    this.name = 'EntityStoreError';
  }
}

/**
 * Migration result from cache to Supabase
 */
export interface MigrationResult {
  /** Number of entities successfully migrated */
  migrated: number;
  /** Errors encountered during migration */
  errors: string[];
  /** Whether migration completed fully */
  success: boolean;
  /** Whether migration was skipped because another process is already migrating */
  skipped?: boolean;
}

/**
 * Type converters for transforming between domain and database types
 * TDomain = Domain type (business logic, ISO strings)
 * TDb = Database type (persistence layer, may have Date objects)
 */
export interface TypeConverters<TDomain extends BaseEntityData, TDb> {
  /** Convert from database type to domain type */
  fromDb: (dbEntity: TDb) => TDomain;
  /** Convert from domain type to database type */
  toDb: (domainEntity: TDomain) => TDb;
  /** Convert create input from domain to DB */
  createInputToDb: (input: CreateEntityData<TDomain>) => any;
  /** Convert update input from domain to DB */
  updateInputToDb: (input: UpdateEntityData<TDomain>) => any;
}

/**
 * Configuration for entity store
 * TDomain = Domain type (what the business logic uses)
 * TDb = Database type (what the database returns)
 */
export interface EntityStoreConfig<
  TDomain extends BaseEntityData,
  TDb = TDomain,
> {
  /** Entity name (e.g., 'trip', 'goal') - used for cache keys and logging */
  entityName: string;
  /** Cache key prefix (e.g., 'trips:session:', 'goals:session:') */
  cacheKeyPrefix: string;
  /** Database operations for Supabase provider (operates on DB types) */
  dbOperations: {
    getAll: (userId: string) => Promise<TDb[]>;
    getById: (entityId: string) => Promise<TDb | null>;
    create: (userId: string, data: any) => Promise<TDb>;
    update: (entityId: string, data: any) => Promise<TDb>;
    delete: (entityId: string) => Promise<void>;
    bulkCreate?: (userId: string, entities: any[]) => Promise<TDb[]>;
  };
  /** Type converters (domain <-> DB) */
  converters: TypeConverters<TDomain, TDb>;
  /** Optional: Custom validation for entity data (operates on domain types) */
  validate?: {
    sessionId?: (sessionId: string) => void;
    createData?: (data: CreateEntityData<TDomain>) => void;
    updateData?: (data: UpdateEntityData<TDomain>) => void;
  };
}
