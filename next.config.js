/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Optimize for Vercel serverless
  output: 'standalone',
}

module.exports = nextConfig
