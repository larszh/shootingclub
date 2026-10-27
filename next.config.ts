import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mariadb", "@prisma/adapter-mariadb"],
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
