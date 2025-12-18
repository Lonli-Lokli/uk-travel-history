# Architectural Overview: Paid Registration Model

**Created**: 2025-12-18
**Status**: Proposal
**Relates to**: RFC-004, RFC-005, RFC-006, RFC-007

## Summary

This document outlines the architectural changes needed to implement a **paid-first registration model** where users must pay via Stripe before being registered in Firebase. All paid users have access to all premium features (single tier), with feature availability controlled dynamically via Vercel Edge Config.

## Current vs. New Architecture

### Current (RFC 1-7 as drafted)
```
┌─────────────────────────────────────────────────────────────┐
│ User Flow                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User visits site (anonymous)                            │
│  2. Creates Firebase account (free)                         │
│  3. Uses basic features (free tier)                         │
│  4. Hits feature gate for premium feature                   │
│  5. Sees UpgradeModal                                       │
│  6. Pays via Stripe                                         │
│  7. Webhook updates Firestore: tier = 'premium'            │
│  8. Can now access premium features                         │
│                                                              │
│  Tiers: 'free' and 'premium'                                │
└─────────────────────────────────────────────────────────────┘
```

### New (Paid Registration with Passkeys) - PAY FIRST
```
┌─────────────────────────────────────────────────────────────┐
│ User Flow - Payment Before Registration                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User visits site (anonymous)                            │
│  2. Tries to use ANY feature                                │
│  3. Sees Payment Modal:                                     │
│       a. Shows pricing (monthly/annual)                     │
│       b. User clicks "Subscribe"                            │
│       c. Creates Stripe Checkout session:                   │
│          - mode: 'subscription'                             │
│          - success_url: /registration?session_id={id}       │
│       d. Redirects to Stripe Checkout                       │
│       e. Stripe collects email + payment                    │
│       f. User completes payment                             │
│                                                              │
│  4. Stripe redirects to: /registration?session_id=cs_xxx    │
│     (This is KEY - ensures payment completed before reg)    │
│                                                              │
│  5. Registration Page (/registration):                      │
│       a. Validates session_id with Stripe API               │
│       b. If invalid/unpaid → redirect to home               │
│       c. If valid → show "Create Your Account"              │
│       d. User clicks "Register with Passkey"                │
│       e. Browser passkey prompt appears                     │
│       f. Firebase user created → authenticated              │
│       g. Send { userId, session_id } to backend             │
│                                                              │
│  6. Backend (/api/complete-registration):                   │
│       a. Validate session_id with Stripe                    │
│       b. Verify session is paid and not already used        │
│       c. Extract Stripe customer ID & subscription ID       │
│       d. Create Firestore doc:                              │
│          /subscriptions/{userId} {                          │
│            status: 'active',                                │
│            stripeCustomerId: <from session>,                │
│            stripeSubscriptionId: <from session>,            │
│            stripeSessionId: <session_id>, // prevent reuse  │
│            createdAt: <timestamp>,                          │
│          }                                                   │
│       e. Mark session as "consumed" (prevent reuse)         │
│                                                              │
│  7. User now authenticated + paid → redirect to /travel     │
│  8. Can access ALL features                                 │
│                                                              │
│  Auth: Firebase passkeys (no email required)                │
│  Payment: Stripe (email collected for invoicing)            │
│  Tiers: Only 'paid' (no free tier)                          │
│  Premium features: Controlled by Vercel Edge Config         │
│                                                              │
│  Benefits:                                                  │
│    ✅ No orphaned Firebase accounts                         │
│    ✅ Only paying customers get accounts                    │
│    ✅ Clean linking via session_id                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

### 1. Payment Before Registration (Critical Change)
- **Pay first, register second** - prevents orphaned Firebase accounts
- Anonymous users can view landing page but cannot use features
- Flow: (1) Pay via Stripe, (2) Register with passkey on return
- Only paying customers get Firebase accounts
- Linking via Stripe session_id passed in success URL
- Stripe collects email for invoicing (not required for passkey)

### 2. Single Paid Tier (Initially)
- All paid users have same access level
- No distinction between "basic premium" and "advanced premium" in V1
- Architecture supports future tiering (e.g., "standard" and "professional")

### 3. Dynamic Feature Control (Vercel Edge Config)
- What's considered "premium" is NOT hardcoded
- Controlled via Vercel Edge Config (dynamic, instant updates)
- Allows A/B testing, gradual rollout, feature experimentation
- If Edge Config unavailable, all paid features are blocked  
  

### 4. Simplified Authentication Flow
- Users pay BEFORE registration (via Stripe Checkout)
- After payment, they register with passkey (linked via session_id)
- Passkey creates Firebase user (no email required)
- Server middleware checks: "Is user authenticated + paid subscription active?"
- No tier checking (everyone authenticated + paid = full access)

## Detailed Component Changes

### RFC-004: Server Middleware (MAJOR CHANGES)

#### Current Design
- Checks Firebase token validity
- Fetches subscription document from Firestore
- Compares user's tier against required tier for feature
- Returns 403 if tier insufficient

#### New Design - Server-Side Security (CRITICAL)

**File**: `apps/uk-travel-history/src/middleware/serverAuth.ts`

```typescript
import { NextRequest } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import { get } from '@vercel/edge-config';

