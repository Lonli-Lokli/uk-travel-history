#!/usr/bin/env node

/**
 * Check Git configuration for cross-platform development
 *
 * This script verifies that Windows developers have configured Git's
 * core.autocrlf setting to ensure proper line ending handling.
 *
 * Background:
 * - Repository uses .gitattributes to enforce LF line endings
 * - Windows developers need core.autocrlf=true to work with CRLF locally
 * - Without this setting, they'll commit CRLF which breaks CI checks
 *
 * This check runs on npm install to catch configuration issues early.
 */

const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const isWindows = platform === 'win32';

// Skip check on non-Windows platforms and in CI environments
if (!isWindows || process.env.CI) {
  process.exit(0);
}

console.log('🔍 Checking Git configuration for Windows development...\n');

try {
  // Check if git is available
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch (error) {
    console.warn('⚠️  Git not found in PATH. Skipping configuration check.');
    process.exit(0);
  }

  // Check core.autocrlf setting
  let autocrlf;
  try {
    autocrlf = execSync('git config --get core.autocrlf', {
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    // core.autocrlf not set
    autocrlf = '';
  }

  if (autocrlf !== 'true') {
    console.error('❌ Git configuration issue detected!\n');
    console.error('Your Git is not configured for cross-platform development.');
    console.error(
      'This will cause line ending issues and break CI checks.\n'
    );
    console.error('Please run this command to fix:\n');
    console.error('  git config --global core.autocrlf true\n');
    console.error('Why this is needed:');
    console.error(
      '  • This repository uses LF line endings (Linux/Mac style)'
    );
    console.error(
      '  • Windows uses CRLF line endings (\\r\\n) by default'
    );
    console.error(
      '  • core.autocrlf=true converts CRLF → LF on commit (required)'
    );
    console.error(
      '  • You can still work with CRLF locally (Git auto-converts)\n'
    );
    console.error(
      'For more information, see the "Git Configuration" section in README.md\n'
    );

    // Exit with error to fail npm install
    process.exit(1);
  }

  console.log('✅ Git configuration is correct (core.autocrlf=true)\n');
  process.exit(0);
} catch (error) {
  console.error('⚠️  Error checking Git configuration:', error.message);
  console.error('Continuing anyway...\n');
  process.exit(0);
}
