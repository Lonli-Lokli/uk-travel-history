'use client';

import { Button, UIIcon } from '@uth/ui';
import { useState } from 'react';
import Link from 'next/link';

interface AccountErrorFallbackProps {
  userId: string;
  email: string;
}

export function AccountErrorFallback({
  userId,
  email,
}: AccountErrorFallbackProps) {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleProvision = async () => {
    setIsProvisioning(true);
    setError(null);

    try {
      const response = await fetch('/api/user/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to provision user');
      }

      setSuccess(true);

      // Reload the page after successful provisioning
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    } finally {
      setIsProvisioning(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <UIIcon iconName="check" className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Account Provisioned!
            </h2>
            <p className="text-slate-600 mb-4">
              Your account has been set up successfully. Reloading page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <UIIcon
              iconName="alert-triangle"
              className="h-8 w-8 text-yellow-600"
            />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Account Setup Incomplete
          </h2>
          <p className="text-slate-600 mb-6">
            Your authentication was successful, but your account data is missing
            from our database. This is unusual and may indicate a technical
            issue during account setup.
          </p>

          <div className="w-full bg-slate-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-slate-700 mb-2">
              <span className="font-medium">Email:</span> {email}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">User ID:</span>{' '}
              <code className="text-xs bg-white px-1 py-0.5 rounded">
                {userId}
              </code>
            </p>
          </div>

          {error && (
            <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="w-full space-y-3">
            <Button
              onClick={handleProvision}
              disabled={isProvisioning}
              className="w-full"
              size="lg"
            >
              {isProvisioning ? (
                <>
                  <UIIcon
                    iconName="loading"
                    className="h-5 w-5 mr-2 animate-spin"
                  />
                  Setting up your account...
                </>
              ) : (
                <>
                  <UIIcon iconName="reload" className="h-5 w-5 mr-2" />
                  Set Up Account Now
                </>
              )}
            </Button>

            <Link href="/travel" className="block">
              <Button variant="outline" className="w-full">
                <UIIcon iconName="arrow-left" className="h-4 w-4 mr-2" />
                Back to Travel Tracker
              </Button>
            </Link>
          </div>

          <p className="text-xs text-slate-500 mt-6">
            If this issue persists, please contact support at{' '}
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com'}`}
              className="text-primary hover:underline"
            >
              {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com'}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