export interface AuthContext {
  userId: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * Verifies Firebase authentication token and subscription status.
 *
 * SECURITY: This function runs on the server and CANNOT be bypassed by client.
 */
export async function verifyAuth(request: NextRequest): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token, true);

    // Check subscription status in Firestore
    const subscriptionDoc = await adminFirestore
      .collection('subscriptions')
      .doc(decodedToken.uid)
      .get();

    const subscriptionStatus = subscriptionDoc.data()?.status;

    // Only active subscriptions allowed
    if (subscriptionStatus !== 'active') {
      throw new AuthError('Subscription not active', 403);
    }

    return {
      userId: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new AuthError('Invalid or expired token', 401);
  }
}

/**
 * Server-side check if a feature requires payment.
 *
 * SECURITY: This MUST be called server-side for all protected routes.
 * Client-side checks are for UX only and can be bypassed.
 */
export async function isFeaturePremium(featureId: string): Promise<boolean> {
  try {
    // Fetch from Edge Config (server-side only)
    const premiumFeatures = await get<string[]>('premium_features');

    // Fail-closed: if no config, assume all features are premium
    if (!premiumFeatures || premiumFeatures.length === 0) {
      console.warn('[SERVER] Edge Config unavailable - blocking all features');
      return true;
    }

    return premiumFeatures.includes(featureId);
  } catch (error) {
    console.error('[SERVER] Failed to fetch Edge Config:', error);
    // Fail-closed: assume premium on error
    return true;
  }
}

/**
 * Combined auth + feature check for protected API routes.
 *
 * SECURITY: Use this in ALL API routes that serve premium features.
 */
