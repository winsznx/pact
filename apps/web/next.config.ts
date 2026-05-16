import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // wagmi/viem ship CJS + ESM; pnpm hoisting + Next.js bundling
  // sometimes tangles them. transpilePackages keeps it deterministic.
  transpilePackages: ["@pact/shared"],
};

export default config;
