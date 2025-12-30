// Payment Store
// Manages payment and registration flow logic

import { makeAutoObservable, runInAction } from 'mobx';
import { authStore } from './authStore';
import { logger } from '@uth/utils';

type BillingPeriod = 'monthly' | 'annual' | 'once';

interface PriceData {
  id: string;
  amount: number;
  currency: string;
}

interface StripePrices {
  monthly: PriceData;
  annual: PriceData;
  lifetime: PriceData;
}

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

  // Price Data (GBP fallbacks)
  private _monthlyPrice = 3.9;
  private _annualPrice = 39.9;
  private _lifetimePrice = 69.9;
  private _currency = 'gbp';
  pricesLoaded = false;

  constructor() {
    makeAutoObservable(this);
    this.fetchPrices(); // Load prices on initialization
  }

  /**
   * Fetch prices from API
   */
  async fetchPrices(): Promise<void> {
    try {
      const response = await fetch('/api/stripe/prices');
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }

      const prices: StripePrices = await response.json();

      runInAction(() => {
        this._monthlyPrice = prices.monthly.amount;
        this._annualPrice = prices.annual.amount;
        this._lifetimePrice = prices.lifetime.amount;
        this._currency = prices.monthly.currency; // All prices should have same currency
        this.pricesLoaded = true;
      });
    } catch (err) {
      logger.error('Failed to fetch prices, using fallback values', err);
      // Keep fallback values
      runInAction(() => {
        this.pricesLoaded = true;
      });
    }
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
    return this._monthlyPrice;
  }

  /**
   * Get annual price
   */
  get annualPrice(): number {
    return this._annualPrice;
  }

  /**
   * Get lifetime price
   */
  get lifetimePrice(): number {
    return this._lifetimePrice;
  }

  /**
   * Get currency code
   */
  get currency(): string {
    return this._currency;
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
      ((this.monthlyPrice * 12 - this.annualPrice) / (this.monthlyPrice * 12)) *
        100,
    );
  }

  /**
   * Handle subscribe button click
   * Creates Stripe checkout session and redirects
   * @param useAuthenticated - If true, use authenticated checkout (requires signed-in user)
   */
  async handleSubscribe(useAuthenticated = false): Promise<void> {
    this.isProcessing = true;
    this.error = null;

    try {
      // Use authenticated or anonymous checkout based on parameter
      const endpoint = useAuthenticated
        ? '/api/stripe/create-checkout'
        : '/api/stripe/create-anonymous-checkout';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingPeriod: this.billingPeriod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId, url } = await response.json();

      // Track checkout initiation
      logger.addBreadcrumb('User initiated checkout', 'payment', {
        billingPeriod: this.billingPeriod,
        sessionId,
      });

      // Redirect to Stripe Checkout URL
      // Modern approach: redirect directly to the URL (redirectToCheckout is deprecated)
      if (!url) {
        throw new Error('No checkout URL returned from server');
      }

      window.location.href = url;
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to start checkout';
        this.isProcessing = false;
      });

      // Track error in Sentry
      logger.error('Failed to create checkout session', err, {
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
          this.sessionValidationError = data.alreadyUsed
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

      logger.error('Failed to validate session', err, {
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
      logger.addBreadcrumb(
        'Registration completed successfully',
        'registration',
        {
          userId,
        },
      );
    } catch (err) {
      runInAction(() => {
        this.registrationError =
          err instanceof Error
            ? err.message
            : 'Failed to complete registration';
        this.isCompletingRegistration = false;
      });

      logger.error('Failed to complete registration', err, {
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