export async function requirePaidFeature(
  request: NextRequest,
  featureId: string
): Promise<AuthContext> {
  // Step 1: Verify user is authenticated with active subscription
  const authContext = await verifyAuth(request);

  // Step 2: Check if this specific feature requires payment
  const isPremium = await isFeaturePremium(featureId);

  if (!isPremium) {
    // Feature is not premium - allow access
    return authContext;
  }

  // Feature IS premium - subscription already verified in verifyAuth()
  // If we're here, user has active subscription, so they can access it
  return authContext;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
```

**Example Usage in API Route:**

```typescript
// apps/uk-travel-history/src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePaidFeature, AuthError } from '@/middleware/serverAuth';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Server-side validation - CANNOT be bypassed by client
    const authContext = await requirePaidFeature(request, 'excel_export');

    // User is authorized - proceed with export
    const data = await request.json();
    const excelBuffer = await generateExcel(data);

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="travel-history.xlsx"',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Key Changes:**
- Remove `requireFeature()` function (replaced with `requirePaidFeature`)
- Add `isFeaturePremium()` - server-side Edge Config check (fail-closed)
- Add `requirePaidFeature()` - combined auth + feature validation
- **CRITICAL**: All checks happen server-side - client cannot bypass
- Simplified: authenticated + active subscription = access to all paid features
- Feature-level gating via Edge Config (server-side only)

### RFC-005: Feature Gate Component (MODERATE CHANGES)

#### Current Design
- Checks `monetizationStore.hasAccess(feature)` which compares tiers
- Shows upgrade modal for insufficient tier

#### New Design
```typescript
export const FeatureGate = observer<FeatureGateProps>(({
  feature,
  mode = 'hide',
  children,
  fallback,
  className = '',
}) => {
  const [showRegistrationModal, setShowRegistrationModal] = React.useState(false);

  // NEW: Simpler check - is user authenticated with active subscription?
  const isAuthenticated = authStore.user !== null;
  const isSubscriptionActive = monetizationStore.subscriptionStatus === 'active';
  const hasAccess = isAuthenticated && isSubscriptionActive;
  const isLoading = monetizationStore.isLoading;

  // NEW: Check if this feature requires payment (from Edge Config)
  const isPremiumFeature = monetizationStore.isPremiumFeature(feature);

  // Show loading skeleton while subscription loads
  if (isLoading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded" />;
  }

  // If feature is not premium (from Edge Config), always allow
  if (!isPremiumFeature) {
    return <>{children}</>;
  }

  // User has access - render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // User denied access - show registration/payment modal
  switch (mode) {
    case 'hide':
      return fallback ? <>{fallback}</> : null;

    case 'paywall':
      return (
        <>
          <div
            className={`relative cursor-pointer ${className}`}
            onClick={() => setShowRegistrationModal(true)}
            role="button"
            tabIndex={0}
            aria-label="Register to access this feature"
          >
            {/* Blurred content */}
            <div style={{ filter: 'blur(2px)', pointerEvents: 'none' }}>
              {children}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
                <p className="text-sm font-medium">
                  Register to unlock this feature
                </p>
              </div>
            </div>
          </div>

          {showRegistrationModal && (
            <RegistrationPaymentModal
              feature={feature}
              onClose={() => setShowRegistrationModal(false)}
            />
          )}
        </>
      );

    // ... other modes
  }
});
```

**Key Changes:**
- Remove tier comparison logic
- Simplified to binary check: authenticated + active subscription
- Add check against Edge Config for premium features: `isPremiumFeature(feature)`
- Rename "UpgradeModal" to "RegistrationPaymentModal"
- Update messaging: "Register to unlock" instead of "Upgrade to Premium"

### RFC-006: Payment Modal (MAJOR CHANGES)

#### Current Design
- Shows "Upgrade to Premium" with tier comparison
- Expects user to already be authenticated
- Shows LoginModal if not authenticated

#### New Design

**Renamed:** `UpgradeModal.tsx` → `PaymentModal.tsx`

**Single-Step Flow: Payment Only**
- No registration in modal (happens AFTER payment)
- User clicks "Subscribe" → redirects to Stripe
- After payment, Stripe redirects to /registration page
- Registration page handles passkey creation + linking

```typescript
export const PaymentModal = observer<PaymentModalProps>(({
  isOpen = true,
  feature,
  onClose,
}) => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Determine Stripe price ID
      const priceId = billingPeriod === 'monthly'
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL;

      // Create checkout session WITHOUT authentication
      // Anonymous checkout - email collected by Stripe
      const response = await fetch('/api/stripe/create-anonymous-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          billingPeriod,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe not loaded');

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      if (stripeError) {
        throw stripeError;
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <SparklesIcon className="h-6 w-6 text-yellow-500" />
            Subscribe to Get Started
          </DialogTitle>
        </DialogHeader>

        {/* Contextual message if triggered by specific feature */}
        {feature && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900">
              <strong>{FEATURE_METADATA[feature]?.name}</strong> requires a subscription.
              Get full access to all features with one simple payment.
            </p>
          </div>
        )}

        {/* Pricing Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'annual'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setBillingPeriod('annual')}
            >
              Annual
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Display */}
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-gray-900">
            ${billingPeriod === 'monthly' ? '9.99' : '8.25'}
            <span className="text-lg font-normal text-gray-600">/month</span>
          </div>
          {billingPeriod === 'annual' && (
            <p className="text-sm text-gray-600 mt-1">
              Billed $99/year (2 months free!)
            </p>
          )}
        </div>

        {/* Features List (all included, no comparison) */}
        <div className="border-2 border-blue-600 rounded-lg p-6 bg-blue-50 mb-4">
          <h3 className="text-lg font-semibold mb-4 text-blue-900">
            Everything Included
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-blue-900">Unlimited Excel exports with all calculations</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-blue-900">Professional PDF reports for visa applications</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-blue-900">Cloud sync across all your devices</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-blue-900">Advanced travel analytics and insights</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-blue-900">Priority email support</span>
            </li>
          </ul>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Redirecting...
              </>
            ) : (
              <>Subscribe Now</>
            )}
          </Button>
        </div>

        {/* Info about next steps */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center mb-3">
            After payment, you'll create your secure account with passkey authentication
          </p>
          <div className="flex justify-center gap-6 text-xs text-gray-600">
            <span>🔒 Secure payment via Stripe</span>
            <span>✓ Cancel anytime</span>
            <span>💯 30-day money-back guarantee</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
```

**Key Changes:**
- Single-step modal (payment only, no registration)
- Remove authentication requirement (anonymous checkout)
- Show "Subscribe Now" instead of "Continue to Payment"
- Create new API endpoint: `/api/stripe/create-anonymous-checkout`
- Email collected by Stripe Checkout (not in modal)
- After payment, user redirected to /registration page

**New API Endpoint Required:**
`/api/stripe/create-anonymous-checkout/route.ts`
```typescript
export async function POST(request: NextRequest) {
  // NEW: No authentication required (anonymous checkout)
  const body = await request.json();
  const { priceId, billingPeriod } = body;

  // Validate price ID
  if (priceId !== STRIPE_PRICES.PREMIUM_MONTHLY && priceId !== STRIPE_PRICES.PREMIUM_ANNUAL) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    // No customer_email - let Stripe collect it
    metadata: {
      billingPeriod,
      checkoutType: 'new_subscription', // Flag for tracking
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    // CRITICAL: Redirect to registration page with session_id
    success_url: `${appUrl}/registration?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?checkout=canceled`,
  });

  return NextResponse.json({ sessionId: session.id, url: session.url });
}
```

**New Registration Page Component:**
`/app/registration/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { authStore } from '@/stores/authStore';
import { Button } from '@uth/ui/components/ui/button';

export default observer(function RegistrationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session_id = searchParams.get('session_id');

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Validate session_id with backend
  useEffect(() => {
    if (!session_id) {
      router.push('/');
      return;
    }

    async function validateSession() {
      try {
        const response = await fetch('/api/stripe/validate-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id }),
        });

        if (!response.ok) {
          throw new Error('Invalid or expired session');
        }

        const data = await response.json();

        // Check if session is paid and not already used
        if (data.paymentStatus !== 'paid' || data.alreadyUsed) {
          throw new Error('Payment not completed or session already used');
        }

        setIsValid(true);
      } catch (err) {
        console.error('Session validation error:', err);
        setError(err instanceof Error ? err.message : 'Failed to validate payment');
        // Redirect to home after 3 seconds
        setTimeout(() => router.push('/'), 3000);
      } finally {
        setIsValidating(false);
      }
    }

    validateSession();
  }, [session_id, router]);

  // Step 2: Handle passkey registration
  const handlePasskeyRegistration = async () => {
    setIsRegistering(true);
    setError(null);

    try {
      // Create passkey → Firebase user created
      await authStore.registerWithPasskey();

      const userId = authStore.user?.uid;
      if (!userId) {
        throw new Error('Failed to get user ID after registration');
      }

      // Step 3: Link subscription to Firebase user
      const response = await fetch('/api/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await authStore.getIdToken()}`,
        },
        body: JSON.stringify({
          session_id,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete registration');
      }

      // Success! Redirect to app
      router.push('/travel?registration=success');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete registration');
    } finally {
      setIsRegistering(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating your payment...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Issue</h1>
          <p className="text-gray-600 mb-4">
            {error || 'Unable to verify your payment. Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-600">
            Now let's create your secure account
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            You'll use passkey authentication - secure, password-free access using your device's biometric features (Face ID, fingerprint, etc.)
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        <Button
          onClick={handlePasskeyRegistration}
          disabled={isRegistering}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {isRegistering ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Creating your account...
            </>
          ) : (
            <>Create Account with Passkey</>
          )}
        </Button>

        <p className="text-xs text-gray-600 mt-4 text-center">
          This will only take a few seconds
        </p>
      </div>
    </div>
  );
});
```

**New Backend Endpoints Required:**

1. `/api/stripe/validate-session/route.ts` - Validates session_id
2. `/api/complete-registration/route.ts` - Links subscription to Firebase user

        {/* Trust Signals */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-center gap-6 text-xs text-gray-600">
            <span>🔒 Secure payment via Stripe</span>
            <span>✓ Cancel anytime</span>
            <span>💯 30-day money-back guarantee</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
```

