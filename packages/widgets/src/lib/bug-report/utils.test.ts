import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeFilename, sanitizeUrl, escapeHtml, rateLimiter } from './utils';

describe('Bug Report Utils', () => {
  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      // The sanitization replaces '/' and '\\' with '_', but doesn't replace '.' in the middle
      expect(sanitizeFilename('../../etc/passwd')).toBe('_.._etc_passwd');
    });

    it('should remove null bytes', () => {
      expect(sanitizeFilename('file\0name.txt')).toBe('file_name.txt');
    });

    it('should remove leading dots', () => {
      expect(sanitizeFilename('...hidden.txt')).toBe('hidden.txt');
    });

    it('should preserve valid filenames', () => {
      expect(sanitizeFilename('report-2024.pdf')).toBe('report-2024.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300);
      expect(sanitizeFilename(longName).length).toBe(255);
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeFilename('file<>name.txt')).toBe('file__name.txt');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('should allow valid https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('should reject javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('should reject data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('should reject invalid URLs', () => {
      expect(sanitizeUrl('not a url')).toBeNull();
    });

    it('should preserve URL parameters', () => {
      const url = 'https://example.com/path?foo=bar&baz=qux';
      expect(sanitizeUrl(url)).toBe(url);
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than signs', () => {
      expect(escapeHtml('5 < 10')).toBe('5 &lt; 10');
    });

    it('should escape greater than signs', () => {
      expect(escapeHtml('10 > 5')).toBe('10 &gt; 5');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    });

    it('should escape apostrophes', () => {
      expect(escapeHtml("It's working")).toBe('It&#039;s working');
    });

    it('should escape script tags', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;'
      );
    });

    it('should not modify safe text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('rateLimiter', () => {
    beforeEach(() => {
      // Clear rate limiter state between tests
      // Note: This is simplified; in real implementation you'd expose a reset method
      vi.useFakeTimers();
    });

    it('should allow requests under the limit', () => {
      expect(rateLimiter.check('192.168.1.1')).toBe(true);
      expect(rateLimiter.check('192.168.1.1')).toBe(true);
      expect(rateLimiter.check('192.168.1.1')).toBe(true);
    });

    it('should block requests over the limit', () => {
      rateLimiter.check('192.168.1.2');
      rateLimiter.check('192.168.1.2');
      rateLimiter.check('192.168.1.2');
      expect(rateLimiter.check('192.168.1.2')).toBe(false);
    });

    it('should allow requests from different IPs independently', () => {
      expect(rateLimiter.check('192.168.1.3')).toBe(true);
      expect(rateLimiter.check('192.168.1.4')).toBe(true);
      expect(rateLimiter.check('192.168.1.5')).toBe(true);
    });

    it('should reset after time window', () => {
      rateLimiter.check('192.168.1.6');
      rateLimiter.check('192.168.1.6');
      rateLimiter.check('192.168.1.6');

      // Advance time by more than window (1 hour + 1ms)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Should allow requests again
      expect(rateLimiter.check('192.168.1.6')).toBe(true);
    });
  });
});
