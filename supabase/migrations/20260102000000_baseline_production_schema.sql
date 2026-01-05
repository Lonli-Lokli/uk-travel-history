


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."subscription_tier" AS ENUM (
    'free',
    'monthly',
    'yearly',
    'lifetime'
);


ALTER TYPE "public"."subscription_tier" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clerk_user_id"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Extract clerk user ID from JWT claims
    -- Clerk stores user_id in the 'sub' claim
      RETURN nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
      END;
      $$;


ALTER FUNCTION "public"."clerk_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_has_premium_access"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
      DECLARE
        user_record users;
        BEGIN
          -- Get current user record
            SELECT * INTO user_record
              FROM users
                WHERE clerk_user_id = public.clerk_user_id();

                  -- Return false if user not found
                    IF NOT FOUND THEN
                        RETURN FALSE;
                          END IF;

                            -- Check premium access using helper function
                              RETURN has_premium_access(user_record);
                              END;
                              $$;


ALTER FUNCTION "public"."current_user_has_premium_access"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clerk_user_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "passkey_enrolled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscription_tier" "public"."subscription_tier" DEFAULT 'free'::"public"."subscription_tier" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "current_period_end" timestamp with time zone,
    "subscription_status" "text",
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "pause_resumes_at" timestamp with time zone,
    CONSTRAINT "check_paused_has_resume_date" CHECK ((("subscription_status" <> 'paused'::"text") OR ("pause_resumes_at" IS NOT NULL))),
    CONSTRAINT "check_subscription_tier_status_consistency" CHECK (((("subscription_tier" = 'free'::"public"."subscription_tier") AND ("subscription_status" IS NULL)) OR (("subscription_tier" = ANY (ARRAY['monthly'::"public"."subscription_tier", 'yearly'::"public"."subscription_tier", 'lifetime'::"public"."subscription_tier"])) AND ("subscription_status" IS NOT NULL))))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."subscription_tier" IS 'User subscription tier: free (default), monthly, yearly, or lifetime (one-time purchase)';



COMMENT ON COLUMN "public"."users"."stripe_customer_id" IS 'Stripe customer ID for billing management';



COMMENT ON COLUMN "public"."users"."stripe_subscription_id" IS 'Stripe subscription ID (null for one-time lifetime purchases)';



COMMENT ON COLUMN "public"."users"."stripe_price_id" IS 'Stripe price ID for the current subscription/purchase';



COMMENT ON COLUMN "public"."users"."current_period_end" IS 'End date of current subscription period (null for lifetime)';



COMMENT ON COLUMN "public"."users"."subscription_status" IS 'Subscription status code from subscription_statuses table. NULL = free/non-paid user, non-NULL = paid user with specific status';



COMMENT ON COLUMN "public"."users"."cancel_at_period_end" IS 'True if subscription is scheduled to cancel at period end (Stripe cancel_at_period_end flag)';



COMMENT ON COLUMN "public"."users"."pause_resumes_at" IS 'When a paused subscription will resume (from Stripe pause_collection.resumes_at)';



COMMENT ON CONSTRAINT "check_paused_has_resume_date" ON "public"."users" IS 'Ensures paused subscriptions always have a resume date (pause_resumes_at)';



COMMENT ON CONSTRAINT "check_subscription_tier_status_consistency" ON "public"."users" IS 'Enforces business rule: free tier = NULL status, paid tier = non-NULL status. Prevents inconsistent states like free+active or paid+NULL.';



CREATE OR REPLACE FUNCTION "public"."has_premium_access"("user_row" "public"."users") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
                    BEGIN
                      -- Premium access if:
                        -- 1. Paid tier (monthly, yearly, lifetime)
                          -- 2. Active or trialing status
                            -- 3. OR scheduled for cancellation but still in current period
                              RETURN (
                                  user_row.subscription_tier IN ('monthly', 'yearly', 'lifetime')
                                      AND (
                                            user_row.subscription_status IN ('active', 'trialing')
                                                  OR (
                                                          -- Grace period: scheduled cancellation but period hasn't ended
                                                                  user_row.cancel_at_period_end = TRUE
                                                                          AND user_row.current_period_end IS NOT NULL
                                                                                  AND user_row.current_period_end > NOW()
                                                                                        )
                                                                                            )
                                                                                              );
                                                                                              END;
                                                                                              $$;


