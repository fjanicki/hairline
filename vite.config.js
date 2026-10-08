import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs: the same build works on GitHub Pages (/hairline/), from the release zip at any path,
  // and locally. Asset code resolves paths against import.meta.env.BASE_URL.
  base: './',
  // host: true also listens on the LAN, so other machines can open http://<this-ip>:5173.
  // .cache holds test builds and tool output; watching it made the dev server reload on every test build.
  server: { port: 5173, strictPort: true, host: true, watch: { ignored: ['**/.cache/**'] } },
  preview: { port: 4173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
