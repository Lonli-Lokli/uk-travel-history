import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsPage from './page';

describe('TermsPage', () => {
  it('should render the page', () => {
    render(<TermsPage />);
    expect(screen.getByText('Terms and Conditions')).toBeTruthy();
  });

  it('should have a back button', () => {
    render(<TermsPage />);
    const backButton = screen.getByRole('link', { name: /back to home/i });
    expect(backButton).toBeTruthy();
    expect(backButton.getAttribute('href')).toBe('/');
  });

  it('should have last updated date', () => {
    render(<TermsPage />);
    expect(screen.getByText(/Last updated:/i)).toBeTruthy();
  });

  it('should render all main sections', () => {
    render(<TermsPage />);

    expect(screen.getByText('1. Acceptance of Terms')).toBeTruthy();
    expect(screen.getByText('2. Use of Service')).toBeTruthy();
    expect(screen.getByText('3. Disclaimer of Warranties')).toBeTruthy();
    expect(screen.getByText('4. Limitation of Liability')).toBeTruthy();
    expect(screen.getByText('5. Privacy and Data')).toBeTruthy();
    expect(screen.getByText('6. Not Legal Advice')).toBeTruthy();
    expect(screen.getByText('7. Changes to Terms')).toBeTruthy();
    expect(screen.getByText('8. Third-Party Services')).toBeTruthy();
    expect(screen.getByText('9. Contact')).toBeTruthy();
  });

  it('should have disclaimer about service being provided as-is', () => {
    render(<TermsPage />);
    expect(screen.getByText(/THE SERVICE IS PROVIDED "AS IS"/i)).toBeTruthy();
  });

  it('should mention limitation of liability', () => {
    render(<TermsPage />);
    expect(screen.getByText(/TO THE MAXIMUM EXTENT PERMITTED BY LAW/i)).toBeTruthy();
  });

  it('should emphasize not providing legal advice', () => {
    render(<TermsPage />);
    expect(screen.getByText(/This Service does not provide legal advice/i)).toBeTruthy();
    expect(screen.getByText(/consult with a qualified immigration lawyer/i)).toBeTruthy();
  });

  it('should mention privacy and data processing', () => {
    render(<TermsPage />);
    expect(screen.getByText(/All data processing happens locally in your browser/i)).toBeTruthy();
  });

  it('should have proper use guidelines', () => {
    render(<TermsPage />);
    expect(screen.getByText(/Use the Service for lawful purposes only/i)).toBeTruthy();
  });

  it('should mention third-party services', () => {
    render(<TermsPage />);
    expect(screen.getByText(/The Service may integrate with third-party services/i)).toBeTruthy();
  });
});
