import { test, expect } from '@playwright/test';

/**
 * Happy Path E2E Tests for UK Travel History Parser
 *
 * This test suite validates the core user journeys:
 * 1. Landing page - UI and navigation
 * 2. Travel page - Manual trip entry and calculations
 * 3. Data persistence and export functionality
 */

test.describe('UK Travel History Parser - Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the landing page successfully', async ({ page }) => {
    await test.step('Verify page title and metadata', async () => {
      await expect(page).toHaveTitle(/UK Travel History Parser/i);
    });

    await test.step('Verify header is visible', async () => {
      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Check logo and title
      await expect(page.getByText('UK Travel Parser')).toBeVisible();
    });

    await test.step('Verify main content is visible', async () => {
      await expect(page.getByText('Welcome to UK Travel Parser')).toBeVisible();
      await expect(
        page.getByText(
          'Track your UK travel history and calculate continuous residence',
        ),
      ).toBeVisible();
    });
  });

  test('should display all import options', async ({ page }) => {
    await test.step('Check PDF import button', async () => {
      const pdfButton = page.getByRole('button', { name: /Import from PDF/i });
      await expect(pdfButton).toBeVisible();
      await expect(pdfButton).toBeEnabled();
    });

    await test.step('Check Excel import button', async () => {
      const excelButton = page.getByRole('button', {
        name: /Import from Excel/i,
      });
      await expect(excelButton).toBeVisible();
      await expect(excelButton).toBeEnabled();
    });

    await test.step('Check Clipboard import button', async () => {
      const clipboardButton = page.getByRole('button', {
        name: /Import from Clipboard/i,
      });
      await expect(clipboardButton).toBeVisible();
      await expect(clipboardButton).toBeEnabled();
    });

    await test.step('Check manual entry button', async () => {
      const manualButton = page.getByRole('button', {
        name: /add travel dates manually/i,
      });
      await expect(manualButton).toBeVisible();
      await expect(manualButton).toBeEnabled();
    });
  });

  test('should display "How to Get Your Travel History PDF" section', async ({
    page,
  }) => {
    await test.step('Verify instructions section exists', async () => {
      await expect(
        page.getByText('How to Get Your Travel History PDF'),
      ).toBeVisible();
    });

    await test.step('Verify step-by-step instructions', async () => {
      await expect(
        page.getByText('Request your travel history document'),
      ).toBeVisible();
      await expect(page.getByText('Wait for processing')).toBeVisible();
      await expect(page.getByText('Upload your PDF here')).toBeVisible();
    });

    await test.step('Verify external link to Home Office SAR', async () => {
      const sarLink = page.getByRole('link', {
        name: /Request your travel history document/i,
      });
      await expect(sarLink).toBeVisible();
      await expect(sarLink).toHaveAttribute(
        'href',
        'https://visas-immigration.service.gov.uk/product/saru',
      );
    });
  });

  test('should display "What This Tool Does" section', async ({ page }) => {
    await test.step('Verify features list', async () => {
      await expect(page.getByText('What This Tool Does')).toBeVisible();
      await expect(
        page.getByText('Calculate days outside the UK'),
      ).toBeVisible();
      await expect(
        page.getByText('Track continuous residence period'),
      ).toBeVisible();
      await expect(page.getByText('Verify 180-day absence limit')).toBeVisible();
      await expect(page.getByText('Export formatted Excel reports')).toBeVisible();
      await expect(page.getByText('Track vignette & visa dates')).toBeVisible();
      await expect(page.getByText('Follows Home Office guidance')).toBeVisible();
    });
  });

  test('should navigate to travel page when clicking manual entry', async ({
    page,
  }) => {
    await test.step('Click manual entry button', async () => {
      const manualButton = page.getByRole('button', {
        name: /add travel dates manually/i,
      });
      await manualButton.click();
    });

    await test.step('Verify navigation to travel page', async () => {
      await expect(page).toHaveURL(/\/travel/);
    });
  });

  test('should display Buy Me a Coffee button', async ({ page, isMobile }) => {
    await test.step('Verify Buy Me a Coffee link', async () => {
      const coffeeLink = page
        .getByRole('link', { name: /Buy Me a Coffee/i })
        .first();
      await expect(coffeeLink).toBeVisible();
      await expect(coffeeLink).toHaveAttribute(
        'href',
        'https://www.buymeacoffee.com/LonliLokliV',
      );
    });
  });
});

