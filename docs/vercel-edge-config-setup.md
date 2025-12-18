# Vercel Edge Config Setup Guide

This guide explains how to set up and manage Vercel Edge Config for dynamic feature flag control in production.

## Overview

Edge Config enables you to control feature flags in real-time without redeploying your application. This is essential for:

- **Gradual rollouts**: Enable features for a percentage of users
- **Beta testing**: Give specific users early access
- **Emergency killswitch**: Instantly disable problematic features
- **A/B testing**: Different features for different user cohorts

## Prerequisites

- Vercel account with a deployed project
- Vercel CLI installed (optional, for local management)
- Project must be on a Vercel Pro or Enterprise plan for Edge Config

## Step 1: Create Edge Config Store

### Via Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create Database** → Select **Edge Config**
4. Give it a name (e.g., `uk-travel-history-features`)
5. Click **Create**

### Via Vercel CLI

```bash
# Login to Vercel
vercel login

# Create Edge Config store
vercel edge-config create uk-travel-history-features
```

## Step 2: Link Edge Config to Your Project

### Via Dashboard

1. In the Edge Config store, go to **Settings**
2. Click **Connect to Project**
3. Select your project (`uk-travel-history`)
4. Click **Connect**

This automatically creates an environment variable `EDGE_CONFIG` in your project.

### Via CLI

```bash
# Link Edge Config to project
vercel env add EDGE_CONFIG
# Paste the Edge Config connection string when prompted
```

## Step 3: Configure Feature Flags

Edge Config stores feature flags in JSON format under the key `features`.

### Schema

```json
{
  "features": {
    "feature_id": {
      "enabled": true,
      "rolloutPercentage": 50,
      "betaUsers": ["user123", "user456"]
    }
  }
}
```

### Field Descriptions

- **enabled** (required): Boolean - Master switch for the feature
- **rolloutPercentage** (optional): Number 0-100 - Percentage of users to enable
- **betaUsers** (optional): Array of user IDs - Users who always get access

### Via Dashboard

1. Open your Edge Config store
2. Click **Edit Items**
3. Click **Add Item**
4. Key: `features`
5. Value: Paste JSON configuration (see examples below)
6. Click **Save**

### Via CLI

```bash
# Set features configuration
vercel edge-config item create features --value '{
  "excel_export": {
    "enabled": true,
    "rolloutPercentage": 100
  },
  "pdf_export": {
    "enabled": true,
    "rolloutPercentage": 10,
    "betaUsers": ["user_abc", "user_xyz"]
  },
  "cloud_sync": {
    "enabled": false
  }
}'
```

## Step 4: Environment Variables

Set up environment variables for your feature flags. These serve as:

1. **Compile-time defaults** when Edge Config is not available
2. **Hard overrides** for emergency situations

### Required Environment Variables

Add these to your Vercel project (Settings → Environment Variables):

```bash
# Master monetization switch
NEXT_PUBLIC_FF_MONETIZATION=true

# Authentication
NEXT_PUBLIC_FF_FIREBASE_AUTH=true

# Payment features
NEXT_PUBLIC_FF_STRIPE_CHECKOUT=true

# Premium features
NEXT_PUBLIC_FF_EXCEL_EXPORT_PREMIUM=true
NEXT_PUBLIC_FF_PDF_EXPORT=true
NEXT_PUBLIC_FF_CLOUD_SYNC=true

# UI features
NEXT_PUBLIC_FF_UPGRADE_MODAL=true
NEXT_PUBLIC_FF_PREMIUM_BADGE=true

# Edge Config connection (auto-created when you link Edge Config)
EDGE_CONFIG=https://edge-config.vercel.com/ecfg_xxxxx?token=xxxxx
```

### Local Development

Create `.env.local` in your project root:

```bash
# Copy from .env.local.example
cp .env.local.example .env.local

# Edit .env.local with your settings
```

For local Edge Config testing, add your Edge Config connection string:

```bash
EDGE_CONFIG=https://edge-config.vercel.com/ecfg_xxxxx?token=xxxxx
```

> ⚠️ **Security Note**: Never commit `.env.local` to version control. The `.env.local.example` file is for reference only.

## Step 5: Feature Flag Configuration Examples

### Example 1: Full Rollout (100% of users)

```json
{
  "features": {
    "excel_export": {
      "enabled": true,
      "rolloutPercentage": 100
    }
  }
}
```

All premium users get access to Excel export.

