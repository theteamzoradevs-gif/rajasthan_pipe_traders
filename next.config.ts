import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 3600,
    // Optional remote media when `NEXT_PUBLIC_API_BASE_URL` points off-site (see app/lib/api/baseUrl.ts).
    remotePatterns: [
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },

  experimental: {
    // Tree-shake these large packages so only used exports are bundled
    optimizePackageImports: ["react", "react-dom"],
  },
};

export default nextConfig;
