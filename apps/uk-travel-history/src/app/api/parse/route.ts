import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@uth/utils';
import type { ParseResult } from '@uth/parser';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Lazy load PDF parser to catch initialization errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PDFParse: any;
let analyzeTravelHistory: ((text: string) => ParseResult) | undefined =
  undefined;
let initError: Error | null = null;

async function initializePdfParser() {
  if (initError) {
    throw initError;
  }

  if (PDFParse && analyzeTravelHistory) {
    return;
  }

  try {
    await import('pdf-parse/worker');
    const pdfModule = await import('pdf-parse');
    const { getPath } = await import('pdf-parse/worker');
    const parserModule = await import('@uth/parser');

    PDFParse = pdfModule.PDFParse;
    analyzeTravelHistory = parserModule.analyzeTravelHistory;
    PDFParse.setWorker(getPath());
  } catch (error) {
    initError =
      error instanceof Error
        ? error
        : new Error('Failed to initialize PDF parser');
    throw initError;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize PDF parser if not already done
    await initializePdfParser();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!analyzeTravelHistory) {
      return NextResponse.json(
        { error: 'Parser not initialized' },
        { status: 500 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const parser = new PDFParse({
      data: Buffer.from(arrayBuffer),
    });
    const text = (await parser.getText()).text;

    if (!text.includes('Inbound') && !text.includes('Outbound')) {
      return NextResponse.json(
        {
          error:
            'This does not appear to be a UK border control travel history document',
        },
        { status: 400 }
      );
    }

    const result = analyzeTravelHistory(text);

    if (result.records.length === 0) {
      return NextResponse.json(
        { error: 'No travel records found in the document' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        trips: result.trips.map(trip => ({
          ...trip,
          outDate: trip.outDate?.toISOString() || null,
          inDate: trip.inDate?.toISOString() || null,
        })),
        summary: result.summary,
      },
    });
  } catch (error) {
    logger.error('Error processing PDF:', error);
    return NextResponse.json(
      { error: 'Failed to process PDF file' },
      { status: 500 }
    );
  }
}
