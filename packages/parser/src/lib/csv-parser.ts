import Papa from 'papaparse';
import { parseDate } from './parser';

export interface CSVTripRow {
  outDate: string;
  inDate: string;
  outRoute?: string;
  inRoute?: string;
}

export interface ParsedTrip {
  outDate: string; // ISO format
  inDate: string; // ISO format
  outRoute: string;
  inRoute: string;
}

export interface CSVParseResult {
  success: boolean;
  trips: ParsedTrip[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse CSV text containing travel history data
 * Accepts both comma and tab delimiters
 * Handles dates in DD/MM/YYYY or YYYY-MM-DD format
 */
export function parseCsvText(csvText: string): CSVParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trips: ParsedTrip[] = [];

  if (!csvText || csvText.trim().length === 0) {
    errors.push('CSV content is empty');
    return { success: false, trips: [], errors, warnings };
  }

  // Try parsing with Papa Parse (auto-detects delimiter)
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => {
      // Normalize header names to match expected columns
      const normalized = header.trim().toLowerCase();
      if (normalized === '#' || normalized === 'num' || normalized === 'number') {
        return 'num';
      }
      if (normalized === 'date out' || normalized === 'dateout' || normalized === 'departure date' || normalized === 'out date') {
        return 'outDate';
      }
      if (normalized === 'date in' || normalized === 'datein' || normalized === 'return date' || normalized === 'in date') {
        return 'inDate';
      }
      if (normalized === 'departure' || normalized === 'departure route' || normalized === 'out route') {
        return 'outRoute';
      }
      if (normalized === 'return' || normalized === 'return route' || normalized === 'in route') {
        return 'inRoute';
      }
      // Ignore calculated columns
      if (normalized === 'calendar days' || normalized === 'full days outside uk' || normalized === 'full days') {
        return '_ignore_' + header;
      }
      return header;
    },
  });

  if (result.errors.length > 0) {
    result.errors.forEach((err) => {
      errors.push(`Parse error at row ${err.row}: ${err.message}`);
    });
  }

  if (result.data.length === 0) {
    errors.push('No data rows found in CSV');
    return { success: false, trips: [], errors, warnings };
  }

  // Check if we have the required columns
  const firstRow = result.data[0];
  if (!('outDate' in firstRow) || !('inDate' in firstRow)) {
    errors.push('CSV must contain "Date Out" and "Date In" columns');
    return { success: false, trips: [], errors, warnings };
  }

  // Parse each row
  result.data.forEach((row, index) => {
    const rowNum = index + 2; // +1 for header, +1 for 0-index

    const outDateStr = row.outDate?.trim() || '';
    const inDateStr = row.inDate?.trim() || '';

    if (!outDateStr && !inDateStr) {
      warnings.push(`Row ${rowNum}: Both dates are empty, skipping`);
      return;
    }

    // Parse dates
    let outDate: Date | null = null;
    let inDate: Date | null = null;

    if (outDateStr) {
      outDate = parseDate(outDateStr);
      if (!outDate) {
        errors.push(`Row ${rowNum}: Invalid departure date format "${outDateStr}". Use DD/MM/YYYY or YYYY-MM-DD`);
        return;
      }
    }

    if (inDateStr) {
      inDate = parseDate(inDateStr);
      if (!inDate) {
        errors.push(`Row ${rowNum}: Invalid return date format "${inDateStr}". Use DD/MM/YYYY or YYYY-MM-DD`);
        return;
      }
    }

    // Validate date logic
    if (outDate && inDate && outDate > inDate) {
      errors.push(`Row ${rowNum}: Departure date is after return date`);
      return;
    }

    trips.push({
      outDate: outDate ? outDate.toISOString().split('T')[0] : '',
      inDate: inDate ? inDate.toISOString().split('T')[0] : '',
      outRoute: row.outRoute?.trim() || '',
      inRoute: row.inRoute?.trim() || '',
    });
  });

  return {
    success: errors.length === 0,
    trips,
    errors,
    warnings,
  };
}

/**
 * Parse clipboard text (could be CSV or TSV from Excel/Google Sheets)
 */
export function parseClipboardText(text: string): CSVParseResult {
  // Clipboard data from Excel/Google Sheets is often tab-separated
  // Papa Parse will auto-detect the delimiter
  return parseCsvText(text);
}