### Example 2: Gradual Rollout (10% → 50% → 100%)

**Phase 1: Beta testing (10%)**

```json
{
  "features": {
    "cloud_sync": {
      "enabled": true,
      "rolloutPercentage": 10,
      "betaUsers": ["internal_tester_1", "internal_tester_2"]
    }
  }
}
```

**Phase 2: Expand (50%)**

```json
{
  "features": {
    "cloud_sync": {
      "enabled": true,
      "rolloutPercentage": 50,
      "betaUsers": ["internal_tester_1", "internal_tester_2"]
    }
  }
}
```

**Phase 3: Full release (100%)**

```json
{
  "features": {
    "cloud_sync": {
      "enabled": true,
      "rolloutPercentage": 100
    }
  }
}
```

### Example 3: Beta Users Only

```json
{
  "features": {
    "advanced_analytics": {
      "enabled": true,
      "rolloutPercentage": 0,
      "betaUsers": ["user_123", "user_456", "user_789"]
    }
  }
}
```

Only specified beta users can access the feature.

### Example 4: Emergency Killswitch

```json
{
  "features": {
    "pdf_export": {
      "enabled": false
    }
  }
}
```

Instantly disables the feature for all users (takes effect in < 1 second).

### Example 5: Complete Configuration

```json
{
  "features": {
    "basic_calculation": {
      "enabled": true
    },
    "pdf_import": {
      "enabled": true
    },
    "csv_import": {
      "enabled": true
    },
    "manual_entry": {
      "enabled": true
    },
    "excel_export": {
      "enabled": true,
      "rolloutPercentage": 100
    },
    "pdf_export": {
      "enabled": true,
      "rolloutPercentage": 25,
      "betaUsers": ["beta_user_1", "beta_user_2"]
    },
    "employer_letters": {
      "enabled": false
    },
    "cloud_sync": {
      "enabled": false
    },
    "advanced_analytics": {
      "enabled": true,
      "rolloutPercentage": 0,
      "betaUsers": ["internal_user_1"]
    }
  }
}
```

## Step 6: Implement Server-Side Validation

**CRITICAL**: Client-side feature flags can be bypassed. Always validate on the server.

### API Route Protection

```typescript
// app/api/export/route.ts
import { validateFeatureAccess, FEATURES } from '@uth/features';

export async function POST(request: Request) {
  // 1. Get authenticated user
  const { userId } = await getAuthUser(request);
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Get user's subscription tier
  const userTier = await getUserTier(userId); // Your implementation

  // 3. Validate feature access SERVER-SIDE
  const access = await validateFeatureAccess(FEATURES.EXCEL_EXPORT, userTier);
  if (!access.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Feature not available',
        reason: access.reason,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 4. Only now process the request
  return generateExcelExport(data);
}
```

### Why Server-Side Validation is Critical

❌ **Client-side only (INSECURE)**:

```typescript
// Bad: Free users can bypass this by modifying JavaScript
if (FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM) {
  return <ExportButton onClick={downloadExcel} />;
}
```

✅ **Server-side validation (SECURE)**:

```typescript
// Good: Client checks are for UX only
if (FEATURE_FLAGS.EXCEL_EXPORT_PREMIUM) {
  return <ExportButton onClick={downloadExcel} />;
}

// API route validates server-side
export async function POST(request: Request) {
  const access = await validateFeatureAccess(FEATURES.EXCEL_EXPORT, userTier);
  if (!access.allowed) {
    return new Response('Unauthorized', { status: 403 });
  }
  // ...
}
```

## Step 7: Testing Edge Config

### Test Edge Config Availability

```bash
# In your app, add a test endpoint
# app/api/test-edge-config/route.ts
import { isEdgeConfigAvailable } from '@uth/features';

export async function GET() {
  const available = await isEdgeConfigAvailable();
  return Response.json({ available });
}
```

Visit `/api/test-edge-config` to verify Edge Config is working.

### Test Feature Flags

```bash
# app/api/test-flags/route.ts
import { getAllFeatureFlags } from '@uth/features';

export async function GET() {
  const flags = await getAllFeatureFlags();
  return Response.json({ flags });
}
```

### Local Testing

```bash
# Set up local Edge Config connection
export EDGE_CONFIG="https://edge-config.vercel.com/ecfg_xxxxx?token=xxxxx"

# Run dev server
npm run dev

# Test API endpoints
curl http://localhost:3000/api/test-flags
```

