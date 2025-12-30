/**
 * Supabase implementation of DbProvider
 * Handles database operations using Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbProvider, DbProviderConfig } from './interface';
import type {
  User,
  CreateUserData,
  UpdateUserData,
  PurchaseIntent,
  CreatePurchaseIntentData,
  UpdatePurchaseIntentData,
  WebhookEvent,
  CreateWebhookEventData,
} from '../../types/domain';
import {
  DbError,
  DbErrorCode,
  PurchaseIntentStatus,
  SubscriptionTier,
  SubscriptionStatus,
} from '../../types/domain';
import type { Database } from './supabase.types';

/**
 * Supabase implementation of the database provider
 */
export class SupabaseDbAdapter implements DbProvider {
  private client: SupabaseClient<Database> | null = null;
  private configured = false;
  private initError?: Error;

  initialize(_config: DbProviderConfig): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      const error = new Error(
        'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
      );
      this.initError = error;
      return;
    }

    this.client = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): SupabaseClient<Database> {
    if (!this.configured || !this.client) {
      if (this.initError) {
        throw new DbError(
          DbErrorCode.CONFIG_ERROR,
          `Supabase not initialized: ${this.initError.message}`,
          this.initError,
        );
      }
      throw new DbError(
        DbErrorCode.CONFIG_ERROR,
        'Supabase not initialized. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
      );
    }
    return this.client;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleError(operation: string, error: any): never {
    // Map Supabase/PostgreSQL error codes to domain errors
    const errorCode = error?.code;

    if (errorCode === 'PGRST116') {
      throw new DbError(DbErrorCode.NOT_FOUND, `${operation}: Record not found`, error);
    }

    if (errorCode === '23505') {
      throw new DbError(
        DbErrorCode.UNIQUE_VIOLATION,
        `${operation}: Unique constraint violation`,
        error,
      );
    }

    if (errorCode === '23503') {
      throw new DbError(
        DbErrorCode.FOREIGN_KEY_VIOLATION,
        `${operation}: Foreign key constraint violation`,
        error,
      );
    }

    // Generic error
    throw new DbError(
      DbErrorCode.PROVIDER_ERROR,
      `${operation} failed: ${error?.message || 'Unknown error'}`,
      error,
    );
  }

  async keepalive(): Promise<number> {
    const client = this.ensureConfigured();

    try {
      const { data, error } = await client.rpc('keepalive');

      if (error) {
        this.handleError('Keepalive', error);
      }

      return data as number;
    } catch (error) {
      this.handleError('Keepalive', error);
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async getUserByAuthId(authUserId: string): Promise<User | null> {
    const client = this.ensureConfigured();

    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('clerk_user_id', authUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.handleError('getUserByAuthId', error);
      }

      return this.mapUserFromDb(data);
    } catch (error) {
      if (error instanceof DbError && error.is(DbErrorCode.NOT_FOUND)) {
        return null;
      }
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const client = this.ensureConfigured();

    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.handleError('getUserById', error);
      }

      return this.mapUserFromDb(data);
    } catch (error) {
      if (error instanceof DbError && error.is(DbErrorCode.NOT_FOUND)) {
        return null;
      }
      throw error;
    }
  }

  async createUser(data: CreateUserData): Promise<User> {
    const client = this.ensureConfigured();

    const insertData = {
      clerk_user_id: data.authUserId,
      email: data.email,
      passkey_enrolled: data.passkeyEnrolled ?? false,
      subscription_tier: data.subscriptionTier ?? SubscriptionTier.FREE,
      // NULL status for free tier, ACTIVE for paid tiers (unless explicitly set)
      subscription_status:
        data.subscriptionStatus !== undefined
          ? data.subscriptionStatus
          : data.subscriptionTier === SubscriptionTier.FREE
            ? null
            : SubscriptionStatus.ACTIVE,
      stripe_customer_id: data.stripeCustomerId ?? null,
      stripe_subscription_id: data.stripeSubscriptionId ?? null,
      stripe_price_id: data.stripePriceId ?? null,
      current_period_end: data.currentPeriodEnd?.toISOString() ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (client.from('users') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      this.handleError('createUser', error);
    }

    return this.mapUserFromDb(result);
  }

  async updateUserByAuthId(
    authUserId: string,
    updates: UpdateUserData,
  ): Promise<User> {
    const client = this.ensureConfigured();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.passkeyEnrolled !== undefined)
      updateData.passkey_enrolled = updates.passkeyEnrolled;
    if (updates.subscriptionTier !== undefined)
      updateData.subscription_tier = updates.subscriptionTier;
    if (updates.subscriptionStatus !== undefined)
      updateData.subscription_status = updates.subscriptionStatus;
    if (updates.stripeCustomerId !== undefined)
      updateData.stripe_customer_id = updates.stripeCustomerId;
    if (updates.stripeSubscriptionId !== undefined)
      updateData.stripe_subscription_id = updates.stripeSubscriptionId;
    if (updates.stripePriceId !== undefined)
      updateData.stripe_price_id = updates.stripePriceId;
    if (updates.currentPeriodEnd !== undefined)
      updateData.current_period_end = updates.currentPeriodEnd?.toISOString() ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from('users') as any)
      .update(updateData)
      .eq('clerk_user_id', authUserId)
      .select()
      .single();

    if (error) {
      this.handleError('updateUserByAuthId', error);
    }

    return this.mapUserFromDb(data);
  }

  async deleteUserByAuthId(authUserId: string): Promise<void> {
    const client = this.ensureConfigured();

    const { error } = await client
      .from('users')
      .delete()
      .eq('clerk_user_id', authUserId);

    if (error) {
      this.handleError('deleteUserByAuthId', error);
    }
  }

  // ============================================================================
  // Purchase Intent Operations
  // ============================================================================

  async getPurchaseIntentById(id: string): Promise<PurchaseIntent | null> {
    const client = this.ensureConfigured();

    try {
      const { data, error } = await client
        .from('purchase_intents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.handleError('getPurchaseIntentById', error);
      }

      return this.mapPurchaseIntentFromDb(data);
    } catch (error) {
      if (error instanceof DbError && error.is(DbErrorCode.NOT_FOUND)) {
        return null;
      }
      throw error;
    }
  }

  async getPurchaseIntentBySessionId(
    sessionId: string,
  ): Promise<PurchaseIntent | null> {
    const client = this.ensureConfigured();

    try {
      const { data, error } = await client
        .from('purchase_intents')
        .select('*')
        .eq('stripe_checkout_session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.handleError('getPurchaseIntentBySessionId', error);
      }

      return this.mapPurchaseIntentFromDb(data);
    } catch (error) {
      if (error instanceof DbError && error.is(DbErrorCode.NOT_FOUND)) {
        return null;
      }
      throw error;
    }
  }

  async getPurchaseIntentsByAuthUserId(
    authUserId: string,
  ): Promise<PurchaseIntent[]> {
    const client = this.ensureConfigured();

    const { data, error } = await client
      .from('purchase_intents')
      .select('*')
      .eq('clerk_user_id', authUserId);

    if (error) {
      this.handleError('getPurchaseIntentsByAuthUserId', error);
    }

    return (data || []).map((row) => this.mapPurchaseIntentFromDb(row));
  }

  async createPurchaseIntent(
    data: CreatePurchaseIntentData,
  ): Promise<PurchaseIntent> {
    const client = this.ensureConfigured();

    const insertData = {
      email: data.email,
      status: data.status || PurchaseIntentStatus.CREATED,
      price_id: data.priceId ?? null,
      product_id: data.productId ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (client.from('purchase_intents') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      this.handleError('createPurchaseIntent', error);
    }

    return this.mapPurchaseIntentFromDb(result);
  }

  async updatePurchaseIntent(
    id: string,
    updates: UpdatePurchaseIntentData,
  ): Promise<PurchaseIntent> {
    const client = this.ensureConfigured();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.stripeCheckoutSessionId !== undefined)
      updateData.stripe_checkout_session_id = updates.stripeCheckoutSessionId;
    if (updates.stripePaymentIntentId !== undefined)
      updateData.stripe_payment_intent_id = updates.stripePaymentIntentId;
    if (updates.authUserId !== undefined)
      updateData.clerk_user_id = updates.authUserId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from('purchase_intents') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.handleError('updatePurchaseIntent', error);
    }

    return this.mapPurchaseIntentFromDb(data);
  }

  // ============================================================================
  // Webhook Event Operations
  // ============================================================================

  async hasWebhookEventBeenProcessed(stripeEventId: string): Promise<boolean> {
    const client = this.ensureConfigured();

    try {
      const { data, error } = await client
        .from('webhook_events')
        .select('id')
        .eq('stripe_event_id', stripeEventId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return false;
        }
        this.handleError('hasWebhookEventBeenProcessed', error);
      }

      return !!data;
    } catch (error) {
      if (error instanceof DbError && error.is(DbErrorCode.NOT_FOUND)) {
        return false;
      }
      throw error;
    }
  }

  async recordWebhookEvent(data: CreateWebhookEventData): Promise<WebhookEvent> {
    const client = this.ensureConfigured();

    const insertData = {
      stripe_event_id: data.stripeEventId,
      type: data.type,
      payload: data.payload,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (client.from('webhook_events') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      this.handleError('recordWebhookEvent', error);
    }

    return this.mapWebhookEventFromDb(result);
  }

  // ============================================================================
  // Mapping Functions (DB -> Domain)
  // ============================================================================

  private mapUserFromDb(row: Database['public']['Tables']['users']['Row']): User {
    return {
      id: row.id,
      authUserId: row.clerk_user_id,
      email: row.email,
      passkeyEnrolled: row.passkey_enrolled,
      subscriptionTier: (row.subscription_tier as SubscriptionTier) ?? SubscriptionTier.FREE,
      // NULL status is valid for free tier users, only default to ACTIVE for non-null values
      subscriptionStatus: row.subscription_status
        ? (row.subscription_status as SubscriptionStatus)
        : null,
      stripeCustomerId: row.stripe_customer_id ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      stripePriceId: row.stripe_price_id ?? null,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      createdAt: new Date(row.created_at),
    };
  }

  private mapPurchaseIntentFromDb(
    row: Database['public']['Tables']['purchase_intents']['Row'],
  ): PurchaseIntent {
    return {
      id: row.id,
      status: row.status as PurchaseIntentStatus,
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      email: row.email,
      priceId: row.price_id,
      productId: row.product_id,
      authUserId: row.clerk_user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapWebhookEventFromDb(
    row: Database['public']['Tables']['webhook_events']['Row'],
  ): WebhookEvent {
    return {
      id: row.id,
      stripeEventId: row.stripe_event_id,
      type: row.type,
      payload: row.payload,
      processedAt: new Date(row.processed_at),
    };
  }
}
