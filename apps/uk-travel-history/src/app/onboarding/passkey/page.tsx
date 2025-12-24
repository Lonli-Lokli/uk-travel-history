'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@uth/ui';
import { logger } from '@uth/utils';

export default function PasskeyOnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPasskey, setHasPasskey] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      // Check if user already has a passkey enrolled
      const passkeyFactors = user.passkeys || [];
      setHasPasskey(passkeyFactors.length > 0);

      // If they already have a passkey, mark as enrolled and redirect
      if (passkeyFactors.length > 0) {
        markPasskeyEnrolled();
      }
    }
  }, [isLoaded, user]);

  const markPasskeyEnrolled = async () => {
    try {
      // Update the users table in Supabase
      const response = await fetch('/api/user/update-passkey-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enrolled: true }),
      });

      if (response.ok) {
        // Redirect to the main app
        router.push('/travel');
      }
    } catch (err) {
      logger.error('Failed to update passkey status', err);
    }
  };

  const handleEnrollPasskey = async () => {
    if (!user) return;

    setIsEnrolling(true);
    setError(null);

    try {
      // Create a passkey using Clerk's API
      await user.createPasskey();

      // Mark as enrolled
      await markPasskeyEnrolled();
    } catch (err: any) {
      logger.error('Passkey enrollment failed', err);
      setError(
        err.message ||
          'Failed to enroll passkey. Please try again or contact support.',
      );
      setIsEnrolling(false);
    }
  };

  const handleSkip = () => {
    // For now, we require passkeys, so show a message
    setError(
      'Passkey enrollment is required to access the application. This ensures your account security.',
    );
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push('/claim');
    return null;
  }

  if (hasPasskey && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-600">Completing setup...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Secure Your Account
            </h1>
            <p className="text-slate-600">
              Set up a passkey for secure, passwordless access
            </p>
          </div>

          <div className="mb-6 space-y-4 text-sm text-slate-600">
            <div className="flex items-start">
              <svg
                className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                <strong>More secure</strong> than passwords - uses biometrics or
                device authentication
              </span>
            </div>
            <div className="flex items-start">
              <svg
                className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                <strong>Faster sign-in</strong> - no need to remember or type
                passwords
              </span>
            </div>
            <div className="flex items-start">
              <svg
                className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>
                <strong>Phishing resistant</strong> - passkeys can't be stolen
                or intercepted
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleEnrollPasskey}
              disabled={isEnrolling}
              className="w-full"
              size="lg"
            >
              {isEnrolling ? 'Setting up passkey...' : 'Set Up Passkey'}
            </Button>

            <p className="text-center text-xs text-slate-500">
              You'll be prompted to use your device's biometric authentication
              (Face ID, Touch ID, Windows Hello, etc.)
            </p>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">
          <p>
            Passkey enrollment is required to access the application. This
            ensures the security of your travel data.
          </p>
        </div>
      </div>
    </div>
  );
}
