/* eslint-disable no-empty-pattern */
import { test, expect, type Page, TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result as AxeResult, NodeResult } from 'axe-core';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Accessibility E2E Tests for UK Travel History Parser
 *
 * This test suite uses axe-core to automatically scan for accessibility violations,
 * with a strong focus on color contrast and WCAG compliance.
 *
 * Tests are performed on both the landing page and travel page to ensure accessibility
 * across all user journeys.
 *
 * Workers write violations to JSON files. Global teardown merges them and generates
 * either no-violations.md (if clean) or one file per rule (e.g., color-contrast.md).
 */

// Worker-scoped violation tracking (isolated per parallel worker)
interface ViolationRecord {
  testName: string;
  suiteName: string;
  url: string;
  violations: AxeResult[];
  timestamp: number;
}

// Single store for ALL violations in this worker
// Each worker writes its own report file with unique timestamp
const allViolations: ViolationRecord[] = [];

// Generate timestamp once per worker for consistent filenames
const workerTimestamp = Date.now();

// Helper to get reports directory path
function getReportsDir(): string {
  return path.join(process.cwd(), '..', '..', 'accessibility-reports');
}

/**
 * Runs axe accessibility scan, collects violations, and asserts.
 * ALL tests that run axe should use this function to ensure violations are reported.
 */
async function runAxeAndCollect(
  page: Page,
  testName: string,
  suiteName: string,
  options?: {
    include?: string; // CSS selector to limit scan
    tags?: string[];
    disableRules?: string[];
    filterViolations?: (v: AxeResult) => boolean;
  },
): Promise<AxeResult[]> {
  // Build axe scanner
  let builder = new AxeBuilder({ page });

  if (options?.include) {
    const element = await page.locator(options.include).elementHandle();
    if (element) {
      builder = builder.include(element);
    }
  }

  builder = builder.withTags(options?.tags || ['wcag2a', 'wcag2aa']);

  if (options?.disableRules) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  // Apply custom filter if provided
  let violations = results.violations;
  if (options?.filterViolations) {
    violations = violations.filter(options.filterViolations);
  }

  // Store ALL violations (even empty) for comprehensive reporting
  allViolations.push({
    testName,
    suiteName,
    url: page.url(),
    violations,
    timestamp: Date.now(),
  });

  // Log results
  if (violations.length > 0) {
    console.log(`❌ [${suiteName}] ${testName}: ${violations.length} violation(s)`);
  } else {
    console.log(`✅ [${suiteName}] ${testName}: No violations`);
  }

  return violations;
}

