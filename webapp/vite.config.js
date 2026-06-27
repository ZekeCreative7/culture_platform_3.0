import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: [
      {
        find: /^(\.\.?\/.*)\.js\?v=.*$/,
        replacement: '$1.js'
      }
    ]
  }
});
