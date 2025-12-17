// API Route: Finish Passkey Sign-In
// Proxies request to firebase-web-authn extension

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential is required' },
        { status: 400 }
      );
    }

    // Validate Firebase configuration
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json(
        { error: 'Firebase not configured' },
        { status: 503 }
      );
    }

    // Call firebase-web-authn extension endpoint
    const extensionUrl = `https://ext-firebase-web-authn-api-${projectId}.cloudfunctions.net/signin/finish`;

    const response = await fetch(extensionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Extension error:', error);
      return NextResponse.json(
        { error: 'Failed to complete sign-in' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sign-in finish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
