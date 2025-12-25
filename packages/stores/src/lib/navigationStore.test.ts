import { describe, it, expect, beforeEach } from 'vitest';
import { navigationStore } from './navigationStore';

describe('NavigationStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    navigationStore.closeMobileMenu();
  });

  describe('Initial State', () => {
    it('should have mobile menu closed by default', () => {
      expect(navigationStore.isMobileMenuOpen).toBe(false);
    });
  });

  describe('openMobileMenu', () => {
    it('should open the mobile menu', () => {
      navigationStore.openMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(true);
    });

    it('should keep menu open if called multiple times', () => {
      navigationStore.openMobileMenu();
      navigationStore.openMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(true);
    });
  });

  describe('closeMobileMenu', () => {
    it('should close the mobile menu', () => {
      navigationStore.openMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(true);

      navigationStore.closeMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(false);
    });

    it('should keep menu closed if called multiple times', () => {
      navigationStore.closeMobileMenu();
      navigationStore.closeMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(false);
    });
  });

  describe('toggleMobileMenu', () => {
    it('should toggle menu from closed to open', () => {
      expect(navigationStore.isMobileMenuOpen).toBe(false);

      navigationStore.toggleMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(true);
    });

    it('should toggle menu from open to closed', () => {
      navigationStore.openMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(true);

      navigationStore.toggleMobileMenu();
      expect(navigationStore.isMobileMenuOpen).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      navigationStore.toggleMobileMenu(); // open
      expect(navigationStore.isMobileMenuOpen).toBe(true);

      navigationStore.toggleMobileMenu(); // close
      expect(navigationStore.isMobileMenuOpen).toBe(false);

      navigationStore.toggleMobileMenu(); // open
      expect(navigationStore.isMobileMenuOpen).toBe(true);
    });
  });

  describe('setMobileMenuOpen', () => {
    it('should set menu to open when passed true', () => {
      navigationStore.setMobileMenuOpen(true);
      expect(navigationStore.isMobileMenuOpen).toBe(true);
    });

    it('should set menu to closed when passed false', () => {
      navigationStore.openMobileMenu();
      navigationStore.setMobileMenuOpen(false);
      expect(navigationStore.isMobileMenuOpen).toBe(false);
    });

    it('should handle setting same state multiple times', () => {
      navigationStore.setMobileMenuOpen(true);
      navigationStore.setMobileMenuOpen(true);
      expect(navigationStore.isMobileMenuOpen).toBe(true);

      navigationStore.setMobileMenuOpen(false);
      navigationStore.setMobileMenuOpen(false);
      expect(navigationStore.isMobileMenuOpen).toBe(false);
    });
  });

  describe('MobX Observability', () => {
    it('should be observable and reactive', () => {
      let callCount = 0;
      const { autorun } = require('mobx');

      const dispose = autorun(() => {
        // Access observable property to track it
        const _isOpen = navigationStore.isMobileMenuOpen;
        callCount++;
      });

      // Initial run
      expect(callCount).toBe(1);

      // Change state
      navigationStore.openMobileMenu();
      expect(callCount).toBe(2);

      navigationStore.closeMobileMenu();
      expect(callCount).toBe(3);

      dispose();
    });
  });
});
