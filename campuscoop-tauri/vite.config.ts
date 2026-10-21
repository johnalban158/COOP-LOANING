import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tauri': path.resolve(__dirname, '../src-tauri/src'),
    },
  },
  build: {
    outDir: '../src-tauri/gen',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
