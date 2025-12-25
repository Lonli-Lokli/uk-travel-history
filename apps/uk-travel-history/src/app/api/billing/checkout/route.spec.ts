/**
 * Tests for /api/billing/checkout endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@uth/db', () => ({
  getSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'purchase-intent-123',
              email: 'test@example.com',
              status: 'created',
            },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          error: null,
        })),
      })),
    })),
  })),
}));

vi.mock('@uth/utils', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('stripe', () => {
  return {
    default: vi.fn(function() {
      return {
        checkout: {
          sessions: {
            create: vi.fn(async () => ({
              id: 'cs_test_123',
              url: 'https://checkout.stripe.com/pay/cs_test_123',
            })),
          },
        },
      };
    }),
  };
});

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ONE_TIME_PAYMENT = 'price_123';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('should create checkout session successfully', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('cs_test_123');
    expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
  });

  it('should return 400 if email is missing', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if email is not a string', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 123 }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 500 if STRIPE_SECRET_KEY is not configured', async () => {
    // Arrange
    delete process.env.STRIPE_SECRET_KEY;
    const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Payment system not configured');
  });

  it('should return 500 if STRIPE_PRICE_ONE_TIME_PAYMENT is not configured', async () => {
    // Arrange
    delete process.env.STRIPE_PRICE_ONE_TIME_PAYMENT;
    const request = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe('Payment price not configured');
  });
});
