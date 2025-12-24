import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as React from 'react';
// @ts-expect-error - act is not typed in react-dom/test-utils
import { act } from 'react-dom/test-utils';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// For React 19 compatibility with @testing-library/react
// React 19 moved act from React.act to react-dom/test-utils
// We need to polyfill it back to React.act for @testing-library/react
if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

// Polyfill React.act for @testing-library/react compatibility with React 19
if (!React.act) {
  // @ts-expect-error - we're adding act to React for compatibility
  React.act = act;
}
