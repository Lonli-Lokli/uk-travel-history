# Feature-to-API Endpoint Inventory

This document tracks all features and their associated API endpoints, ensuring comprehensive server-side enforcement of feature access control.

## Inventory Table

| Feature Key | Feature Name | API Routes | Methods | Required Tier | Current Status | Notes |
|------------|--------------|------------|---------|---------------|----------------|-------|
| `basic_calculation` | Travel Calculations | N/A (Client-side only) | - | FREE | ✅ No API | Calculations happen in browser |
| `pdf_import` | PDF Import | `/api/parse` | POST | FREE | ✅ Protected | Parses SAR PDFs |
| `csv_import` | CSV/Excel Import | `/api/import-full` | POST | FREE | ✅ Protected | Imports Excel files with travel data |
| `manual_entry` | Manual Entry | N/A (Client-side only) | - | FREE | ✅ No API | Direct state manipulation in browser |
| `excel_export` | Excel Export | `/api/export` | POST | PREMIUM | ✅ Protected | Generates formatted Excel file |
| `pdf_export` | PDF Export | TBD | TBD | PREMIUM | ⏳ Coming Soon | Professional PDF reports |
| `employer_letters` | Employer Letters | TBD | TBD | PREMIUM | ⏳ Coming Soon | Generate employer confirmation letters |
| `cloud_sync` | Cloud Sync | TBD | TBD | PREMIUM | ⏳ Coming Soon | Sync data across devices |
| `advanced_analytics` | Advanced Analytics | TBD | TBD | PREMIUM | ⏳ Coming Soon | Detailed insights and ILR readiness |

## API Routes Reference

### Protected Routes (Require Feature Access)

#### `/api/export` - Excel Export
- **Method**: POST
- **Feature**: `excel_export`
- **Tier**: PREMIUM
- **Protection**: ✅ `assertFeatureAccess(request, FEATURES.EXCEL_EXPORT)`
- **Purpose**: Generates formatted Excel file with travel history and calculations
- **Input**: Form data with trips, visa details, and export mode
- **Output**: Excel file (`.xlsx`)
- **Security Notes**:
  - Validates data before processing
  - No sensitive data logged
  - Premium-only due to value-added formatting and comprehensive export

#### `/api/parse` - PDF Import
- **Method**: POST
- **Feature**: `pdf_import`
- **Tier**: FREE
- **Protection**: ✅ `assertFeatureAccess(request, FEATURES.PDF_IMPORT)`
- **Purpose**: Parses UK Home Office SAR PDF documents
- **Input**: PDF file upload
- **Output**: Structured travel history JSON
- **Security Notes**:
  - File type validation (must be PDF)
  - Content validation (checks for Inbound/Outbound keywords)
  - PDF parsing sandboxed in nodejs runtime
  - Can be made premium in future via Edge Config

#### `/api/import-full` - Excel Import
- **Method**: POST
- **Feature**: `csv_import`
- **Tier**: FREE
- **Protection**: ✅ `assertFeatureAccess(request, FEATURES.CSV_IMPORT)`
- **Purpose**: Imports previously exported Excel files
- **Input**: Excel file upload
- **Output**: Structured travel history and visa details JSON
- **Security Notes**:
  - File format validation
  - Date parsing with error handling
  - Can be made premium in future via Edge Config

### Unprotected Routes (No Feature Access Required)

#### `/api/billing/checkout` - Stripe Checkout
- **Method**: POST
- **Feature**: N/A (Payment flow)
- **Tier**: N/A
- **Protection**: ❌ No feature guard (payment processing)
- **Purpose**: Creates Stripe checkout session for premium upgrade
- **Security Notes**:
  - Rate limited by Vercel
  - Stripe signature verification in webhook

#### `/api/stripe/webhook` - Stripe Webhook
- **Method**: POST
- **Feature**: N/A (Payment flow)
- **Tier**: N/A
- **Protection**: ❌ No feature guard (webhook handler)
- **Purpose**: Processes Stripe payment events
- **Security Notes**:
  - Stripe signature verification
  - Idempotency checks via database
  - Critical for provisioning premium access

