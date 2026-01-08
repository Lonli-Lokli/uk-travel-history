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
 * If violations are found, the test fails and generates a detailed accessibility-report.md file.
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
 * Generates final comprehensive report for all tests in this worker
 */
async function generateFinalReport(testInfo: TestInfo): Promise<void> {
  // Include project name and timestamp for unique filenames
  const projectName = testInfo.project.name.toLowerCase().replace(/\s+/g, '-');
  const filename = `accessibility-report-${projectName}-${workerTimestamp}.md`;

  // Generate report from all collected violations
  const report = generateReport(projectName, allViolations);

  // Attach to Playwright test results
  await testInfo.attach(filename, {
    body: report,
    contentType: 'text/markdown',
  });

  // Write to accessibility-reports directory
  const reportDir = getReportsDir();
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(path.join(reportDir, filename), report, 'utf-8');

  // Count stats
  const testsWithViolations = allViolations.filter((r) => r.violations.length > 0);
  const totalViolations = allViolations.reduce(
    (sum, r) => sum + r.violations.length,
    0,
  );

  console.log(
    `Generated accessibility report: ${filename} (${allViolations.length} tests, ${testsWithViolations.length} with violations, ${totalViolations} total violations)`,
  );
}

// Structure for grouping violations by rule
interface GroupedViolation {
  ruleId: string;
  help: string;
  description: string;
  impact: string;
  tags: string[];
  helpUrl: string;
  foundIn: Set<string>; // "suiteName: testName" entries
  elements: Map<string, UniqueElement>; // selector -> element details
}

interface UniqueElement {
  selector: string;
  html: string;
  failureSummary: string;
  fixes: string[];
  foundIn: Set<string>; // tests that found this element
}

/**
 * Generates GitHub-ready accessibility report
 * Groups violations by rule ID and deduplicates elements across tests/browsers
 */
function generateReport(projectName: string, records: ViolationRecord[]): string {
  let report = `# Accessibility Report: ${projectName}\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n`;
  report += `**Browser/Device**: ${projectName}\n\n`;

  // Calculate stats
  const testsWithViolations = records.filter((r) => r.violations.length > 0);

  report += `## Summary\n\n`;
  report += `- **Total Tests Run**: ${records.length}\n`;
  report += `- **Tests with Violations**: ${testsWithViolations.length}\n`;

  if (testsWithViolations.length === 0) {
    report += `\n## Result\n\n`;
    report += `No accessibility violations found!\n\n`;

    // List all passing tests
    report += `### Tests Executed\n\n`;
    const suites = [...new Set(records.map((r) => r.suiteName))];
    suites.forEach((suite) => {
      const suiteTests = records.filter((r) => r.suiteName === suite);
      report += `**${suite}**\n`;
      suiteTests.forEach((t) => {
        report += `- ${t.testName}\n`;
      });
      report += `\n`;
    });

    return report;
  }

  // Group all violations by rule ID
  const groupedViolations = new Map<string, GroupedViolation>();

  records.forEach((record) => {
    const testContext = `${record.suiteName}: ${record.testName}`;

    record.violations.forEach((violation) => {
      const ruleId = violation.id;

      if (!groupedViolations.has(ruleId)) {
        groupedViolations.set(ruleId, {
          ruleId,
          help: violation.help,
          description: violation.description,
          impact: violation.impact || 'unknown',
          tags: violation.tags,
          helpUrl: violation.helpUrl,
          foundIn: new Set(),
          elements: new Map(),
        });
      }

      const group = groupedViolations.get(ruleId)!;
      group.foundIn.add(testContext);

      // Add elements, deduplicating by selector
      violation.nodes.forEach((node: NodeResult) => {
        const selector = node.target.join(' ');

        if (!group.elements.has(selector)) {
          const fixes: string[] = [];
          if (node.any) {
            node.any.forEach((fix) => fixes.push(fix.message));
          }
          if (node.all) {
            node.all.forEach((fix) => fixes.push(fix.message));
          }

          group.elements.set(selector, {
            selector,
            html: node.html,
            failureSummary: node.failureSummary || '',
            fixes,
            foundIn: new Set(),
          });
        }

        group.elements.get(selector)!.foundIn.add(testContext);
      });
    });
  });

  // Count unique violations and elements
  const uniqueRules = groupedViolations.size;
  const uniqueElements = [...groupedViolations.values()].reduce(
    (sum, g) => sum + g.elements.size,
    0,
  );

  report += `- **Unique Violation Rules**: ${uniqueRules}\n`;
  report += `- **Unique Affected Elements**: ${uniqueElements}\n\n`;

  // Sort violations by priority (critical first)
  const priorityOrder: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
    unknown: 4,
  };

  const sortedViolations = [...groupedViolations.values()].sort(
    (a, b) =>
      (priorityOrder[a.impact.toLowerCase()] ?? 4) -
      (priorityOrder[b.impact.toLowerCase()] ?? 4),
  );

  // Generate violations section
  report += `## Violations by Rule\n\n`;

  sortedViolations.forEach((group, idx) => {
    const priority = getPriority(group.impact);

    report += `### ${idx + 1}. ${group.help}\n\n`;
    report += `| Property | Value |\n`;
    report += `|----------|-------|\n`;
    report += `| **Rule ID** | \`${group.ruleId}\` |\n`;
    report += `| **Priority** | ${priority} |\n`;
    report += `| **Impact** | ${group.impact.toUpperCase()} |\n`;
    report += `| **WCAG** | ${group.tags.filter((t) => t.startsWith('wcag')).join(', ')} |\n\n`;

    report += `**Description**: ${group.description}\n\n`;

    report += `**Found in tests**:\n`;
    [...group.foundIn].sort().forEach((test) => {
      report += `- ${test}\n`;
    });
    report += `\n`;

    // Affected elements
    report += `<details>\n`;
    report += `<summary><strong>Affected Elements (${group.elements.size} unique)</strong></summary>\n\n`;

    let elementIdx = 1;
    group.elements.forEach((element) => {
      report += `#### Element ${elementIdx}\n\n`;
      report += `**Selector**: \`${element.selector}\`\n\n`;
      report += `**HTML**:\n\`\`\`html\n${element.html.substring(0, 300)}${element.html.length > 300 ? '...' : ''}\n\`\`\`\n\n`;

      if (element.failureSummary) {
        report += `**Issue**: ${element.failureSummary}\n\n`;
      }

      if (element.fixes.length > 0) {
        report += `**How to fix**:\n`;
        [...new Set(element.fixes)].forEach((fix) => {
          report += `- ${fix}\n`;
        });
        report += `\n`;
      }

      if (element.foundIn.size > 1) {
        report += `*Found in ${element.foundIn.size} tests*\n\n`;
      }

      elementIdx++;
    });

    report += `</details>\n\n`;
    report += `[Axe Documentation](${group.helpUrl})\n\n`;
    report += `---\n\n`;
  });

  return report;
}

/**
 * Maps impact level to priority
 */
function getPriority(impact: string): string {
  switch (impact.toLowerCase()) {
    case 'critical':
      return 'P1 - Critical';
    case 'serious':
      return 'P2 - High';
    case 'moderate':
      return 'P3 - Medium';
    case 'minor':
      return 'P4 - Low';
    default:
      return 'P3 - Medium';
  }
}
