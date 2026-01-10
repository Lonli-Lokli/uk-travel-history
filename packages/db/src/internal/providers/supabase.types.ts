export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      feature_policies: {
        Row: {
          allowlist: string[] | null;
          beta_users: string[] | null;
          created_at: string;
          denylist: string[] | null;
          enabled: boolean;
          feature_key: string;
          id: string;
          min_tier: string;
          rollout_percentage: number | null;
          updated_at: string;
        };
        Insert: {
          allowlist?: string[] | null;
          beta_users?: string[] | null;
          created_at?: string;
          denylist?: string[] | null;
          enabled?: boolean;
          feature_key: string;
          id?: string;
          min_tier?: string;
          rollout_percentage?: number | null;
          updated_at?: string;
        };
        Update: {
          allowlist?: string[] | null;
          beta_users?: string[] | null;
          created_at?: string;
          denylist?: string[] | null;
          enabled?: boolean;
          feature_key?: string;
          id?: string;
          min_tier?: string;
          rollout_percentage?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      goal_templates: {
        Row: {
          category: string;
          created_at: string;
          default_config: Json;
          description: string | null;
          display_order: number;
          id: string;
          is_available: boolean;
          jurisdiction: Database['public']['Enums']['goal_jurisdiction'];
          min_tier: string | null;
          name: string;
          required_fields: Json;
          type: Database['public']['Enums']['goal_type'];
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          default_config: Json;
          description?: string | null;
          display_order?: number;
          id: string;
          is_available?: boolean;
          jurisdiction: Database['public']['Enums']['goal_jurisdiction'];
          min_tier?: string | null;
          name: string;
          required_fields?: Json;
          type: Database['public']['Enums']['goal_type'];
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          default_config?: Json;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_available?: boolean;
          jurisdiction?: Database['public']['Enums']['goal_jurisdiction'];
          min_tier?: string | null;
          name?: string;
          required_fields?: Json;
          type?: Database['public']['Enums']['goal_type'];
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_intents: {
        Row: {
          clerk_user_id: string | null;
          created_at: string;
          email: string;
          id: string;
          price_id: string | null;
          product_id: string | null;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
        };
        Insert: {
          clerk_user_id?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          price_id?: string | null;
          product_id?: string | null;
          status: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          clerk_user_id?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          price_id?: string | null;
          product_id?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_intents_clerk_user_id_fkey';
            columns: ['clerk_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['clerk_user_id'];
          },
        ];
      };
      subscription_statuses: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          is_active: boolean;
        };
        Insert: {
          code: string;
          created_at?: string;
          description: string;
          is_active?: boolean;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      tracking_goals: {
        Row: {
          color: string | null;
          config: Json;
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          is_archived: boolean;
          jurisdiction: Database['public']['Enums']['goal_jurisdiction'];
          name: string;
          start_date: string;
          target_date: string | null;
          type: Database['public']['Enums']['goal_type'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          config?: Json;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          is_archived?: boolean;
          jurisdiction?: Database['public']['Enums']['goal_jurisdiction'];
          name: string;
          start_date: string;
          target_date?: string | null;
          type: Database['public']['Enums']['goal_type'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          config?: Json;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          is_archived?: boolean;
          jurisdiction?: Database['public']['Enums']['goal_jurisdiction'];
          name?: string;
          start_date?: string;
          target_date?: string | null;
          type?: Database['public']['Enums']['goal_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trip_groups: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          is_collapsed: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_collapsed?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_collapsed?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          created_at: string;
          destination: string | null;
          goal_id: string;
          group_id: string | null;
          id: string;
          in_date: string;
          in_route: string | null;
          notes: string | null;
          out_date: string;
          out_route: string | null;
          sort_order: number;
          source: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          destination?: string | null;
          goal_id: string;
          group_id?: string | null;
          id?: string;
          in_date: string;
          in_route?: string | null;
          notes?: string | null;
          out_date: string;
          out_route?: string | null;
          sort_order?: number;
          source?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          destination?: string | null;
          goal_id?: string;
          group_id?: string | null;
          id?: string;
          in_date?: string;
          in_route?: string | null;
          notes?: string | null;
          out_date?: string;
          out_route?: string | null;
          sort_order?: number;
          source?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_goal_id_fkey';
            columns: ['goal_id'];
            isOneToOne: false;
            referencedRelation: 'tracking_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'trip_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          cancel_at_period_end: boolean;
          clerk_user_id: string;
          created_at: string;
          current_period_end: string | null;
          email: string;
          id: string;
          passkey_enrolled: boolean;
          pause_resumes_at: string | null;
          role: Database['public']['Enums']['user_role'];
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          subscription_tier: Database['public']['Enums']['subscription_tier'];
        };
        Insert: {
          cancel_at_period_end?: boolean;
          clerk_user_id: string;
          created_at?: string;
          current_period_end?: string | null;
          email: string;
          id?: string;
          passkey_enrolled?: boolean;
          pause_resumes_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_tier?: Database['public']['Enums']['subscription_tier'];
        };
        Update: {
          cancel_at_period_end?: boolean;
          clerk_user_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          email?: string;
          id?: string;
          passkey_enrolled?: boolean;
          pause_resumes_at?: string | null;
          role?: Database['public']['Enums']['user_role'];
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_tier?: Database['public']['Enums']['subscription_tier'];
        };
        Relationships: [
          {
            foreignKeyName: 'fk_users_subscription_status';
            columns: ['subscription_status'];
            isOneToOne: false;
            referencedRelation: 'subscription_statuses';
            referencedColumns: ['code'];
          },
        ];
      };
      webhook_events: {
        Row: {
          id: string;
          payload: Json;
          processed_at: string;
          stripe_event_id: string;
          type: string;
        };
        Insert: {
          id?: string;
          payload: Json;
          processed_at?: string;
          stripe_event_id: string;
          type: string;
        };
        Update: {
          id?: string;
          payload?: Json;
          processed_at?: string;
          stripe_event_id?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      clerk_user_id: { Args: never; Returns: string };
      current_user_has_premium_access: { Args: never; Returns: boolean };
      current_user_is_admin: { Args: never; Returns: boolean };
      current_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      has_premium_access: {
        Args: { user_row: Database['public']['Tables']['users']['Row'] };
        Returns: boolean;
      };
      keepalive: { Args: never; Returns: number };
    };
    Enums: {
      goal_jurisdiction: 'uk' | 'schengen' | 'global';
      goal_type:
        | 'uk_ilr'
        | 'uk_citizenship'
        | 'uk_tax_residency'
        | 'schengen_90_180'
        | 'days_counter'
        | 'custom_threshold';
      subscription_tier: 'free' | 'monthly' | 'yearly' | 'lifetime';
      user_role: 'standard' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      goal_jurisdiction: ['uk', 'schengen', 'global'],
      goal_type: [
        'uk_ilr',
        'uk_citizenship',
        'uk_tax_residency',
        'schengen_90_180',
        'days_counter',
        'custom_threshold',
      ],
      subscription_tier: ['free', 'monthly', 'yearly', 'lifetime'],
      user_role: ['standard', 'admin'],
    },
  },
} as const;
