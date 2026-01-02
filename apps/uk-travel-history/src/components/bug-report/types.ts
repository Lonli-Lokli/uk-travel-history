import { z } from 'zod';

/**
 * Validation schema for bug report form
 */
export const bugReportSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must not exceed 1000 characters'),
  attachment: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => {
        const allowedTypes = [
          'text/plain',
          'application/json',
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'text/x-log',
        ];
        return allowedTypes.includes(file.type) || file.name.endsWith('.log');
      },
      'File type not supported. Allowed: .txt, .log, .json, .pdf, .png, .jpg'
    )
    .optional()
    .nullable(),
});

/**
 * TypeScript type inferred from schema
 */
export type BugReportFormData = z.infer<typeof bugReportSchema>;

/**
 * API request payload
 */
export interface BugReportPayload {
  email: string;
  message: string;
  pageUrl: string;
  userAgent: string;
  screenshotUrl?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
}

/**
 * API response
 */
export interface BugReportResponse {
  success: boolean;
  message?: string;
  error?: string;
}
