import { describe, it, expect } from 'vitest';
import { parseCsvText, parseClipboardText, parseXlsxFile } from './csv-parser';
import ExcelJS from 'exceljs';

describe('CSV Parser', () => {
  describe('parseCsvText', () => {
    it('should parse valid CSV with DD/MM/YYYY dates', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris
01/02/2024,10/02/2024,Berlin,London`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(2);
      expect(result.trips[0]).toEqual({
        outDate: '2024-01-15',
        inDate: '2024-01-20',
        outRoute: 'London',
        inRoute: 'Paris',
      });
      expect(result.trips[1]).toEqual({
        outDate: '2024-02-01',
        inDate: '2024-02-10',
        outRoute: 'Berlin',
        inRoute: 'London',
      });
    });

    it('should parse valid CSV with YYYY-MM-DD dates', () => {
      const csv = `Date Out,Date In,Departure,Return
2024-01-15,2024-01-20,London,Paris
2024-02-01,2024-02-10,Berlin,London`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(2);
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('2024-01-20');
    });

    it('should handle tab-separated values (TSV)', () => {
      const tsv = `Date Out\tDate In\tDeparture\tReturn
15/01/2024\t20/01/2024\tLondon\tParis
01/02/2024\t10/02/2024\tBerlin\tLondon`;

      const result = parseCsvText(tsv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(2);
    });

    it('should normalize various header formats', () => {
      const csv = `#,out date,in date,departure route,return route
1,15/01/2024,20/01/2024,London,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
    });

    it('should handle empty outRoute and inRoute fields', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,,`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('');
      expect(result.trips[0].inRoute).toBe('');
    });

    it('should skip rows with both dates empty', () => {
      const csv = `Date Out,Date In,Departure,Return
,,London,Paris
15/01/2024,20/01/2024,Berlin,London`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
      expect(result.warnings).toContain('Row 2: Both dates are empty, skipping');
    });

    it('should handle incomplete trips (missing inDate)', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,,London,`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('');
    });

    it('should handle incomplete trips (missing outDate)', () => {
      const csv = `Date Out,Date In,Departure,Return
,20/01/2024,,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
      expect(result.trips[0].outDate).toBe('');
      expect(result.trips[0].inDate).toBe('2024-01-20');
    });

    it('should reject invalid date formats', () => {
      const csv = `Date Out,Date In,Departure,Return
invalid-date,20/01/2024,London,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Row 2: Invalid departure date format "invalid-date". Use DD/MM/YYYY or YYYY-MM-DD'
      );
    });

    it('should reject departure date after return date', () => {
      const csv = `Date Out,Date In,Departure,Return
20/01/2024,15/01/2024,London,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Row 2: Departure date is after return date');
    });

    it('should reject empty CSV content', () => {
      const result = parseCsvText('');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('CSV content is empty');
    });

    it('should reject CSV without required columns', () => {
      const csv = `Random,Columns
value1,value2`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('CSV must contain "Date Out" and "Date In" columns');
    });

    it('should ignore calculated columns like "Calendar Days" and "Full Days"', () => {
      const csv = `Date Out,Date In,Departure,Return,Calendar Days,Full Days Outside UK
15/01/2024,20/01/2024,London,Paris,5,4`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
      // Calculated columns should be ignored
    });

    it('should sanitize CSV injection attempts in route fields', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,=1+1,@IMPORTXML("https://evil.com")`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('1+1'); // Leading = removed
      expect(result.trips[0].inRoute).toBe('IMPORTXML("https://evil.com")'); // Leading @ removed
    });

    it('should handle formula injection with +, -, = characters', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,+CMD|'/c calc',=-2+3`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('CMD|\'/c calc\''); // Leading + removed
      expect(result.trips[0].inRoute).toBe('-2+3'); // Leading = removed
    });

    it('should handle leap year dates correctly', () => {
      const csv = `Date Out,Date In,Departure,Return
28/02/2024,01/03/2024,London,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outDate).toBe('2024-02-28');
      expect(result.trips[0].inDate).toBe('2024-03-01');
    });

    it('should handle dates spanning year boundaries', () => {
      const csv = `Date Out,Date In,Departure,Return
20/12/2023,05/01/2024,London,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outDate).toBe('2023-12-20');
      expect(result.trips[0].inDate).toBe('2024-01-05');
    });

    it('should handle multiple trips with mixed valid and invalid data', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris
invalid,20/02/2024,Berlin,London
01/03/2024,10/03/2024,Madrid,Barcelona`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(false);
      expect(result.trips).toHaveLength(2); // Only valid trips
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle same-day return trips', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,15/01/2024,London,Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('2024-01-15');
    });

    it('should handle whitespace in date fields', () => {
      const csv = `Date Out,Date In,Departure,Return
  15/01/2024  ,  20/01/2024  ,  London  ,  Paris  `;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('2024-01-20');
      expect(result.trips[0].outRoute).toBe('London');
      expect(result.trips[0].inRoute).toBe('Paris');
    });

    it('should return appropriate error for CSV with only headers', () => {
      const csv = `Date Out,Date In,Departure,Return`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No data rows found in CSV');
    });

    it('should handle CSV with BOM (Byte Order Mark)', () => {
      const csv = '\uFEFFDate Out,Date In,Departure,Return\n15/01/2024,20/01/2024,London,Paris';

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
    });
  });

  describe('parseClipboardText', () => {
    it('should parse clipboard text with tab separators (from Excel)', () => {
      const clipboardData = `Date Out\tDate In\tDeparture\tReturn
15/01/2024\t20/01/2024\tLondon\tParis`;

      const result = parseClipboardText(clipboardData);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
    });

    it('should parse clipboard text with comma separators', () => {
      const clipboardData = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,London,Paris`;

      const result = parseClipboardText(clipboardData);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1);
    });

    it('should handle empty clipboard text', () => {
      const result = parseClipboardText('');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('CSV content is empty');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large CSV files (stress test)', () => {
      let csv = 'Date Out,Date In,Departure,Return\n';

      // Generate 1000 trips
      for (let i = 1; i <= 1000; i++) {
        const day = String(i % 28 + 1).padStart(2, '0');
        csv += `${day}/01/2024,${day}/01/2024,London,Paris\n`;
      }

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(1000);
    });

    it('should handle special characters in route names', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,"London, UK","Paris, France"`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('London, UK');
      expect(result.trips[0].inRoute).toBe('Paris, France');
    });

    it('should handle quotes in route names', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,"London ""Heathrow""",Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('London "Heathrow"');
    });

    it('should handle newlines in quoted fields', () => {
      const csv = `Date Out,Date In,Departure,Return
15/01/2024,20/01/2024,"London
Heathrow",Paris`;

      const result = parseCsvText(csv);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toContain('London');
    });
  });

  describe('parseXlsxFile', () => {
    async function createTestWorkbook(data: any[]): Promise<ArrayBuffer> {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Travel History');

      // Add headers
      sheet.columns = [
        { header: '#', key: 'num', width: 8 },
        { header: 'Date Out', key: 'outDate', width: 16 },
        { header: 'Date In', key: 'inDate', width: 16 },
        { header: 'Departure', key: 'outRoute', width: 35 },
        { header: 'Return', key: 'inRoute', width: 35 },
      ];

      // Add data rows
      data.forEach((row, index) => {
        sheet.addRow({
          num: index + 1,
          outDate: row.outDate,
          inDate: row.inDate,
          outRoute: row.outRoute || '',
          inRoute: row.inRoute || '',
        });
      });

      return await workbook.xlsx.writeBuffer();
    }

    it('should parse valid XLSX file with DD/MM/YYYY dates', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '15/01/2024', inDate: '20/01/2024', outRoute: 'London', inRoute: 'Paris' },
        { outDate: '01/02/2024', inDate: '10/02/2024', outRoute: 'Berlin', inRoute: 'London' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(2);
      expect(result.trips[0]).toEqual({
        outDate: '2024-01-15',
        inDate: '2024-01-20',
        outRoute: 'London',
        inRoute: 'Paris',
      });
    });

    it('should parse valid XLSX file with YYYY-MM-DD dates', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '2024-01-15', inDate: '2024-01-20', outRoute: 'London', inRoute: 'Paris' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('2024-01-20');
    });

    it('should handle empty route fields', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '15/01/2024', inDate: '20/01/2024', outRoute: '', inRoute: '' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('');
      expect(result.trips[0].inRoute).toBe('');
    });

    it('should handle incomplete trips (missing return date)', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '15/01/2024', inDate: '', outRoute: 'London', inRoute: '' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('');
    });

    it('should handle special characters in routes', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '15/01/2024', inDate: '20/01/2024', outRoute: 'London, UK', inRoute: 'Paris, France' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips[0].outRoute).toBe('London, UK');
      expect(result.trips[0].inRoute).toBe('Paris, France');
    });

    it('should skip rows with empty dates', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '15/01/2024', inDate: '20/01/2024', outRoute: 'London', inRoute: 'Paris' },
        { outDate: '', inDate: '', outRoute: '', inRoute: '' },
        { outDate: '01/02/2024', inDate: '10/02/2024', outRoute: 'Berlin', inRoute: 'London' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Both dates are empty');
    });

    it('should handle invalid date formats', async () => {
      const buffer = await createTestWorkbook([
        { outDate: 'invalid-date', inDate: '20/01/2024', outRoute: 'London', inRoute: 'Paris' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid departure date');
    });

    it('should validate departure date is not after return date', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '20/01/2024', inDate: '15/01/2024', outRoute: 'London', inRoute: 'Paris' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Departure date is after return date');
    });

    it('should handle workbook without Travel History sheet', async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Other Sheet');
      const buffer = await workbook.xlsx.writeBuffer();

      const result = await parseXlsxFile(buffer);

      // Should use first available worksheet
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Excel file must contain');
    });

    it('should sanitize CSV injection attempts', async () => {
      const buffer = await createTestWorkbook([
        { outDate: '15/01/2024', inDate: '20/01/2024', outRoute: '=cmd|/c calc', inRoute: '+HYPERLINK("evil")' },
      ]);

      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      // Should remove leading = and +
      expect(result.trips[0].outRoute).toBe('cmd|/c calc');
      expect(result.trips[0].inRoute).toBe('HYPERLINK("evil")');
    });

    it('should round-trip with exported data', async () => {
      // Simulate data that would be exported
      const exportedData = [
        { outDate: '15/01/2024', inDate: '20/01/2024', outRoute: 'London Heathrow', inRoute: 'Paris CDG' },
        { outDate: '10/03/2024', inDate: '15/03/2024', outRoute: 'Manchester', inRoute: 'Dublin' },
      ];

      const buffer = await createTestWorkbook(exportedData);
      const result = await parseXlsxFile(buffer);

      expect(result.success).toBe(true);
      expect(result.trips.length).toBe(2);

      // Verify dates are correctly parsed
      expect(result.trips[0].outDate).toBe('2024-01-15');
      expect(result.trips[0].inDate).toBe('2024-01-20');
      expect(result.trips[1].outDate).toBe('2024-03-10');
      expect(result.trips[1].inDate).toBe('2024-03-15');

      // Verify routes are preserved
      expect(result.trips[0].outRoute).toBe('London Heathrow');
      expect(result.trips[0].inRoute).toBe('Paris CDG');
      expect(result.trips[1].outRoute).toBe('Manchester');
      expect(result.trips[1].inRoute).toBe('Dublin');
    });
  });
});
