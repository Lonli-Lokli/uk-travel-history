'use client';

import { observer } from 'mobx-react-lite';
import { paymentStore } from '@uth/stores';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
} from '@uth/ui';
import { CreditCard, Loader2, CheckCircle2, SparklesIcon } from 'lucide-react';

export const PaymentModal = observer(() => {
  const isOpen = paymentStore.isPaymentModalOpen;
  const billingPeriod = paymentStore.billingPeriod;
  const isProcessing = paymentStore.isProcessing;
  const error = paymentStore.error;
  const monthlyPrice = paymentStore.monthlyPrice;
  const pricePerMonth = paymentStore.pricePerMonth;
  const annualPrice = paymentStore.annualPrice;
  const annualSavings = paymentStore.annualSavings;

  const premiumFeatures = [
    'Unlimited Excel exports with all calculations',
    'Professional PDF reports for visa applications',
    'Employer confirmation letter generator',
    'Cloud sync across all your devices',
    'Advanced travel analytics and insights',
    'Priority email support',
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => paymentStore.setPaymentModalOpen(open)}
    >
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <SparklesIcon className="h-6 w-6 text-yellow-500" />
            Subscribe to Get Started
          </DialogTitle>
          <DialogDescription>
            All features included with your subscription. No hidden costs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pricing Toggle */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg border border-gray-300 p-1 bg-gray-50">
              <button
                onClick={() => paymentStore.setBillingPeriod('monthly')}
                disabled={isProcessing}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => paymentStore.setBillingPeriod('annual')}
                disabled={isProcessing}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'annual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Annual
                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                  Save {annualSavings}%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Display */}
          <div className="text-center">
            <div className="text-5xl font-bold text-gray-900">
              ${pricePerMonth.toFixed(2)}
              <span className="text-lg font-normal text-gray-600">/month</span>
            </div>
            {billingPeriod === 'annual' && (
              <p className="text-sm text-gray-600 mt-2">
                Billed ${annualPrice.toFixed(2)}/year (2 months free!)
              </p>
            )}
          </div>

          {/* Features List */}
          <div className="border-2 border-blue-600 rounded-lg p-6 bg-blue-50">
            <h3 className="text-lg font-semibold mb-4 text-blue-900 flex items-center gap-2">
              Everything Included
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                All Features
              </span>
            </h3>
            <ul className="space-y-3">
              {premiumFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-blue-900">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">{error}</p>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => paymentStore.closePaymentModal()}
              disabled={isProcessing}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => paymentStore.handleSubscribe()}
              disabled={isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirecting to Stripe...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Subscribe Now
                </>
              )}
            </Button>
          </div>

          {/* Info about next steps */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center mb-3">
              After payment, you'll create your secure account with passkey
              authentication
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                🔒 Secure payment via Stripe
              </span>
              <span className="flex items-center gap-1">✓ Cancel anytime</span>
              <span className="flex items-center gap-1">
                💯 30-day money-back
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

PaymentModal.displayName = 'PaymentModal';
