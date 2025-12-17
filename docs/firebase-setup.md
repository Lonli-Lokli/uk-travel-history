# Firebase Authentication Setup Guide

This guide explains how to set up Firebase Authentication with Passkey support for the UK Travel History application.

## Prerequisites

- Firebase account (free tier is sufficient)
- Access to Firebase Console
- Access to Vercel Dashboard (for environment variables)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Create a project** (or select existing project)
3. Enter project name: `uk-travel-history` (or your preferred name)
4. Disable Google Analytics (optional, not needed for auth)
5. Click **Create project**

## Step 2: Register Web App

1. In Firebase Console, click the **Web icon** (`</>`) to add a web app
2. Enter app nickname: `UK Travel History Web`
3. **Do not** enable Firebase Hosting
4. Click **Register app**
5. Copy the Firebase configuration object (you'll need these values later)

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 3: Install Firebase Web Authn Extension

This extension enables passkey authentication.

1. In Firebase Console, go to **Extensions** (in left sidebar under "Build")
2. Click **Install Extension**
3. Search for **"firebase-web-authn"** by gavinsawyer
4. Click **Install** on the extension
5. Configure the extension:
   - **Cloud Functions location**: Choose region closest to your users (e.g., `us-central1`, `europe-west1`)
   - **Allowed origins**: Add your domains:
     ```
     http://localhost:3000,https://your-app.vercel.app,https://your-custom-domain.com
     ```
   - **User creation mode**: Select `automatic` (creates users on first sign-in)
6. Click **Install extension**
7. Wait for installation to complete (2-3 minutes)

**Note the extension endpoint URL** (you'll see it after installation):
```
https://ext-firebase-web-authn-api-{project-id}.cloudfunctions.net
```

## Step 4: Generate Service Account Key

For server-side authentication verification, you need a service account key.

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** (downloads a JSON file)
5. Open the JSON file and extract these values:
   - `project_id`
   - `client_email`
   - `private_key`

⚠️ **Security Warning**: Never commit this file to Git. Keep it secure.

## Step 5: Configure Environment Variables

### Local Development

1. Create `.env.local` file in `apps/uk-travel-history/`:

```bash
# Firebase Client SDK (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (Private - Server Only)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-abc@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# Feature Flags
NEXT_PUBLIC_FF_FIREBASE_AUTH=true
```

2. Restart your development server:
```bash
npm run start
```

### Production (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Name: `NEXT_PUBLIC_FIREBASE_API_KEY`
   - Value: `AIza...`
   - Environments: Select **Production**, **Preview**, **Development**
   - Click **Save**
5. Repeat for all variables listed above
6. Redeploy your application

⚠️ **Important**: For `FIREBASE_ADMIN_PRIVATE_KEY`, make sure to paste the entire key including newlines. Vercel will handle the formatting.

## Step 6: Test Authentication

### Test Passkey Registration

1. Start your development server: `npm run start`
2. Open http://localhost:3000/travel
3. Click **Sign In** button in header
4. Click **Create an account**
5. Enter your email address
6. Click **Create Passkey**
7. Your browser will prompt you to create a passkey:
   - On Mac: Use Touch ID or password
   - On Windows: Use Windows Hello, PIN, or security key
   - On Mobile: Use fingerprint or face recognition
8. After successful registration, you should be signed in

### Test Passkey Sign-In

1. Sign out (if logged in)
2. Click **Sign In** button
3. Click **Sign In with Passkey**
4. Your browser will prompt you to use your passkey
5. Authenticate with your device (fingerprint, face ID, etc.)
6. You should be signed in

### Verify in Firebase Console

1. Go to Firebase Console → **Authentication**
2. Click **Users** tab
3. You should see your user listed
4. The sign-in provider will show as **Custom** (because passkeys use custom tokens)

## Step 7: Enable Authentication in Production

1. Set the feature flag in Vercel:
   ```
   NEXT_PUBLIC_FF_FIREBASE_AUTH=true
   ```
2. Redeploy your application
3. The Sign In button will appear in the header

## Troubleshooting

### "Passkeys are not supported in this browser"

**Solution**: Passkeys require a modern browser:
- Chrome 108+
- Safari 16+
- Edge 108+
- Firefox 122+

### "Failed to start passkey registration"

**Possible causes**:
1. Extension not installed correctly
2. Allowed origins not configured
3. HTTPS required (localhost is exception)

**Solutions**:
- Check Firebase Console → Extensions → firebase-web-authn → Configuration
- Add your domain to allowed origins
- Ensure you're using HTTPS in production

### "Firebase Admin SDK not initialized"

**Possible causes**:
1. Service account credentials not set
2. Private key format incorrect

**Solutions**:
- Verify all `FIREBASE_ADMIN_*` environment variables are set
- Ensure `FIREBASE_ADMIN_PRIVATE_KEY` includes newlines (`\n`)
- Check Vercel logs for specific error messages

### "No credential received"

**Possible causes**:
1. User cancelled the passkey prompt
2. No passkey registered for this device
3. Browser security settings blocking WebAuthn

**Solutions**:
- Try again and complete the passkey prompt
- For sign-in, ensure you've registered a passkey first
- Check browser settings for security/privacy restrictions

### Extension endpoint 404

**Possible causes**:
1. Extension not fully deployed
2. Wrong project ID in URL

**Solutions**:
- Wait 5 minutes after installation
- Verify the extension URL in Firebase Console → Extensions
- Check that `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matches your project

## Security Best Practices

### Environment Variables

- ✅ **DO**: Use Vercel environment variables for production secrets
- ✅ **DO**: Use `.env.local` for local development (gitignored)
- ❌ **DON'T**: Commit `.env.local` or service account keys to Git
- ❌ **DON'T**: Share your Firebase Admin private key

### Passkey Security

- ✅ **DO**: Use HTTPS in production (Vercel does this automatically)
- ✅ **DO**: Configure allowed origins in Firebase extension
- ❌ **DON'T**: Allow `*` as an origin (security risk)

### User Data

- ✅ **DO**: Implement user deletion (GDPR compliance)
- ✅ **DO**: Only collect necessary user information (email)
- ❌ **DON'T**: Log user tokens or credentials

## GDPR Compliance

To allow users to delete their accounts:

1. Implement account deletion UI (future task)
2. Use Firebase Admin SDK to delete user:
   ```typescript
   await adminAuth.deleteUser(userId);
   ```
3. Delete all associated user data from Firestore

## Cost Estimate

Firebase Authentication is **free** for up to 50,000 monthly active users.

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| Firebase Authentication | 50,000 MAU | $0/month |
| Cloud Functions (extension) | 2M invocations | $0/month (within free tier) |
| **Total** | | **$0/month** |

## Next Steps

After setting up authentication:

1. **RFC-003**: Integrate Stripe for subscriptions
2. **RFC-004**: Add subscription status checks
3. **RFC-005**: Implement premium feature access control

## Useful Links

- [Firebase Web Authn Extension](https://extensions.dev/extensions/gavinsawyer/firebase-web-authn)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [WebAuthn Guide](https://webauthn.guide/)
- [Passkeys.dev](https://passkeys.dev/)
