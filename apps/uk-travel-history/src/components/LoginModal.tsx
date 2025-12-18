'use client';

import { observer } from 'mobx-react-lite';
import { authStore, uiStore } from '@uth/stores';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@uth/ui';
import { Fingerprint, Loader2, AlertCircle } from 'lucide-react';

export const LoginModal = observer(() => {
  const isAuthenticating = authStore.isAuthenticating;
  const isPasskeySupported = authStore.isPasskeySupported;
  const open = uiStore.isLoginModalOpen;
  const email = uiStore.loginEmail;
  const displayName = uiStore.loginDisplayName;
  const mode = uiStore.loginMode;
  const error = uiStore.loginError;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => uiStore.setLoginModalOpen(open)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'signin'
              ? 'Sign in with your passkey to access premium features'
              : 'Create an account using a passkey - no password required'}
          </DialogDescription>
        </DialogHeader>

        {!isPasskeySupported ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">
              Passkeys are not supported in your browser. Please use a modern
              browser like Chrome, Safari, or Edge.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => uiStore.setLoginEmail(e.target.value)}
                    disabled={isAuthenticating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name (Optional)</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) =>
                      uiStore.setLoginDisplayName(e.target.value)
                    }
                    disabled={isAuthenticating}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={() =>
                mode === 'signin'
                  ? uiStore.handleSignIn()
                  : uiStore.handleRegister()
              }
              disabled={isAuthenticating || (mode === 'register' && !email)}
              className="w-full"
            >
              {isAuthenticating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Fingerprint className="h-4 w-4 mr-2" />
              )}
              {mode === 'signin' ? 'Sign In with Passkey' : 'Create Passkey'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {mode === 'signin' ? 'New user?' : 'Already have an account?'}
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={() =>
                uiStore.setLoginMode(mode === 'signin' ? 'register' : 'signin')
              }
              disabled={isAuthenticating}
              className="w-full"
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
            </Button>

            <div className="text-xs text-muted-foreground space-y-2 pt-2">
              <p className="font-medium">What is a passkey?</p>
              <p>
                A passkey is a secure, passwordless way to sign in using your
                device's biometric authentication (fingerprint, face
                recognition) or PIN. Your credentials never leave your device.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

LoginModal.displayName = 'LoginModal';
