import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {format, parseISO} from 'date-fns'
import { enGB } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date string (YYYY-MM-DD) to DD/MM/YYYY format
 * This ensures consistent formatting between server and client to avoid hydration mismatches
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const isoDate = parseISO(dateString);
  return format(isoDate, 'MMMM d, yyyy', { locale: enGB })
}

export class NeverError extends Error {
  constructor(value: never) {
    super(`Unexpected value: ${JSON.stringify(value)}`);
  }
}
