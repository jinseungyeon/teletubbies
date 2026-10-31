import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One React tree for every screen; the dev server falls back to index.html so
// /office, /profile, /onboarding, /character and /login all boot the app.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  appType: 'spa',
});
