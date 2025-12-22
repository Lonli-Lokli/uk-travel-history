'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import { authStore, paymentStore } from '@uth/stores';
import { Button, UIIcon } from '@uth/ui';

// Separate component for content that uses useSearchParams
const RegistrationContent = observer(() => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  const isAuthenticating = authStore.isAuthenticating;
  const isPasskeySupported = authStore.isPasskeySupported;
  const authError = authStore.error;

  const isValidating = paymentStore.isValidatingSession;
  const validationError = paymentStore.sessionValidationError;
  const isCompletingRegistration = paymentStore.isCompletingRegistration;
  const registrationError = paymentStore.registrationError;

  // Validate session on mount
  useEffect(() => {
    if (!sessionId) {
      // No session ID - redirect to home
      router.push('/');
      return;
    }

    // Validate the session
    paymentStore
      .validateSession(sessionId)
      .then((result) => {
        if (!result.isValid) {
          // Invalid session - will redirect after showing error
          setTimeout(() => router.push('/'), 3000);
        }
      })
      .catch((err) => {
        console.error('Session validation error:', err);
        setTimeout(() => router.push('/'), 3000);
      });

    // Cleanup on unmount
    return () => {
      paymentStore.resetRegistrationState();
    };
  }, [sessionId, router]);

  // Handle passkey registration
  const handleCreateAccount = async () => {
    if (!sessionId) return;

    try {
      // Step 1: Create passkey account (no email required)
      await authStore.registerPasskeyAnonymous();

      // Step 2: Link subscription to Firebase user
      await paymentStore.completeRegistration(sessionId);

      // Step 3: Redirect to app
      router.push('/travel?registration=success');
    } catch (err) {
      console.error('Registration error:', err);
      // Error is already set in stores
    }
  };

  // Loading state: Validating session
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <UIIcon
            iconName="loading"
            className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4"
          />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Validating your payment...
          </h1>
          <p className="text-gray-600">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Error state: Invalid session or payment not completed
  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <UIIcon
              iconName="alert-circle"
              className="h-16 w-16 text-red-600 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Issue
            </h1>
            <p className="text-gray-600 mb-4">{validationError}</p>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Passkey not supported
  if (!isPasskeySupported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <UIIcon
              iconName="alert-circle"
              className="h-16 w-16 text-yellow-600 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Browser Not Supported
            </h1>
            <p className="text-gray-600 mb-4">
              Passkeys are not supported in your browser. Please use a modern
              browser like Chrome, Safari, or Edge.
            </p>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state: Ready to create account
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <UIIcon
                iconName="check-circle"
                className="h-10 w-10 text-green-600"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-600">
              Now let's create your secure account
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <UIIcon
                iconName="fingerprint"
                className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5"
              />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Passkey Authentication</p>
                <p>
                  Secure, password-free access using your device's biometric
                  features (Face ID, Touch ID, or Windows Hello).
                </p>
              </div>
            </div>
          </div>

          {/* Error Messages */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <UIIcon
                  iconName="alert-circle"
                  className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
                />
                <div className="text-sm text-red-900">
                  <p className="font-medium mb-1">Authentication Error</p>
                  <p>{authError}</p>
                </div>
              </div>
            </div>
          )}

          {registrationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <UIIcon
                  iconName="alert-circle"
                  className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
                />
                <div className="text-sm text-red-900">
                  <p className="font-medium mb-1">Registration Error</p>
                  <p>{registrationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Create Account Button */}
          <Button
            onClick={handleCreateAccount}
            disabled={isAuthenticating || isCompletingRegistration}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
          >
            {isAuthenticating || isCompletingRegistration ? (
              <>
                <UIIcon
                  iconName="loading"
                  className="h-5 w-5 mr-2 animate-spin"
                />
                {isAuthenticating
                  ? 'Creating passkey...'
                  : 'Completing registration...'}
              </>
            ) : (
              <>
                <UIIcon iconName="fingerprint" className="h-5 w-5 mr-2" />
                Create Account with Passkey
                <UIIcon iconName="arrow-right" className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          {/* Helper Text */}
          <p className="text-xs text-gray-600 mt-4 text-center">
            This will only take a few seconds. You'll be prompted by your device
            to confirm.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By creating an account, you agree to our Terms of Service and Privacy
          Policy.
        </p>
      </div>
    </div>
  );
});

RegistrationContent.displayName = 'RegistrationContent';

// Main page component with Suspense boundary
export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <UIIcon
            iconName="loading"
            className="h-12 w-12 text-blue-600 animate-spin"
          />
        </div>
      }
    >
      <RegistrationContent />
    </Suspense>
  );
}
