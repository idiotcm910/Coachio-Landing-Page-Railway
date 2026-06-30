import { fileURLToPath } from 'node:url';
import path from 'node:path';

// __dirname không có sẵn trong ESM — dựng lại từ import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Standalone + tracing root về repo root để bundle workspace packages (@coachio/*)
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@coachio/design-system', '@coachio/api-client'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'khoahoc.coachio.ai',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'lovinbot-dev.b-cdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.coachio.ai',
        pathname: '/**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
