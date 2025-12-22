import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date string (YYYY-MM-DD) to DD/MM/YYYY format
 * This ensures consistent formatting between server and client to avoid hydration mismatches
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  return dateString.split('-').reverse().join('/');
}

export class NeverError extends Error {
  constructor(value: never) {
    super(`Unexpected value: ${JSON.stringify(value)}`);
  }
}
