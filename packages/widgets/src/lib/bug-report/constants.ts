/**
 * Bug report feature constants
 */

export const FILE_SIZE_LIMITS = {
  ATTACHMENT: 5 * 1024 * 1024, // 5MB
  SCREENSHOT: 10 * 1024 * 1024, // 10MB
} as const;

export const MESSAGE_LENGTH = {
  MIN: 10,
  MAX: 1000,
} as const;

export const ALLOWED_FILE_TYPES = [
  'text/plain',
  'application/json',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/x-log',
] as const;

export const ALLOWED_FILE_EXTENSIONS = [
  '.txt',
  '.json',
  '.pdf',
  '.png', 
  '.jpg',
  '.jpeg',
  '.log',
]

/**
 * Rate limiting configuration
 * 3 submissions per hour per IP address
 */
export const RATE_LIMIT = {
  MAX_REQUESTS: 3,
  WINDOW_MS: 60 * 60 * 1000, // 1 hour
} as const;
