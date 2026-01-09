import * as fs from 'fs';
import * as path from 'path';
import type { Result as AxeResult, NodeResult } from 'axe-core';

/**
 * Global teardown for Playwright E2E tests.
 * Runs ONCE after all workers complete, merging violation JSON files
 * and generating rule-based accessibility reports.
 */

interface ViolationRecord {
  testName: string;
  suiteName: string;
  url: string;
  violations: AxeResult[];
  timestamp: number;
}

interface WorkerViolationData {
  projectName: string;
  timestamp: number;
  records: ViolationRecord[];
}

interface GroupedViolation {
  ruleId: string;
  help: string;
  description: string;
  impact: string;
  tags: string[];
  helpUrl: string;
  foundIn: Map<string, Set<string>>; // projectName -> Set of test contexts
  elements: Map<string, UniqueElement>;
}

interface UniqueElement {
  selector: string;
  html: string;
  failureSummary: string;
  fixes: string[];
  foundIn: Map<string, Set<string>>; // projectName -> Set of test contexts
}

async function globalTeardown() {
  const reportDir = path.join(
    process.cwd(),
    '..',
    '..',
    'accessibility-reports',
  );

  console.log('Global teardown: Processing accessibility reports...');

  if (!fs.existsSync(reportDir)) {
    console.log('No accessibility report directory found');
    return;
  }

  // Read all violation JSON files
  const files = fs.readdirSync(reportDir);
  const violationFiles = files.filter(
    (f) => f.startsWith('violations-') && f.endsWith('.json'),
  );

  if (violationFiles.length === 0) {
    console.log('No violation JSON files found');
    return;
  }

  console.log(`Found ${violationFiles.length} violation JSON files`);

  // Merge all violations across all workers/projects
  const allViolations: WorkerViolationData[] = [];
  for (const file of violationFiles) {
    const filePath = path.join(reportDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: WorkerViolationData = JSON.parse(content);
    allViolations.push(data);
  }

  // Group violations by rule ID across all devices/browsers
  const groupedByRule = new Map<string, GroupedViolation>();

  allViolations.forEach((workerData) => {
    const projectName = workerData.projectName;

    workerData.records.forEach((record) => {
      const testContext = `${record.suiteName}: ${record.testName}`;

      record.violations.forEach((violation) => {
        const ruleId = violation.id;

        if (!groupedByRule.has(ruleId)) {
          groupedByRule.set(ruleId, {
            ruleId,
            help: violation.help,
            description: violation.description,
            impact: violation.impact || 'unknown',
            tags: violation.tags,
            helpUrl: violation.helpUrl,
            foundIn: new Map(),
            elements: new Map(),
          });
        }

        const group = groupedByRule.get(ruleId)!;

        // Track which devices/browsers found this rule violation
        if (!group.foundIn.has(projectName)) {
          group.foundIn.set(projectName, new Set());
        }
        group.foundIn.get(projectName)!.add(testContext);

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
              foundIn: new Map(),
            });
          }

          const element = group.elements.get(selector)!;
          if (!element.foundIn.has(projectName)) {
            element.foundIn.set(projectName, new Set());
          }
          element.foundIn.get(projectName)!.add(testContext);
        });
      });
    });
  });

  // Generate reports
  if (groupedByRule.size === 0) {
    // No violations found - generate success report
    generateNoViolationsReport(reportDir, allViolations);
  } else {
    // Generate one report per rule
    generateRuleBasedReports(reportDir, groupedByRule);
  }

  // Clean up JSON files
  for (const file of violationFiles) {
    fs.unlinkSync(path.join(reportDir, file));
  }

  console.log('Global teardown complete');
}

/**
 * Generate a success report when no violations are found
 */
function generateNoViolationsReport(
  reportDir: string,
  allViolations: WorkerViolationData[],
): void {
  let report = `# Accessibility Report: No Violations Found\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `✅ **No accessibility violations detected across all devices/browsers!**\n\n`;

  // List all devices/browsers tested
  const projects = [...new Set(allViolations.map((v) => v.projectName))];
  report += `### Devices/Browsers Tested\n\n`;
  projects.forEach((project) => {
    const projectData = allViolations.find((v) => v.projectName === project);
    if (projectData) {
      const totalTests = projectData.records.length;
      report += `- **${formatProjectName(project)}**: ${totalTests} tests passed\n`;
    }
  });
  report += `\n`;

  // List all tests executed
  report += `### Tests Executed\n\n`;
  const uniqueTests = new Set<string>();
  allViolations.forEach((workerData) => {
    workerData.records.forEach((record) => {
      uniqueTests.add(`${record.suiteName}: ${record.testName}`);
    });
  });

  [...uniqueTests].sort().forEach((test) => {
    report += `- ${test}\n`;
  });

  fs.writeFileSync(path.join(reportDir, 'no-violations.md'), report, 'utf-8');
  console.log(`Generated: no-violations.md`);
}

