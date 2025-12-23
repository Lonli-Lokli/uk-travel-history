/**
 * Stripe implementation of PaymentsServerProvider
 */

import Stripe from 'stripe';
import type {
  PaymentsServerProvider,
  PaymentsServerProviderConfig,
} from './interface';
import type {
  CheckoutIntent,
  CheckoutSessionRef,
  WebhookHandlerInput,
  WebhookEventResult,
  WebhookEvent,
  Entitlement,
} from '../../types/domain';
import {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
} from '../../types/domain';

/**
 * Stripe implementation of the payments server provider
 */
export class StripePaymentsServerAdapter implements PaymentsServerProvider {
  private stripe?: Stripe;
  private webhookSecret?: string;
  private priceIds: Record<string, string> = {};
  private configured = false;

  initialize(config: PaymentsServerProviderConfig): void {
    // Load Stripe secret key
    const secretKey =
      process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_build';

    if (!secretKey || secretKey === 'sk_test_placeholder_key_for_build') {
      console.warn(
        'Stripe secret key not configured. Set STRIPE_SECRET_KEY environment variable.',
      );
      return;
    }

    try {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia',
        typescript: true,
      });

      // Load price IDs from environment
      this.priceIds = {
        [PaymentPlan.PREMIUM_MONTHLY]:
          process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
        [PaymentPlan.PREMIUM_ANNUAL]:
          process.env.STRIPE_PRICE_PREMIUM_ANNUAL || 'price_premium_annual',
        [PaymentPlan.PREMIUM_ONCE]:
          process.env.STRIPE_PRICE_PREMIUM_ONCE || 'price_premium_once',
      };

