/**
 * Tests for /api/billing/checkout endpoint
 * Updated to test feature access control enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest, NextResponse } from 'next/server';
import { configureRouteLogger } from '@uth/flow';
import { TIERS } from '@uth/features';

// Mock dependencies
vi.mock('@uth/db', () => ({
  createPurchaseIntent: vi.fn(),
  updatePurchaseIntent: vi.fn(),
  PurchaseIntentStatus: {
    CREATED: 'created',
    CHECKOUT_CREATED: 'checkout_created',
    PAID: 'paid',
    PROVISIONED: 'provisioned',
  },
}));

vi.mock('@uth/payments-server', () => ({
  createCheckoutSession: vi.fn(),
  PaymentPlan: {
    PREMIUM_MONTHLY: 'PREMIUM_MONTHLY',
    PREMIUM_ANNUAL: 'PREMIUM_ANNUAL',
    PREMIUM_ONCE: 'PREMIUM_ONCE',
  },
}));

vi.mock('@uth/features/server', () => ({
  assertFeatureAccess: vi.fn(),
  FEATURE_KEYS: {
    PAYMENTS: 'payments',
    EXCEL_EXPORT: 'excel_export',
    EXCEL_IMPORT: 'excel_import',
    PDF_IMPORT: 'pdf_import',
  },
}));

// Create mock logger for testing
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

import { createPurchaseIntent, updatePurchaseIntent } from '@uth/db';
import { createCheckoutSession } from '@uth/payments-server';
import { assertFeatureAccess } from '@uth/features/server';

const mockCreatePurchaseIntent = vi.mocked(createPurchaseIntent);
const mockUpdatePurchaseIntent = vi.mocked(updatePurchaseIntent);
const mockCreateCheckoutSession = vi.mocked(createCheckoutSession);
const mockAssertFeatureAccess = vi.mocked(assertFeatureAccess);

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure route logger with mock
    configureRouteLogger({
      logger: mockLogger,
    });

    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_123';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    // Mock assertFeatureAccess to return anonymous user context by default
    mockAssertFeatureAccess.mockResolvedValue({
      userId: null,
      tier: TIERS.ANONYMOUS,
      hasActiveSubscription: false,
    });

    // Setup default mock implementations
    mockCreatePurchaseIntent.mockResolvedValue({
      id: 'purchase-intent-123',
      email: 'test@example.com',
      status: 'created',
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      priceId: null,
      productId: null,
      authUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockUpdatePurchaseIntent.mockResolvedValue({
      id: 'purchase-intent-123',
      email: 'test@example.com',
      status: 'checkout_created',
      stripeCheckoutSessionId: 'cs_test_123',
      stripePaymentIntentId: null,
      priceId: 'price_123',
      productId: null,
      authUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
      expiresAt: new Date(Date.now() + 3600000),
    });
  });

  it('should create checkout session successfully', async () => {
    // Arrange
    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      },
    );

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('cs_test_123');
    expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_123');

    // Verify SDK was called correctly
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
      plan: 'PREMIUM_ONCE',
      customerEmail: 'test@example.com',
      successUrl:
        'http://localhost:3000/travel?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3000/',
      metadata: {
        purchase_intent_id: 'purchase-intent-123',
        email: 'test@example.com',
      },
    });
  });

  it('should return 400 if email is missing', async () => {
    // Arrange
    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if email is not a string', async () => {
    // Arrange
    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ email: 123 }),
      },
    );

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 500 if checkout session creation fails', async () => {
    // Arrange
    mockCreateCheckoutSession.mockRejectedValue(
      new Error('Payment system not configured'),
    );
    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      },
    );

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create checkout session');
  });

  it('should return 500 if STRIPE_LIFETIME_PRICE_ID is not configured', async () => {
    // Arrange
    delete process.env.STRIPE_LIFETIME_PRICE_ID;
    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      },
    );

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Payment price not configured');
  });

  it('should enforce feature access control', async () => {
    // Arrange
    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      },
    );

    // Act
    await POST(request);

    // Assert - verify assertFeatureAccess was called with correct params
    expect(mockAssertFeatureAccess).toHaveBeenCalledWith(
      request,
      'payments',
    );
  });

  it('should return 404 when PAYMENTS feature is disabled', async () => {
    // Arrange - assertFeatureAccess throws a NextResponse error
    const errorResponse = NextResponse.json(
      { error: 'Feature not available', code: 'feature_disabled' },
      { status: 404 },
    );
    mockAssertFeatureAccess.mockRejectedValue(errorResponse);

    const request = new NextRequest(
      'http://localhost:3000/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      },
    );

    // Act - The route catches the thrown NextResponse and returns it
    const response = await POST(request);
    const data = await response.json();

    // Assert - assertFeatureAccess was called
    expect(mockAssertFeatureAccess).toHaveBeenCalledWith(
      request,
      'payments',
    );

    // The route should catch and return the error response
    // Note: The actual behavior depends on try/catch in the route
    // If assertFeatureAccess throws, it should be caught and handled
    expect(response.status).toBe(404);
    expect(data.error).toBe('Feature not available');
    expect(data.code).toBe('feature_disabled');
  });
});
