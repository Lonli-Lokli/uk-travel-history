import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BugReportEmailProps {
  email: string;
  message: string;
  pageUrl: string;
  userAgent: string;
  screenshotUrl?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
  timestamp: string;
}

export const BugReportEmail = ({
  email,
  message,
  pageUrl,
  userAgent,
  screenshotUrl,
  attachmentUrl,
  attachmentFilename,
  timestamp,
}: BugReportEmailProps) => {
  const previewText = `Bug Report: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Bug Report</Heading>

          <Section style={section}>
            <Text style={label}>From:</Text>
            <Text style={value}>{email}</Text>
          </Section>

          <Section style={section}>
            <Text style={label}>Page URL:</Text>
            <Link href={pageUrl} style={link}>
              {pageUrl}
            </Link>
          </Section>

          <Section style={section}>
            <Text style={label}>Timestamp:</Text>
            <Text style={value}>{timestamp}</Text>
          </Section>

          <Hr style={hr} />

          <Section style={section}>
            <Text style={label}>Message:</Text>
            <Text style={messageText}>{message}</Text>
          </Section>

          {screenshotUrl && (
            <>
              <Hr style={hr} />
              <Section style={section}>
                <Text style={label}>Screenshot:</Text>
                <Img
                  src={screenshotUrl}
                  alt="Page screenshot"
                  style={screenshot}
                />
                <Link href={screenshotUrl} style={link}>
                  View full size
                </Link>
              </Section>
            </>
          )}

          {attachmentUrl && attachmentFilename && (
            <>
              <Hr style={hr} />
              <Section style={section}>
                <Text style={label}>Attachment:</Text>
                <Link href={attachmentUrl} style={link}>
                  {attachmentFilename}
                </Link>
              </Section>
            </>
          )}

          <Hr style={hr} />

          <Section style={section}>
            <Text style={label}>Technical Details:</Text>
            <Text style={technicalText}>User Agent: {userAgent}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

BugReportEmail.PreviewProps = {
  email: 'user@example.com',
  message:
    'I found a bug where the travel calculator is not correctly counting days when trips span multiple months.',
  pageUrl: 'https://uk-travel-history.vercel.app/travel',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timestamp: new Date().toISOString(),
  screenshotUrl: 'https://placehold.co/1200x800',
  attachmentUrl: 'https://example.com/error.log',
  attachmentFilename: 'error.log',
} as BugReportEmailProps;

export default BugReportEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#1e293b',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '32px',
  margin: '16px 20px',
};

const section = {
  padding: '0 20px',
  marginBottom: '16px',
};

const label = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px 0',
};

const value = {
  color: '#1e293b',
  fontSize: '14px',
  margin: '0 0 8px 0',
};

const messageText = {
  color: '#1e293b',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 8px 0',
  whiteSpace: 'pre-wrap' as const,
};

const technicalText = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 4px 0',
  fontFamily: 'monospace',
};

const link = {
  color: '#2563eb',
  fontSize: '14px',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '20px 0',
};

const screenshot = {
  maxWidth: '100%',
  height: 'auto',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  marginBottom: '8px',
};
