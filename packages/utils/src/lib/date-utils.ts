import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';

import 'dayjs/locale/en-gb';
import { logger } from './logger';
import { NeverError } from './utils';

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);

dayjs.locale('en-gb');

export type FormattingType = 'ui' | 'api' | 'keyMonth' | 'keyLabel';
/**
 * Format date string (YYYY-MM-DD) to required format
 * This ensures consistent formatting between server and client to avoid hydration mismatches
 */
export function formatDate(
  dateObj: string | Date | Dayjs | null,
  purpose: FormattingType = 'ui',
): string | null {
  if (!dateObj) return null;

  const date =
    typeof dateObj === 'string' ? parseDate(dateObj) : dayjs(dateObj);
  if (!date || !date.isValid()) return null;

  switch (purpose) {
    case 'keyMonth':
      return date.format('YYYY-MM');
    case 'keyLabel':
      return date.format('MMMM YYYY');
    case 'api':
      return date.format('YYYY-MM-DD');
    case 'ui':
      return date.format('MMMM D, YYYY');
    default:
      throw new NeverError(purpose);
  }
}

/**
 * Parse date string to ISO format (YYYY-MM-DD)
 * @param dateStr - Date string in various formats
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseDate(dateStr: string): Dayjs | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const formats = [
    'DD/MM/YYYY', // DD/MM/YYYY
    'YYYY-MM-DD', // YYYY-MM-DD
    'DD-MM-YYYY', // DD-MM-YYYY
  ];

  for (const format of formats) {
    const parsed = dayjs(dateStr.trim(), format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }

  return null;
}

/**
 * Unsafely parse date string to ISO format (YYYY-MM-DD)
 * @param dateStr - Date string in various formats
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseDateUnsafe(dateStr: string): Dayjs {
  if (!dateStr || typeof dateStr !== 'string')
    throw new Error('Date string is required');

  const formats = [
    'DD/MM/YYYY', // DD/MM/YYYY
    'YYYY-MM-DD', // YYYY-MM-DD
    'DD-MM-YYYY', // DD-MM-YYYY
  ];

  for (const format of formats) {
    const parsed = dayjs(dateStr.trim(), format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }

  throw new Error(`Invalid date string: ${dateStr}`);
}

export function today(): Dayjs {
  return dayjs().startOf('day');
}
export function toDayjs(dateString: string | Dayjs | null): Dayjs | null {
  if (!dateString) return null;

  const date = dayjs(dateString);
  if (!date.isValid()) {
    logger.warn(`Invalid date string: ${dateString}`);
    return null;
  }

  return date;
}

export function toDate(dateString: string | Dayjs | null): Date | null {
  return toDayjs(dateString)?.toDate() ?? null;
}

/**
 * Equivalent of date-fns isBefore
 */
export function isBefore(
  date: string | Date | Dayjs | null,
  dateToCompare: string | Date | Dayjs | null,
): boolean {
  if (!date || !dateToCompare) return false;
  const d1 = dayjs(date);
  const d2 = dayjs(dateToCompare);

  if (!d1.isValid() || !d2.isValid()) return false;

  return d1.isBefore(d2);
}

/**
 * Equivalent of date-fns isAfter
 */
export function isAfter(
  date: string | Date | Dayjs | null,
  dateToCompare: string | Date | Dayjs | null,
): boolean {
  if (!date || !dateToCompare) return false;
  const d1 = dayjs(date);
  const d2 = dayjs(dateToCompare);

  if (!d1.isValid() || !d2.isValid()) return false;

  return d1.isAfter(d2);
}

/**
 * Equivalent of date-fns differenceInDays
 * Returns full day difference (date1 - date2)
 */
export function differenceInDays(
  dateLeft: string | Date | Dayjs | null,
  dateRight: string | Date | Dayjs | null,
): number {
  if (!dateLeft || !dateRight) return 0;
  const left = dayjs(dateLeft);
  const right = dayjs(dateRight);

  if (!left.isValid() || !right.isValid()) return 0;

  return left.diff(right, 'day');
}

/* ------------------ add / sub ------------------ */

export function addDays(
  date: string | Date | Dayjs | null,
  amount: number,
): Dayjs | null {
  if (!date) return null;
  const d = dayjs(date);
  return d.isValid() ? d.add(amount, 'day') : null;
}

export function subDays(
  date: string | Date | Dayjs | null,
  amount: number,
): Dayjs | null {
  if (!date) return null;
  const d = dayjs(date);
  return d.isValid() ? d.subtract(amount, 'day') : null;
}

export function addYears(
  date: string | Date | Dayjs | null,
  amount: number,
): Dayjs | null {
  if (!date) return null;
  const d = dayjs(date);
  return d.isValid() ? d.add(amount, 'year') : null;
}

export function subYears(
  date: string | Date | Dayjs | null,
  amount: number,
): Dayjs | null {
  if (!date) return null;
  const d = dayjs(date);
  return d.isValid() ? d.subtract(amount, 'year') : null;
}

export function isWithinInterval(
  date: string | Date | Dayjs,
  interval: { start: string | Date | Dayjs; end: string | Date | Dayjs },
): boolean {
  const d = dayjs(date);
  const start = dayjs(interval.start);
  const end = dayjs(interval.end);

  if (!d.isValid() || !start.isValid() || !end.isValid()) return false;

  // date-fns is inclusive
  return d.isBetween(start, end, null, '[]');
}

export function areIntervalsOverlapping(
  intervalLeft: { start: string | Date | Dayjs; end: string | Date | Dayjs },
  intervalRight: { start: string | Date | Dayjs; end: string | Date | Dayjs },
): boolean {
  const aStart = dayjs(intervalLeft.start);
  const aEnd = dayjs(intervalLeft.end);
  const bStart = dayjs(intervalRight.start);
  const bEnd = dayjs(intervalRight.end);

  if (
    !aStart.isValid() ||
    !aEnd.isValid() ||
    !bStart.isValid() ||
    !bEnd.isValid()
  ) {
    return false;
  }

  // Inclusive overlap (matches date-fns default)
  return aStart.isSameOrBefore(bEnd) && bStart.isSameOrBefore(aEnd);
}

/* ------------------ startOf ------------------ */

export function startOfDay(date: string | Date | Dayjs): Dayjs | null {
  const d = dayjs(date);
  return d.isValid() ? d.startOf('day') : null;
}

/**
 * Validate if a date string is valid ISO format (YYYY-MM-DD)
 * @param date - ISO date string
 * @returns true if valid, false otherwise
 */
export const isValidDate = (date: string | Dayjs | null): boolean => {
  if (typeof date === 'string' && !date) return false;
  if (date === null) return false;
  if (date instanceof dayjs) {
    return date.isValid();
  }

  return dayjs(date, 'YYYY-MM-DD', true).isValid();
};

/**
 * Convert ISO date string to milliseconds for comparison
 * Avoids timezone issues by treating as UTC midnight
 */
export const toMs = (d: string): number => {
  return dayjs.utc(d, 'YYYY-MM-DD', true).valueOf();
};