**Key Changes:**
- Two-step flow: Register with passkey first, then payment
- Add step indicator UI (1. Register → 2. Payment)
- Remove "Free vs Premium" comparison (no free tier)
- Show "Everything Included" feature list
- Skip Step 1 if user already authenticated
- Update copy: "Continue to Payment" instead of "Upgrade to Premium"
- Use existing `/api/stripe/create-checkout` endpoint (already implemented)
- Email collected by Stripe Checkout (not in modal)

**No New API Endpoint Required:**
The existing `/api/stripe/create-checkout` endpoint already:
- Requires authentication (passes `client_reference_id = userId`)
- Creates checkout session with user's Firebase UID
- Allows Stripe to collect email for billing

The webhook will create the subscription document using the `client_reference_id` (userId) from the session.

### RFC-007: Feature Flags + Edge Config (MODERATE CHANGES)

#### Current Design
- Uses environment variables for feature flags
- Hardcoded feature-to-tier mapping in `TIER_CONFIG`

#### New Design

**Add Edge Config Integration:**

```typescript
// packages/ui/src/config/featureFlags.ts
import { get } from '@vercel/edge-config';

export const FEATURE_FLAGS = {
  // Master switch for entire monetization system
  MONETIZATION_ENABLED: process.env.NEXT_PUBLIC_FF_MONETIZATION === 'true',

  // Authentication (simplified - no tiers)
  FIREBASE_AUTH_ENABLED: process.env.NEXT_PUBLIC_FF_FIREBASE_AUTH === 'true',

  // Payment features
  STRIPE_CHECKOUT_ENABLED: process.env.NEXT_PUBLIC_FF_STRIPE_CHECKOUT === 'true',

  // NEW: Use Edge Config for dynamic feature control
  USE_EDGE_CONFIG: process.env.NEXT_PUBLIC_FF_USE_EDGE_CONFIG === 'true',

  // UI features
  REGISTRATION_MODAL_ENABLED: process.env.NEXT_PUBLIC_FF_REGISTRATION_MODAL === 'true',

  // Development helpers
  DEV_MODE_TOGGLE: process.env.NODE_ENV === 'development',
} as const;

// NEW: Dynamic premium feature check using Edge Config
// SECURITY: This is for UI only - server MUST validate independently
export async function isPremiumFeature(featureId: string): Promise<boolean> {
  // If Edge Config disabled, block all features (fail-closed)
  if (!FEATURE_FLAGS.USE_EDGE_CONFIG) {
    console.warn('Edge Config disabled - all features blocked');
    return true; // Fail-closed: all features require payment without Edge Config
  }

  try {
    // Fetch from Edge Config
    const premiumFeatures = await get<string[]>('premium_features');

    // If Edge Config returns empty or undefined, block everything
    if (!premiumFeatures || premiumFeatures.length === 0) {
      console.warn('Edge Config returned empty - all features blocked');
      return true; // Fail-closed: block if no config available
    }

    return premiumFeatures.includes(featureId);
  } catch (error) {
    console.error('Failed to fetch from Edge Config:', error);

    // CRITICAL: Fail-closed on error
    // Block access if we can't verify - security over convenience
    return true; // Assume premium if we can't check
  }
}

// NEW: Get all premium features (for UI lists)
// SECURITY: This is for UI only - server MUST validate independently
export async function getPremiumFeatures(): Promise<string[]> {
  if (!FEATURE_FLAGS.USE_EDGE_CONFIG) {
    console.warn('Edge Config disabled - assuming all features premium');
    // Return default premium features as fallback
    return ['excel_export', 'pdf_export', 'cloud_sync', 'advanced_analytics'];
  }

  try {
    const premiumFeatures = await get<string[]>('premium_features');
    return premiumFeatures || ['excel_export', 'pdf_export', 'cloud_sync', 'advanced_analytics'];
  } catch (error) {
    console.error('Failed to fetch from Edge Config:', error);
    // Fail-closed: return default premium list
    return ['excel_export', 'pdf_export', 'cloud_sync', 'advanced_analytics'];
  }
}
```