ALTER FUNCTION "public"."has_premium_access"("user_row" "public"."users") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_premium_access"("user_row" "public"."users") IS 'Determines if user has premium access considering active subscriptions, trials, and grace periods for scheduled cancellations';



CREATE OR REPLACE FUNCTION "public"."keepalive"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
                                        BEGIN
                                          RETURN 1;
                                          END;
                                          $$;


ALTER FUNCTION "public"."keepalive"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "min_tier" "text" DEFAULT 'anonymous'::"text" NOT NULL,
    "rollout_percentage" integer,
    "allowlist" "text"[] DEFAULT '{}'::"text"[],
    "denylist" "text"[] DEFAULT '{}'::"text"[],
    "beta_users" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feature_policies_rollout_percentage_check" CHECK ((("rollout_percentage" >= 0) AND ("rollout_percentage" <= 100)))
);


ALTER TABLE "public"."feature_policies" OWNER TO "postgres";


COMMENT ON TABLE "public"."feature_policies" IS 'Runtime feature flag configuration - replaces Vercel Edge Config to reduce API calls';



COMMENT ON COLUMN "public"."feature_policies"."feature_key" IS 'Unique identifier for the feature (e.g., excel_export, pdf_import)';



COMMENT ON COLUMN "public"."feature_policies"."enabled" IS 'Global kill switch - if false, feature is disabled for everyone';



COMMENT ON COLUMN "public"."feature_policies"."min_tier" IS 'Minimum subscription tier required (anonymous, free, premium)';



COMMENT ON COLUMN "public"."feature_policies"."rollout_percentage" IS 'Percentage of users who get access (0-100) for gradual rollout';



COMMENT ON COLUMN "public"."feature_policies"."allowlist" IS 'Explicit allowlist of user IDs (bypasses tier check)';



COMMENT ON COLUMN "public"."feature_policies"."denylist" IS 'Explicit denylist of user IDs (blocks access regardless of tier)';



COMMENT ON COLUMN "public"."feature_policies"."beta_users" IS 'Beta users who get access regardless of tier';



CREATE TABLE IF NOT EXISTS "public"."purchase_intents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "status" "text" NOT NULL,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "email" "text" NOT NULL,
    "price_id" "text",
    "product_id" "text",
    "clerk_user_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_intents_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'checkout_created'::"text", 'paid'::"text", 'provisioned'::"text"])))
);


ALTER TABLE "public"."purchase_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_statuses" (
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_statuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_statuses" IS 'Reference table for subscription status codes (aligned with Stripe)';



COMMENT ON COLUMN "public"."subscription_statuses"."code" IS 'Status code (e.g., active, past_due, canceled)';



COMMENT ON COLUMN "public"."subscription_statuses"."description" IS 'Human-readable description of the status';



COMMENT ON COLUMN "public"."subscription_statuses"."is_active" IS 'Whether this status represents an active/valid subscription';



CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."feature_policies"
    ADD CONSTRAINT "feature_policies_feature_key_key" UNIQUE ("feature_key");



ALTER TABLE ONLY "public"."feature_policies"
    ADD CONSTRAINT "feature_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_intents"
    ADD CONSTRAINT "purchase_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_intents"
    ADD CONSTRAINT "purchase_intents_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");



