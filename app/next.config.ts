import path from 'node:path';
import type { NextConfig } from 'next';

/*
 * Environment variables live in `app/.env.local`, beside this file.
 *
 * Not at the repository root: the proxy runs in an isolated Edge runtime that
 * only receives variables Next collected itself at startup, so a root env file
 * loaded from this config reaches Server Components but never the proxy, and
 * auth fails on every request. Keeping the file where Next looks for it is the
 * one placement that works for both.
 */

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['172.16.16.202'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  /* The repository root, one level up. `@proven/engine` is a workspace package
     symlinked from `packages/engine`, which lives outside this directory:
     without this, Turbopack stops at the app folder and cannot resolve it. */
  turbopack: {
    root: path.join(import.meta.dirname, '..'),
  },
  /* `@proven/engine` is consumed as built output from its own `dist/`, not
     transpiled from source here: it is plain ES2022 with no JSX and no Next
     specifics, and building it once keeps the app build and the engine's own
     `npm test` honest about the same artefact. `npm run build` in the repo
     root builds the engine first. */

  /* Security: Disable debug endpoints in production */
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      // Exclude debug routes from production build
      config.externals = config.externals || [];
      config.externals.push(
        (
          _context: string,
          request: string,
          callback: (error?: Error | null, result?: string) => void,
        ) => {
          if (request?.includes('app/api/debug')) {
            return callback(null, 'commonjs false');
          }
          callback();
        },
      );
    }
    return config;
  },
};

export default nextConfig;
