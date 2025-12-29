// Navbar Toolbar Store
// Manages navbar toolbar items with automatic cleanup on navigation

import { makeAutoObservable, action, observable } from 'mobx';
import { ReactNode } from 'react';

export interface ToolbarItem {
  id: string;
  element: ReactNode;
}

class NavbarToolbarStore {
  // Current pathname for detecting navigation changes
  currentPathname = '';

  // Registered toolbar items
  // Use shallow observable: the array reference is observable, but not the React elements inside
  toolbarItems: ToolbarItem[] = [];

  constructor() {
    makeAutoObservable(this, {
      registerToolbarItems: action,
      clearToolbar: action,
      updatePathname: action,
      // Make toolbarItems shallowly observable - only the array reference, not the contents
      // This allows reactivity when items are added/removed without wrapping React elements
      toolbarItems: observable.shallow,
    });
  }

  /**
   * Register toolbar items for a page
   * @param items - Array of toolbar items to register
   */
  registerToolbarItems(items: ToolbarItem[]): void {
    this.toolbarItems = items;
  }

  /**
   * Clear all toolbar items
   */
  clearToolbar(): void {
    this.toolbarItems = [];
  }

  /**
   * Update current pathname and clear toolbar if changed
   * This is called by Navbar on every render to detect navigation
   * @param pathname - Current pathname
   */
  updatePathname(pathname: string): void {
    if (this.currentPathname !== pathname) {
      this.currentPathname = pathname;
      this.clearToolbar();
    }
  }

  /**
   * Check if toolbar has items
   */
  get hasToolbarItems(): boolean {
    return this.toolbarItems.length > 0;
  }
}

export const navbarToolbarStore = new NavbarToolbarStore();
