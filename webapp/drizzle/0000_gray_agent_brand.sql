CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"company" text,
	"role" text DEFAULT 'developer',
	"plan" text DEFAULT 'starter',
	"credits_remaining" integer DEFAULT 100,
	"credits_total" integer DEFAULT 100,
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'Default Key' NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creation_name" text NOT NULL,
	"status" text DEFAULT 'running',
	"total_tests" integer DEFAULT 0,
	"passed_tests" integer DEFAULT 0,
	"failed_tests" integer DEFAULT 0,
	"skipped_tests" integer DEFAULT 0,
	"backend_pass_rate" numeric(5, 2),
	"frontend_pass_rate" numeric(5, 2),
	"duration_ms" integer,
	"report_json" jsonb,
	"ai_analysis" jsonb,
	"framework" text,
	"source" text DEFAULT 'mcp',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"test_count" integer DEFAULT 0,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"test_run_id" uuid,
	"test_name" text NOT NULL,
	"test_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid,
	"source" text DEFAULT 'testbot-mcp' NOT NULL,
	"tool_name" text NOT NULL,
	"event_type" text NOT NULL,
	"run_id" text,
	"phase" text,
	"status" text,
	"success" boolean DEFAULT false,
	"error_code" text,
	"reason" text,
	"message" text,
	"duration_ms" integer,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_lists" ADD CONSTRAINT "test_lists_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_list_items" ADD CONSTRAINT "test_list_items_list_id_test_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."test_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_list_items" ADD CONSTRAINT "test_list_items_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_telemetry_events" ADD CONSTRAINT "mcp_telemetry_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_telemetry_events" ADD CONSTRAINT "mcp_telemetry_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_user_id_idx" ON "test_runs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_created_at_idx" ON "test_runs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_telemetry_user_id_idx" ON "mcp_telemetry_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_telemetry_api_key_id_idx" ON "mcp_telemetry_events" USING btree ("api_key_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_telemetry_occurred_at_idx" ON "mcp_telemetry_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_telemetry_run_id_idx" ON "mcp_telemetry_events" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_telemetry_event_type_idx" ON "mcp_telemetry_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_telemetry_status_idx" ON "mcp_telemetry_events" USING btree ("status");
