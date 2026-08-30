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
      // NOTE: only use `import type` from @shared/schema in frontend code — runtime
      // imports pull the full drizzle schema (+drizzle-orm+zod, ~240 kB min) into the
      // page chunk. Runtime constants live in dependency-free modules below
      // (@shared/permissions, @shared/pricing, @shared/safety-forms).
      '@shared/schema': path.resolve(import.meta.dirname, '..', '..', 'lib', 'db', 'src', 'schema', 'schema.ts'),
      '@shared/permissions': path.resolve(import.meta.dirname, '..', '..', 'lib', 'db', 'src', 'schema', 'permissions.ts'),
      '@shared/pricing': path.resolve(import.meta.dirname, '..', '..', 'lib', 'db', 'src', 'schema', 'pricing.ts'),
      '@shared/safety-forms': path.resolve(import.meta.dirname, '..', '..', 'lib', 'db', 'src', 'schema', 'safety-forms.ts'),
      '@shared/dateUtils': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-dateUtils.ts'),
      '@shared/displayName': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-displayName.ts'),
      '@shared/tradeCatalog': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-tradeCatalog.ts'),
      '@shared/financials': path.resolve(import.meta.dirname, 'src', 'lib', 'shared-financials.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split the largest always-loaded vendors out of the entry chunk so
        // they download in parallel and stay cached across app deploys.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(react|react-dom|scheduler|wouter)\//.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'vendor-motion';
          }
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (
            id.includes('@radix-ui') ||
            id.includes('@floating-ui') ||
            id.includes('lucide-react') ||
            id.includes('cmdk') ||
            id.includes('tailwind-merge') ||
            id.includes('class-variance-authority') ||
            id.includes('clsx')
          ) {
            return 'vendor-ui';
          }
          return undefined;
        },
      },
    },
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
