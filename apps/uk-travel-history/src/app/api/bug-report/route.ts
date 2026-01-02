import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import BugReportEmail from '../../../emails/bug-report';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const FROM_EMAIL = process.env.BUG_REPORT_FROM_EMAIL || 'bugs@uk-travel-history.com';
const TO_EMAIL = process.env.BUG_REPORT_TO_EMAIL || 'support@uk-travel-history.com';

/**
 * POST /api/bug-report
 *
 * Handles bug report submissions with screenshot and file attachments
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();

    const email = formData.get('email') as string;
    const message = formData.get('message') as string;
    const pageUrl = formData.get('pageUrl') as string;
    const userAgent = formData.get('userAgent') as string;
    const screenshot = formData.get('screenshot') as File | null;
    const attachment = formData.get('attachment') as File | null;

    // Validate required fields
    if (!email || !message || !pageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.length < 10 || message.length > 1000) {
      return NextResponse.json(
        { error: 'Message must be between 10 and 1000 characters' },
        { status: 400 }
      );
    }

    let screenshotUrl: string | undefined;
    let attachmentUrl: string | undefined;
    let attachmentFilename: string | undefined;

    // Upload screenshot to Vercel Blob if provided
    if (screenshot) {
      // Validate file size (max 10MB for screenshot)
      if (screenshot.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Screenshot file too large (max 10MB)' },
          { status: 400 }
        );
      }

      const screenshotBuffer = Buffer.from(await screenshot.arrayBuffer());
      const screenshotBlob = await put(
        `bug-reports/screenshots/${Date.now()}-screenshot.jpg`,
        screenshotBuffer,
        {
          access: 'public',
          addRandomSuffix: true,
          contentType: 'image/jpeg',
        }
      );
      screenshotUrl = screenshotBlob.url;
    }

    // Upload attachment to Vercel Blob if provided
    if (attachment) {
      // Validate file size (max 5MB)
      if (attachment.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Attachment file too large (max 5MB)' },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = [
        'text/plain',
        'application/json',
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ];

      const isLogFile = attachment.name.endsWith('.log');
      const isAllowedType = allowedTypes.includes(attachment.type);

      if (!isLogFile && !isAllowedType) {
        return NextResponse.json(
          { error: 'File type not allowed' },
          { status: 400 }
        );
      }

      const attachmentBuffer = Buffer.from(await attachment.arrayBuffer());
      const attachmentBlob = await put(
        `bug-reports/attachments/${Date.now()}-${attachment.name}`,
        attachmentBuffer,
        {
          access: 'public',
          addRandomSuffix: true,
          contentType: attachment.type || 'application/octet-stream',
        }
      );
      attachmentUrl = attachmentBlob.url;
      attachmentFilename = attachment.name;
    }

    // Generate email HTML
    const emailHtml = await render(
      BugReportEmail({
        email,
        message,
        pageUrl,
        userAgent,
        screenshotUrl,
        attachmentUrl,
        attachmentFilename,
        timestamp: new Date().toISOString(),
      })
    );

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: `Bug Report: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      html: emailHtml,
    });

    if (!emailResponse.data) {
      console.error('Resend error:', emailResponse.error);
      throw new Error('Failed to send email');
    }

    return NextResponse.json({
      success: true,
      message: 'Bug report submitted successfully',
    });
  } catch (error) {
    console.error('Bug report API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
