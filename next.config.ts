import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'effigy.im',
      },
    ],
  },
};

export default nextConfig;
