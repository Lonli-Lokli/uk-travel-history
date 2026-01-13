# Bug Report Feature

This directory contains the bug report form feature that allows users to submit bug reports with automatic screenshot capture and optional file attachments.

## Components

### `BugReportDialog`
The main dialog component that wraps the bug report form in a Radix UI dialog.

**Usage:**
```tsx
import { BugReportDialog } from './bug-report/BugReportDialog';

<BugReportDialog>
  <button>Contact Us</button>
</BugReportDialog>
```

### `BugReportForm`
The form component with validation, file upload, and screenshot capture.

**Features:**
- Email validation
- Message validation (10-1000 characters)
- Optional file attachment (max 5MB, specific types only)
- Automatic screenshot capture on submission
- Loading states for capture and upload
- Toast notifications for success/error

### `useScreenshotCapture`
A React hook that captures screenshots of the current page using html2canvas.

**Usage:**
```tsx
const { captureScreenshot, isCapturing } = useScreenshotCapture();

const handleCapture = async () => {
  const { blob, error } = await captureScreenshot();
  if (blob) {
    // Use the screenshot blob
  }
};
```

## API Endpoint

### `POST /api/bug-report`

Handles bug report submissions with file uploads to Vercel Blob and email sending via Resend.

**Request (FormData):**
- `email` (required): User's email address
- `message` (required): Bug description (10-1000 chars)
- `pageUrl` (required): Current page URL
- `userAgent` (required): Browser user agent
- `screenshot` (optional): Screenshot file (auto-captured)
- `attachment` (optional): User-uploaded file

**Response:**
```json
{
  "success": true,
  "message": "Bug report submitted successfully"
}
```

## Email Template

The email template is located at `src/emails/bug-report.tsx` and uses React Email for rendering.

**Template includes:**
- User email and timestamp
- Page URL and user agent
- Bug description
- Embedded screenshot (if available)
- Attachment link (if available)

## Environment Variables

The following environment variables must be configured in Vercel:

### Required
- `RESEND_API_KEY` - API key from Resend (get from https://resend.com/api-keys)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token (auto-generated in Vercel)

### Optional
- `BUG_REPORT_FROM_EMAIL` - Email address to send from (default: bugs@uk-travel-history.com)
- `BUG_REPORT_TO_EMAIL` - Email address to send to (default: support@uk-travel-history.com)

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install html2canvas react-hook-form zod @hookform/resolvers resend react-email @react-email/components @vercel/blob
   npm install --save-dev @types/html2canvas
   ```

2. **Configure Resend**
   - Sign up at https://resend.com
   - Verify your domain or use the testing domain
   - Get your API key from the dashboard
   - Add to Vercel environment variables

3. **Enable Vercel Blob**
   - Enable Blob Storage in your Vercel project
   - The `BLOB_READ_WRITE_TOKEN` is auto-generated

4. **Update Environment Variables**
   ```bash
   # In Vercel Dashboard > Settings > Environment Variables
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
   BUG_REPORT_FROM_EMAIL=bugs@yourdomain.com
   BUG_REPORT_TO_EMAIL=support@yourdomain.com
   ```

## File Type Restrictions

**Allowed file types:**
- `.txt` - Plain text files
- `.log` - Log files
- `.json` - JSON files
- `.pdf` - PDF documents
- `.png`, `.jpg`, `.jpeg` - Images

**Size limits:**
- Attachments: 5MB maximum
- Screenshots: 10MB maximum (auto-generated)

## Accessibility

The bug report form follows WCAG 2.1 AA guidelines:
- Keyboard navigation support (Tab, Shift+Tab, Escape)
- Focus management (focus trapped in dialog)
- ARIA labels for all form controls
- Error messages associated with form fields
- Screen reader announcements for form status
- Sufficient color contrast (4.5:1 minimum)

## Security Considerations

- File type validation on both client and server
- File size limits enforced
- Email validation
- Input sanitization
- Blob storage with public access (temporary URLs)
- Rate limiting should be added in production
- Consider adding honeypot field for spam prevention

## Testing

To test the feature locally:

1. Set up environment variables in `.env.local`
2. Start the development server: `npm run dev`
3. Click "Contact Us" in the footer
4. Fill out the form and submit
5. Check your email for the bug report

For testing without Resend/Blob configured, the API will fail gracefully with error messages.

## Future Enhancements

- Bug report dashboard for admins
- Duplicate bug detection
- Integration with issue tracking (Jira, Linear)
- User session recording
- Console log capture
- Rate limiting
- Spam prevention (honeypot, reCAPTCHA)
