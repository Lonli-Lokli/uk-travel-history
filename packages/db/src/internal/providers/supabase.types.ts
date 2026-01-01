/**
 * TypeScript types for Supabase database schema
 * Generated from database schema
 */

export interface Database {
  public: {
    Tables: {
      subscription_statuses: {
        Row: {
          code: string;
          description: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          description: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          description?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      purchase_intents: {
        Row: {
          id: string;
          status: 'created' | 'checkout_created' | 'paid' | 'provisioned';
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          email: string;
          price_id: string | null;
          product_id: string | null;
          clerk_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status: 'created' | 'checkout_created' | 'paid' | 'provisioned';
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          email: string;
          price_id?: string | null;
          product_id?: string | null;
          clerk_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: 'created' | 'checkout_created' | 'paid' | 'provisioned';
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          email?: string;
          price_id?: string | null;
          product_id?: string | null;
          clerk_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string;
          passkey_enrolled: boolean;
          role: 'standard' | 'admin';
          subscription_tier: 'free' | 'monthly' | 'yearly' | 'lifetime';
          subscription_status:
            | 'active'
            | 'past_due'
            | 'canceled'
            | 'trialing'
            | 'incomplete'
            | 'unpaid'
            | 'paused'
            | null; // NULL = free/non-paid user
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          pause_resumes_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email: string;
          passkey_enrolled?: boolean;
          role?: 'standard' | 'admin';
          subscription_tier?: 'free' | 'monthly' | 'yearly' | 'lifetime';
          subscription_status?:
            | 'active'
            | 'past_due'
            | 'canceled'
            | 'trialing'
            | 'incomplete'
            | 'unpaid'
            | 'paused'
            | null; // NULL = free/non-paid user
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          pause_resumes_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          email?: string;
          passkey_enrolled?: boolean;
          role?: 'standard' | 'admin';
          subscription_tier?: 'free' | 'monthly' | 'yearly' | 'lifetime';
          subscription_status?:
            | 'active'
            | 'past_due'
            | 'canceled'
            | 'trialing'
            | 'incomplete'
            | 'unpaid'
            | 'paused'
            | null; // NULL = free/non-paid user
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          pause_resumes_at?: string | null;
          created_at?: string;
        };
      };
      webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          type: string;
          payload: Record<string, unknown>;
          processed_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          type: string;
          payload: Record<string, unknown>;
          processed_at?: string;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          type?: string;
          payload?: Record<string, unknown>;
          processed_at?: string;
        };
      };
      feature_policies: {
        Row: {
          id: string;
          feature_key: string;
          enabled: boolean;
          min_tier: 'anonymous' | 'free' | 'premium';
          rollout_percentage: number | null;
          allowlist: string[];
          denylist: string[];
          beta_users: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          feature_key: string;
          enabled?: boolean;
          min_tier?: 'anonymous' | 'free' | 'premium';
          rollout_percentage?: number | null;
          allowlist?: string[];
          denylist?: string[];
          beta_users?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          feature_key?: string;
          enabled?: boolean;
          min_tier?: 'anonymous' | 'free' | 'premium';
          rollout_percentage?: number | null;
          allowlist?: string[];
          denylist?: string[];
          beta_users?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      keepalive: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
