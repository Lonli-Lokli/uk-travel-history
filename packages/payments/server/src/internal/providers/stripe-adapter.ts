/**
 * Stripe implementation of PaymentsServerProvider
 * API Version: 2025-12-15.clover
 *
 * This adapter handles Stripe API interactions and converts
 * all Stripe types to domain types before returning.
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
  ParsedWebhookEvent,
  InvoiceEventData,
  CheckoutSessionEventData,
} from '../../types/domain';
import {
  PaymentsError,
  PaymentsErrorCode,
  PaymentPlan,
  PaymentStatus,
  WebhookEventType,
  ProviderSubscriptionStatus,
} from '../../types/domain';

// ============================================================================
// Stripe to Domain Type Converters (Internal)
// ============================================================================

/**
 * Convert Stripe subscription status to domain status
 */
function mapStripeStatus(status: Stripe.Subscription.Status): ProviderSubscriptionStatus {
  const mapping: Record<Stripe.Subscription.Status, ProviderSubscriptionStatus> = {
    active: ProviderSubscriptionStatus.ACTIVE,
    past_due: ProviderSubscriptionStatus.PAST_DUE,
    canceled: ProviderSubscriptionStatus.CANCELED,
    trialing: ProviderSubscriptionStatus.TRIALING,
    incomplete: ProviderSubscriptionStatus.INCOMPLETE,
    incomplete_expired: ProviderSubscriptionStatus.INCOMPLETE_EXPIRED,
    unpaid: ProviderSubscriptionStatus.UNPAID,
    paused: ProviderSubscriptionStatus.PAUSED,
  };
  return mapping[status];
}

/**
 * Extract customer ID from polymorphic customer field
 */
function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string {
  if (!customer) return '';
  return typeof customer === 'string' ? customer : customer.id;
}

/**
 * Extract billing period from subscription items (API 2025-03-31+)
 */
function extractBillingPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
} {
  const firstItem = subscription.items?.data?.[0];
  return {
    currentPeriodStart: firstItem?.current_period_start ?? null,
    currentPeriodEnd: firstItem?.current_period_end ?? null,
  };
}

/**
 * Extract price ID from subscription's first item
 */
function extractPriceId(subscription: Stripe.Subscription): string | undefined {
  return subscription.items?.data?.[0]?.price?.id;
}

/**
 * Normalize metadata to remove null values
 */
function normalizeMetadata(
  metadata: Stripe.Metadata | null | undefined,
): Record<string, string> {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== null),
  );
}

/**
 * Convert Stripe.Subscription to SubscriptionDetails
 */
function convertSubscription(subscription: Stripe.Subscription): SubscriptionDetails {
  const { currentPeriodStart, currentPeriodEnd } = extractBillingPeriod(subscription);

  return {
    id: subscription.id,
    customerId: extractCustomerId(subscription.customer),
    status: mapStripeStatus(subscription.status),
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    pauseCollection: subscription.pause_collection
      ? {
          behavior: subscription.pause_collection.behavior,
          resumesAt: subscription.pause_collection.resumes_at,
        }
      : null,
    priceId: extractPriceId(subscription),
    metadata: normalizeMetadata(subscription.metadata),
  };
}

/**
 * Extract subscription ID from Invoice using new parent structure
 * API 2025-03-31+: invoice.subscription deprecated → invoice.parent.subscription_details.subscription
 */
function extractSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  if (invoice.parent?.type === 'subscription_details') {
    const subscription = invoice.parent.subscription_details?.subscription;
    if (subscription) {
      return typeof subscription === 'string' ? subscription : subscription.id;
    }
  }
  return null;
}

/**
 * Convert Stripe.Invoice to InvoiceEventData
 */
function convertInvoice(invoice: Stripe.Invoice): InvoiceEventData {
  return {
    id: invoice.id,
    customerId: extractCustomerId(invoice.customer),
    customerEmail: invoice.customer_email,
    subscriptionId: extractSubscriptionIdFromInvoice(invoice),
    billingReason: invoice.billing_reason,
    attemptCount: invoice.attempt_count ?? 0,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
  };
}

/**
 * Convert Stripe.Checkout.Session to CheckoutSessionEventData
 */
function convertCheckoutSession(session: Stripe.Checkout.Session): CheckoutSessionEventData {
  const metadata = normalizeMetadata(session.metadata);
  return {
    id: session.id,
    mode: session.mode,
    paymentStatus: session.payment_status,
    customerId: extractCustomerId(session.customer),
    subscriptionId:
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id,
    userId: metadata.userId || session.client_reference_id || undefined,
    customerEmail: session.customer_email || session.customer_details?.email || undefined,
    metadata,
  };
}

/**
 * Convert Stripe.Event to ParsedWebhookEvent
 */
function convertWebhookEvent(event: Stripe.Event): ParsedWebhookEvent {
  const basePayload = {
    id: event.id,
    created: event.created,
  };

  switch (event.type) {
    case 'checkout.session.completed':
      return {
        ...basePayload,
        type: 'checkout.session.completed',
        data: convertCheckoutSession(event.data.object),
      };

    case 'customer.subscription.created':
      return {
        ...basePayload,
        type: 'customer.subscription.created',
        data: convertSubscription(event.data.object),
      };

    case 'customer.subscription.updated':
      return {
        ...basePayload,
        type: 'customer.subscription.updated',
        data: convertSubscription(event.data.object),
      };

    case 'customer.subscription.deleted':
      return {
        ...basePayload,
        type: 'customer.subscription.deleted',
        data: convertSubscription(event.data.object),
      };

    case 'invoice.payment_succeeded':
      return {
        ...basePayload,
        type: 'invoice.payment_succeeded',
        data: convertInvoice(event.data.object),
      };

    case 'invoice.payment_failed':
      return {
        ...basePayload,
        type: 'invoice.payment_failed',
        data: convertInvoice(event.data.object),
      };

    default:
      return {
        ...basePayload,
        type: 'unknown',
        _type: event.type,
        data: event.data.object,
      };
  }
}

