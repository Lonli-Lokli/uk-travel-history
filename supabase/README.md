# Supabase Database

This directory contains the Supabase database configuration, migrations, and tests.

## Structure

```
supabase/
├── migrations/              # SQL migrations (applied in timestamp order)
│   ├── 20260102000000_baseline_production_schema.sql
│   └── 20260105000000_add_user_roles.sql
├── migrations-archieve/     # Historical migrations (reference only)
├── tests/database/          # pgTAP tests
│   ├── schema_tests.sql
│   └── rls_tests.sql
├── seed.sql                 # Reference data (applied after migrations)
├── config.toml              # Local development configuration
└── README.md
```

## Quick Start

```bash
# Start local Supabase (Docker required)
npx supabase start

# Reset database (applies migrations + seed)
npx supabase db reset

# Run tests
npx supabase test db

# Stop local Supabase
npx supabase stop
```

## Migration Workflow

### CI/CD Pipeline

| Event | Action |
|-------|--------|
| PR to `master` | Validates migrations on fresh DB, runs lint + tests |
| Merge to `master` | Deploys migrations to production via `supabase db push` |

### Creating a New Migration

```bash
# 1. Create migration file
npx supabase migration new add_some_feature

# 2. Edit the generated file in supabase/migrations/

# 3. Test locally
npx supabase db reset
npx supabase test db

# 4. Commit and push for PR
```

### Migration Rules

- **Never** modify schema directly in Supabase Dashboard
- **Never** edit existing migrations after they've been deployed
- **Always** test migrations locally before pushing
- Migrations must be idempotent where possible (use `IF NOT EXISTS`, `IF EXISTS`)

## Seed Data

`seed.sql` contains reference data required for the app to function:

| Table | Data |
|-------|------|
| `subscription_statuses` | Stripe status codes (active, past_due, canceled, etc.) |
| `feature_policies` | Default feature flag configuration |

Seed data is applied automatically after migrations during `db reset`.

## Tests

pgTAP tests validate schema structure and RLS policies:

```bash
npx supabase test db
```

Tests check:
- Tables exist with correct columns
- RLS is enabled on all tables
- Seed data is present
- Subscription tier enum values

## Local Services

After `supabase start`:

| Service | URL |
|---------|-----|
| Studio UI | http://localhost:54323 |
| API | http://localhost:54321 |
| Database | `postgresql://postgres:postgres@localhost:54322/postgres` |

## Troubleshooting

**"Connection refused" on port 54322**
```bash
npx supabase start  # Supabase containers aren't running
```

**"Migration already applied" error**
```bash
npx supabase db reset  # Drops and recreates database
```

**"Test failed" with pg_class multiple rows**
- Ensure tests filter by `nspname = 'public'` when querying `pg_class`