      // Load webhook secret
      this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!this.webhookSecret) {
        console.warn(
          'Stripe webhook secret not configured. Webhook signature verification will be skipped.',
        );
      }

      this.configured = true;
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private ensureConfigured(): Stripe {
    if (!this.stripe) {
      throw new PaymentsError(
        PaymentsErrorCode.CONFIG_ERROR,
        'Stripe is not initialized. Set STRIPE_SECRET_KEY environment variable.',
      );
    }
    return this.stripe;
  }

  getPriceId(plan: string): string {
    return this.priceIds[plan] || plan;
  }

  async createCheckoutSession(
    intent: CheckoutIntent,
  ): Promise<CheckoutSessionRef> {
    const stripe = this.ensureConfigured();

    try {
      const priceId = this.getPriceId(intent.plan);

      const session = await stripe.checkout.sessions.create({
        mode:
          intent.plan === PaymentPlan.PREMIUM_ONCE ? 'payment' : 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: intent.successUrl,
        cancel_url: intent.cancelUrl,
        client_reference_id: intent.userId,
        metadata: {
          userId: intent.userId,
          plan: intent.plan,
          ...intent.metadata,
        },
      });

      if (!session.url) {
        throw new PaymentsError(
          PaymentsErrorCode.PROVIDER_ERROR,
          'Stripe did not return a checkout URL',
        );
      }

      return {
        id: session.id,
        url: session.url,
        expiresAt: new Date(session.expires_at * 1000),
      };
    } catch (error: any) {
      if (error instanceof PaymentsError) {
        throw error;
      }

      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        `Failed to create checkout session: ${error.message}`,
        error,
      );
    }
  }

  async verifyCheckoutSession(sessionId: string): Promise<Entitlement | null> {
    const stripe = this.ensureConfigured();

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'line_items'],
      });

      if (session.payment_status !== 'paid') {
        return null;
      }

      const userId =
        session.client_reference_id || session.metadata?.userId || '';
      const plan =
        (session.metadata?.plan as PaymentPlan) || PaymentPlan.PREMIUM_MONTHLY;

      const entitlement: Entitlement = {
        userId,
        plan,
        status: PaymentStatus.SUCCEEDED,
        startDate: new Date(session.created * 1000),
        isActive: true,
      };

      // If it's a subscription, add subscription details
      if (session.mode === 'subscription' && session.subscription) {
        const subscription =
          typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

        entitlement.subscriptionId = subscription.id;
        entitlement.endDate = new Date(subscription.current_period_end * 1000);
      }

      return entitlement;
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        throw new PaymentsError(
          PaymentsErrorCode.NOT_FOUND,
          `Checkout session not found: ${sessionId}`,
          error,
        );
      }

      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        `Failed to verify checkout session: ${error.message}`,
        error,
      );
    }
  }

  /**
   * Map Stripe event type to domain event type
   */
  private mapEventType(stripeType: string): WebhookEventType {
    switch (stripeType) {
      case 'checkout.session.completed':
        return WebhookEventType.CHECKOUT_COMPLETED;
      case 'payment_intent.succeeded':
        return WebhookEventType.PAYMENT_SUCCEEDED;
      case 'payment_intent.payment_failed':
        return WebhookEventType.PAYMENT_FAILED;
      case 'customer.subscription.created':
        return WebhookEventType.SUBSCRIPTION_CREATED;
      case 'customer.subscription.updated':
        return WebhookEventType.SUBSCRIPTION_UPDATED;
      case 'customer.subscription.deleted':
        return WebhookEventType.SUBSCRIPTION_CANCELLED;
      default:
        return WebhookEventType.UNKNOWN;
    }
  }

  /**
   * Normalize Stripe event to domain webhook event
   */
  private normalizeStripeEvent(stripeEvent: Stripe.Event): WebhookEvent {
    const event: WebhookEvent = {
      id: stripeEvent.id,
      type: this.mapEventType(stripeEvent.type),
      timestamp: new Date(stripeEvent.created * 1000),
    };

    // Extract data based on event type
    const data = stripeEvent.data.object as any;

    if (stripeEvent.type === 'checkout.session.completed') {
      event.userId = data.client_reference_id || data.metadata?.userId;
      event.plan = data.metadata?.plan;
      event.sessionId = data.id;
      event.subscriptionId = data.subscription;
      event.status = PaymentStatus.SUCCEEDED;
    } else if (stripeEvent.type.startsWith('payment_intent')) {
      event.status =
        stripeEvent.type === 'payment_intent.succeeded'
          ? PaymentStatus.SUCCEEDED
          : PaymentStatus.FAILED;
      event.metadata = data.metadata;
    } else if (stripeEvent.type.startsWith('customer.subscription')) {
      event.subscriptionId = data.id;
      event.userId = data.metadata?.userId;
      event.plan = data.metadata?.plan;
      event.metadata = data.metadata;
    }

    return event;
  }

  async handleWebhook(input: WebhookHandlerInput): Promise<WebhookEventResult> {
    const stripe = this.ensureConfigured();

    // Verify webhook signature if webhook secret is configured
    let stripeEvent: Stripe.Event;

    if (this.webhookSecret) {
      try {
        stripeEvent = stripe.webhooks.constructEvent(
          input.body,
          input.signature,
          this.webhookSecret,
        );
      } catch (error: any) {
        throw new PaymentsError(
          PaymentsErrorCode.INVALID_SIGNATURE,
          `Webhook signature verification failed: ${error.message}`,
          error,
        );
      }
    } else {
      // If no webhook secret, parse the body directly (not recommended for production)
      try {
        stripeEvent =
          typeof input.body === 'string'
            ? JSON.parse(input.body)
            : JSON.parse(input.body.toString());
      } catch (error: any) {
        throw new PaymentsError(
          PaymentsErrorCode.INVALID_INPUT,
          'Invalid webhook payload',
          error,
        );
      }
    }

    // Normalize to domain event
    const event = this.normalizeStripeEvent(stripeEvent);

    // TODO: Implement idempotency check
    // For now, assume not processed
    const alreadyProcessed = false;

    return {
      event,
      alreadyProcessed,
      actions: ['Event normalized from Stripe webhook'],
    };
  }
}
