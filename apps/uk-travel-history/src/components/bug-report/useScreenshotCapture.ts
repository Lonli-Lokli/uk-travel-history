'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

export interface ScreenshotCaptureResult {
  blob: Blob | null;
  error: string | null;
}

/**
 * Hook for capturing screenshots of the current page
 *
 * Features:
 * - Saves and restores scroll position
 * - Supports cancellation via AbortController
 * - Proper cleanup on unmount
 *
 * @returns Object containing capture function and loading state
 */
export function useScreenshotCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const captureScreenshot = useCallback(async (): Promise<ScreenshotCaptureResult> => {
    // Create new AbortController for this capture
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsCapturing(true);

    try {
      // Save current scroll position
      const originalScrollX = window.scrollX;
      const originalScrollY = window.scrollY;

      // Scroll to top for consistent screenshots
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Small delay to ensure scroll completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if capture was aborted
      if (signal.aborted) {
        throw new Error('Screenshot capture was cancelled');
      }

      // Capture the screenshot
      // Note: Using type assertion as @types/html2canvas is outdated (v0.5 types for v1.4.1)
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
      } as any);

      // Check if capture was aborted
      if (signal.aborted) {
        throw new Error('Screenshot capture was cancelled');
      }

      // Restore scroll position
      window.scrollTo({
        top: originalScrollY,
        left: originalScrollX,
        behavior: 'instant',
      });

      // Convert canvas to blob (JPEG with 80% quality for smaller file size)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.8);
      });

      if (!blob) {
        throw new Error('Failed to create screenshot blob');
      }

      return { blob, error: null };
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return {
        blob: null,
        error: error instanceof Error ? error.message : 'Failed to capture screenshot',
      };
    } finally {
      setIsCapturing(false);
      abortControllerRef.current = null;
    }
  }, []);

  return {
    captureScreenshot,
    isCapturing,
  };
}
