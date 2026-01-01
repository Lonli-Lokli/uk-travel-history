'use client';

import { observer } from 'mobx-react-lite';
import { Button, UIIcon } from '@uth/ui';
import { paymentStore } from '@uth/stores';
import { useState } from 'react';
import Link from 'next/link';

interface AccountPageClientProps {
  user: {
    email: string;
    subscriptionTier: string;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
  };
}

export const AccountPageClient = observer(({ user }: AccountPageClientProps) => {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const isPremium = ['monthly', 'yearly', 'lifetime'].includes(
    user.subscriptionTier,
  );
  const isActive = user.subscriptionStatus === 'active';

  const handleUpgrade = () => {
    paymentStore.openPaymentModal();
  };

  const handleManageSubscription = async () => {
    if (!user.stripeCustomerId) return;

    setIsLoadingPortal(true);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: user.stripeCustomerId,
          returnUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getTierDisplayName = (tier: string) => {
    const tierMap: Record<string, string> = {
      free: 'Free',
      monthly: 'Premium (Monthly)',
      yearly: 'Premium (Yearly)',
      lifetime: 'Premium (Lifetime)',
    };
    return tierMap[tier] || tier;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;

    const statusStyles: Record<
      string,
      { bg: string; text: string; label: string }
    > = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
      past_due: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Past Due' },
      canceled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Canceled' },
      trialing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Trial' },
      incomplete: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Incomplete' },
      unpaid: { bg: 'bg-red-100', text: 'text-red-800', label: 'Unpaid' },
      paused: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Paused' },
    };

    const style = statusStyles[status] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: status,
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
      >
        {style.label}
      </span>
    );
  };

  return (
    <div className="bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/travel"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <UIIcon iconName="arrow-left" className="h-4 w-4 mr-1" />
            Back to Travel Tracker
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-slate-600 mt-2">
            Manage your subscription and account preferences
          </p>
        </div>

        {/* Account Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Account Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Email</span>
              <span className="text-sm font-medium text-slate-900">
                {user.email}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Subscription
          </h2>

          <div className="space-y-4">
            {/* Current Plan */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div>
                <p className="text-sm text-slate-600">Current Plan</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">
                  {getTierDisplayName(user.subscriptionTier)}
                </p>
              </div>
              {user.subscriptionStatus && (
                <div>{getStatusBadge(user.subscriptionStatus)}</div>
              )}
            </div>

            {/* Status Message for Incomplete */}
            {user.subscriptionStatus === 'incomplete' && (
              <div className="pb-4 border-b border-slate-200">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <UIIcon
                      iconName="alert-circle"
                      className="h-5 w-5 text-orange-600 mr-3 flex-shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-orange-900 mb-1">
                        Payment Confirmation Required
                      </p>
                      <p className="text-sm text-orange-800">
                        Your subscription payment is being processed. This usually happens when additional authentication (like 3D Secure) is required. Once the payment is confirmed, your subscription will automatically activate.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Renewal Date */}
            {isPremium && user.currentPeriodEnd && isActive && (
              <div className="pb-4 border-b border-slate-200">
                <p className="text-sm text-slate-600">
                  {user.subscriptionTier === 'lifetime'
                    ? 'Access'
                    : 'Renews on'}
                </p>
                <p className="text-sm font-medium text-slate-900 mt-1">
                  {user.subscriptionTier === 'lifetime'
                    ? 'Lifetime Access'
                    : formatDate(user.currentPeriodEnd)}
                </p>
              </div>
            )}

            {/* Features */}
            <div className="pb-4 border-b border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Features</p>
              <ul className="space-y-2">
                <li className="flex items-start text-sm text-slate-700">
                  <UIIcon
                    iconName="check"
                    className="h-5 w-5 text-green-600 mr-2 flex-shrink-0"
                  />
                  <span>Travel history parsing from PDF</span>
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <UIIcon
                    iconName="check"
                    className="h-5 w-5 text-green-600 mr-2 flex-shrink-0"
                  />
                  <span>Manual trip entry and editing</span>
                </li>
                <li
                  className={`flex items-start text-sm ${isPremium ? 'text-slate-700' : 'text-slate-400'}`}
                >
                  <UIIcon
                    iconName={isPremium ? 'check' : 'circle-x'}
                    className={`h-5 w-5 mr-2 flex-shrink-0 ${isPremium ? 'text-green-600' : 'text-slate-400'}`}
                  />
                  <span>Excel export (ILR format)</span>
                </li>
                <li
                  className={`flex items-start text-sm ${isPremium ? 'text-slate-700' : 'text-slate-400'}`}
                >
                  <UIIcon
                    iconName={isPremium ? 'check' : 'circle-x'}
                    className={`h-5 w-5 mr-2 flex-shrink-0 ${isPremium ? 'text-green-600' : 'text-slate-400'}`}
                  />
                  <span>Full backup export</span>
                </li>
                <li
                  className={`flex items-start text-sm ${isPremium ? 'text-slate-700' : 'text-slate-400'}`}
                >
                  <UIIcon
                    iconName={isPremium ? 'check' : 'circle-x'}
                    className={`h-5 w-5 mr-2 flex-shrink-0 ${isPremium ? 'text-green-600' : 'text-slate-400'}`}
                  />
                  <span>Priority support</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {!isPremium ? (
                <Button
                  onClick={handleUpgrade}
                  className="w-full"
                  size="lg"
                >
                  <UIIcon iconName="arrow-up" className="h-5 w-5 mr-2" />
                  Upgrade to Premium
                </Button>
              ) : (
                user.stripeCustomerId &&
                user.subscriptionTier !== 'lifetime' && (
                  <Button
                    onClick={handleManageSubscription}
                    variant="outline"
                    className="w-full"
                    disabled={isLoadingPortal}
                  >
                    {isLoadingPortal ? (
                      <>
                        <UIIcon
                          iconName="loading"
                          className="h-4 w-4 mr-2 animate-spin"
                        />
                        Loading...
                      </>
                    ) : (
                      <>
                        <UIIcon iconName="pencil" className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </>
                    )}
                  </Button>
                )
              )}

              {!isPremium && (
                <p className="text-xs text-slate-500 text-center mt-3">
                  Unlock all features with a Premium subscription
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-600">
            Need help?{' '}
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com'}`}
              className="text-primary hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
});

AccountPageClient.displayName = 'AccountPageClient';