**Edge Config Structure:**
```json
{
  "premium_features": [
    "excel_export",
    "pdf_export",
    "cloud_sync",
    "advanced_analytics",
    "employer_letter"
  ]
}
```

**Key Changes:**
- Add `USE_EDGE_CONFIG` flag
- Implement `isPremiumFeature()` that queries Edge Config
- Implement `getPremiumFeatures()` for listing features
- **CRITICAL**: Fail-closed approach - if Edge Config unavailable, block all features
- Remove tier-based flags (no free/premium distinction in flags)

**SECURITY WARNING:**
All client-side checks are for **UX ONLY**. Server-side validation is MANDATORY:
- Client code can be modified via browser dev tools
- Feature gates can be bypassed by manipulating JavaScript
- Edge Config checks on client are NOT security boundaries
- **ALL premium feature access MUST be validated server-side** in API routes

## Stripe Webhook Changes

### Current Webhook (RFC-003)
```typescript
// On successful payment:
// 1. Update Firestore: subscriptions/{userId} { tier: 'premium', status: 'active' }
```

### New Webhook (Simplified - No User Creation)
```typescript
// On successful payment (checkout.session.completed):
// 1. Extract userId from session.client_reference_id or session.metadata.userId
// 2. Create/Update Firestore subscription doc:
//    /subscriptions/{userId} {
//      status: 'active',
//      stripeCustomerId: session.customer,
//      stripeSubscriptionId: session.subscription,
//      createdAt: <timestamp>,
//      currentPeriodEnd: <timestamp>,
//    }
// 3. User is already registered (via passkey in Step 1 of modal)
// 4. No email sending required (user already authenticated)
```