#### `/api/stripe/create-checkout` - Stripe Checkout (Alternative)
- **Method**: POST
- **Feature**: N/A (Payment flow)
- **Tier**: N/A
- **Protection**: ❌ No feature guard
- **Purpose**: Alternative checkout creation endpoint
- **Security Notes**: Similar to `/api/billing/checkout`

#### `/api/stripe/create-anonymous-checkout` - Anonymous Checkout
- **Method**: POST
- **Feature**: N/A (Payment flow)
- **Tier**: N/A
- **Protection**: ❌ No feature guard
- **Purpose**: Creates checkout for unauthenticated users
- **Security Notes**: Email validation, purchase intent tracking

#### `/api/stripe/validate-session` - Session Validation
- **Method**: POST
- **Feature**: N/A (Payment flow)
- **Tier**: N/A
- **Protection**: ❌ No feature guard
- **Purpose**: Validates Stripe checkout session status
- **Security Notes**: Stripe API validation

#### `/api/complete-registration` - Complete Registration
- **Method**: POST
- **Feature**: N/A (Auth flow)
- **Tier**: N/A
- **Protection**: ❌ No feature guard (onboarding)
- **Purpose**: Completes user registration after payment
- **Security Notes**: Links purchase intent to user account

#### `/api/user/update-passkey-status` - Passkey Status
- **Method**: POST
- **Feature**: N/A (Auth flow)
- **Tier**: N/A
- **Protection**: ✅ Clerk auth() required
- **Purpose**: Updates passkey enrollment status
- **Security Notes**: Authenticated users only, syncs to Clerk metadata

#### `/api/cron/supabase-keepalive` - Database Keepalive
- **Method**: GET
- **Feature**: N/A (Maintenance)
- **Tier**: N/A
- **Protection**: ❌ No feature guard (cron job)
- **Purpose**: Keeps Supabase connection alive
- **Security Notes**: Should verify cron secret in production

## Feature Policy Controls

### Current Capabilities

All features support the following remote configuration via Edge Config:

1. **Global Kill Switch** (`enabled: boolean`)
   - Disable any feature instantly without redeploy
   - Returns 404 to hide disabled features
   - Overrides all other checks

2. **Mode Override** (`mode: 'free' | 'paid'`)
   - Change tier requirements at runtime
   - Example: Make excel_export free temporarily for promotion
   - Defaults to predefined tier in `DEFAULT_FEATURE_POLICIES`

3. **Minimum Tier** (`minTier: TierId`)
   - Specify required subscription tier
   - Currently: FREE or PREMIUM
   - Future: Could add TEAM, ENTERPRISE tiers

4. **Rollout Percentage** (`rolloutPercentage: number`)
   - Gradual rollout to subset of users
   - 0-100 percentage
   - Consistent per user (uses userId hash)
   - Optional: Only applied if configured

5. **Allowlist** (`allowlist: string[]`)
   - Explicit list of user IDs to grant access
   - Bypasses tier requirements
   - Useful for beta testing, VIPs, support

6. **Denylist** (`denylist: string[]`)
   - Explicit list of user IDs to block
   - Overrides everything else (even premium tier)
   - Useful for abuse prevention

### Safe Defaults

If Edge Config is unavailable, the system uses `DEFAULT_FEATURE_POLICIES`:

- Free features: Enabled, mode='free'
- Premium features: Enabled, mode='paid', minTier=PREMIUM
- Coming soon features: Disabled
- **Principle**: Fail closed - deny access when in doubt

## Testing Coverage

### Unit Tests

Location: `packages/features/src/lib/api-guards.test.ts`

Coverage:
- ✅ Global kill switch (disabled features)
- ✅ Free features for all tier users
- ✅ Premium tier restrictions
- ✅ Subscription requirements (active vs expired)
- ✅ Unauthenticated access attempts
- ✅ Default policy validation
- ✅ Fail-safe behavior when config unavailable
- ⏳ TODO: Allowlist/denylist (requires mocking)
- ⏳ TODO: Rollout percentage (requires mocking)
- ⏳ TODO: Mode override (requires mocking)

