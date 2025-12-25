// UI Store
// Manages UI state including modals and form data

import { makeAutoObservable } from 'mobx';
import { authStore } from './authStore';
import { logger } from '@uth/utils';

class UIStore {
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
}

export const uiStore = new UIStore();
