/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Supports zero-downtime deploys: build into .next-staging, then atomically swap to .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};
module.exports = nextConfig;
