// Navigation Store
// Manages navigation state including mobile menu

import { makeAutoObservable } from 'mobx';

class NavigationStore {
  // Mobile menu state
  isMobileMenuOpen = false;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Open the mobile menu
   */
  openMobileMenu(): void {
    this.isMobileMenuOpen = true;
  }

  /**
   * Close the mobile menu
   */
  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  /**
   * Toggle the mobile menu
   */
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  /**
   * Set mobile menu open state
   */
  setMobileMenuOpen(open: boolean): void {
    this.isMobileMenuOpen = open;
  }
}

export const navigationStore = new NavigationStore();