### Integration Tests

⏳ **TODO**: Add E2E tests with Playwright

Test scenarios needed:
1. Free user attempts premium feature → 403
2. Premium user accesses premium feature → 200
3. Feature disabled globally → 404 for all users
4. Feature changed to free mode → Free users get access
5. Subscription expires → Premium features blocked
6. Rollout at 50% → Half of users get access consistently

## Logging and Observability

### Access Decision Logging

All feature access checks are logged with:

- `featureId`: Which feature was accessed
- `userId`: Who attempted access (or 'anonymous')
- `tier`: User's subscription tier
- `allowed`: Whether access was granted
- `reason`: Why access was denied (if applicable)
- `path`: API route path
- `method`: HTTP method

Log levels:
- **INFO**: Access granted
- **WARN**: Access denied
- **ERROR**: Unexpected errors in guard logic

### Metrics

⏳ **TODO**: Add structured metrics for monitoring

Suggested metrics:
- Feature access attempts (by feature, tier, result)
- Feature denial reasons (by feature, reason code)
- Policy evaluation duration
- Edge Config fetch failures

## Operational Procedures

### How to Disable a Feature

1. Update Edge Config with `enabled: false` for the feature key
2. Change takes effect immediately (no redeploy needed)
3. All users will see 404 for that feature
4. UI should hide the feature (client-side flag already synced)

### How to Make a Feature Free Temporarily

1. Update Edge Config policy:
   ```json
   {
     "excel_export": {
       "enabled": true,
       "mode": "free",
       "minTier": "free"
     }
   }
   ```
2. Change takes effect immediately
3. Free users can now access the feature
4. To revert: Change mode back to "paid"

### How to Gradual Rollout a New Feature

1. Deploy feature code with `enabled: false` in defaults
2. Update Edge Config with rollout:
   ```json
   {
     "new_feature": {
       "enabled": true,
       "mode": "paid",
       "minTier": "premium",
       "rolloutPercentage": 10
     }
   }
   ```
3. Gradually increase percentage: 10% → 25% → 50% → 100%
4. Monitor metrics and error rates at each step

### How to Block a User

1. Update Edge Config policy with denylist:
   ```json
   {
     "excel_export": {
       "enabled": true,
       "mode": "paid",
       "minTier": "premium",
       "denylist": ["user_abc123", "user_xyz789"]
     }
   }
   ```
2. User will see 403 for that feature
3. Applies across all features where denylist is configured

## Future Enhancements

### Short Term
- [ ] Add integration tests (Playwright)
- [ ] Add metrics collection
- [ ] Complete test coverage for allowlist/denylist/rollout
- [ ] Add rate limiting per feature per user
- [ ] Add usage tracking per feature

### Medium Term
- [ ] Store complete feature policies in Edge Config (not just enabled flag)
- [ ] Add feature usage analytics dashboard
- [ ] Add automated policy validation (CI/CD)
- [ ] Add feature usage quotas (e.g., 10 exports per month for free tier)

### Long Term
- [ ] Add per-organization feature control (multi-tenant)
- [ ] Add feature dependency tracking (feature X requires feature Y)
- [ ] Add A/B testing framework
- [ ] Add feature flag UI (no-code policy management)

## Audit Trail

| Date | Change | Author | Reason |
|------|--------|--------|--------|
| 2025-12-26 | Initial implementation | Claude | Issue #97 - API feature enforcement |

## References

- Issue #97: [Audit API feature-eligibility enforcement](../../../issues/97)
- Edge Config Docs: https://vercel.com/docs/edge-config
- Feature Definitions: `packages/features/src/lib/features.ts`
- API Guards: `packages/features/src/lib/api-guards.ts`
- Default Policies: `packages/features/src/lib/api-guards.ts#DEFAULT_FEATURE_POLICIES`
