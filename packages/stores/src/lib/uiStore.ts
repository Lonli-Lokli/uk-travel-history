// UI Store
// Manages UI state including modals and form data

import { makeAutoObservable, runInAction } from 'mobx';
import { authStore } from './authStore';
import { logger } from '@uth/utils';

class UIStore {
  // Login Modal State
  isLoginModalOpen = false;
  loginDisplayName = '';
  loginMode: 'signin' | 'register' = 'signin';
  loginError: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Open the login modal
   */
  openLoginModal(): void {
    this.isLoginModalOpen = true;
  }

  /**
   * Close the login modal and reset form state
   */
  closeLoginModal(): void {
    this.isLoginModalOpen = false;
    this.resetLoginForm();
  }

  /**
   * Set login modal open state
   */
  setLoginModalOpen(open: boolean): void {
    this.isLoginModalOpen = open;
    if (!open) {
      this.resetLoginForm();
    }
  }


  /**
   * Set login display name
   */
  setLoginDisplayName(displayName: string): void {
    this.loginDisplayName = displayName;
  }

  /**
   * Set login mode (signin or register)
   */
  setLoginMode(mode: 'signin' | 'register'): void {
    this.loginMode = mode;
    this.loginError = null;
  }

  /**
   * Set login error
   */
  setLoginError(error: string | null): void {
    this.loginError = error;
  }

  /**
   * Reset login form to initial state
   */
  resetLoginForm(): void {
    this.loginDisplayName = '';
    this.loginMode = 'signin';
    this.loginError = null;
  }

  /**
   * Handle sign in with passkey
   */
  async handleSignIn(): Promise<void> {
    this.loginError = null;
    try {
      await authStore.signInWithPasskey();
      this.closeLoginModal();
    } catch (err) {
      runInAction(() => {
        this.loginError =
          err instanceof Error ? err.message : 'Failed to sign in';
      });
      throw err;
    }
  }

  /**
   * Handle register with passkey
   */
  async handleRegister(): Promise<void> {
    if (!this.loginDisplayName) {
      this.loginError = 'Display name is required';
      return;
    }

    this.loginError = null;
    try {
      await authStore.registerPasskey(
        this.loginDisplayName
      );
      this.closeLoginModal();
    } catch (err) {
      runInAction(() => {
        this.loginError =
          err instanceof Error ? err.message : 'Failed to register';
      });
      throw err;
    }
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
