import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@clientloop/domain",
    "@clientloop/contracts",
    "@clientloop/ui-sdk"
  ]
};

export default nextConfig;
