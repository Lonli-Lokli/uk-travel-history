// API Route: Start Passkey Registration
// Proxies request to firebase-web-authn extension

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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
    // The extension is installed at: ext-firebase-web-authn-api
    const extensionUrl = `https://ext-firebase-web-authn-api-${projectId}.cloudfunctions.net/register/start`;

    const response = await fetch(extensionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        displayName: displayName || email.split('@')[0],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Extension error:', error);
      return NextResponse.json(
        { error: 'Failed to start registration' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Registration start error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
