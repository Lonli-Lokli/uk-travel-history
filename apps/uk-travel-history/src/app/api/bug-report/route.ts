import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import BugReportEmail from '../../../emails/bug-report';
import {
  FILE_SIZE_LIMITS,
  MESSAGE_LENGTH,
  ALLOWED_FILE_TYPES,
} from '../../../components/bug-report/constants';
import {
  sanitizeFilename,
  sanitizeUrl,
  rateLimiter,
} from '../../../components/bug-report/utils';

// Force dynamic route to prevent static generation during build
export const dynamic = 'force-dynamic';

// Email configuration
const FROM_EMAIL =
  process.env.BUG_REPORT_FROM_EMAIL || 'bugs@uk-travel-history.com';
const TO_EMAIL =
  process.env.BUG_REPORT_TO_EMAIL || 'support@uk-travel-history.com';

// Allowed origins for CSRF protection
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
  'http://localhost:4200',
  'https://uk-travel-history.vercel.app',
].filter(Boolean); // Remove undefined values

/**
 * Validate environment variables on module load
 */
function validateEnv(): { isValid: boolean; missing: string[] } {
  const required = ['RESEND_API_KEY', 'BLOB_READ_WRITE_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);
  return { isValid: missing.length === 0, missing };
}

/**
 * Get Resend client instance (lazy initialization to avoid build-time errors)
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(apiKey);
}

/**
 * POST /api/bug-report
 *
 * Handles bug report submissions with screenshot and file attachments
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Environment validation
    const envCheck = validateEnv();
    if (!envCheck.isValid) {
      console.error('Missing environment variables:', envCheck.missing);
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 },
      );
    }

    // Step 2: CSRF Protection - Validate request origin
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    // Allow requests from allowed origins or if origin header is missing (same-origin requests)
    const isValidOrigin =
      !origin ||
      ALLOWED_ORIGINS.some(
        (allowed) => origin === allowed || origin.startsWith(allowed || ''),
      );

    const isValidReferer =
      !referer ||
      ALLOWED_ORIGINS.some(
        (allowed) =>
          referer.startsWith(allowed || '') ||
          referer.startsWith('http://localhost'),
      );

    if (!isValidOrigin && !isValidReferer) {
      console.warn('Invalid request origin:', origin, 'referer:', referer);
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 },
      );
    }

    // Step 3: Rate Limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    if (!rateLimiter.check(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    // Step 4: Parse form data
    const formData = await request.formData();

    const email = formData.get('email') as string;
    const message = formData.get('message') as string;
    const pageUrl = formData.get('pageUrl') as string;
    const userAgent = formData.get('userAgent') as string;
    const screenshot = formData.get('screenshot') as File | null;
    const attachment = formData.get('attachment') as File | null;

    // Step 5: Validate required fields
    if (!email || !message || !pageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Step 6: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 },
      );
    }

    // Step 7: Validate message length
    if (
      message.length < MESSAGE_LENGTH.MIN ||
      message.length > MESSAGE_LENGTH.MAX
    ) {
      return NextResponse.json(
        {
          error: `Message must be between ${MESSAGE_LENGTH.MIN} and ${MESSAGE_LENGTH.MAX} characters`,
        },
        { status: 400 },
      );
    }

    // Step 8: Sanitize and validate pageUrl
    const sanitizedPageUrl = sanitizeUrl(pageUrl);
    if (!sanitizedPageUrl) {
      return NextResponse.json({ error: 'Invalid page URL' }, { status: 400 });
    }

    let screenshotUrl: string | undefined;
    let attachmentUrl: string | undefined;
    let attachmentFilename: string | undefined;

    // Step 9: Upload screenshot to Vercel Blob if provided
    if (screenshot) {
      // Validate file size
      if (screenshot.size > FILE_SIZE_LIMITS.SCREENSHOT) {
        return NextResponse.json(
          {
            error: `Screenshot file too large (max ${FILE_SIZE_LIMITS.SCREENSHOT / 1024 / 1024}MB)`,
          },
          { status: 400 },
        );
      }

      const screenshotBuffer = Buffer.from(await screenshot.arrayBuffer());
      const sanitizedFilename = sanitizeFilename('screenshot.jpg');
      const screenshotBlob = await put(
        `bug-reports/screenshots/${Date.now()}-${sanitizedFilename}`,
        screenshotBuffer,
        {
          access: 'public',
          addRandomSuffix: true,
          contentType: 'image/jpeg',
        },
      );
      screenshotUrl = screenshotBlob.url;
    }

    // Step 10: Upload attachment to Vercel Blob if provided
    if (attachment) {
      // Validate file size
      if (attachment.size > FILE_SIZE_LIMITS.ATTACHMENT) {
        return NextResponse.json(
          {
            error: `Attachment file too large (max ${FILE_SIZE_LIMITS.ATTACHMENT / 1024 / 1024}MB)`,
          },
          { status: 400 },
        );
      }

      // Validate file type
      const isLogFile = attachment.name.endsWith('.log');
      const isAllowedType = ALLOWED_FILE_TYPES.includes(
        attachment.type as (typeof ALLOWED_FILE_TYPES)[number],
      );

      if (!isLogFile && !isAllowedType) {
        return NextResponse.json(
          { error: 'File type not allowed' },
          { status: 400 },
        );
      }

      // Sanitize filename to prevent path traversal
      const sanitizedFilename = sanitizeFilename(attachment.name);
      const attachmentBuffer = Buffer.from(await attachment.arrayBuffer());
      const attachmentBlob = await put(
        `bug-reports/attachments/${Date.now()}-${sanitizedFilename}`,
        attachmentBuffer,
        {
          access: 'public',
          addRandomSuffix: true,
          contentType: attachment.type || 'application/octet-stream',
        },
      );
      attachmentUrl = attachmentBlob.url;
      attachmentFilename = sanitizedFilename; // Use sanitized filename
    }

    // Step 11: Generate email HTML (sanitized pageUrl used here)
    const emailHtml = await render(
      BugReportEmail({
        email,
        message,
        pageUrl: sanitizedPageUrl,
        userAgent,
        screenshotUrl,
        attachmentUrl,
        attachmentFilename,
        timestamp: new Date().toISOString(),
      }),
    );

    // Step 12: Send email via Resend
    const resend = getResendClient();
    const emailResponse = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: `Bug Report: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`,
      html: emailHtml,
    });

    if (!emailResponse.data) {
      console.error('Resend error:', emailResponse.error);
      // Don't expose internal error details to user
      return NextResponse.json(
        { error: 'Failed to send bug report. Please try again later.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bug report submitted successfully',
    });
  } catch (error) {
    // Log error for debugging but don't expose details to user
    console.error('Bug report API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    );
  }
}
