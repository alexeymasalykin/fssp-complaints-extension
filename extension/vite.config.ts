import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { cpSync } from 'fs';
import manifest from './src/manifest.json';

// Плагин для копирования _locales в dist (crxjs не делает это автоматически)
function copyLocales() {
  return {
    name: 'copy-locales',
    closeBundle() {
      cpSync(
        resolve(__dirname, 'src/_locales'),
        resolve(__dirname, 'dist/_locales'),
        { recursive: true }
      );
    },
  };
}

export default defineConfig({
  plugins: [
    crx({ manifest }),
    copyLocales(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        results: resolve(__dirname, 'src/results/result.html'),
      },
    },
  },
});
