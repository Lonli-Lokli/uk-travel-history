/**
 * Mock implementation of PaymentsServerProvider for testing
 */

import type {
  PaymentsServerProvider,
  PaymentsServerProviderConfig,
} from './interface';
import type {
  CheckoutIntent,
  CheckoutSessionRef,
  WebhookHandlerInput,
  WebhookEventResult,
  Entitlement,
  PriceIds,
  CheckoutSessionDetails,
  SubscriptionDetails,
  PriceDetails,
} from '../../types/domain';
import {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
} from '../../types/domain';

/**
 * Mock payments provider for testing
 */
export class MockPaymentsServerAdapter implements PaymentsServerProvider {
  private configured = true;
  private sessions: Map<string, CheckoutSessionDetails> = new Map();
  private subscriptions: Map<string, SubscriptionDetails> = new Map();
  private sessionCounter = 0;
  private subscriptionCounter = 0;

  initialize(config: PaymentsServerProviderConfig): void {
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getPriceId(plan: string): string {
    const priceIds: Record<string, string> = {
      [PaymentPlan.PREMIUM_MONTHLY]: 'price_mock_monthly',
      [PaymentPlan.PREMIUM_ANNUAL]: 'price_mock_annual',
      [PaymentPlan.PREMIUM_ONCE]: 'price_mock_once',
    };

    return priceIds[plan] || 'price_mock_default';
  }

  getPriceIds(): PriceIds {
    return {
      PREMIUM_MONTHLY: 'price_mock_monthly',
      PREMIUM_ANNUAL: 'price_mock_annual',
      PREMIUM_ONCE: 'price_mock_once',
    };
  }

  async getPriceDetails(): Promise<PriceDetails> {
    // Return mock price details in GBP
    return {
      monthly: {
        id: 'price_mock_monthly',
        unitAmount: 999, // £9.99
        currency: 'gbp',
        amount: 9.99,
      },
      annual: {
        id: 'price_mock_annual',
        unitAmount: 9900, // £99.00
        currency: 'gbp',
        amount: 99.0,
      },
      lifetime: {
        id: 'price_mock_once',
        unitAmount: 24900, // £249.00
        currency: 'gbp',
        amount: 249.0,
      },
    };
  }

  async createCheckoutSession(
    intent: CheckoutIntent,
  ): Promise<CheckoutSessionRef> {
    this.sessionCounter++;
    const sessionId = `cs_test_mock_${this.sessionCounter}`;
    const subscriptionId = `sub_test_mock_${this.subscriptionCounter++}`;

    // Create mock session details
    const sessionDetails: CheckoutSessionDetails = {
      id: sessionId,
      paymentStatus: 'unpaid',
      customerId: intent.userId ? `cus_mock_${intent.userId}` : undefined,
      subscriptionId:
        intent.plan !== PaymentPlan.PREMIUM_ONCE ? subscriptionId : undefined,
      metadata: intent.metadata || {},
      customerEmail: intent.customerEmail,
    };

    // Store the session
    this.sessions.set(sessionId, sessionDetails);

    // Create mock subscription if not one-time payment
    if (intent.plan !== PaymentPlan.PREMIUM_ONCE) {
      const now = Math.floor(Date.now() / 1000);
      const subscription: SubscriptionDetails = {
        id: subscriptionId,
        customerId: sessionDetails.customerId || 'cus_mock_anonymous',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60, // 30 days
        cancelAtPeriodEnd: false,
        priceId: this.getPriceId(intent.plan),
        metadata: intent.metadata || {},
      };

      this.subscriptions.set(subscriptionId, subscription);
    }

    return {
      id: sessionId,
      url: `https://mock-checkout.example.com/pay/${sessionId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  async verifyCheckoutSession(sessionId: string): Promise<Entitlement | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new PaymentsError(
        PaymentsErrorCode.NOT_FOUND,
        `Session not found: ${sessionId}`,
      );
    }

    if (session.paymentStatus !== 'paid') {
      return null;
    }

    // Determine payment plan from subscription
    let plan = PaymentPlan.PREMIUM_ONCE;
    if (session.subscriptionId) {
      const subscription = this.subscriptions.get(session.subscriptionId);
      if (subscription?.priceId === 'price_mock_monthly') {
        plan = PaymentPlan.PREMIUM_MONTHLY;
      } else if (subscription?.priceId === 'price_mock_annual') {
        plan = PaymentPlan.PREMIUM_ANNUAL;
      }
    }

    return {
      userId: session.customerId || 'anonymous',
      plan,
      status: PaymentStatus.SUCCEEDED,
      startDate: new Date(),
      isActive: true,
      subscriptionId: session.subscriptionId,
    };
  }

  async retrieveCheckoutSession(
    sessionId: string,
  ): Promise<CheckoutSessionDetails> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new PaymentsError(
        PaymentsErrorCode.NOT_FOUND,
        `No such checkout session: ${sessionId}`,
      );
    }

    return session;
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionDetails> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new PaymentsError(
        PaymentsErrorCode.NOT_FOUND,
        `No such subscription: ${subscriptionId}`,
      );
    }

    return subscription;
  }

  constructWebhookEvent(
    body: string | Buffer,
    signature: string,
    secret: string,
  ): any {
    // Simple mock webhook event construction
    // In real implementation, this would verify signature
    if (signature !== 'mock_valid_signature') {
      throw new PaymentsError(
        PaymentsErrorCode.INVALID_SIGNATURE,
        'Invalid webhook signature',
      );
    }

    const bodyStr = typeof body === 'string' ? body : body.toString();

    try {
      return JSON.parse(bodyStr);
    } catch {
      throw new PaymentsError(
        PaymentsErrorCode.INVALID_INPUT,
        'Invalid webhook payload',
      );
    }
  }

  async handleWebhook(input: WebhookHandlerInput): Promise<WebhookEventResult> {
    const event = this.constructWebhookEvent(
      input.body,
      input.signature,
      'mock_secret',
    );

    return {
      event: {
        id: event.id || 'evt_mock_' + Date.now(),
        type: WebhookEventType.UNKNOWN,
        timestamp: new Date(),
        userId: event.userId,
        metadata: event.metadata,
      },
      alreadyProcessed: false,
      actions: [],
    };
  }

  /**
   * Helper method to add a mock session (for testing)
   */
  addMockSession(sessionId: string, details: CheckoutSessionDetails): void {
    this.sessions.set(sessionId, details);
  }

  /**
   * Helper method to add a mock subscription (for testing)
   */
  addMockSubscription(
    subscriptionId: string,
    details: SubscriptionDetails,
  ): void {
    this.subscriptions.set(subscriptionId, details);
  }

  /**
   * Clear all mock data (for testing)
   */
  clearMockData(): void {
    this.sessions.clear();
    this.subscriptions.clear();
    this.sessionCounter = 0;
    this.subscriptionCounter = 0;
  }
}
