# Testing Strategy & Coverage Requirements

## Overview

This project maintains a comprehensive testing strategy with both unit tests and end-to-end tests to ensure code quality and prevent regressions.

## Coverage Requirements

**Minimum Coverage Threshold: 80%**

All code contributions must maintain or improve the overall test coverage. The following metrics must meet the 80% threshold:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

Coverage thresholds are enforced automatically via:
1. **Local development**: Vitest will fail if coverage drops below 80%
2. **CI/CD**: GitHub Actions runs coverage checks on every pull request
3. **Branch protection**: PRs that reduce coverage below 80% should not be merged

## Running Tests

### Unit Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Run tests for specific package
npx nx test <package-name>
```

### End-to-End Tests
```bash
# Run e2e tests
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui

# Run e2e tests in debug mode
npm run test:e2e:debug

# Show e2e test report
npm run test:e2e:report
```

## Test Organization

### Unit Tests
Unit tests are co-located with source files using the following conventions:
- Component tests: `*.test.tsx`
- Logic tests: `*.test.ts`
- API route tests: `*.spec.ts`

### E2E Tests
E2E tests are located in `apps/uk-travel-history/e2e/` and test critical user flows:
- `happy-path.spec.ts`: Core user journeys
- `accessibility.spec.ts`: WCAG compliance (axe-core powered)
- `feature-gating.spec.ts`: Feature flag behavior

#### Accessibility Testing Details

The accessibility test suite (`accessibility.spec.ts`) uses Playwright + axe-core for automated WCAG compliance testing.

**Three-Phase Workflow:**

**Phase 1: Worker Execution**
- Each Playwright worker runs tests in parallel across devices/browsers
- Workers collect violations using the `runAxeAndCollect()` helper function
- Each worker writes intermediate JSON file: `violations-{projectName}-{timestamp}.json`
- JSON files contain raw violation data for merging

**Phase 2: Global Teardown** (`e2e/global-teardown.ts`)
- Runs ONCE after all workers complete
- Merges all worker JSON files
- Groups violations by rule ID (e.g., `color-contrast`, `button-name`)
- Generates final reports:
  - **Success case**: `no-violations.md` (lists all devices tested)
  - **Violations case**: `SUMMARY.md` + one file per rule (e.g., `color-contrast.md`)

**Phase 3: CI/CD Integration** (`tools/generate-e2e-report.js`)
- Parses final markdown reports
- Posts PR comments with violation summary
- Uploads artifacts for download via GitHub Actions

**Report Format** (rule-based, NOT device-based):

```
accessibility-reports/
├── SUMMARY.md              # Overview grouped by priority
├── color-contrast.md       # Shows which devices have this violation
├── button-name.md          # Shows which devices have this violation
└── aria-required-attr.md   # Shows which devices have this violation
```

Each rule file includes:
- Description, impact level, and WCAG tags
- **Devices affected** (e.g., "Chromium, Firefox, Mobile Chrome")
- Affected elements with CSS selectors and HTML snippets
- Fix suggestions from axe-core
- Links to axe documentation

**Working with Accessibility Tests:**

DO:
- Add new tests using `runAxeAndCollect()` helper (ensures proper reporting)
- Use `filterViolations` option to focus on specific rule types
- Test both landing and travel pages (full user journey)
- Follow existing test patterns for suite names and test names

DON'T:
- Generate per-worker markdown reports (use JSON intermediate format)
- Create duplicate reports for each device/browser
- Bypass the `runAxeAndCollect()` helper (violations won't be tracked)
- Modify global setup/teardown without understanding the full workflow

**Modifying Accessibility Infrastructure:**

If you need to change the accessibility testing system, update all three layers:

1. **Worker JSON output** (`accessibility.spec.ts`) - Data structure
2. **Global teardown parsing** (`global-teardown.ts`) - Merging logic
3. **Report aggregation** (`generate-e2e-report.js`) - CI/CD integration

Always test locally before pushing:
```bash
npm run test:e2e
# Check accessibility-reports/ directory for correct format
```

## Test Coverage by Package

Current coverage status:

| Package | Coverage | Status |
|---------|----------|--------|
| utils | 100% | ✅ Excellent |
| parser | 90.4% | ✅ Good |
| app | ~65% | ⚠️ Needs improvement |
| db | 47.2% | ❌ Below threshold |
| auth-server | 27.2% | ❌ Below threshold |

## Coverage Enforcement in CI

### GitHub Actions Workflow

The `.github/workflows/test-coverage.yml` workflow:
1. Runs on all pull requests to main/master
2. Executes `npm run test:coverage`
3. Uploads coverage reports to Codecov
4. **Fails the build if coverage drops below 80%**

### Branch Protection Rules

To prevent merges that reduce coverage:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Add rule for `master` (or `main`):
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select the `test-coverage` job as a required status check
3. Save changes

This ensures that:
- **No PR can be merged if it reduces coverage below 80%**
- **Coverage must always increase or stay the same**
- **Developers are notified immediately if their changes reduce coverage**

## Writing Effective Tests

### Best Practices

1. **Test behavior, not implementation**
   - Focus on what the code does, not how it does it
   - Avoid testing internal implementation details

2. **Aim for high value tests**
   - Prioritize testing critical business logic
   - Test edge cases and error scenarios
   - Ensure user-facing features are well covered

3. **Keep tests simple and focused**
   - One test should verify one behavior
   - Use descriptive test names that explain what is being tested

4. **Mock external dependencies**
   - Mock API calls, database connections, external services
   - Use factories for test data
   - Keep mocks simple and maintainable

### Example Test Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup test environment
    vi.clearAllMocks();
  });

  describe('Feature/Method', () => {
    it('should handle success case', () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error case', () => {
      // Test error scenarios
    });
  });
});
```

## Continuous Improvement

### Current Priorities

1. **Increase coverage for core packages**:
   - `db`: Add tests for database operations and RLS policies
   - `auth-server`: Test authentication flows and user management
   - `app`: Test UI components, hooks, and API routes

2. **Improve E2E coverage**:
   - Add tests for payment flows
   - Test data import/export features
   - Verify feature flag behavior

3. **Maintain high coverage**:
   - Review coverage reports regularly
   - Add tests for all new features
   - Refactor to improve testability

## Troubleshooting

### Coverage not meeting threshold

If tests pass but coverage is below 80%:
1. Run `npm run test:coverage` to see detailed coverage report
2. Check HTML report at `coverage/index.html`
3. Identify untested files/functions
4. Add tests for uncovered code paths

### Tests failing in CI but passing locally

1. Ensure all dependencies are installed: `npm ci`
2. Clear cache: `rm -rf node_modules && npm install`
3. Check for environment-specific issues
4. Review test logs in GitHub Actions

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright E2E Testing](https://playwright.dev/)
- [Nx Testing](https://nx.dev/recipes/testing)
