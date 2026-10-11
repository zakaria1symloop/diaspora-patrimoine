import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

// Development only: Next refuses its dev resources (hot reload, the dev-tools button, the error overlay) to any origin
// other than localhost. Other developers open the site through this machine's network address, so those hosts are
// allowed: this machine's own IPv4 addresses, the private ranges, and anything listed in DEV_ALLOWED_ORIGINS
// (comma-separated host names). Has no effect on a production build.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a): a is NonNullable<typeof a> => Boolean(a) && a!.family === 'IPv4' && !a!.internal)
  .map((a) => a.address);
const allowedDevOrigins = [
  ...lanAddresses,
  '192.168.*.*',
  '10.*.*.*',
  '172.*.*.*',
  '*.local',
  ...(process.env.DEV_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
];

// BO-001 — the back office is its own application, on its own host (D-051), never indexed.
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins,
  transpilePackages: ['@dp/ui'],
  trailingSlash: false,
  async rewrites() {
    // Browser → API through the back office's own origin: the API's HttpOnly cookies belong to this host (API-003),
    // and the `Origin` of a write is ADMIN_URL, which gives the STAFF audience.
    return [
      { source: '/api/v1/:path*', destination: `${API_URL}/api/v1/:path*` },
      // local development: the public images, served by the API, through this origin (see mediaUrlOf in the API)
      { source: '/media-files/:path*', destination: `${API_URL}/media-files/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default config;
