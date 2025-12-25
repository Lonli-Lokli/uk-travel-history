'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { observer } from 'mobx-react-lite';
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
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/travel', label: 'Travel' },
];

interface NavbarProps {
  children?: ReactNode;
}

export const Navbar = observer(({ children }: NavbarProps) => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Exact match for home, starts with for others
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Hide navigation on About and Terms pages for cleaner minimalist design
  const hideNavigation = pathname === '/about' || pathname === '/terms';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 h-14">
      <div className="max-w-6xl mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full gap-4">
          {/* Logo/Branding */}
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded shrink-0"
            aria-label="UK Travel Parser home"
          >
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <UIIcon iconName="airplane" className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm hidden sm:inline">
              UK Travel Parser
            </span>
          </Link>

          {/* Center content (children/toolbar) */}
          {children && (
            <div className="flex items-center gap-2 flex-1 justify-center">
              {children}
            </div>
          )}

          {/* Desktop Navigation */}
          {!hideNavigation && (
            <nav className={cn('hidden md:flex items-center', children ? 'gap-1' : 'gap-2')} aria-label="Main navigation">
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
                            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                            'relative',
                            isActive(item.href)
                              ? 'text-slate-900'
                              : 'text-slate-600 opacity-70 hover:opacity-100'
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
          )}

          {/* Mobile Menu Trigger */}
          {!hideNavigation && (
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0 h-8 w-8"
              onClick={() => navigationStore.openMobileMenu()}
              aria-label="Open menu"
            >
              <UIIcon iconName="menu" className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {!hideNavigation && (
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
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        'min-h-[44px]', // Touch target size
                        isActive(item.href)
                          ? 'bg-slate-50 text-slate-900 font-medium'
                          : 'text-slate-600'
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
      )}
    </header>
  );
});

Navbar.displayName = 'Navbar';