test.describe('Accessibility Tests', () => {
  // Directory is created by global-setup.ts

  // Single afterAll at top level generates ONE comprehensive report per project
  test.afterAll(async ({}, testInfo) => {
    await generateFinalReport(testInfo);
  });

  test.describe('Landing Page Accessibility', () => {
    const suiteName = 'Landing Page';

    test('should not have accessibility violations on landing page', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Full page scan',
        suiteName,
        {
          tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          disableRules: ['meta-viewport'],
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have accessible import buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check that buttons have accessible names
      const pdfButton = page.getByRole('button', { name: /Import from PDF/i });
      const excelButton = page.getByRole('button', {
        name: /Import from Excel/i,
      });
      const clipboardButton = page.getByRole('button', {
        name: /Import from Clipboard/i,
      });
      const manualButton = page.getByRole('button', {
        name: /add travel dates manually/i,
      });

      await expect(pdfButton).toBeVisible();
      await expect(excelButton).toBeVisible();
      await expect(clipboardButton).toBeVisible();
      await expect(manualButton).toBeVisible();

      // Run focused accessibility scan on button container
      const buttonContainer = page.locator('div').filter({
        has: pdfButton,
      });

      const violations = await runAxeAndCollect(
        page,
        'Import buttons',
        suiteName,
        {
          include: await buttonContainer
            .evaluate((el) => {
              // Generate a unique selector for this element
              const id = `axe-target-${Date.now()}`;
              el.setAttribute('data-axe-target', id);
              return `[data-axe-target="${id}"]`;
            })
            .catch(() => 'body'), // Fallback to body if selector fails
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have accessible external links', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check SAR link has proper attributes
      const sarLink = page.getByRole('link', {
        name: /Request your travel history document/i,
      });
      await expect(sarLink).toBeVisible();

      // Verify it opens in new tab with security attributes
      await expect(sarLink).toHaveAttribute('target', '_blank');
      await expect(sarLink).toHaveAttribute('rel', /noopener/);

      // Check Buy Me a Coffee link
      const coffeeLink = page
        .getByRole('link', { name: /Buy Me a Coffee/i })
        .first();
      await expect(coffeeLink).toBeVisible();
      await expect(coffeeLink).toHaveAttribute('target', '_blank');
      await expect(coffeeLink).toHaveAttribute('rel', /noopener/);
    });
  });

  test.describe('Travel Page Accessibility', () => {
    const suiteName = 'Travel Page';

    test('should not have accessibility violations on travel page', async ({
      page,
    }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');

      const violations = await runAxeAndCollect(
        page,
        'Full page scan',
        suiteName,
        {
          tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          disableRules: ['meta-viewport'],
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have accessible header navigation', async ({ page }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      // Check logo link is accessible
      const logoLink = page.locator('header a[href="/"]').first();
      await expect(logoLink).toBeVisible();

      // Check Import/Export buttons have accessible names
      const importButton = page.getByRole('button', { name: /Import/i }).first();
      await expect(importButton).toBeVisible();

      // Run accessibility scan on header
      const violations = await runAxeAndCollect(
        page,
        'Header navigation',
        suiteName,
        { include: 'header' },
      );

      expect(violations).toEqual([]);
    });

    test('should have accessible dropdown menus', async ({ page }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      // Open Import dropdown
      const importButton = page.getByRole('button', { name: /Import/i }).first();
      await importButton.click();

      // Wait for dropdown to appear
      await expect(page.getByText('From PDF')).toBeVisible();

      // Run accessibility scan - filter for menu-related violations
      const violations = await runAxeAndCollect(
        page,
        'Dropdown menus',
        suiteName,
        {
          filterViolations: (v) =>
            Boolean(
              v.id.includes('menu') ||
                v.id.includes('aria') ||
                v.id.includes('role'),
            ),
        },
      );

      expect(violations).toEqual([]);
    });
  });

  test.describe('Color Contrast Validation', () => {
    const suiteName = 'Color Contrast';

    test('should detect color contrast violations when present', async ({
      page,
    }) => {
      // Create a page with known bad contrast for validation
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Color Contrast Test</title>
          </head>
          <body>
            <button style="background-color: #888; color: #999; padding: 10px;">
              Low Contrast Button
            </button>
            <p style="color: #777; background-color: #888;">
              Low contrast text
            </p>
          </body>
        </html>
      `);

      // Run accessibility scan (don't use runAxeAndCollect - this is a validation test)
      const accessibilityScanResults = await new AxeBuilder({
        page,
      }).analyze();

      // Expect violations to be found
      expect(accessibilityScanResults.violations.length).toBeGreaterThan(0);

      // Check that at least one violation is related to color contrast
      const contrastViolation = accessibilityScanResults.violations.find(
        (v) => v.id === 'color-contrast',
      );
      expect(contrastViolation).toBeDefined();
    });

    test('should pass with good color contrast', async ({ page }) => {
      // Create a page with good contrast
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Good Contrast Test</title>
          </head>
          <body>
            <button style="background-color: #000; color: #fff; padding: 10px;">
              Good Contrast Button
            </button>
            <p style="color: #000; background-color: #fff;">
              Good contrast text
            </p>
          </body>
        </html>
      `);

      // Run accessibility scan (don't use runAxeAndCollect - this is a validation test)
      const accessibilityScanResults = await new AxeBuilder({
        page,
      }).analyze();

      // Should have no color contrast violations
      const contrastViolation = accessibilityScanResults.violations.find(
        (v) => v.id === 'color-contrast',
      );
      expect(contrastViolation).toBeUndefined();
    });
  });

  test.describe('Specific WCAG Rules', () => {
    const suiteName = 'WCAG Rules';

    test('should have valid ARIA attributes on landing page', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'ARIA attributes (landing)',
        suiteName,
        {
          filterViolations: (v) =>
            Boolean(v.id.includes('aria') || v.tags.includes('aria')),
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have valid ARIA attributes on travel page', async ({
      page,
    }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'ARIA attributes (travel)',
        suiteName,
        {
          filterViolations: (v) =>
            Boolean(v.id.includes('aria') || v.tags.includes('aria')),
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have proper heading hierarchy on landing page', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Heading hierarchy (landing)',
        suiteName,
        {
          filterViolations: (v) => v.id === 'heading-order',
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have proper heading hierarchy on travel page', async ({
      page,
    }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Heading hierarchy (travel)',
        suiteName,
        {
          filterViolations: (v) => v.id === 'heading-order',
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have accessible interactive elements on landing page', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Interactive elements (landing)',
        suiteName,
        {
          filterViolations: (v) =>
            Boolean(
              v.id.includes('button') ||
                v.id.includes('link') ||
                v.id.includes('interactive'),
            ),
        },
      );

      expect(violations).toEqual([]);
    });

    test('should have accessible interactive elements on travel page', async ({
      page,
    }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Interactive elements (travel)',
        suiteName,
        {
          filterViolations: (v) =>
            Boolean(
              v.id.includes('button') ||
                v.id.includes('link') ||
                v.id.includes('interactive'),
            ),
        },
      );

      expect(violations).toEqual([]);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be keyboard navigable on landing page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Tab through interactive elements
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName;
      });

      expect(focusedElement).toBeTruthy();
    });

    test('should be keyboard navigable on travel page', async ({ page }) => {
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      // Tab through interactive elements
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName;
      });

      expect(focusedElement).toBeTruthy();
    });

    test('should navigate using Enter key on buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Focus on manual entry button and press Enter
      const manualButton = page.getByRole('button', {
        name: /add travel dates manually/i,
      });
      await manualButton.focus();
      await page.keyboard.press('Enter');

      // Should navigate to travel page
      await expect(page).toHaveURL(/\/travel/);
    });
  });

  test.describe('Mobile Accessibility', () => {
    const suiteName = 'Mobile';

    test('should be accessible on mobile viewport (landing page)', async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Mobile viewport (landing)',
        suiteName,
      );

      expect(violations).toEqual([]);
    });

    test('should be accessible on mobile viewport (travel page)', async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/travel');
      await page.waitForLoadState('domcontentloaded');

      const violations = await runAxeAndCollect(
        page,
        'Mobile viewport (travel)',
        suiteName,
      );

      expect(violations).toEqual([]);
    });
  });
});

/**
 * Writes violations to JSON file for this worker (intermediate format).
 * Global teardown will merge all JSON files and generate final reports.
 */
async function generateFinalReport(testInfo: TestInfo): Promise<void> {
  // Include project name and timestamp for unique filenames
  const projectName = testInfo.project.name.toLowerCase().replace(/\s+/g, '-');
  const filename = `violations-${projectName}-${workerTimestamp}.json`;

  // Write to accessibility-reports directory
  const reportDir = getReportsDir();
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Write violations as JSON for global teardown to process
  const jsonData = {
    projectName,
    timestamp: workerTimestamp,
    records: allViolations,
  };

  fs.writeFileSync(
    path.join(reportDir, filename),
    JSON.stringify(jsonData, null, 2),
    'utf-8',
  );

  // Count stats
  const testsWithViolations = allViolations.filter((r) => r.violations.length > 0);
  const totalViolations = allViolations.reduce(
    (sum, r) => sum + r.violations.length,
    0,
  );

  console.log(
    `Wrote violations JSON: ${filename} (${allViolations.length} tests, ${testsWithViolations.length} with violations, ${totalViolations} total violations)`,
  );
}
