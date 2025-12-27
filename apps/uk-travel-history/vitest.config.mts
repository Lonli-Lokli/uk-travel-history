import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
env: {
      NODE_ENV: 'test' as const
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'test/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@uth/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@uth/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@uth/features': path.resolve(__dirname, '../../packages/features/src'),
      '@uth/stores': path.resolve(__dirname, '../../packages/stores/src'),
      '@uth/widgets': path.resolve(__dirname, '../../packages/widgets/src'),
    },
  },
});
