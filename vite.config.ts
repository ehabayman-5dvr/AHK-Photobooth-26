import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Direct credential access is limited to the user's local browser trials.
  // Production Electron builds get their credentials through the main-process bridge.
  envPrefix: command === 'serve' ? 'VITE_' : [],
  plugins: [react(), {
    name: 'local-browser-trial-csp',
    transformIndexHtml(html, context) {
      if (!context.server) return html;
      return html.replace("connect-src 'self' ws://127.0.0.1:5173;", "connect-src 'self' ws://127.0.0.1:5173 https://api.openai.com https://generativelanguage.googleapis.com https://api.cloudinary.com https://ai-photobooth-dashboard-brown.vercel.app;");
    },
  }], base: './', server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist' },
}));
