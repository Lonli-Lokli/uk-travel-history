import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from './page';

describe('AboutPage', () => {
  it('should render the page', () => {
    render(<AboutPage />);
    expect(screen.getByText('About UK Travel History Parser')).toBeTruthy();
  });

  it('should have a back button', () => {
    render(<AboutPage />);
    const backButton = screen.getByRole('link', { name: /back to home/i });
    expect(backButton).toBeTruthy();
    expect(backButton.getAttribute('href')).toBe('/');
  });

  it('should render all main sections', () => {
    render(<AboutPage />);

    expect(screen.getByText('What is this tool?')).toBeTruthy();
    expect(screen.getByText('Who is this for?')).toBeTruthy();
    expect(screen.getByText('Key Features')).toBeTruthy();
    expect(screen.getByText('Privacy & Security')).toBeTruthy();
    expect(screen.getByText('Disclaimer')).toBeTruthy();
    expect(screen.getByText('Support the Project')).toBeTruthy();
  });

  it('should have Buy Me a Coffee link', () => {
    render(<AboutPage />);
    const coffeeLink = screen.getByRole('link', { name: /buy me a coffee/i });
    expect(coffeeLink).toBeTruthy();
    expect(coffeeLink.getAttribute('href')).toBe('https://www.buymeacoffee.com/LonliLokliV');
    expect(coffeeLink.getAttribute('target')).toBe('_blank');
    expect(coffeeLink.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should mention key use cases', () => {
    render(<AboutPage />);

    expect(screen.getByText(/Indefinite Leave to Remain/i)).toBeTruthy();
    expect(screen.getByText(/180-day absence rule/i)).toBeTruthy();
  });

  it('should have privacy information', () => {
    render(<AboutPage />);

    const privacySection = screen.getByText(/Your privacy is important/i);
    expect(privacySection).toBeTruthy();
  });

  it('should have disclaimer about not being legal advice', () => {
    render(<AboutPage />);

    expect(screen.getByText(/should not be considered as legal advice/i)).toBeTruthy();
  });

  it('should list key features', () => {
    render(<AboutPage />);

    expect(screen.getByText(/Parse UK Home Office Subject Access Request/i)).toBeTruthy();
    expect(screen.getByText(/Manual entry and editing/i)).toBeTruthy();
    expect(screen.getByText(/Automatic calculation/i)).toBeTruthy();
  });
});
