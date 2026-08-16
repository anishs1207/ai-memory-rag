import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const serverUrl = process.env.SERVER_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${serverUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${serverUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
