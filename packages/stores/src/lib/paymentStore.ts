// Payment Store
// Manages payment and registration flow logic

import { makeAutoObservable, runInAction } from 'mobx';
import { authStore } from './authStore';
import * as Sentry from '@sentry/nextjs';

type BillingPeriod = 'monthly' | 'annual';

class PaymentStore {
  // Payment Modal State
  isPaymentModalOpen = false;
  billingPeriod: BillingPeriod = 'monthly';
  isProcessing = false;
  error: string | null = null;

  // Registration State
  isValidatingSession = false;
  sessionValidationError: string | null = null;
  isCompletingRegistration = false;
  registrationError: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Open the payment modal
   */
  openPaymentModal(): void {
    this.isPaymentModalOpen = true;
    this.error = null;
  }

  /**
   * Close the payment modal
   */
  closePaymentModal(): void {
    this.isPaymentModalOpen = false;
    this.error = null;
  }

  /**
   * Set payment modal open state
   */
  setPaymentModalOpen(open: boolean): void {
    this.isPaymentModalOpen = open;
    if (!open) {
      this.error = null;
    }
  }

  /**
   * Set billing period (monthly or annual)
   */
  setBillingPeriod(period: BillingPeriod): void {
    this.billingPeriod = period;
  }

  /**
   * Get monthly price
   */
  get monthlyPrice(): number {
    return 9.99;
  }

  /**
   * Get annual price
   */
  get annualPrice(): number {
    return 99.0;
  }

  /**
   * Get price per month for display
   */
  get pricePerMonth(): number {
    return this.billingPeriod === 'monthly'
      ? this.monthlyPrice
      : this.annualPrice / 12;
  }

  /**
   * Get annual savings percentage
   */
  get annualSavings(): number {
    return Math.round(
      ((this.monthlyPrice * 12 - this.annualPrice) /
        (this.monthlyPrice * 12)) *
        100,
    );
  }

  /**
   * Handle subscribe button click
   * Creates Stripe checkout session and redirects
   */
  async handleSubscribe(): Promise<void> {
    this.isProcessing = true;
    this.error = null;

    try {
      // Get price ID from environment variables
      const priceId =
        this.billingPeriod === 'monthly'
          ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY
          : process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL;

      if (!priceId) {
        throw new Error('Stripe price ID not configured');
      }

      // Create anonymous checkout session
      const response = await fetch('/api/stripe/create-anonymous-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          billingPeriod: this.billingPeriod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Load Stripe.js
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripePublishableKey =
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (!stripePublishableKey) {
        throw new Error('Stripe publishable key not configured');
      }

      const stripe = await loadStripe(stripePublishableKey);

      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      // Track checkout initiation
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'User initiated checkout',
        level: 'info',
        data: {
          billingPeriod: this.billingPeriod,
          sessionId,
        },
      });

      // Redirect to Stripe Checkout
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw stripeError;
      }

      // If we reach here, redirect failed - set processing to false
      runInAction(() => {
        this.isProcessing = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to start checkout';
        this.isProcessing = false;
      });

      // Track error in Sentry
      Sentry.captureException(err, {
        tags: {
          service: 'payment',
          operation: 'create_checkout',
        },
        contexts: {
          payment: {
            billingPeriod: this.billingPeriod,
          },
        },
      });

      throw err;
    }
  }

  /**
   * Validate Stripe session ID (called on /registration page)
   */
  async validateSession(sessionId: string): Promise<{
    isValid: boolean;
    subscriptionId?: string;
    customerId?: string;
  }> {
    this.isValidatingSession = true;
    this.sessionValidationError = null;

    try {
      const response = await fetch('/api/stripe/validate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to validate session');
      }

      const data = await response.json();

      if (data.paymentStatus !== 'paid' || data.alreadyUsed) {
        runInAction(() => {
          this.isValidatingSession = false;
          this.sessionValidationError =
            data.alreadyUsed
              ? 'This payment link has already been used'
              : 'Payment not completed';
        });

        return { isValid: false };
      }

      runInAction(() => {
        this.isValidatingSession = false;
      });

      return {
        isValid: true,
        subscriptionId: data.subscriptionId,
        customerId: data.customerId,
      };
    } catch (err) {
      runInAction(() => {
        this.sessionValidationError =
          err instanceof Error ? err.message : 'Failed to validate payment';
        this.isValidatingSession = false;
      });

      Sentry.captureException(err, {
        tags: {
          service: 'payment',
          operation: 'validate_session',
        },
        contexts: {
          payment: {
            sessionId,
          },
        },
      });

      throw err;
    }
  }

  /**
   * Complete registration by linking Firebase user to Stripe subscription
   */
  async completeRegistration(sessionId: string): Promise<void> {
    this.isCompletingRegistration = true;
    this.registrationError = null;

    try {
      // Get user ID from auth store
      const userId = authStore.user?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get Firebase ID token
      const token = await authStore.getIdToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Call complete-registration API
      const response = await fetch('/api/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete registration');
      }

      runInAction(() => {
        this.isCompletingRegistration = false;
      });

      // Track successful registration
      Sentry.addBreadcrumb({
        category: 'registration',
        message: 'Registration completed successfully',
        level: 'info',
        data: {
          userId,
        },
      });
    } catch (err) {
      runInAction(() => {
        this.registrationError =
          err instanceof Error ? err.message : 'Failed to complete registration';
        this.isCompletingRegistration = false;
      });

      Sentry.captureException(err, {
        tags: {
          service: 'registration',
          operation: 'complete_registration',
        },
        contexts: {
          registration: {
            sessionId,
            userId: authStore.user?.uid,
          },
        },
      });

      throw err;
    }
  }

  /**
   * Reset registration state
   */
  resetRegistrationState(): void {
    this.isValidatingSession = false;
    this.sessionValidationError = null;
    this.isCompletingRegistration = false;
    this.registrationError = null;
  }
}

export const paymentStore = new PaymentStore();
