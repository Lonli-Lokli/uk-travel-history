/**
 * Stripe implementation of PaymentsServerProvider
 */

import Stripe from 'stripe';
import { logger } from '@uth/utils';
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
      logger.warn(
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
          process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly',
        [PaymentPlan.PREMIUM_ANNUAL]:
          process.env.STRIPE_YEARLY_PRICE_ID || 'price_yearly',
        [PaymentPlan.PREMIUM_ONCE]:
          process.env.STRIPE_LIFETIME_PRICE_ID || 'price_lifetime',
      };

      // Load webhook secret
      this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!this.webhookSecret) {
        logger.warn(
          'Stripe webhook secret not configured. Webhook signature verification will be skipped.',
        );
      }

      this.configured = true;
    } catch (error) {
      logger.error('Failed to initialize Stripe:', error);
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

  getPriceIds(): PriceIds {
    return {
      PREMIUM_MONTHLY: this.priceIds[PaymentPlan.PREMIUM_MONTHLY] || '',
      PREMIUM_ANNUAL: this.priceIds[PaymentPlan.PREMIUM_ANNUAL] || '',
      PREMIUM_ONCE: this.priceIds[PaymentPlan.PREMIUM_ONCE] || '',
    };
  }

  async getPriceDetails(): Promise<PriceDetails> {
    const stripe = this.ensureConfigured();

    try {
      const priceIds = this.getPriceIds();

      // Fetch all prices in parallel
      const [monthlyPrice, annualPrice, lifetimePrice] = await Promise.all([
        stripe.prices.retrieve(priceIds.PREMIUM_MONTHLY),
        stripe.prices.retrieve(priceIds.PREMIUM_ANNUAL),
        stripe.prices.retrieve(priceIds.PREMIUM_ONCE),
      ]);

      return {
        monthly: {
          id: monthlyPrice.id,
          unitAmount: monthlyPrice.unit_amount || 0,
          currency: monthlyPrice.currency,
          amount: (monthlyPrice.unit_amount || 0) / 100,
        },
        annual: {
          id: annualPrice.id,
          unitAmount: annualPrice.unit_amount || 0,
          currency: annualPrice.currency,
          amount: (annualPrice.unit_amount || 0) / 100,
        },
        lifetime: {
          id: lifetimePrice.id,
          unitAmount: lifetimePrice.unit_amount || 0,
          currency: lifetimePrice.currency,
          amount: (lifetimePrice.unit_amount || 0) / 100,
        },
      };
    } catch (error) {
      logger.error('Failed to retrieve price details from Stripe', error);
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        'Failed to retrieve price details',
        error,
      );
    }
  }

  async retrieveCheckoutSession(
    sessionId: string,
  ): Promise<CheckoutSessionDetails> {
    const stripe = this.ensureConfigured();

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return {
        id: session.id,
        paymentStatus: session.payment_status,
        customerId: session.customer as string | undefined,
        subscriptionId: session.subscription as string | undefined,
        metadata: session.metadata || undefined,
        customerEmail:
          session.customer_email ||
          session.customer_details?.email ||
          undefined,
      };
    } catch (error: unknown) {
      const stripeError = error as Stripe.StripeRawError;
      if (stripeError.code === 'resource_missing') {
        throw new PaymentsError(
          PaymentsErrorCode.NOT_FOUND,
          `Checkout session not found: ${sessionId}`,
          error,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        `Failed to retrieve checkout session: ${errorMessage}`,
        error,
      );
    }
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionDetails> {
    const stripe = this.ensureConfigured();

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      return {
        id: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        priceId: subscription.items.data[0]?.price.id,
        metadata: subscription.metadata || undefined,
      };
    } catch (error: unknown) {
      const stripeError = error as Stripe.StripeRawError;
      if (stripeError.code === 'resource_missing') {
        throw new PaymentsError(
          PaymentsErrorCode.NOT_FOUND,
          `Subscription not found: ${subscriptionId}`,
          error,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        `Failed to retrieve subscription: ${errorMessage}`,
        error,
      );
    }
  }

  constructWebhookEvent(
    body: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    const stripe = this.ensureConfigured();

    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentsError(
        PaymentsErrorCode.INVALID_SIGNATURE,
        `Webhook signature verification failed: ${errorMessage}`,
        error,
      );
    }
  }

  async createCheckoutSession(
    intent: CheckoutIntent,
  ): Promise<CheckoutSessionRef> {
    const stripe = this.ensureConfigured();

    try {
      const priceId = this.getPriceId(intent.plan);

      // Build session parameters based on whether this is authenticated or anonymous
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
        metadata: {
          plan: intent.plan,
          ...intent.metadata,
        },
      };

      // Authenticated user: set customer_email and client_reference_id
      if (intent.userId) {
        sessionParams.client_reference_id = intent.userId;
        sessionParams.metadata!.userId = intent.userId;

        if (intent.customerEmail) {
          sessionParams.customer_email = intent.customerEmail;
        }
      }

      // Add subscription metadata if subscription mode
      if (intent.plan !== PaymentPlan.PREMIUM_ONCE && intent.userId) {
        sessionParams.subscription_data = {
          metadata: {
            userId: intent.userId,
          },
        };
      } else if (intent.plan !== PaymentPlan.PREMIUM_ONCE) {
        // Anonymous subscription
        sessionParams.subscription_data = {
          metadata: {
            isPreRegistration: 'true',
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

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
    } catch (error: unknown) {
      if (error instanceof PaymentsError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        `Failed to create checkout session: ${errorMessage}`,
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
    } catch (error: unknown) {
      const stripeError = error as Stripe.StripeRawError;
      if (stripeError.code === 'resource_missing') {
        throw new PaymentsError(
          PaymentsErrorCode.NOT_FOUND,
          `Checkout session not found: ${sessionId}`,
          error,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        `Failed to verify checkout session: ${errorMessage}`,
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

    // Extract data based on event type with proper typing
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      event.userId =
        session.client_reference_id || session.metadata?.userId || undefined;
      event.plan = session.metadata?.plan as PaymentPlan | undefined;
      event.sessionId = session.id;
      event.subscriptionId = session.subscription as string | undefined;
      event.status = PaymentStatus.SUCCEEDED;
    } else if (stripeEvent.type.startsWith('payment_intent')) {
      const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;
      event.status =
        stripeEvent.type === 'payment_intent.succeeded'
          ? PaymentStatus.SUCCEEDED
          : PaymentStatus.FAILED;
      event.metadata = paymentIntent.metadata as
        | Record<string, unknown>
        | undefined;
    } else if (stripeEvent.type.startsWith('customer.subscription')) {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      event.subscriptionId = subscription.id;
      event.userId = subscription.metadata?.userId || undefined;
      event.plan = subscription.metadata?.plan as PaymentPlan | undefined;
      event.metadata = subscription.metadata as
        | Record<string, unknown>
        | undefined;
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
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new PaymentsError(
          PaymentsErrorCode.INVALID_SIGNATURE,
          `Webhook signature verification failed: ${errorMessage}`,
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
      } catch (error: unknown) {
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

  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<string> {
    if (!this.stripe) {
      throw new PaymentsError(
        PaymentsErrorCode.CONFIG_ERROR,
        'Stripe not initialized',
      );
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error: unknown) {
      throw new PaymentsError(
        PaymentsErrorCode.PROVIDER_ERROR,
        'Failed to create portal session',
        error,
      );
    }
  }
}