/**
 * Stripe implementation of the payments server provider
 */
export class StripePaymentsServerAdapter implements PaymentsServerProvider {
  private stripe?: Stripe;
  private webhookSecret?: string;
  private priceIds: Record<string, string> = {};
  private configured = false;

  initialize(_config: PaymentsServerProviderConfig): void {
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
        apiVersion: '2025-12-15.clover',
        typescript: true,
      });

      this.priceIds = {
        [PaymentPlan.PREMIUM_MONTHLY]:
          process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly',
        [PaymentPlan.PREMIUM_ANNUAL]:
          process.env.STRIPE_YEARLY_PRICE_ID || 'price_yearly',
        [PaymentPlan.PREMIUM_ONCE]:
          process.env.STRIPE_LIFETIME_PRICE_ID || 'price_lifetime',
      };

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

      const [monthlyPrice, annualPrice, lifetimePrice] = await Promise.all([
        stripe.prices.retrieve(priceIds.PREMIUM_MONTHLY),
        stripe.prices.retrieve(priceIds.PREMIUM_ANNUAL),
        stripe.prices.retrieve(priceIds.PREMIUM_ONCE),
      ]);

      return {
        monthly: {
          id: monthlyPrice.id,
          unitAmount: monthlyPrice.unit_amount || 10,
          currency: monthlyPrice.currency,
          amount: (monthlyPrice.unit_amount || 10) / 100,
        },
        annual: {
          id: annualPrice.id,
          unitAmount: annualPrice.unit_amount || 100,
          currency: annualPrice.currency,
          amount: (annualPrice.unit_amount || 100) / 100,
        },
        lifetime: {
          id: lifetimePrice.id,
          unitAmount: lifetimePrice.unit_amount || 1_000,
          currency: lifetimePrice.currency,
          amount: (lifetimePrice.unit_amount || 1_000) / 100,
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
        customerId:
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id,
        subscriptionId:
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id,
        metadata: session.metadata || undefined,
        customerEmail:
          session.customer_email ||
          session.customer_details?.email ||
          undefined,
      };
    } catch (error: unknown) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.code === 'resource_missing') {
          throw new PaymentsError(
            PaymentsErrorCode.NOT_FOUND,
            `Checkout session not found: ${sessionId}`,
            error,
          );
        }
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

  /**
   * Retrieve a subscription by ID
   * Converts Stripe.Subscription to domain SubscriptionDetails
   */
  async retrieveSubscription(subscriptionId: string): Promise<SubscriptionDetails> {
    const stripe = this.ensureConfigured();

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return convertSubscription(subscription);
    } catch (error: unknown) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.code === 'resource_missing') {
          throw new PaymentsError(
            PaymentsErrorCode.NOT_FOUND,
            `Subscription not found: ${subscriptionId}`,
            error,
          );
        }
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

  /**
   * Construct and verify a webhook event
   * Verifies signature and returns a domain ParsedWebhookEvent
   */
  constructWebhookEvent(
    body: string | Buffer,
    signature: string,
    secret: string,
  ): ParsedWebhookEvent {
    const stripe = this.ensureConfigured();

    try {
      const stripeEvent = stripe.webhooks.constructEvent(body, signature, secret);
      return convertWebhookEvent(stripeEvent);
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

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode:
          intent.plan === PaymentPlan.PREMIUM_ONCE ? 'payment' : 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: intent.successUrl,
        cancel_url: intent.cancelUrl,
        metadata: {
          plan: intent.plan,
        },
      };

      if (intent.userId) {
        sessionParams.client_reference_id = intent.userId;
        sessionParams.metadata!.userId = intent.userId;

        if (intent.customerEmail) {
          sessionParams.customer_email = intent.customerEmail;
          sessionParams.metadata!.email = intent.customerEmail;
        }
      }

      if (intent.plan !== PaymentPlan.PREMIUM_ONCE && intent.userId) {
        sessionParams.subscription_data = {
          metadata: {
            userId: intent.userId,
            email: intent.customerEmail || '',
          },
        };
      } else if (intent.plan !== PaymentPlan.PREMIUM_ONCE) {
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

      if (session.mode === 'subscription' && session.subscription) {
        const subscription =
          typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

        entitlement.subscriptionId = subscription.id;
        // API 2025-03-31+: billing period is on subscription items
        const firstItem = subscription.items?.data?.[0];
        if (firstItem?.current_period_end) {
          entitlement.endDate = new Date(firstItem.current_period_end * 1000);
        }
      }

      return entitlement;
    } catch (error: unknown) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.code === 'resource_missing') {
          throw new PaymentsError(
            PaymentsErrorCode.NOT_FOUND,
            `Checkout session not found: ${sessionId}`,
            error,
          );
        }
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

  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<string> {
    const stripe = this.ensureConfigured();

    try {
      const session = await stripe.billingPortal.sessions.create({
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