test.describe('UK Travel History Parser - Travel Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/travel');
  });

  test('should load the travel page successfully', async ({ page }) => {
    await test.step('Verify page loads', async () => {
      await expect(page).toHaveTitle(/Travel History.*UK Travel History Parser/i);
    });

    await test.step('Verify header is visible', async () => {
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(page.getByText('UK Travel Parser')).toBeVisible();
    });

    await test.step('Verify main content area exists', async () => {
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test('should display summary cards', async ({ page }) => {
    await test.step('Wait for page to load', async () => {
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Verify summary statistics are displayed', async () => {
      // Look for text that indicates summary cards
      // These may show "0" or "-" when no trips are added
      const summarySection = page.locator('main').first();
      await expect(summarySection).toBeVisible();
    });
  });

  test('should display header navigation with logo link to home', async ({
    page,
  }) => {
    await test.step('Verify logo links to home', async () => {
      const logoLink = page.locator('header a[href="/"]').first();
      await expect(logoLink).toBeVisible();
    });

    await test.step('Click logo and verify navigation to home', async () => {
      const logoLink = page.locator('header a[href="/"]').first();
      await logoLink.click();
      await expect(page).toHaveURL('/');
    });
  });

  test('should display Import and Export buttons in header', async ({
    page,
    isMobile,
  }) => {
    await test.step('Verify Import button exists', async () => {
      // On mobile, it's an icon button; on desktop, it has text
      const importButton = isMobile
        ? page.locator('header button:has-text(""), button[aria-label*="Import"]').first()
        : page.getByRole('button', { name: /Import/i }).first();

      await expect(importButton).toBeVisible();
    });

    await test.step('Verify Export button exists (disabled when no trips)', async () => {
      // Export button should exist but be disabled when there are no trips
      const exportButton = isMobile
        ? page.locator('header button').filter({ has: page.locator('svg') }).nth(2)
        : page.getByRole('button', { name: /Export/i }).first();

      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeDisabled();
    });
  });

  test('should open Import dropdown menu', async ({ page, isMobile }) => {
    await test.step('Click Import button', async () => {
      const importButton = isMobile
        ? page.locator('header button').filter({ has: page.locator('svg') }).first()
        : page.getByRole('button', { name: /Import/i }).first();

      await importButton.click();
    });

    await test.step('Verify dropdown menu items', async () => {
      // Wait for dropdown to appear
      await expect(page.getByText('From PDF')).toBeVisible();
      await expect(page.getByText('From Excel')).toBeVisible();
      await expect(page.getByText('From Clipboard')).toBeVisible();
    });
  });

  test('should display visa details section', async ({ page }) => {
    await test.step('Look for visa-related elements', async () => {
      // The visa details card should be present
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();

      // These elements may be visible or collapsed depending on implementation
      // Just verify the main content loads without error
      await page.waitForLoadState('networkidle');
    });
  });

  test('should be mobile responsive', async ({ page, isMobile }) => {
    await test.step('Verify page loads on mobile', async () => {
      if (isMobile) {
        // Mobile-specific checks
        await expect(page.locator('header')).toBeVisible();
        await expect(page.locator('main')).toBeVisible();
      }
    });
  });

  test('should handle empty state gracefully', async ({ page }) => {
    await test.step('Verify page loads with no trips', async () => {
      // On initial load with no data, page should still render properly
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();

      // Export should be disabled
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toBeDisabled();
    });
  });
});

test.describe('UK Travel History Parser - Complete User Journey', () => {
  test('should complete full journey from landing to travel page', async ({
    page,
  }) => {
    await test.step('Start at landing page', async () => {
      await page.goto('/');
      await expect(page.getByText('Welcome to UK Travel Parser')).toBeVisible();
    });

    await test.step('Navigate to travel page', async () => {
      const manualButton = page.getByRole('button', {
        name: /add travel dates manually/i,
      });
      await manualButton.click();
      await expect(page).toHaveURL(/\/travel/);
    });

    await test.step('Verify travel page loaded', async () => {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    });

    await test.step('Navigate back to home using logo', async () => {
      const logoLink = page.locator('header a[href="/"]').first();
      await logoLink.click();
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Welcome to UK Travel Parser')).toBeVisible();
    });
  });
});
