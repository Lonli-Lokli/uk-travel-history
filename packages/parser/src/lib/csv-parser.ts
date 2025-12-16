import Papa from 'papaparse';
import ExcelJS from 'exceljs';
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

/**
 * Sanitize CSV field to prevent formula injection
 * Remove leading characters that could trigger formula execution: =, +, -, @
 */
function sanitizeField(field: string): string {
  if (!field) return field;

  const trimmed = field.trim();
  if (trimmed.length === 0) return trimmed;

  // Check if field starts with potential formula trigger
  const firstChar = trimmed[0];
  if (
    firstChar === '=' ||
    firstChar === '+' ||
    firstChar === '-' ||
    firstChar === '@'
  ) {
    // Remove the leading character to prevent formula injection
    return trimmed.substring(1);
  }

  return trimmed;
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
      if (
        normalized === '#' ||
        normalized === 'num' ||
        normalized === 'number'
      ) {
        return 'num';
      }
      if (
        normalized === 'date out' ||
        normalized === 'dateout' ||
        normalized === 'departure date' ||
        normalized === 'out date'
      ) {
        return 'outDate';
      }
      if (
        normalized === 'date in' ||
        normalized === 'datein' ||
        normalized === 'return date' ||
        normalized === 'in date'
      ) {
        return 'inDate';
      }
      if (
        normalized === 'departure' ||
        normalized === 'departure route' ||
        normalized === 'out route'
      ) {
        return 'outRoute';
      }
      if (
        normalized === 'return' ||
        normalized === 'return route' ||
        normalized === 'in route'
      ) {
        return 'inRoute';
      }
      // Ignore calculated columns
      if (
        normalized === 'calendar days' ||
        normalized === 'full days outside uk' ||
        normalized === 'full days'
      ) {
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

    // Parse dates to ISO strings
    let outDate: string | null = null;
    let inDate: string | null = null;

    if (outDateStr) {
      outDate = parseDate(outDateStr);
      if (!outDate) {
        errors.push(
          `Row ${rowNum}: Invalid departure date format "${outDateStr}". Use DD/MM/YYYY or YYYY-MM-DD`,
        );
        return;
      }
    }

    if (inDateStr) {
      inDate = parseDate(inDateStr);
      if (!inDate) {
        errors.push(
          `Row ${rowNum}: Invalid return date format "${inDateStr}". Use DD/MM/YYYY or YYYY-MM-DD`,
        );
        return;
      }
    }

    // Validate date logic (compare ISO strings)
    if (outDate && inDate && outDate > inDate) {
      errors.push(`Row ${rowNum}: Departure date is after return date`);
      return;
    }

    trips.push({
      outDate: outDate || '',  // Already in ISO format (YYYY-MM-DD)
      inDate: inDate || '',    // Already in ISO format (YYYY-MM-DD)
      outRoute: sanitizeField(row.outRoute || ''),
      inRoute: sanitizeField(row.inRoute || ''),
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
 * Parse XLSX file content
 * Handles Excel files (.xlsx) with the same structure as exported files
 */
export async function parseXlsxFile(
  arrayBuffer: ArrayBuffer,
): Promise<CSVParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trips: ParsedTrip[] = [];

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet =
      workbook.getWorksheet('Travel History') || workbook.worksheets[0];
    if (!sheet) {
      errors.push('No worksheet found in Excel file');
      return { success: false, trips: [], errors, warnings };
    }

    // Find header row (should be row 1)
    const headerRow = sheet.getRow(1);
    const headers: { [key: string]: number } = {};

    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().trim().toLowerCase() || '';
      if (value === '#' || value === 'num' || value === 'number') {
        headers.num = colNumber;
      } else if (
        value === 'date out' ||
        value === 'dateout' ||
        value === 'departure date' ||
        value === 'out date'
      ) {
        headers.outDate = colNumber;
      } else if (
        value === 'date in' ||
        value === 'datein' ||
        value === 'return date' ||
        value === 'in date'
      ) {
        headers.inDate = colNumber;
      } else if (
        value === 'departure' ||
        value === 'departure route' ||
        value === 'out route'
      ) {
        headers.outRoute = colNumber;
      } else if (
        value === 'return' ||
        value === 'return route' ||
        value === 'in route'
      ) {
        headers.inRoute = colNumber;
      }
    });

    if (!headers.outDate || !headers.inDate) {
      errors.push('Excel file must contain "Date Out" and "Date In" columns');
      return { success: false, trips: [], errors, warnings };
    }

    // Parse data rows (skip header row)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const outDateCell = row.getCell(headers.outDate).value;
      const inDateCell = row.getCell(headers.inDate).value;
      const outRouteCell = row.getCell(headers.outRoute || 999).value;
      const inRouteCell = row.getCell(headers.inRoute || 999).value;

      const outDateStr = outDateCell?.toString().trim() || '';
      const inDateStr = inDateCell?.toString().trim() || '';

      if (!outDateStr && !inDateStr) {
        warnings.push(`Row ${rowNumber}: Both dates are empty, skipping`);
        return;
      }

      // Parse dates to ISO strings
      let outDate: string | null = null;
      let inDate: string | null = null;

      if (outDateStr) {
        outDate = parseDate(outDateStr);
        if (!outDate) {
          errors.push(
            `Row ${rowNumber}: Invalid departure date format "${outDateStr}". Use DD/MM/YYYY or YYYY-MM-DD`,
          );
          return;
        }
      }

      if (inDateStr) {
        inDate = parseDate(inDateStr);
        if (!inDate) {
          errors.push(
            `Row ${rowNumber}: Invalid return date format "${inDateStr}". Use DD/MM/YYYY or YYYY-MM-DD`,
          );
          return;
        }
      }

      // Validate date logic (compare ISO strings)
      if (outDate && inDate && outDate > inDate) {
        errors.push(`Row ${rowNumber}: Departure date is after return date`);
        return;
      }

      trips.push({
        outDate: outDate || '',  // Already in ISO format (YYYY-MM-DD)
        inDate: inDate || '',    // Already in ISO format (YYYY-MM-DD)
        outRoute: sanitizeField(outRouteCell?.toString() || ''),
        inRoute: sanitizeField(inRouteCell?.toString() || ''),
      });
    });

    return {
      success: errors.length === 0,
      trips,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(
      `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    return { success: false, trips: [], errors, warnings };
  }
}

/**
 * Parse clipboard text (could be CSV or TSV from Excel/Google Sheets)
 */
export function parseClipboardText(text: string): CSVParseResult {
  // Clipboard data from Excel/Google Sheets is often tab-separated
  // Papa Parse will auto-detect the delimiter
  return parseCsvText(text);
}