**Key Simplification:**
- User already exists in Firebase (created in Step 1 of modal)
- Webhook only creates/updates subscription document
- No user creation or authentication steps in webhook

## Database Schema Changes

### Current Schema
```
/subscriptions/{userId}
  - tier: 'free' | 'premium'
  - status: 'active' | 'past_due' | 'canceled'
  - stripeCustomerId: string
  - stripeSubscriptionId: string
```

### New Schema
```
/subscriptions/{userId}
  - status: 'active' | 'past_due' | 'canceled'  // REMOVED: tier field
  - stripeCustomerId: string
  - stripeSubscriptionId: string
  - createdAt: timestamp
  - currentPeriodEnd: timestamp
```

**Key Changes:**
- Remove `tier` field (all users have same access level)
- Add `createdAt` for analytics
- Simplified: status is the only differentiator

## Migration Path

### Phase 1: Update RFCs
- [ ] Revise RFC-004 (server middleware)
- [ ] Revise RFC-005 (feature gate)
- [ ] Revise RFC-006 (upgrade → registration modal)
- [ ] Revise RFC-007 (add Edge Config)

### Phase 2: Implement Changes
- [ ] Create `/api/stripe/create-registration-checkout` endpoint
- [ ] Update Stripe webhook to handle new user registration
- [ ] Implement Edge Config integration
- [ ] Update `FeatureGate` component
- [ ] Update server middleware
- [ ] Update MobX store (remove tier logic)

