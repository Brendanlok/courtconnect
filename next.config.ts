import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    turbo: {
      root: __dirname,
    },
  } as Record<string, unknown>,
};

export default nextConfig;
