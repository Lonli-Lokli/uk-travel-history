'use client';

import Link from 'next/link';
import { observer } from 'mobx-react-lite';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  UIIcon,
} from '@uth/ui';
import { FEATURE_KEYS } from '@uth/features';
import { LoginModal } from './LoginModal';
import { useFeatureFlags } from '@uth/widgets';
import { authStore, travelStore, uiStore } from '@uth/stores';
import { UI } from 'react-day-picker';

interface HeaderProps {
  onImportPdfClick: () => void;
  onImportCsvClick: () => void;
  onImportClipboardClick: () => void;
  onExportClick: (mode: 'ilr' | 'full') => void;
}

export const Header = observer(
  ({
    onImportPdfClick,
    onImportCsvClick,
    onImportClipboardClick,
    onExportClick,
  }: HeaderProps) => {
    const { isFeatureEnabled } = useFeatureFlags();
    const isLoading = travelStore.isLoading;
    const hasTrips = travelStore.trips.length > 0;
    const user = authStore.user;
    const isAuthEnabled = isFeatureEnabled(FEATURE_KEYS.AUTH);

    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <UIIcon
                  iconName="airplane"
                  className="w-3.5 h-3.5 text-white"
                />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 text-sm">
                  UK Travel Parser
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block leading-tight">
                  Calculate days outside UK
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* Buy Me a Coffee Button */}
              <a
                href="https://www.buymeacoffee.com/LonliLokliV"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:block"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[#FFDD00] hover:bg-[#FFED4E] border-[#FFDD00] hover:border-[#FFED4E] text-slate-900"
                >
                  <UIIcon iconName="coffee" className="h-4 w-4 mr-1.5" />
                  Buy Me a Coffee
                </Button>
              </a>

              {/* Mobile: Coffee icon only */}
              <a
                href="https://www.buymeacoffee.com/LonliLokliV"
                target="_blank"
                rel="noopener noreferrer"
                className="sm:hidden"
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-[#FFDD00] hover:bg-[#FFED4E] border-[#FFDD00] hover:border-[#FFED4E] text-slate-900"
                >
                  <UIIcon iconName="coffee" className="h-4 w-4" />
                </Button>
              </a>

              {/* Desktop: Import Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <UIIcon
                        iconName="loading"
                        className="h-4 w-4 mr-1.5 animate-spin"
                      />
                    ) : (
                      <UIIcon iconName="export" className="h-4 w-4 mr-1.5" />
                    )}
                    Import
                    <UIIcon iconName="import" className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onImportPdfClick}>
                    <UIIcon iconName="pdf" className="h-4 w-4 mr-2" />
                    From PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onImportCsvClick}>
                    <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    From Excel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onImportClipboardClick}>
                    <UIIcon iconName="clipboard" className="h-4 w-4 mr-2" />
                    From Clipboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile: Import Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="sm:hidden"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <UIIcon
                        iconName="loading"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <UIIcon iconName="import" className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onImportPdfClick}>
                    <UIIcon iconName="pdf" className="h-4 w-4 mr-2" />
                    From PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onImportCsvClick}>
                    <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    From Excel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onImportClipboardClick}>
                    <UIIcon iconName="clipboard" className="h-4 w-4 mr-2" />
                    From Clipboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Desktop: Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="hidden sm:flex"
                    disabled={!hasTrips}
                  >
                    <UIIcon iconName="export" className="h-4 w-4 mr-1.5" />
                    Export
                    <UIIcon iconName="import" className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onExportClick('ilr')}>
                    <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    Travel history only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExportClick('full')}>
                    <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    Full backup
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile: Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="sm:hidden"
                    disabled={!hasTrips}
                  >
                    <UIIcon iconName="export" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onExportClick('ilr')}>
                    <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    Travel history only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExportClick('full')}>
                    <UIIcon iconName="xlsx" className="h-4 w-4 mr-2" />
                    Full backup
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Auth UI - only show if feature flag is enabled */}
              {isAuthEnabled && (
                <>
                  {user ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UIIcon iconName="user" className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">
                            {user.displayName ||
                              user.email?.split('@')[0] ||
                              'Account'}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {user.displayName || 'User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => uiStore.handleSignOut()}
                        >
                          <UIIcon iconName="logout" className="h-4 w-4 mr-2" />
                          Sign Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => uiStore.openLoginModal()}
                    >
                      <UIIcon
                        iconName="fingerprint"
                        className="h-4 w-4 mr-1.5"
                      />
                      <span className="hidden sm:inline">Sign In</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Login Modal */}
        {isAuthEnabled && <LoginModal />}
      </header>
    );
  },
);

Header.displayName = 'Header';
