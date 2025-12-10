# UK Travel History Parser

A professional Next.js web application for parsing UK Home Office travel history PDFs and calculating days spent outside the UK. Built with TanStack React Table, MobX state management, and shadcn/ui.

## Features

- **PDF Import**: Upload Home Office SAR documents to auto-populate travel history
- **Editable Table**: Click any cell to edit dates and routes inline
- **Add/Delete Trips**: Manually add trips or remove incorrect entries
- **Live Calculations**: Full days outside UK calculated automatically
- **Excel Export**: Download formatted spreadsheet with all data
- **Mobile-First**: Responsive design with card view on mobile, table on desktop
- **Professional UI**: Clean, minimalist design using shadcn/ui components

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **State Management**: MobX
- **Table**: TanStack React Table v8
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **PDF Parsing**: pdf-parse
- **Excel Generation**: ExcelJS

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/uk-travel-parser.git
cd uk-travel-parser

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/uk-travel-parser)

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

## Project Structure

```
uk-travel-parser/
├── app/
│   ├── api/
│   │   ├── parse/route.ts      # PDF parsing endpoint
│   │   └── export/route.ts     # Excel export endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Main page
├── components/
│   ├── ui/                     # shadcn/ui components
│   └── TravelTable.tsx         # Main table component
├── stores/
│   └── travelStore.ts          # MobX store
├── lib/
│   ├── parser.ts               # PDF parsing logic
│   └── utils.ts                # Utility functions
└── package.json
```

## Usage

1. **Import from PDF**: Click "Import PDF" to upload a Home Office travel history document
2. **Manual Entry**: Click "Add Trip" to add entries manually
3. **Edit**: Click any cell in the table to edit the value
4. **Delete**: Click the trash icon to remove a trip
5. **Export**: Click "Export Excel" to download the data

## Calculation Method

**Full Days = (Return Date − Departure Date) − 1**

This excludes both the departure day and return day, counting only complete days spent abroad—the standard method for UK residency calculations.

## License

MIT
