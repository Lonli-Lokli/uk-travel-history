import 'pdf-parse/worker'; 
import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { getPath } from 'pdf-parse/worker';

import { analyzeTravelHistory } from '@uth/parser';
import { logger } from '@uth/utils';

export const runtime = 'nodejs';
export const maxDuration = 30;
PDFParse.setWorker(getPath());


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

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
        trips: result.trips.map((trip) => ({
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
