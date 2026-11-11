import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@node-rs/argon2",
    "postgres",
    "ioredis",
    "bullmq",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;