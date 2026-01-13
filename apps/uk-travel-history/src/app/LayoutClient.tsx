import { Navbar } from '../components/Navbar';
import { Providers } from '@/components/Providers';
import { Footer } from '@/components/Footer';
import { Toaster } from '@uth/ui';
import { loadDataContext, loadIdentityContext } from '@uth/features/server';

/**
 * Layout client component that wraps the app with the Navbar and providers.
 *
 * The Navbar now handles its own toolbar rendering based on the current route,
 * eliminating the need for context-based injection and useEffect timing issues.
 */
export async function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load server-authoritative access context (auth + tier + entitlements + policies + pricing)
  // This is computed server-side and hydrated to client stores to prevent flicker
  // All data is loaded in a single call to avoid duplicate fetches
  const [identityContext, dataContext] = await Promise.all([
    loadIdentityContext(),
    loadDataContext(),
  ]);

  return (
    <Providers identityContext={identityContext} dataContext={dataContext}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Footer isAdmin={identityContext.role === 'admin'} />
      <Toaster />
    </Providers>
  );
}
