'use client';

import { observer } from 'mobx-react-lite';
import { Sheet } from 'react-modal-sheet';
import { Button, UIIcon } from '@uth/ui';
import { paymentStore, authStore } from '@uth/stores';
import { logger } from '@uth/utils';

// Helper function to format currency
const formatCurrency = (amount: number, currency: string): string => {
  const symbol = currency.toLowerCase() === 'gbp' ? '£' : '$';
  return `${symbol}${amount.toFixed(2)}`;
};

export const PaymentModal = observer(() => {
  const { isPaymentModalOpen, billingPeriod, isProcessing, error } = 
    paymentStore;
  const isAuthenticated = !!authStore.user;
  const areChangesAllowed = !isProcessing && isAuthenticated;

  const handleClose = () => {
    if (!isProcessing) {
      paymentStore.closePaymentModal();
    }
  };

  const handleSubscribe = async () => {
    try {
      // Use authenticated checkout if user is signed in
      await paymentStore.handleSubscribe();
    } catch (err) {
      // Error is already handled in the store
      logger.error('Subscription error:', err);
    }
  };

  const monthlyPrice = paymentStore.monthlyPrice;
  const annualPrice = paymentStore.annualPrice;
  const lifetimePrice = paymentStore.lifetimePrice;
  const currency = paymentStore.currency;
  const pricePerMonth = paymentStore.pricePerMonth;
  const annualSavings = paymentStore.annualSavings;

  // Calculate lifetime savings (vs paying annually for 3 years)
  const lifetimeSavings = Math.round(
    ((annualPrice * 3 - lifetimePrice) / (annualPrice * 3)) * 100,
  );

  return (
    <Sheet isOpen={isPaymentModalOpen} onClose={handleClose} detent="content">
      <Sheet.Container className="!rounded-t-2xl">
        <Sheet.Header className="!h-10" />
        <Sheet.Content>
          <div className="px-4 pb-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-2">Upgrade to Premium</h2>
            <p className="text-sm text-slate-600 mb-4">
              Unlock all features with a Premium subscription
            </p>

            <div className="space-y-6">
          {/* Pricing Options */}
          <div className="space-y-3">
            {/* Monthly Option */}
            <button
              type="button"
              onClick={() => paymentStore.setBillingPeriod('monthly')}
              disabled={isProcessing}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                billingPeriod === 'monthly'
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 hover:border-slate-300'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Monthly</div>
                  <div className="text-sm text-slate-600">
                    {formatCurrency(monthlyPrice, currency)}/month
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    billingPeriod === 'monthly'
                      ? 'border-primary bg-primary'
                      : 'border-slate-300'
                  }`}
                >
                  {billingPeriod === 'monthly' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>

            {/* Annual Option */}
            <button
              type="button"
              onClick={() => paymentStore.setBillingPeriod('annual')}
              disabled={isProcessing}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left relative ${
                billingPeriod === 'annual'
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 hover:border-slate-300'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Savings Badge */}
              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                Save {annualSavings}%
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Annual</div>
                  <div className="text-sm text-slate-600">
                    {formatCurrency(annualPrice, currency)}/year
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatCurrency(pricePerMonth, currency)}/month
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    billingPeriod === 'annual'
                      ? 'border-primary bg-primary'
                      : 'border-slate-300'
                  }`}
                >
                  {billingPeriod === 'annual' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>

            {/* Lifetime Option */}
            <button
              type="button"
              onClick={() => paymentStore.setBillingPeriod('once')}
              disabled={isProcessing}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left relative ${
                billingPeriod === 'once'
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 hover:border-slate-300'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Best Value Badge */}
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                Best Value
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Lifetime</div>
                  <div className="text-sm text-slate-600">
                    {formatCurrency(lifetimePrice, currency)} one-time
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Save {lifetimeSavings}% vs 3 years annual
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    billingPeriod === 'once'
                      ? 'border-primary bg-primary'
                      : 'border-slate-300'
                  }`}
                >
                  {billingPeriod === 'once' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Features List */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900 mb-3">
              Premium includes:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start text-sm text-slate-700">
                <UIIcon
                  iconName="check"
                  className="h-5 w-5 text-green-600 mr-2 flex-shrink-0"
                />
                <span>Excel export (ILR format)</span>
              </li>
              <li className="flex items-start text-sm text-slate-700">
                <UIIcon
                  iconName="check"
                  className="h-5 w-5 text-green-600 mr-2 flex-shrink-0"
                />
                <span>Full backup export</span>
              </li>
              <li className="flex items-start text-sm text-slate-700">
                <UIIcon
                  iconName="check"
                  className="h-5 w-5 text-green-600 mr-2 flex-shrink-0"
                />
                <span>Priority support</span>
              </li>
              <li className="flex items-start text-sm text-slate-700">
                <UIIcon
                  iconName="check"
                  className="h-5 w-5 text-green-600 mr-2 flex-shrink-0"
                />
                <span>All future features</span>
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Subscribe Button */}
          <Button
            onClick={handleSubscribe}
            disabled={!areChangesAllowed}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <UIIcon
                  iconName="loading"
                  className="h-5 w-5 mr-2 animate-spin"
                />
                Processing...
              </>
            ) : isAuthenticated ? (
              <>
                <UIIcon iconName="arrow-up" className="h-5 w-5 mr-2" />
                Subscribe Now
              </>
            ) : (
              <>
                <UIIcon iconName="x" className="h-5 w-5 mr-2" />
                Sign In first
              </>)}
          </Button>

              <p className="text-xs text-center text-slate-500">
                Secure payment processed by Stripe.
                {billingPeriod !== 'once' && ' Cancel anytime.'}
              </p>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop />
    </Sheet>
  );
});

PaymentModal.displayName = 'PaymentModal';
