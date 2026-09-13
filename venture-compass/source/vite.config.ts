import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: { tabster: 'tabster/dist/esm/index.js' },
    server: { deps: { inline: [/@fluentui/] } },
  },
});
