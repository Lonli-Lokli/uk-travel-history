'use client';

import { Navbar } from '../components/Navbar';
import { usePathname } from 'next/navigation';
import { ReactNode, createContext, useContext, useState, useEffect } from 'react';

interface NavbarToolbarContextValue {
  setToolbar: (toolbar: ReactNode) => void;
}

const NavbarToolbarContext = createContext<NavbarToolbarContextValue>({
  setToolbar: () => {
    // Default no-op function
  },
});

export function useNavbarToolbar() {
  return useContext(NavbarToolbarContext);
}

export function LayoutClient({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<ReactNode>(null);
  const pathname = usePathname();

  // Clear toolbar on route change
  useEffect(() => {
    setToolbar(null);
  }, [pathname]);

  return (
    <NavbarToolbarContext.Provider value={{ setToolbar }}>
      <Navbar>{toolbar}</Navbar>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </NavbarToolbarContext.Provider>
  );
}
