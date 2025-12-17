// API Route: Start Passkey Sign-In
// Proxies request to firebase-web-authn extension

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Call firebase-web-authn extension endpoint
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const extensionUrl = `https://ext-firebase-web-authn-api-${projectId}.cloudfunctions.net/signin/start`;

    const response = await fetch(extensionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Extension error:', error);
      return NextResponse.json(
        { error: 'Failed to start sign-in' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sign-in start error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
