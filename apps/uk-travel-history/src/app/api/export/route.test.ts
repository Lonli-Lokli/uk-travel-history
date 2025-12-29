import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { configureRouteLogger } from '@uth/flow';

// Mock dependencies
vi.mock('@uth/features/server', () => ({
  assertFeatureAccess: vi.fn(),
  FEATURE_KEYS: {
    EXCEL_EXPORT: 'excel_export',
  },
}));

// Create mock logger for testing
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describe('Export API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure route logger with mock
    configureRouteLogger({
      logger: mockLogger,
    });
  });

  const createMockRequest = (formData: Record<string, string>) => {
    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });

    return {
      formData: async () => form,
    } as unknown as NextRequest;
  };

  it('should return error when no data provided', async () => {
    const request = createMockRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No data provided');
  });

  it('should generate ILR export by default', async () => {
    const tripsData = {
      trips: [
        {
          id: '1',
          outDate: '2024-01-01',
          inDate: '2024-01-05',
          outRoute: 'London to Paris',
          inRoute: 'Paris to London',
          calendarDays: 5,
          fullDays: 3,
          isIncomplete: false,
        },
      ],
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers.get('Content-Disposition')).toContain(
      'UK_Travel_History.xlsx'
    );
  });

  it('should generate full export when mode is full', async () => {
    const tripsData = {
      trips: [
        {
          id: '1',
          outDate: '2024-01-01',
          inDate: '2024-01-05',
          outRoute: 'London to Paris',
          inRoute: 'Paris to London',
          calendarDays: 5,
          fullDays: 3,
          isIncomplete: false,
        },
      ],
      vignetteEntryDate: '2023-01-01',
      visaStartDate: '2023-01-01',
      ilrTrack: 5,
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
      exportMode: 'full',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain(
      'UK_Travel_History_Full.xlsx'
    );
  });

  it('should handle incomplete trips with special formatting', async () => {
    const tripsData = {
      trips: [
        {
          id: '1',
          outDate: '2024-01-01',
          inDate: '',
          outRoute: 'London to Paris',
          inRoute: '',
          calendarDays: null,
          fullDays: null,
          isIncomplete: true,
        },
      ],
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should handle invalid date formats gracefully', async () => {
    const tripsData = {
      trips: [
        {
          id: '1',
          outDate: 'invalid-date',
          inDate: '2024-01-05',
          outRoute: 'London to Paris',
          inRoute: 'Paris to London',
          calendarDays: 5,
          fullDays: 3,
          isIncomplete: false,
        },
      ],
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should handle empty trips array', async () => {
    const tripsData = {
      trips: [],
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should handle missing optional fields', async () => {
    const tripsData = {
      trips: [
        {
          id: '1',
          outDate: '2024-01-01',
          inDate: '2024-01-05',
          outRoute: '',
          inRoute: '',
          calendarDays: 5,
          fullDays: 3,
          isIncomplete: false,
        },
      ],
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should include visa details in full export', async () => {
    const tripsData = {
      trips: [],
      vignetteEntryDate: '2023-01-01',
      visaStartDate: '2023-01-01',
      ilrTrack: 10,
    };

    const request = createMockRequest({
      tripsData: JSON.stringify(tripsData),
      exportMode: 'full',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should handle errors and return 500', async () => {
    const request = createMockRequest({
      tripsData: 'invalid-json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate Excel file');
  });
});