### Phase 3: Testing
- [ ] E2E test: Anonymous user → Payment → Login link → Access features
- [ ] Test Edge Config feature control
- [ ] Test subscription status checks

### Phase 4: Deployment
- [ ] Configure Edge Config in Vercel
- [ ] Deploy with feature flags off
- [ ] Enable registration flow incrementally
- [ ] Monitor conversion rates

## Future Extensibility: Multiple Paid Tiers

The architecture supports adding multiple paid tiers in the future:

```typescript
// Future: Add tier field back
/subscriptions/{userId}
  - tier: 'standard' | 'professional' | 'enterprise'
  - status: 'active' | 'past_due' | 'canceled'

// Edge Config: Map features to minimum required tier
{
  "feature_tier_requirements": {
    "excel_export": "standard",
    "pdf_export": "standard",
    "cloud_sync": "standard",
    "advanced_analytics": "professional",
    "white_label": "enterprise"
  }
}
```

Then server middleware becomes:
```typescript
const userTier = subscriptionDoc.data()?.tier || 'standard';
const requiredTier = await getRequiredTier(featureId); // From Edge Config
if (!isAuthorized(userTier, requiredTier)) {
  throw new Error('Upgrade required');
}
```

## Questions for Review

1. **Email Collection**: Should we collect email in the modal, or use Firebase Auth first then link to Stripe?
   - **Proposal**: Collect email in modal (simpler UX)

2. **Login Link Timing**: When should users receive login link?
   - **Proposal**: Immediately after payment (in webhook)

3. **Edge Config Fallback**: What features should be premium by default if Edge Config fails?
   - **Proposal**: All current premium features (Excel export, PDF, cloud sync, analytics)

4. **Existing Users**: How to handle users who already registered under old system?
   - **Proposal**: Grandfather existing free users, require payment for new features

5. **Trial Period**: Should we offer a trial before requiring payment?
   - **Proposal**: V2 feature - start with paid registration only

## Summary of Changes by RFC

| RFC | Current Focus | New Focus | Complexity |
|-----|---------------|-----------|------------|
| RFC-004 | Tier-based auth | Binary auth (paid/unpaid) | Major |
| RFC-005 | Tier comparison in UI | Binary check + Edge Config | Moderate |
| RFC-006 | Upgrade modal for authenticated users | Registration modal for anonymous | Major |
| RFC-007 | Env var feature flags | Env vars + Edge Config | Moderate |

## Next Steps

1. Review this architectural proposal
2. Clarify any questions above
3. Update individual RFCs with detailed changes
4. Implement new API endpoints
5. Test end-to-end flow
