import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const srcRoot = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
        pretendToBeVisual: true,
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/types.ts',
        'src/generated/**',
        'src/app/icon.svg',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/interface-adapters/react/hooks/useFaceMeshTracker.ts',
      ],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 80,
        'src/usecases/**': {
          lines: 95,
          statements: 95,
          branches: 95,
          functions: 95,
        },
        'src/infrastructure/**': {
          lines: 95,
          statements: 95,
          branches: 95,
          functions: 95,
        },
        'src/domain/recommendations.ts': {
          lines: 95,
          statements: 95,
          branches: 95,
          functions: 95,
        },
      },
    },
  },
});
