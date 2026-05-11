import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    devtoolSegmentExplorer: false
  },
  transpilePackages: [
    "@clientloop/domain",
    "@clientloop/contracts",
    "@clientloop/ui-sdk"
  ]
};

export default nextConfig;
