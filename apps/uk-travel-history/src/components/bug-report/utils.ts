/**
 * Utility functions for bug report feature
 */

/**
 * Sanitize filename to prevent path traversal attacks
 * Removes any characters that could be used to escape directories
 */
export function sanitizeFilename(filename: string): string {
  return (
    filename
      // Remove path separators and null bytes
      .replace(/[/\\:\0]/g, '_')
      // Remove leading dots
      .replace(/^\.+/, '')
      // Replace other special characters with underscores
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      // Limit length to prevent issues
      .substring(0, 255)
  );
}

/**
 * Sanitize URL to prevent javascript: and data: URI injection
 * Returns null if URL is invalid or dangerous
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Escape HTML to prevent XSS attacks
 * Note: React Email typically handles this, but we add explicit escaping for safety
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Simple in-memory rate limiter
 * In production, use Redis-based solution like @upstash/ratelimit
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check if request should be allowed
   * @param identifier - Usually IP address
   * @returns true if request is allowed, false if rate limit exceeded
   */
  check(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Remove expired requests
    const validRequests = userRequests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    // Cleanup old entries periodically
    if (this.requests.size > 1000) {
      this.cleanup(now);
    }

    return true;
  }

  private cleanup(now: number) {
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < this.windowMs
      );
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

export const rateLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 requests per hour
