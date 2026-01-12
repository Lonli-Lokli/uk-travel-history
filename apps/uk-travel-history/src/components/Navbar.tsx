'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
  useAuth,
} from '@clerk/nextjs';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  UIIcon,
} from '@uth/ui';
import { navigationStore } from '@uth/stores';
import { cn } from '@uth/utils';
import { useFeatureFlags } from '@uth/widgets';
import { FEATURE_KEYS } from '@uth/features';

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/travel', label: 'Travel' },
];

export const Navbar = observer(() => {
  const pathname = usePathname();
  const { isFeatureEnabled } = useFeatureFlags();
  const { isLoaded } = useAuth();

  const isActive = (href: string) => {
    // Exact match for home, starts with for others
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Check if auth feature is enabled
  const isAuthEnabled = isFeatureEnabled(FEATURE_KEYS.AUTH);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 h-14">
      <div className="max-w-6xl mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full gap-4">
          {/* Logo/Branding */}

          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded shrink-0"
            aria-label="UK Travel Parser home"
          >
            <div className="w-82 h-55 rounded-lg flex items-center justify-center">
              <Image
                src="/logo.svg"
                alt="UK Travel Parser Logo"
                width={82}
                height={55}
                className="w-82 h-55"
              />
            </div>
          </Link>

          {/* Desktop Navigation and Auth */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <nav
              className="flex items-center gap-2"
              aria-label="Main navigation"
            >
              <NavigationMenu>
                <NavigationMenuList className="gap-1">
                  {navItems.map((item) => (
                    <NavigationMenuItem key={item.href}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            'group inline-flex h-9 w-max items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-all',
                            'hover:bg-slate-50 hover:text-slate-900',
                            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                            'relative',
                            isActive(item.href)
                              ? 'text-slate-900'
                              : 'text-slate-600 opacity-70 hover:opacity-100',
                          )}
                        >
                          {item.label}
                          {/* Active indicator */}
                          {isActive(item.href) && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                          )}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </nav>

            {/* Auth UI (desktop) - single button for both sign in/up */}
            {isAuthEnabled && (
              <>
                {!isLoaded ? (
                  // Show skeleton while Clerk is loading
                  <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
                ) : (
                  <>
                    <SignedOut>
                      <SignInButton mode="modal">
                        <Button size="sm" className="h-9">
                          Sign In
                        </Button>
                      </SignInButton>
                    </SignedOut>
                    <SignedIn>
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: 'w-8 h-8',
                          },
                        }}
                      >
                        <UserButton.MenuItems>
                          <UserButton.Link
                            label="Account & Billing"
                            labelIcon={
                              <UIIcon iconName="user" className="h-4 w-4" />
                            }
                            href="/account"
                          />
                        </UserButton.MenuItems>
                      </UserButton>
                    </SignedIn>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Menu Trigger and Auth */}
          <div className="md:hidden flex items-center gap-2 ml-auto">
            {/* Auth UI (mobile) - single button for both sign in/up */}
            {isAuthEnabled && (
              <>
                {!isLoaded ? (
                  // Show skeleton while Clerk is loading
                  <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
                ) : (
                  <>
                    <SignedOut>
                      <SignInButton mode="modal">
                        <Button size="icon" className="h-8 w-8">
                          <UIIcon iconName="fingerprint" className="h-4 w-4" />
                        </Button>
                      </SignInButton>
                    </SignedOut>
                    <SignedIn>
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: 'w-8 h-8',
                          },
                        }}
                      >
                        <UserButton.MenuItems>
                          <UserButton.Link
                            label="Account & Billing"
                            labelIcon={
                              <UIIcon iconName="user" className="h-4 w-4" />
                            }
                            href="/account"
                          />
                        </UserButton.MenuItems>
                      </UserButton>
                    </SignedIn>
                  </>
                )}
              </>
            )}

            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={() => navigationStore.openMobileMenu()}
              aria-label="Open menu"
            >
              <UIIcon iconName="menu" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <Drawer
        open={navigationStore.isMobileMenuOpen}
        onOpenChange={navigationStore.setMobileMenuOpen.bind(navigationStore)}
      >
        <DrawerContent>
          <DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
          <nav className="p-4 pb-8" aria-label="Mobile navigation">
            <ul className="space-y-1" role="list">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => navigationStore.closeMobileMenu()}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      'hover:bg-slate-50',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                      'min-h-[44px]', // Touch target size
                      isActive(item.href)
                        ? 'bg-slate-50 text-slate-900 font-medium'
                        : 'text-slate-600',
                    )}
                  >
                    {item.label}
                    {isActive(item.href) && (
                      <span className="ml-auto w-2 h-2 bg-primary rounded-full" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </DrawerContent>
      </Drawer>
    </header>
  );
});

Navbar.displayName = 'Navbar';
