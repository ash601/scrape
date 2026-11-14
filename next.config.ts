import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Your data folder (my-scrapes/) is read at runtime, never bundled.
  outputFileTracingExcludes: { "*": ["./my-scrapes/**"] },
};

export default nextConfig;
