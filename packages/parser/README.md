# @uth/parser

PDF parsing for UK Home Office Subject Access Request (SAR) travel history documents.

## Purpose

Extracts travel history from PDF documents provided by UK Home Office border control data.

## Key Features

- **PDF Parsing**: Extracts text from SAR PDFs
- **Pattern Matching**: Regex-based date and route extraction
- **Data Normalization**: Converts to structured trip data
- **Error Handling**: Graceful failures with validation

## API Reference

### `parseTravelHistoryPDF(buffer): Promise<ParseResult>`

Parse PDF buffer and extract trips.

**Returns:**

```typescript
interface ParseResult {
  trips: Array<{
    departure: string; // ISO date
    return: string; // ISO date
    route: string;
  }>;
  errors: string[];
}
```

## Usage

```typescript
import { parseTravelHistoryPDF } from '@uth/parser';

const pdfBuffer = await file.arrayBuffer();
const result = await parseTravelHistoryPDF(Buffer.from(pdfBuffer));

if (result.errors.length > 0) {
  console.warn('Parsing errors:', result.errors);
}

console.log('Extracted trips:', result.trips);
```

## PDF Format

Expects UK Home Office SAR format with entries like:

```
01/06/2020 LONDON HEATHROW
15/06/2020 LONDON HEATHROW
```

## Testing

```bash
nx test parser
```

## Dependencies

- `pdf-parse` - PDF text extraction

## Related

- **[`@uth/stores`](../stores/README.md)** - Trip import destination
