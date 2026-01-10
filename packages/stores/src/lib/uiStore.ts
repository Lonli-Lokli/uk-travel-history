// UI Store
// Manages UI state including modals and form data

import { makeAutoObservable } from 'mobx';
import { authStore } from './authStore';
import { logger } from '@uth/utils';

export type AppTab = 'trackers' | 'timeline';

export interface TripDrawerFormData {
  title?: string;
  outDate: string;
  inDate: string;
  outRoute?: string;
  inRoute?: string;
  goalId?: string;
}

export type TripDrawerMode = 'create' | 'edit';

class UIStore {
  activeTab: AppTab = 'trackers';
  dateRangeStart: string | null = null; // ISO date string (YYYY-MM-DD)
  dateRangeEnd: string | null = null; // ISO date string (YYYY-MM-DD)

  // Trip drawer state
  isTripDrawerOpen = false;
  tripDrawerMode: TripDrawerMode = 'create';
  tripDrawerFormData: TripDrawerFormData = {
    outDate: '',
    inDate: '',
    outRoute: '',
    inRoute: '',
    goalId: '',
  };
  editingTripId: string | null = null;

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

  /**
   * Open trip drawer for creating a new trip
   */
  openTripDrawer(goalId?: string) {
    this.isTripDrawerOpen = true;
    this.tripDrawerMode = 'create';
    this.editingTripId = null;
    this.tripDrawerFormData = {
      outDate: '',
      inDate: '',
      outRoute: '',
      inRoute: '',
      goalId: goalId || '',
    };
  }

  /**
   * Open trip drawer for editing an existing trip
   */
  openTripDrawerForEdit(tripId: string, tripData: TripDrawerFormData) {
    this.isTripDrawerOpen = true;
    this.tripDrawerMode = 'edit';
    this.editingTripId = tripId;
    this.tripDrawerFormData = { ...tripData };
  }

  /**
   * Close trip drawer
   */
  closeTripDrawer() {
    this.isTripDrawerOpen = false;
    this.editingTripId = null;
    this.tripDrawerFormData = {
      outDate: '',
      inDate: '',
      outRoute: '',
      inRoute: '',
      goalId: '',
    };
  }

  /**
   * Update trip drawer form data
   */
  updateTripDrawerFormData(updates: Partial<TripDrawerFormData>) {
    this.tripDrawerFormData = {
      ...this.tripDrawerFormData,
      ...updates,
    };
  }
}

export const uiStore = new UIStore();