ALTER TABLE ONLY "public"."subscription_statuses"
    ADD CONSTRAINT "subscription_statuses_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_clerk_user_id_key" UNIQUE ("clerk_user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



CREATE INDEX "idx_feature_policies_feature_key" ON "public"."feature_policies" USING "btree" ("feature_key");



CREATE INDEX "idx_purchase_intents_clerk_user_id" ON "public"."purchase_intents" USING "btree" ("clerk_user_id");



CREATE INDEX "idx_purchase_intents_email" ON "public"."purchase_intents" USING "btree" ("email");



CREATE INDEX "idx_purchase_intents_status" ON "public"."purchase_intents" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_purchase_intents_stripe_checkout" ON "public"."purchase_intents" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "idx_subscription_statuses_code" ON "public"."subscription_statuses" USING "btree" ("code");



CREATE INDEX "idx_subscription_statuses_is_active" ON "public"."subscription_statuses" USING "btree" ("is_active");



CREATE INDEX "idx_users_cancel_at_period_end" ON "public"."users" USING "btree" ("cancel_at_period_end") WHERE ("cancel_at_period_end" = true);



CREATE UNIQUE INDEX "idx_users_clerk_user_id" ON "public"."users" USING "btree" ("clerk_user_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_passkey_enrolled" ON "public"."users" USING "btree" ("passkey_enrolled");



CREATE INDEX "idx_users_pause_resumes_at" ON "public"."users" USING "btree" ("pause_resumes_at") WHERE ("pause_resumes_at" IS NOT NULL);



CREATE INDEX "idx_users_stripe_customer_id" ON "public"."users" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_users_stripe_customer_id_unique" ON "public"."users" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "idx_users_stripe_subscription_id" ON "public"."users" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_users_stripe_subscription_id_unique" ON "public"."users" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_users_subscription_status" ON "public"."users" USING "btree" ("subscription_status") WHERE ("subscription_status" IS NOT NULL);



CREATE INDEX "idx_users_subscription_tier" ON "public"."users" USING "btree" ("subscription_tier");



CREATE INDEX "idx_webhook_events_processed_at" ON "public"."webhook_events" USING "btree" ("processed_at");



CREATE UNIQUE INDEX "idx_webhook_events_stripe_id" ON "public"."webhook_events" USING "btree" ("stripe_event_id");



CREATE INDEX "idx_webhook_events_type" ON "public"."webhook_events" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "update_feature_policies_updated_at" BEFORE UPDATE ON "public"."feature_policies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_purchase_intents_updated_at" BEFORE UPDATE ON "public"."purchase_intents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "fk_users_subscription_status" FOREIGN KEY ("subscription_status") REFERENCES "public"."subscription_statuses"("code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE "public"."feature_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_policies_select_all" ON "public"."feature_policies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "feature_policies_select_anonymous" ON "public"."feature_policies" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."purchase_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_intents_select_own" ON "public"."purchase_intents" FOR SELECT TO "authenticated" USING (("clerk_user_id" = "public"."clerk_user_id"()));



COMMENT ON POLICY "purchase_intents_select_own" ON "public"."purchase_intents" IS 'Users can view their own purchase history';



ALTER TABLE "public"."subscription_statuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_statuses_select_all" ON "public"."subscription_statuses" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT TO "authenticated" USING (("clerk_user_id" = "public"."clerk_user_id"()));



COMMENT ON POLICY "users_select_own" ON "public"."users" IS 'Users can read their own profile data';



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING (("clerk_user_id" = "public"."clerk_user_id"())) WITH CHECK ((("clerk_user_id" = "public"."clerk_user_id"()) AND ("subscription_tier" = ( SELECT "users_1"."subscription_tier"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"()))) AND (NOT ("subscription_status" IS DISTINCT FROM ( SELECT "users_1"."subscription_status"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"())))) AND (NOT ("stripe_customer_id" IS DISTINCT FROM ( SELECT "users_1"."stripe_customer_id"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"())))) AND (NOT ("stripe_subscription_id" IS DISTINCT FROM ( SELECT "users_1"."stripe_subscription_id"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"())))) AND (NOT ("stripe_price_id" IS DISTINCT FROM ( SELECT "users_1"."stripe_price_id"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"())))) AND (NOT ("current_period_end" IS DISTINCT FROM ( SELECT "users_1"."current_period_end"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"())))) AND (NOT ("cancel_at_period_end" IS DISTINCT FROM ( SELECT "users_1"."cancel_at_period_end"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"())))) AND (NOT ("pause_resumes_at" IS DISTINCT FROM ( SELECT "users_1"."pause_resumes_at"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."clerk_user_id" = "public"."clerk_user_id"()))))));



COMMENT ON POLICY "users_update_own" ON "public"."users" IS 'Users can update their own profile data (but not entitlement fields - those are service_role only)';



ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."clerk_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."clerk_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clerk_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_has_premium_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_has_premium_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_has_premium_access"() TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON FUNCTION "public"."has_premium_access"("user_row" "public"."users") TO "anon";
GRANT ALL ON FUNCTION "public"."has_premium_access"("user_row" "public"."users") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_premium_access"("user_row" "public"."users") TO "service_role";



GRANT ALL ON FUNCTION "public"."keepalive"() TO "anon";
GRANT ALL ON FUNCTION "public"."keepalive"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."keepalive"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."feature_policies" TO "anon";
GRANT ALL ON TABLE "public"."feature_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_policies" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_intents" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."purchase_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_intents" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_statuses" TO "anon";
GRANT ALL ON TABLE "public"."subscription_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke insert on table "public"."purchase_intents" from "authenticated";

revoke update on table "public"."purchase_intents" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke select on table "public"."webhook_events" from "authenticated";


