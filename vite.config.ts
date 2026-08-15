import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `vite preview` applies its SPA fallback before looking for a directory index,
 * so /faq would serve the home document even though dist/faq/index.html exists.
 * Static hosts (Vercel, Netlify, Cloudflare Pages) check the filesystem first.
 * This makes local preview behave the same way, so the prerendered output is
 * actually verifiable before deploying.
 */
function servePrerendered(): PluginOption {
  return {
    name: 'keytopia-serve-prerendered',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '/').split('?')[0];
        if (path !== '/' && !path.includes('.')) {
          const file = join(process.cwd(), 'dist', path.replace(/\/$/, ''), 'index.html');
          if (existsSync(file)) req.url = `${path.replace(/\/$/, '')}/index.html`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servePrerendered()],
  // strictPort: one dev server per machine, always on 50675. If the port is
  // taken, a second `npm run dev` fails fast instead of silently starting a
  // duplicate on the next free port — attach to the running one instead.
  server: { port: Number(process.env.PORT) || 50675, strictPort: true },
  preview: { port: Number(process.env.PORT) || 4173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1800,
  },
});
