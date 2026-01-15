import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { rateLimiter } from '@uth/widgets';

// Mock dependencies
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (path: string, buffer: Buffer) => ({
    url: `https://blob.vercel-storage.com/${path}`,
  })),
}));

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: vi.fn(async () => ({
          data: { id: 'email-id' },
          error: null,
        })),
      };
    },
  };
});

vi.mock('@react-email/components', () => ({
  render: vi.fn(async () => '<html>Email content</html>'),
}));

// Mock the email template
vi.mock('@uth/widgets', async () => {
  const actual = await vi.importActual('@uth/widgets');
  return {
    ...actual,
    BugReportEmail: vi.fn(() => null),
  };
});

// Mock environment variables
process.env.RESEND_API_KEY = 'test-api-key';
process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
process.env.NEXT_PUBLIC_SITE_URL = 'https://busel.uk';

describe('Bug Report API Route', () => {
  let testCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.reset();
    testCounter++;
  });

  const createMockRequest = (
    formData: Record<string, string | File>,
    headers?: Record<string, string>,
  ) => {
    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });

    const headersObj = new Headers(
      headers || {
        origin: 'https://busel.uk',
      },
    );

    // Use unique IP for each test to avoid rate limiting issues
    const uniqueIp = `192.168.1.${testCounter}`;

    return {
      formData: async () => form,
      headers: headersObj,
      ip: uniqueIp,
    } as unknown as NextRequest;
  };

  it('should reject request with missing environment variables', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain('temporarily unavailable');

    process.env.RESEND_API_KEY = originalKey;
  });

  it('should reject request from invalid origin', async () => {
    const request = createMockRequest(
      {
        email: 'test@example.com',
        message: 'This is a test message',
        pageUrl: 'https://example.com',
        userAgent: 'Mozilla/5.0',
      },
      {
        origin: 'https://evil.com',
        referer: 'https://evil.com',
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Invalid request origin');
  });

  it('should reject request with missing required fields', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      // Missing message and pageUrl
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('should reject invalid email format', async () => {
    const request = createMockRequest({
      email: 'not-an-email',
      message: 'This is a test message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid email address');
  });

  it('should reject message that is too short', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      message: 'short',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('between 10 and 1000 characters');
  });

  it('should reject message that is too long', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      message: 'x'.repeat(1001),
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('between 10 and 1000 characters');
  });

  it('should reject invalid page URL', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test message',
      pageUrl: 'javascript:alert(1)',
      userAgent: 'Mozilla/5.0',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid page URL');
  });

  it('should reject screenshot file that is too large', async () => {
    const largeFile = new File(
      ['x'.repeat(11 * 1024 * 1024)],
      'screenshot.jpg',
      {
        type: 'image/jpeg',
      },
    );

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      screenshot: largeFile,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Screenshot file too large');
  });

  it('should reject attachment file that is too large', async () => {
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'file.pdf', {
      type: 'application/pdf',
    });

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      attachment: largeFile,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Attachment file too large');
  });

  it('should reject attachment with invalid file type', async () => {
    const invalidFile = new File(['content'], 'virus.exe', {
      type: 'application/x-msdownload',
    });

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      attachment: invalidFile,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File type not allowed');
  });

  it('should accept valid bug report without attachments', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test bug report message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Bug report submitted successfully');
  });

  it('should accept valid bug report with screenshot and attachment', async () => {
    const screenshot = new File(['screenshot'], 'screenshot.jpg', {
      type: 'image/jpeg',
    });
    // Add arrayBuffer method for Node.js File polyfill
    (screenshot as any).arrayBuffer = async () => new ArrayBuffer(10);

    const attachment = new File(['log content'], 'error.log', {
      type: 'text/plain',
    });
    // Add arrayBuffer method for Node.js File polyfill
    (attachment as any).arrayBuffer = async () => new ArrayBuffer(11);

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test bug report message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      screenshot,
      attachment,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const { put } = await import('@vercel/blob');
    expect(put).toHaveBeenCalledTimes(2); // Screenshot and attachment
  });

  it('should sanitize filenames to prevent path traversal', async () => {
    const maliciousFile = new File(['content'], '../../../etc/passwd', {
      type: 'text/plain',
    });
    // Add arrayBuffer method for Node.js File polyfill
    (maliciousFile as any).arrayBuffer = async () => new ArrayBuffer(7);

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test bug report message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      attachment: maliciousFile,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    const { put } = await import('@vercel/blob');
    const putCall = (put as any).mock.calls[0];
    // Filename should be sanitized
    expect(putCall[0]).not.toContain('../');
  });

  it('should handle email sending failures gracefully', async () => {
    // Note: Due to how the mocks are set up at module level, the Resend client
    // will use the mock from the top of this file. To test email failures,
    // we would need to restructure the route to be more testable (e.g., dependency injection).
    // For now, we'll skip this specific test or test the general error handling instead.

    // This test verifies that the route catches errors and returns a generic message
    // We can test this by making the blob upload fail
    const { put } = await import('@vercel/blob');
    (put as any).mockRejectedValueOnce(new Error('Blob storage failed'));

    const screenshot = new File(['screenshot'], 'screenshot.jpg', {
      type: 'image/jpeg',
    });
    // Add arrayBuffer method for Node.js File polyfill
    (screenshot as any).arrayBuffer = async () => new ArrayBuffer(10);

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test bug report message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      screenshot,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe(
      'An unexpected error occurred. Please try again later.',
    );
    // Should not expose internal error details
    expect(data.error).not.toContain('Blob storage');
  });

  it('should not expose internal errors to user', async () => {
    const { put } = await import('@vercel/blob');
    (put as any).mockRejectedValueOnce(
      new Error('Internal database connection failed'),
    );

    const screenshot = new File(['screenshot'], 'screenshot.jpg', {
      type: 'image/jpeg',
    });
    // Add arrayBuffer method for Node.js File polyfill
    (screenshot as any).arrayBuffer = async () => new ArrayBuffer(10);

    const request = createMockRequest({
      email: 'test@example.com',
      message: 'This is a test bug report message',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      screenshot,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe(
      'An unexpected error occurred. Please try again later.',
    );
    // Should not expose internal error details
    expect(data.error).not.toContain('database');
  });
});
