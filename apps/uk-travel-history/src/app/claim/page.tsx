import { SignIn } from '@clerk/nextjs';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claim Your Account',
  description: 'Sign in to claim your UK Travel History account',
};

export default function ClaimPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome to UK Travel History
        </h1>
        <p className="text-slate-600 max-w-md">
          Sign in with the email you used for payment to claim your account
        </p>
      </div>

      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl',
            footer: 'hidden', // Hide the footer which contains the sign-up link
          },
        }}
        routing="path"
        path="/claim"
        afterSignInUrl="/onboarding/passkey"
        redirectUrl="/onboarding/passkey"
      />

      <div className="mt-8 text-center text-sm text-slate-500 max-w-md">
        <p>
          After payment, you'll receive an invitation email. Use that email to sign
          in and complete your account setup.
        </p>
      </div>
    </div>
  );
}
