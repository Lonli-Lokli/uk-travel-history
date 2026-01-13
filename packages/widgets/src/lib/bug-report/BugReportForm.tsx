'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Button, Input, Label } from '@uth/ui';
import { bugReportSchema, type BugReportFormData } from './types';
import { useScreenshotCapture } from './useScreenshotCapture';
import { useToast } from '@uth/ui';
import { ALLOWED_FILE_EXTENSIONS, FILE_SIZE_LIMITS } from './constants';
import { formatBytes } from '@uth/utils';

interface BugReportFormProps {
  onSuccess: () => void;
}

export function BugReportForm({ onSuccess }: BugReportFormProps) {
  const { toast } = useToast();
  const { captureScreenshot, isCapturing } = useScreenshotCapture();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
  });

  const onSubmit = async (data: BugReportFormData) => {
    try {
      setIsSubmitting(true);

      // Step 1: Capture screenshot
      const { blob: screenshotBlob, error: screenshotError } =
        await captureScreenshot();

      if (screenshotError) {
        console.warn('Screenshot capture failed:', screenshotError);
        // Show toast notification if screenshot fails
        toast({
          title: 'Screenshot capture failed',
          description:
            'Continuing with bug report submission without screenshot.',
          variant: 'default',
        });
      }

      // Step 2: Upload files to Vercel Blob and send email
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('message', data.message);
      formData.append('pageUrl', window.location.href);
      formData.append('userAgent', navigator.userAgent);

      if (screenshotBlob) {
        formData.append('screenshot', screenshotBlob, 'screenshot.jpg');
      }

      if (data.attachment) {
        formData.append('attachment', data.attachment);
      }

      const response = await fetch('/api/bug-report', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit bug report');
      }

      // Success!
      toast({
        title: 'Bug report submitted',
        description:
          'Thank you for your feedback! We will review your report shortly.',
      });

      reset();
      setSelectedFile(null);
      onSuccess();
    } catch (error) {
      console.error('Bug report submission failed:', error);
      toast({
        title: 'Submission failed',
        description:
          error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValue('attachment', file);
    } else {
      setSelectedFile(null);
      setValue('attachment', null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setValue('attachment', null);
  };

  const isLoading = isCapturing || isSubmitting;
  const loadingMessage = isCapturing
    ? 'Capturing screenshot...'
    : isSubmitting
      ? 'Uploading...'
      : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          {...register('email')}
          disabled={isLoading}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-red-500" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <Label htmlFor="message">
          Message <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="message"
          rows={6}
          placeholder="Describe the bug you encountered..."
          {...register('message')}
          disabled={isLoading}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className="flex min-h-[120px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
        />
        {errors.message && (
          <p id="message-error" className="text-sm text-red-500" role="alert">
            {errors.message.message}
          </p>
        )}
      </div>

      {/* File Attachment Field */}
      <div className="space-y-2">
        <Label htmlFor="attachment">File Attachment (optional)</Label>
        <div className="space-y-2">
          <Input
            id="attachment"
            type="file"
            accept=".txt,.log,.json,.pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            disabled={isLoading}
            aria-invalid={!!errors.attachment}
            aria-describedby={
              errors.attachment ? 'attachment-error' : undefined
            }
          />
          {selectedFile && (
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-slate-500">
                  ({formatBytes(selectedFile.size)})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                disabled={isLoading}
                aria-label="Remove file"
              >
                Remove
              </Button>
            </div>
          )}
          {errors.attachment && (
            <p
              id="attachment-error"
              className="text-sm text-red-500"
              role="alert"
            >
              {errors.attachment.message}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Max {formatBytes(FILE_SIZE_LIMITS.ATTACHMENT)}. Allowed:{' '}
            {ALLOWED_FILE_EXTENSIONS.join(', ')}.
          </p>
        </div>
      </div>

      {/* Screenshot Info and Privacy Notice */}
      <div className="space-y-2">
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-xs text-yellow-900">
            <strong>Privacy Notice:</strong> The screenshot will capture the
            current page visible on your screen.
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loadingMessage && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded">
          <p className="text-sm text-slate-700 flex items-center gap-2">
            <span className="inline-block animate-spin">⏳</span>
            {loadingMessage}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Submitting...' : 'Submit Bug Report'}
        </Button>
      </div>
    </form>
  );
}
