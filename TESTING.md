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
- `accessibility.spec.ts`: WCAG compliance
- `feature-gating.spec.ts`: Feature flag behavior

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
