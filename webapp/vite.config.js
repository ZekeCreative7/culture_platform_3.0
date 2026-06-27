import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/culture_platform_3.0/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4173,
  },
});
