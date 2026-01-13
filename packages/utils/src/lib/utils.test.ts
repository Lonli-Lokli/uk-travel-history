import { describe, expect } from 'vitest';
import { formatBytes } from './utils';

describe('utils', () => {
  describe('formatBytes formatting', () => {
    it('should format bytes to the correct unit', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 ** 2 * 5)).toBe('5 MB');
      expect(formatBytes(1024 ** 3)).toBe('1 GB');
    });

    it('should handle decimal precision', () => {
      const bytes = 1234567; // Approx 1.18 MB
      expect(formatBytes(bytes, 2)).toBe('1.18 MB');
      expect(formatBytes(bytes, 0)).toBe('1 MB');
    });

    it('should remove trailing zeros via parseFloat', () => {
      // 1024 * 1024 * 5 is exactly 5 MB, shouldn't show 5.00 MB
      expect(formatBytes(1024 * 1024 * 5, 2)).toBe('5 MB');
    });

    it('should handle very large numbers', () => {
      expect(formatBytes(1024 ** 8)).toBe('1 YB'); // Yottabytes
    });

    it('should handle non-numeric or falsy inputs gracefully', () => {
      expect(formatBytes(NaN)).toBe('0 Bytes');
    });
  });
});
