import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` liefert nur das Frontend aus. Damit die /api-Routen
    // funktionieren, parallel `npx wrangler dev` laufen lassen:
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
