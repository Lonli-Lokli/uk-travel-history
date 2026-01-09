#!/usr/bin/env node

/**
 * Generates an E2E test report summary by parsing Playwright test results
 * and accessibility reports from the playwright-report folder.
 *
 * Outputs a JSON object with test status and accessibility violations.
 * Usage: node tools/generate-e2e-report.js
 */

const fs = require('fs');
const path = require('path');

const playwrightReportPath = path.join(__dirname, '..', 'playwright-report');
const accessibilityReportPath = path.join(
  __dirname,
  '..',
  'accessibility-reports',
);
const resultsPath = path.join(playwrightReportPath, 'results.json');

/**
 * Parses Playwright test results JSON
 */
function parseTestResults() {
  if (!fs.existsSync(resultsPath)) {
    console.log('Test results JSON not found');
    return null;
  }

  try {
    const content = fs.readFileSync(resultsPath, 'utf-8');
    const results = JSON.parse(content);

    const stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      duration: results.stats?.duration || 0,
    };

    const failedTests = [];

    // Parse suites and tests
    if (results.suites) {
      const parseTests = (suite) => {
        if (suite.specs) {
          suite.specs.forEach((spec) => {
            stats.total++;

            if (spec.ok === true) {
              stats.passed++;
            } else if (spec.ok === false) {
              stats.failed++;
              failedTests.push({
                title: spec.title,
                file: spec.file || suite.file,
                error:
                  spec.tests?.[0]?.results?.[0]?.error?.message ||
                  'Test failed',
              });
            }
          });
        }

        if (suite.suites) {
          suite.suites.forEach(parseTests);
        }
      };

      results.suites.forEach(parseTests);
    }

    console.log(`Test results: ${stats.passed}/${stats.total} passed`);

    return { stats, failedTests };
  } catch (error) {
    console.error('Error parsing test results:', error.message);
    return null;
  }
}

/**
 * Parses accessibility report files in new rule-based format
 */
