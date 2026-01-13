import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a number of bytes into a human-readable string.
 * @param {number} bytes - The number of bytes to convert.
 * @param {number} decimals - How many decimal places to show (default 2).
 * @returns {string} The formatted string (e.g., "5 MB").
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  // Calculate which unit index to use
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export class NeverError extends Error {
  constructor(value: never) {
    super(`Unexpected value: ${JSON.stringify(value)}`);
  }
}
