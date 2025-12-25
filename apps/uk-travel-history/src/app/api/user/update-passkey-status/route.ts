import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateUserMetadata } from '@uth/auth-server';
import { updateUserByAuthId } from '@uth/db';
import { logger } from '@uth/utils';

/**
 * POST /api/user/update-passkey-status
 * Updates the passkey_enrolled status for the current user
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { enrolled } = body;

    if (typeof enrolled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: enrolled must be a boolean' },
        { status: 400 },
      );
    }

    // Note: Server-side passkey verification is not straightforward with Clerk's current API.
    // The passkey enrollment happens client-side via user.createPasskey().
    // We trust the client call succeeded if this endpoint is called with enrolled=true.
    // The middleware will use publicMetadata.passkey_enrolled to enforce access control.

    // Update database
    try {
      await updateUserByAuthId(userId, { passkeyEnrolled: enrolled });
    } catch (error) {
      logger.error('Failed to update passkey status', error);
      return NextResponse.json(
        { error: 'Failed to update passkey status' },
        { status: 500 },
      );
    }

    // Sync to auth provider public metadata for caching
    try {
      await updateUserMetadata(userId, {
        publicMetadata: {
          passkey_enrolled: enrolled,
        },
      });
    } catch (metadataError) {
      // Log but don't fail the request - Database is source of truth
      logger.error('Failed to sync passkey metadata to auth provider', metadataError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Update passkey status error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
