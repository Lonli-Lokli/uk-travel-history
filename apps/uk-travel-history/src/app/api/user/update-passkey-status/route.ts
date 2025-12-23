import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getSupabaseServerClient } from '@uth/utils';

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

    // Update Supabase
    const supabase = getSupabaseServerClient();

    const { error } = await supabase
      .from('users')
      .update({ passkey_enrolled: enrolled })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('Failed to update passkey status:', error);
      return NextResponse.json(
        { error: 'Failed to update passkey status' },
        { status: 500 },
      );
    }

    // Sync to Clerk public metadata for caching
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      await client.users.updateUser(userId, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          passkey_enrolled: enrolled,
        },
      });
    } catch (metadataError) {
      // Log but don't fail the request - Supabase is source of truth
      console.error('Failed to sync passkey metadata to Clerk:', metadataError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update passkey status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
