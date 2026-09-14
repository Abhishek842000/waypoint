import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@waypoint/shared-types"],
};

export default nextConfig;
