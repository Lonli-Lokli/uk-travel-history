// UI Store
// Manages UI state including modals and form data

import { makeAutoObservable } from 'mobx';
import { authStore } from './authStore';
import { logger } from '@uth/utils';

export type AppTab = 'trackers' | 'timeline';
class UIStore {
  activeTab: AppTab = 'trackers';
  dateRangeStart: string | null = null; // ISO date string (YYYY-MM-DD)
  dateRangeEnd: string | null = null; // ISO date string (YYYY-MM-DD)

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Handle sign out
   */
  async handleSignOut(): Promise<void> {
    try {
      await authStore.signOut();
    } catch (error) {
      logger.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Set the active tab
   */
  setActiveTab(tab: AppTab) {
    this.activeTab = tab;
  }

  /**
   * Toggle between tabs
   */
  toggleTab() {
    this.activeTab = this.activeTab === 'trackers' ? 'timeline' : 'trackers';
  }

  /**
   * Set date range filter
   */
  setDateRange(start: string | null, end: string | null) {
    this.dateRangeStart = start;
    this.dateRangeEnd = end;
  }

  /**
   * Clear date range filter
   */
  clearDateRange() {
    this.dateRangeStart = null;
    this.dateRangeEnd = null;
  }

  /**
   * Check if date range filter is active
   */
  get hasDateRange() {
    return this.dateRangeStart !== null || this.dateRangeEnd !== null;
  }
}

export const uiStore = new UIStore();
