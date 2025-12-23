import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update passkey status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
