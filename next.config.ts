import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* async rewrites() {
    return [
      {
        source: '/api/proxy/console/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ]
  }, */
  // allow ignore build errors
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
