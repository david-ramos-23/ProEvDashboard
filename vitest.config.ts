import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate from vite.config.ts (which pulls in @vitejs/plugin-react, unneeded for
// pure-logic unit tests). Shares only the '@' alias so imports stay consistent
// with the rest of the codebase.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
