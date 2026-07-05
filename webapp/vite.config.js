import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const buildCommit = gitCommit();
const buildTime = new Date().toISOString();

function buildMetadataPlugin() {
  return {
    name: 'culture-platform-build-metadata',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>
    <meta name="culture-platform-build-commit" content="${buildCommit}" />
    <meta name="culture-platform-build-time" content="${buildTime}" />`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), buildMetadataPlugin()],
  root: '.',
  base: '/culture_platform_3.0/',
  define: {
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(buildCommit),
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(buildTime),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        survey: resolve(__dirname, 'survey.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom') || id.includes('node_modules/zustand')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
        },
      },
    },
  },
  server: {
    port: 4173,
  },
});
