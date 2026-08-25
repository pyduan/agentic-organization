import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// The one parser lives at the repo root (lib/todo.mjs) and is shared by the
// dashboard, the Worker and this app. Aliased rather than copied: a second
// implementation is how the format quietly forks.
const kit = fileURLToPath(new URL('../../lib/', import.meta.url));
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  // Static shell, hydrated island. The list is never baked at build time: it is
  // fetched from the Worker, so a commit shows up without a rebuild.
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwind()],
    resolve: { alias: { '@kit': kit } },
    server: {
      fs: { allow: ['..', kit] },
      // In `astro dev`, the API is the local filesystem server, so the app is
      // testable with no GitHub token and no commits: npm run todos:dev
      proxy: { '/api': 'http://127.0.0.1:8788' },
    },
  },
});
