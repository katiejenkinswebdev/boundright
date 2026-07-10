import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Logo uploads go through a server action; PDFs never do (signed URLs).
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
