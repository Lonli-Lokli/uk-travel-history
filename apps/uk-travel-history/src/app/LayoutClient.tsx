'use client';

import { Navbar } from '../components/Navbar';
import { ReactNode } from 'react';

/**
 * Layout client component that wraps the app with the Navbar.
 *
 * The Navbar now handles its own toolbar rendering based on the current route,
 * eliminating the need for context-based injection and useEffect timing issues.
 */
export function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </>
  );
}
