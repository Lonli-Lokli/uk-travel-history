'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DEPRECATED: This registration page is no longer used.
 *
 * The new auth flow uses Clerk + Supabase:
 * 1. Payment → Stripe webhook creates Clerk user
 * 2. User signs in at /claim
 * 3. User enrolls passkey at /onboarding/passkey
 *
 * This page redirects to /claim for backward compatibility.
 */
export default function RegistrationPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new claim page
    router.replace('/claim');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to new registration flow...</p>
      </div>
    </div>
  );
}
