import Link from 'next/link';
import { Button } from '@uth/ui';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-6 rounded-full">
            <svg
              className="w-12 h-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-slate-900 mb-2">403</h1>
        <h2 className="text-2xl font-semibold text-slate-800 mb-4">
          Access Forbidden
        </h2>

        <p className="text-slate-600 mb-8">
          You don&apos;t have permission to access this page. This area is
          restricted to administrators only.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link href="/travel">Go to Travel Tracker</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
