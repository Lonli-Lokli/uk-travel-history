import { z } from 'zod';
import { FILE_SIZE_LIMITS, MESSAGE_LENGTH, ALLOWED_FILE_TYPES } from './constants';

/**
 * Validation schema for bug report form
 */
export const bugReportSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  message: z
    .string()
    .min(MESSAGE_LENGTH.MIN, `Message must be at least ${MESSAGE_LENGTH.MIN} characters`)
    .max(MESSAGE_LENGTH.MAX, `Message must not exceed ${MESSAGE_LENGTH.MAX} characters`),
  attachment: z
    .instanceof(File)
    .refine(
      (file) => file.size <= FILE_SIZE_LIMITS.ATTACHMENT,
      `File size must be less than ${FILE_SIZE_LIMITS.ATTACHMENT / 1024 / 1024}MB`
    )
    .refine(
      (file) => {
        return (
          (ALLOWED_FILE_TYPES as readonly string[]).includes(file.type) ||
          file.name.endsWith('.log')
        );
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
