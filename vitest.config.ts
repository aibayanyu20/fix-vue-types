import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      '**/__tests__/**/*.test.ts',
      '**/tests/**/*.test.ts',
      '**/__tests__/**/*.spec.ts',
    ],
    exclude: [
      '**/node_modules/**',
      'core-main',
    ],
  },
})