function parseAccessibilityReports() {
  const reports = [];
  let totalViolationRules = 0;

  console.log(
    `Looking for accessibility reports in: ${accessibilityReportPath}`,
  );

  if (!fs.existsSync(accessibilityReportPath)) {
    console.log('Accessibility report directory does not exist');
    return { reports, totalViolationRules, hasReports: false, hasViolations: true };
  }

  try {
    const files = fs.readdirSync(accessibilityReportPath);
    console.log(
      `Found ${files.length} files in accessibility report directory`,
    );

    // Check for no-violations.md (success case)
    const hasNoViolations = files.includes('no-violations.md');
    if (hasNoViolations) {
      console.log('No violations found - clean accessibility report!');
      const content = fs.readFileSync(
        path.join(accessibilityReportPath, 'no-violations.md'),
        'utf-8',
      );
      return {
        reports: [],
        totalViolationRules: 0,
        hasReports: true,
        hasViolations: false,
        noViolationsContent: content,
      };
    }

    // Check for SUMMARY.md (violations found)
    const hasSummary = files.includes('SUMMARY.md');
    let summaryContent = '';
    if (hasSummary) {
      summaryContent = fs.readFileSync(
        path.join(accessibilityReportPath, 'SUMMARY.md'),
        'utf-8',
      );

      // Extract total rules from SUMMARY.md
      const rulesMatch = summaryContent.match(/\*\*Total Violation Rules\*\*:\s*(\d+)/);
      totalViolationRules = rulesMatch ? parseInt(rulesMatch[1], 10) : 0;
      console.log(`Found ${totalViolationRules} violation rules`);
    }

    // Get all rule-based report files (exclude SUMMARY.md, README.md, no-violations.md)
    const ruleFiles = files.filter(
      (f) =>
        f.endsWith('.md') &&
        f !== 'SUMMARY.md' &&
        f !== 'README.md' &&
        f !== 'no-violations.md',
    );

    for (const file of ruleFiles) {
      const filePath = path.join(accessibilityReportPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract rule ID from filename (e.g., "color-contrast.md" -> "color-contrast")
      const ruleId = file.replace('.md', '');

      reports.push({
        file,
        ruleId,
        content: content,
      });
    }

    console.log(`Found ${reports.length} rule-based violation reports`);
  } catch (error) {
    console.error('Error reading accessibility reports:', error.message);
  }

  return {
    reports,
    totalViolationRules,
    hasReports: true,
    hasViolations: totalViolationRules > 0,
    summaryContent: reports.length > 0 ? summaryContent : '',
  };
}

/**
 * Strips ANSI escape codes from text
 */
function stripAnsi(text) {
  // Remove ANSI escape codes (color, formatting, etc.)
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Generates markdown summary for test results
 */
function generateTestSummary(testResults) {
  if (!testResults) {
    return '';
  }

  const { stats, failedTests } = testResults;
  let summary = '### 🎭 Test Results\n\n';

  // Overall status
  if (stats.total === 0) {
    summary += `⚠️ **No tests were run!** Check for syntax errors or test collection failures.\n\n`;
  } else if (stats.failed === 0) {
    summary += `✅ **All tests passed!** (${stats.passed}/${stats.total})\n\n`;
  } else {
    summary += `❌ **${stats.failed} test(s) failed** (${stats.passed}/${stats.total} passed)\n\n`;
  }

  // Duration
  const durationSec = (stats.duration / 1000).toFixed(1);
  summary += `⏱️ Duration: ${durationSec}s\n\n`;

  // Failed tests details
  if (failedTests.length > 0) {
    summary += '**Failed tests:**\n';
    failedTests.forEach((test) => {
      summary += `- ❌ ${test.title}\n`;
      if (test.error) {
        // Strip ANSI codes and truncate error message if too long
        const cleanError = stripAnsi(test.error);
        const errorMsg = cleanError.split('\n')[0];
        const truncatedError =
          errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;
        summary += `  \`\`\`\n  ${truncatedError}\n  \`\`\`\n`;
      }
    });
    summary += '\n';
  }

  return summary;
}

/**
 * Generates markdown summary for accessibility reports in new rule-based format
 */
function generateAccessibilitySummary(accessibilityData) {
  if (!accessibilityData.hasReports) {
    return '';
  }

  let summary = '### ♿ Accessibility Reports\n\n';

  // No violations case
  if (!accessibilityData.hasViolations) {
    summary += '✅ **No accessibility violations detected across all devices/browsers!**\n\n';
    return summary;
  }

  // Violations found case
  summary += `⚠️ **Total Violation Rules**: ${accessibilityData.totalViolationRules}\n\n`;

  // Include SUMMARY.md content in collapsible section
  if (accessibilityData.summaryContent) {
    summary += `<details>\n`;
    summary += `<summary><strong>View Violations Summary</strong></summary>\n\n`;

    // Truncate summary if too long to avoid GitHub Actions argument limits
    const MAX_SUMMARY_SIZE = 8000;
    const truncatedSummary =
      accessibilityData.summaryContent.length > MAX_SUMMARY_SIZE
        ? accessibilityData.summaryContent.substring(0, MAX_SUMMARY_SIZE) +
          '\n\n... _(Summary truncated. Download the full accessibility report artifact for complete details.)_'
        : accessibilityData.summaryContent;

    summary += truncatedSummary + '\n';
    summary += `</details>\n\n`;
  }

  // List all rule files found
  if (accessibilityData.reports.length > 0) {
    summary += `**Individual Rule Reports** (${accessibilityData.reports.length} file${accessibilityData.reports.length > 1 ? 's' : ''}):\n`;
    accessibilityData.reports.forEach((report) => {
      summary += `- \`${report.file}\`\n`;
    });
    summary += `\n`;
  }

  summary += '\n_💡 Tip: Download the accessibility reports artifact for complete details._\n';

  return summary;
}

/**
 * Main function
 */
function main() {
  const testResults = parseTestResults();
  const accessibilityData = parseAccessibilityReports();

  // Combine summaries
  let summary = '';
  if (testResults) {
    summary += generateTestSummary(testResults);
  }
  if (accessibilityData.hasReports) {
    summary += generateAccessibilitySummary(accessibilityData);
  }

  const result = {
    hasReport: fs.existsSync(playwrightReportPath),
    testResults,
    accessibility: accessibilityData,
    summary,
  };

  // When run in GitHub Actions, write to output file
  if (process.env.GITHUB_OUTPUT) {
    const outputFile = process.env.GITHUB_OUTPUT;
    // Use base64 encoding to safely pass JSON through GitHub Actions
    const jsonBase64 = Buffer.from(JSON.stringify(result)).toString('base64');
    fs.appendFileSync(outputFile, `report=${jsonBase64}\n`);
    console.log('Report data written to GITHUB_OUTPUT');
  } else {
    // When run locally, output pretty JSON to console
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
