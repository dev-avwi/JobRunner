import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  css: {
    postcss: {
      plugins: [
        (await import('tailwindcss')).default,
        (await import('autoprefixer')).default,
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
      '@shared/schema': path.resolve(import.meta.dirname, '..', '..', 'lib', 'db', 'src', 'schema', 'schema.ts'),
      '@shared/dateUtils': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-dateUtils.ts'),
      '@shared/displayName': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-displayName.ts'),
      '@shared/tradeCatalog': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-tradeCatalog.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: false,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