## Step 8: Monitoring and Rollback

### Monitor Feature Usage

Add analytics to track feature flag checks:

```typescript
import { isFeatureEnabledOnVercel } from '@uth/features';
import { trackEvent } from './analytics';

export async function checkFeature(featureId: string, userId?: string) {
  const enabled = await isFeatureEnabledOnVercel(featureId, userId);

  trackEvent('feature_flag_check', {
    feature: featureId,
    enabled,
    userId,
  });

  return enabled;
}
```

### Emergency Rollback

If a feature causes issues:

1. **Immediate**: Set `enabled: false` in Edge Config (< 1 second)
2. **Fallback**: Set environment variable `FEATURE_FEATURE_NAME=false` and redeploy
3. **Code level**: Comment out feature code and deploy

### Gradual Rollout Strategy

1. **0%**: Beta users only
2. **10%**: Early adopters
3. **25%**: Cautious expansion
4. **50%**: Half of users
5. **100%**: Full release

Monitor error rates and user feedback at each stage. Roll back if issues occur.

## Best Practices

### 1. Always Validate Server-Side

```typescript
// ❌ Bad: Client-side only
if (FEATURE_FLAGS.PREMIUM_FEATURE) {
  handlePremiumAction();
}

// ✅ Good: Server validates
const access = await validateFeatureAccess(FEATURES.PREMIUM_FEATURE, userTier);
if (!access.allowed) throw new Error('Unauthorized');
```

### 2. Use Feature-Specific User IDs

The hash function includes feature ID, so the same user can be in different rollout groups for different features.

### 3. Beta Users for Internal Testing

Always include internal testers in `betaUsers` array for new features.

### 4. Monitor Edge Config Performance

Edge Config adds minimal latency (< 10ms), but monitor in production.

### 5. Document Feature Flag Changes

Keep a changelog of feature flag changes in Edge Config:

```
2025-12-17: Enabled pdf_export at 10% rollout
2025-12-18: Increased pdf_export to 25%
2025-12-19: Full release pdf_export at 100%
```

## Troubleshooting

### Edge Config Not Working

**Symptom**: Features always fall back to environment variables

**Solutions**:

1. Verify `EDGE_CONFIG` environment variable is set in Vercel
2. Check Edge Config is linked to your project
3. Verify Edge Config has `features` key with valid JSON
4. Check Edge Config token has correct permissions

### Features Not Updating

**Symptom**: Changes in Edge Config don't take effect

**Solutions**:

1. Edge Config updates are near-instant (< 1 second)
2. Clear your browser cache
3. Check Edge Config version is latest (Dashboard → Edge Config → History)
4. Verify you're editing the correct environment (Production/Preview/Development)

### Rollout Percentage Not Working

**Symptom**: All users get or don't get the feature

**Solutions**:

1. Verify `rolloutPercentage` is a number (not string)
2. Ensure `userId` is passed to `isFeatureEnabledOnVercel(featureId, userId)`
3. Check hash distribution is working (see tests)

### Free Users Accessing Premium Features

**Symptom**: Free users can use paid features

**Solutions**:

1. ✅ **CRITICAL**: Implement server-side validation (see Step 6)
2. Never rely on client-side checks for access control
3. Validate tier on every API request

## Security Checklist

- [ ] Edge Config connection string is not committed to git
- [ ] Server-side validation implemented for all premium features
- [ ] API routes check user tier before processing requests
- [ ] Client-side checks are for UX only, not security
- [ ] Beta users are internal testers or trusted users
- [ ] Rollout percentages are monitored for abuse patterns
- [ ] Emergency killswitch tested (set enabled: false)

## Next Steps

1. ✅ Set up Edge Config in Vercel
2. ✅ Configure feature flags
3. ✅ Implement server-side validation
4. ✅ Test with beta users
5. ✅ Monitor rollout metrics
6. ✅ Gradually increase rollout percentage
7. ✅ Full release when stable

## Resources

- [Vercel Edge Config Documentation](https://vercel.com/docs/storage/edge-config)
- [Feature Flags Guide](./feature-flags.md)
- [RFC-007: Feature Flag System](../rfcs/007-feature-flags.md)

## Support

If you encounter issues:

1. Check Vercel Edge Config status page
2. Review Vercel project logs
3. Test with `isEdgeConfigAvailable()` helper
4. Contact Vercel support for Edge Config issues
