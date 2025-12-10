import type { Metadata } from 'next';
import { Toaster } from '@uth/ui';
import './global.css';

export const metadata: Metadata = {
  title: 'UK Travel History Parser',
  description:
    'Parse UK border control travel history and calculate days outside UK',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