/**
 * Generate one report per rule showing which devices have violations
 */
function generateRuleBasedReports(
  reportDir: string,
  groupedByRule: Map<string, GroupedViolation>,
): void {
  // Sort violations by priority
  const priorityOrder: Record<string, number> = {
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 3,
    unknown: 4,
  };

  const sortedViolations = [...groupedByRule.values()].sort(
    (a, b) =>
      (priorityOrder[a.impact.toLowerCase()] ?? 4) -
      (priorityOrder[b.impact.toLowerCase()] ?? 4),
  );

  sortedViolations.forEach((group) => {
    const filename = `${group.ruleId}.md`;
    const report = generateRuleReport(group);
    fs.writeFileSync(path.join(reportDir, filename), report, 'utf-8');
    console.log(`Generated: ${filename}`);
  });

  // Generate summary index
  generateSummaryIndex(reportDir, sortedViolations);
}

/**
 * Generate a report for a single rule
 */
function generateRuleReport(group: GroupedViolation): string {
  const priority = getPriority(group.impact);

  let report = `# ${group.help}\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n\n`;

  report += `| Property | Value |\n`;
  report += `|----------|-------|\n`;
  report += `| **Rule ID** | \`${group.ruleId}\` |\n`;
  report += `| **Priority** | ${priority} |\n`;
  report += `| **Impact** | ${group.impact.toUpperCase()} |\n`;
  report += `| **WCAG** | ${group.tags.filter((t) => t.startsWith('wcag')).join(', ')} |\n\n`;

  report += `**Description**: ${group.description}\n\n`;

  // Show which devices/browsers have this violation
  report += `## Devices/Browsers Affected\n\n`;
  [...group.foundIn.entries()].forEach(([projectName, tests]) => {
    report += `### ${formatProjectName(projectName)}\n\n`;
    report += `**Found in ${tests.size} test(s)**:\n`;
    [...tests].sort().forEach((test) => {
      report += `- ${test}\n`;
    });
    report += `\n`;
  });

  // Affected elements
  report += `## Affected Elements (${group.elements.size} unique)\n\n`;

  let elementIdx = 1;
  group.elements.forEach((element) => {
    report += `### Element ${elementIdx}\n\n`;
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

    // Show which devices found this element
    if (element.foundIn.size > 0) {
      report += `**Found in devices/browsers**:\n`;
      [...element.foundIn.entries()].forEach(([projectName, tests]) => {
        report += `- **${formatProjectName(projectName)}**: ${tests.size} test(s)\n`;
      });
      report += `\n`;
    }

    elementIdx++;
  });

  report += `\n[View Axe Documentation](${group.helpUrl})\n`;

  return report;
}

/**
 * Generate summary index of all violations
 */
function generateSummaryIndex(
  reportDir: string,
  violations: GroupedViolation[],
): void {
  let report = `# Accessibility Violations Summary\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n\n`;

  report += `## Overview\n\n`;
  report += `- **Total Violation Rules**: ${violations.length}\n`;

  const totalElements = violations.reduce(
    (sum, v) => sum + v.elements.size,
    0,
  );
  report += `- **Total Affected Elements**: ${totalElements}\n\n`;

  // Group by priority
  const byPriority: Record<string, GroupedViolation[]> = {
    'P1 - Critical': [],
    'P2 - High': [],
    'P3 - Medium': [],
    'P4 - Low': [],
  };

  violations.forEach((v) => {
    const priority = getPriority(v.impact);
    if (byPriority[priority]) {
      byPriority[priority].push(v);
    }
  });

  report += `## Violations by Priority\n\n`;

  Object.entries(byPriority).forEach(([priority, rules]) => {
    if (rules.length > 0) {
      report += `### ${priority} (${rules.length} rule${rules.length > 1 ? 's' : ''})\n\n`;
      rules.forEach((rule) => {
        const devices = [...rule.foundIn.keys()]
          .map((p) => formatProjectName(p))
          .join(', ');
        report += `- [${rule.help}](./${rule.ruleId}.md) - Found on: ${devices}\n`;
      });
      report += `\n`;
    }
  });

  fs.writeFileSync(path.join(reportDir, 'SUMMARY.md'), report, 'utf-8');
  console.log(`Generated: SUMMARY.md`);
}

/**
 * Format project name for display
 */
function formatProjectName(projectName: string): string {
  return projectName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

export default globalTeardown;
