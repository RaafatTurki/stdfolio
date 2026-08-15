import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fullreload from 'vite-plugin-full-reload'

export default defineConfig({
  plugins: [
    sveltekit(),
    fullreload(['static/**/*', 'src/**/*'])
  ],
  build: {
    assetsInlineLimit: Infinity
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["raafat.io"],
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: ["raafat.io"],
  },
});
